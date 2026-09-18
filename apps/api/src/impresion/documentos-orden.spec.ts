import { PDFDocument } from 'pdf-lib';
import { DocumentosOrdenService } from './documentos-orden.service';
import { planDocumento, siguienteEstado } from './documentos-orden.domain';
import { calcularHojas } from '../centro-copiado/adaptador';
import type { PrismaService } from '../prisma/prisma.service';
import type { ArchivosService } from '../archivos/archivos.service';
import type { ImpresionService } from './impresion.service';
import type { CurrentAuth } from '../auth/auth.types';

const auth = {
  tenantId: 'tenant-a',
  userId: 'user-a',
  email: 'operario@test.local',
} as CurrentAuth;
const meta = {
  nombre: 'Documento',
  paginas: 3,
  copias: 2,
  tamano: 'A4',
  color: 'BN',
  faz: 2,
  hojas: 4,
  papelMateriaPrimaId: 'papel',
  gramaje: 75,
};
const job = (value: object = meta) => ({ _centroCopiado: value });

describe('plan de impresión cotizado', () => {
  it('cada copia impar comienza en un frente, tanto al cotizar como al imprimir', () => {
    expect(calcularHojas(3, 2, 2)).toEqual({ carillas: 6, hojas: 4 });
    expect(calcularHojas(3, 3, 2)).toEqual({ carillas: 9, hojas: 6 });
    expect(calcularHojas(3, 2, 1)).toEqual({ carillas: 6, hojas: 6 });
    expect(planDocumento(job())).toMatchObject({
      copias: 2,
      faz: 2,
      hojas: 4,
      motivo: null,
    });
    expect(planDocumento(job({ ...meta, hojas: 3 }))?.motivo).toMatch(
      /Volvé a cotizar/,
    );
  });
  it.each([
    { color: 'COLOR' },
    { tamano: 'A3' },
    { copias: 0 },
    { paginas: 0 },
    { copias: 1.5 },
  ])('excluye documentos incompatibles: %o', (cambios) => {
    expect(planDocumento(job({ ...meta, ...cambios }))?.motivo).toBeTruthy();
  });
  it('no degrada finales con ACK ni DELETED tardíos', () => {
    expect(siguienteEstado('COMPLETE', 'DELETED')).toBe('COMPLETE');
    expect(siguienteEstado('PRINTING', 'ENVIADO')).toBe('PRINTING');
    expect(siguienteEstado('PREPARADO', 'SIN_CONFIRMAR')).toBe('SIN_CONFIRMAR');
    expect(siguienteEstado('ENVIADO', 'DELETED')).toBe('DELETED');
  });
});

describe('envíos de documentos de una OT', () => {
  async function fixture() {
    const pdf = await PDFDocument.create();
    for (let n = 0; n < 3; n++) pdf.addPage([595.276, 841.89]);
    const bytes = Buffer.from(await pdf.save());
    const orden = {
      id: 'orden',
      numero: 'OT-TEST',
      estado: 'pendiente',
      updatedAt: new Date('2026-09-18'),
      items: [
        {
          id: 'item',
          contieneLotesEntrega: false,
          jobContextSnapshotJson: job(),
          cotizacionItem: null,
          archivos: [
            {
              id: 'archivo',
              nombreOriginal: 'original.pdf',
              mimeType: 'application/pdf',
              bytes: BigInt(bytes.length),
              key: 'tenant-a/original.pdf',
            },
          ],
        },
      ],
    };
    const crear = jest.fn().mockResolvedValue({});
    const buscarEvento = jest.fn().mockResolvedValue(null);
    const actualizarEvento = jest.fn().mockResolvedValue({});
    const buscarOrden = jest.fn().mockResolvedValue(orden);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'orden' }]),
      ordenTrabajo: { findFirst: buscarOrden },
      ordenTrabajoEvento: {
        findFirst: buscarEvento,
        create: crear,
        update: actualizarEvento,
      },
    };
    const prisma = {
      ...tx,
      ordenTrabajoEvento: {
        ...tx.ordenTrabajoEvento,
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: async (fn: (client: typeof tx) => unknown) => await fn(tx),
    };
    const leer = jest.fn().mockResolvedValue(bytes);
    const firmar = jest
      .fn()
      .mockReturnValue({ hash: 'hash', firma: 'firma', timestamp: 1 });
    const servicio = new DocumentosOrdenService(
      prisma as unknown as PrismaService,
      { leerContenido: leer } as unknown as ArchivosService,
      { firmarDocumento: firmar } as unknown as ImpresionService,
    );
    const preparar = (anterior?: string) =>
      servicio.preparar(
        auth,
        'orden',
        'item',
        'intento',
        'RICOH',
        'localhost',
        anterior,
      );
    return {
      servicio,
      preparar,
      orden,
      crear,
      buscarEvento,
      actualizarEvento,
      buscarOrden,
      leer,
      firmar,
      tx,
      bytes,
    };
  }
  it('deriva el PDF, copias y faz del snapshot, con reserva auditable antes de responder', async () => {
    const f = await fixture();
    const r = await f.preparar();
    expect(r.params.options).toMatchObject({
      copies: 2,
      duplex: 'long-edge',
      colorType: 'grayscale',
    });
    expect(r.params.data[0].data).toBe(f.bytes.toString('base64'));
    const creacion = (f.crear.mock.calls as unknown[][])[0][0] as {
      data: Record<string, unknown>;
    };
    expect(creacion.data).toMatchObject({
      tenantId: auth.tenantId,
      ordenId: 'orden',
      usuarioId: auth.userId,
      datosJson: { archivos: ['archivo'], estado: 'PREPARADO' },
    });
    const consulta = (f.buscarOrden.mock.calls as unknown[][])[0][0] as {
      where: Record<string, unknown>;
    };
    expect(consulta.where).toEqual({ id: 'orden', tenantId: auth.tenantId });
    expect(f.leer).toHaveBeenCalledTimes(1);
  });
  it.each(['borrador', 'cancelada'])(
    'rechaza una OT %s sin leer sus archivos',
    async (estado) => {
      const f = await fixture();
      f.orden.estado = estado;
      await expect(f.preparar()).rejects.toThrow('emití');
      expect(f.leer).not.toHaveBeenCalled();
    },
  );
  it('rechaza un tenant ajeno antes de leer/firmar', async () => {
    const f = await fixture();
    f.buscarOrden.mockResolvedValue(null);
    await expect(f.preparar()).rejects.toThrow('no encontrada');
    expect(f.firmar).not.toHaveBeenCalled();
  });
  it('requiere reimpresión explícita de la última versión; no entrega otra firma ante repetición', async () => {
    const f = await fixture();
    f.buscarEvento
      .mockResolvedValueOnce({ id: 'previo' })
      .mockResolvedValueOnce(null);
    await expect(f.preparar()).rejects.toThrow('ya tiene un envío');
    expect(f.crear).not.toHaveBeenCalled();
    f.buscarEvento
      .mockResolvedValueOnce({ id: 'previo' })
      .mockResolvedValueOnce(null);
    await expect(f.preparar('previo')).resolves.toHaveProperty(
      'intento.id',
      'intento',
    );
    f.buscarEvento.mockResolvedValue({ id: 'intento' });
    await expect(f.preparar('intento')).rejects.toThrow('ya tiene un envío');
    expect(f.crear).toHaveBeenCalledTimes(1);
  });
  it('no firma si las páginas reales no coinciden, el archivo falta o es inválido', async () => {
    const f = await fixture();
    f.orden.items[0].jobContextSnapshotJson = job({ ...meta, paginas: 4 });
    await expect(f.preparar()).rejects.toThrow('páginas');
    f.leer.mockResolvedValue(null);
    await expect(f.preparar()).rejects.toThrow('disponible');
    expect(f.firmar).not.toHaveBeenCalled();
  });
  it('el rechazo de una firma no reserva un envío', async () => {
    const f = await fixture();
    f.firmar.mockImplementation(() => {
      throw new Error('certificado');
    });
    await expect(f.preparar()).rejects.toThrow('certificado');
    expect(f.crear).not.toHaveBeenCalled();
  });
  it('conserva el orden de los originales de un tomo y separa los impares a doble faz', async () => {
    const f = await fixture();
    const item = f.orden.items[0];
    item.archivos.push({
      ...item.archivos[0],
      id: 'archivo-2',
      nombreOriginal: 'segundo.pdf',
      key: 'tenant-a/segundo.pdf',
    });
    item.jobContextSnapshotJson = job({
      esTomo: true,
      tomoNombre: 'Tomo',
      juegos: 2,
      hojas: 8,
      segmentos: [
        { ...meta, archivoNombre: 'original.pdf' },
        { ...meta, archivoNombre: 'segundo.pdf' },
      ],
    });
    const r = await f.preparar();
    const pdf = await PDFDocument.load(
      Buffer.from(r.params.data[0].data, 'base64'),
    );
    expect(pdf.getPageCount()).toBe(8);
    expect(r.params.options).toMatchObject({ copies: 2, duplex: 'long-edge' });
    expect(r.intento.archivos).toEqual(['archivo', 'archivo-2']);
    expect(f.leer.mock.calls).toEqual([
      ['tenant-a/original.pdf'],
      ['tenant-a/segundo.pdf'],
    ]);
  });
  it('los estados pertenecen al usuario y tenant del envío, sin modificar producción', async () => {
    const f = await fixture();
    f.buscarEvento.mockResolvedValue({
      id: 'intento',
      datosJson: { estado: 'COMPLETE', eventos: [] },
      fecha: new Date(),
      usuarioNombre: 'Operario',
    });
    const r = await f.servicio.estado(
      auth,
      'orden',
      'intento',
      'DELETED',
      'Retirado',
    );
    expect(r.estado).toBe('COMPLETE');
    const consulta = (f.buscarEvento.mock.calls as unknown[][])[0][0] as {
      where: Record<string, unknown>;
    };
    expect(consulta.where).toMatchObject({
      tenantId: auth.tenantId,
      usuarioId: auth.userId,
      ordenId: 'orden',
    });
  });
});
