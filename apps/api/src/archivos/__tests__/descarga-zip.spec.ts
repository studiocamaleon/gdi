import { Readable } from 'node:stream';
import { unzipSync } from 'fflate';
import {
  crearZipStream,
  nombreSeguroZip,
  validarPaqueteZip,
  MAX_ZIP_BYTES,
} from '../descarga-zip';
import { ArchivosService } from '../archivos.service';

async function bytes(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

it('produce un ZIP recuperable con archivos binarios completos y nombres repetidos', async () => {
  const originales = [
    Buffer.from('%PDF-ficticio'),
    Buffer.from([0, 255, 1, 128]),
  ];
  const entradas = originales.map((b, i) => ({
    key: String(i),
    nombre: `producto-1/00${i + 1}_arte.pdf`,
    bytes: b.length,
  }));
  const zip = await bytes(
    crearZipStream(entradas, {
      abrirLectura: async (key) =>
        Readable.from([
          originales[+key].subarray(0, 2),
          originales[+key].subarray(2),
        ]),
    }),
  );
  const extraidos = unzipSync(zip);
  entradas.forEach((e, i) =>
    expect(Buffer.from(extraidos[e.nombre])).toEqual(originales[i]),
  );
});

it.each([null, Buffer.from('corto'), Buffer.from('archivo mucho más largo')])(
  'aborta si falta un archivo o sus bytes no coinciden',
  async (contenido) => {
    await expect(
      bytes(
        crearZipStream([{ key: '1', nombre: 'arte.pdf', bytes: 10 }], {
          abrirLectura: async () =>
            contenido ? Readable.from([contenido]) : null,
        }),
      ),
    ).rejects.toThrow();
  },
);

it('cierra la lectura cuando se cancela la descarga', async () => {
  const origen = Readable.from(
    (async function* () {
      for (let i = 0; i < 10000; i++) yield Buffer.alloc(65536);
    })(),
  );
  const zip = crearZipStream(
    [{ key: '1', nombre: 'arte.pdf', bytes: 65536 * 10000 }],
    { abrirLectura: async () => origen },
  );
  for await (const chunk of zip) {
    expect(chunk.length).toBeGreaterThan(0);
    break;
  }
  await new Promise((resolve) =>
    zip.closed ? resolve(null) : zip.once('close', resolve),
  );
  expect(origen.destroyed).toBe(true);
});

it('rechaza paquetes vacíos o fuera del límite ZIP32 y limpia rutas de nombres', () => {
  expect(() => validarPaqueteZip([])).toThrow('No hay archivos');
  expect(() =>
    validarPaqueteZip([{ key: '1', nombre: 'arte', bytes: MAX_ZIP_BYTES + 1 }]),
  ).toThrow('2 GB');
  expect(nombreSeguroZip('../../fuera\\arte.pdf')).not.toMatch(/[\\/]|\.\./);
});

function fixture() {
  const prisma = {
    ordenTrabajo: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ numero: 'OT-DEMO', items: [{ id: 'i1' }] }),
    },
    ordenTrabajoItem: {
      findFirst: jest.fn().mockResolvedValue({ id: 'i1', nombre: 'Producto', ordenId: 'ot1' }),
    },
    archivo: {
      findMany: jest.fn().mockResolvedValue([
        {
          key: 'privado/1',
          nombreOriginal: '../../Arte.pdf',
          bytes: 3n,
          ordenItemId: null,
        },
        {
          key: 'privado/2',
          nombreOriginal: 'Arte.pdf',
          bytes: 3n,
          ordenItemId: 'i1',
        },
      ]),
    },
  };
  return {
    prisma,
    service: new ArchivosService(
      prisma as never,
      {
        abrirLectura: async () => Readable.from([Buffer.from('PDF')]),
      } as never,
      {} as never,
    ),
  };
}

it('limita el paquete a archivos listos de esa empresa y orden; conserva carpetas y no incluye papelera ni PDF del sistema', async () => {
  const { service, prisma } = fixture();
  const r = await service.prepararDescargaZip('empresa-a', { ordenId: 'ot1' });
  expect(prisma.ordenTrabajo.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'ot1', tenantId: 'empresa-a' } }),
  );
  expect(prisma.archivo.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        tenantId: 'empresa-a',
        estado: 'LISTO',
        generado: false,
        OR: [
          { ordenId: 'ot1', scope: 'ORDEN' },
          { ordenItemId: { in: ['i1'] }, scope: 'ORDEN_ITEM' },
        ],
      },
    }),
  );
  expect(Object.keys(unzipSync(await bytes(r.stream())))).toEqual([
    'orden/001_____Arte.pdf',
    'producto-1/002_Arte.pdf',
  ]);
});

it('la descarga de operación diaria incluye los generales y sólo el ítem solicitado', async () => {
  const { service, prisma } = fixture();
  await service.prepararDescargaZip('empresa-a', { itemId: 'i1' });
  expect(prisma.ordenTrabajoItem.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'i1', tenantId: 'empresa-a' } }),
  );
  expect(prisma.archivo.findMany.mock.calls[0][0].where.OR).toEqual([
    { ordenId: 'ot1', scope: 'ORDEN' },
    { ordenItemId: { in: ['i1'] }, scope: 'ORDEN_ITEM' },
  ]);
});

it.each(['orden', 'item'])(
  'no consulta ni lee archivos de una %s ajena',
  async (tipo) => {
    const { service, prisma } = fixture();
    prisma.ordenTrabajo.findFirst.mockResolvedValue(null);
    prisma.ordenTrabajoItem.findFirst.mockResolvedValue(null);
    await expect(
      service.prepararDescargaZip(
        'empresa-b',
        tipo === 'orden' ? { ordenId: 'ajena' } : { itemId: 'ajeno' },
      ),
    ).rejects.toThrow('no encontrad');
    expect(prisma.archivo.findMany).not.toHaveBeenCalled();
  },
);
