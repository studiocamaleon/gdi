import { Prisma } from '@prisma/client';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { CentroCopiadoService } from '../centro-copiado.service';
import type { DocumentoInput } from '../adaptador';
import {
  exigirMismoTrabajo,
  solicitudDesdeSnapshot,
} from '../pedidos/snapshot-pedido';

const papel = '10000000-0000-4000-8000-000000000001';
const contexto = {
  productoId: 'impresion-ficticia',
  rutaAlternativaId: 'ruta-ficticia',
  configPasoId: 'impresion',
  maquinaColorId: 'laser-color',
  maquinaBnId: 'laser-bn',
  cobraSetup: false,
  papeles: [
    {
      materiaPrimaId: papel,
      nombre: 'Papel ficticio',
      gramajes: [80],
      variantes: [
        {
          id: 'papel-a4',
          formatoComercial: 'A4',
          anchoMm: 210,
          altoMm: 297,
          gramajeGr: 80,
        },
      ],
    },
  ],
  anilladoConfigPasoId: 'anillado',
  anillos: [
    { tipoAnillo: 'ESPIRAL_PLASTICO', diametroMm: 20, capacidadMaxHojas: 150 },
  ],
  tiposAnilloPermitidos: ['ESPIRAL_PLASTICO'],
  tapas: [],
  tapaFrontalMpId: null,
  tapaContratapaMpId: null,
};
const motor = new MotorUniversalService({} as never, {} as never, {} as never);
const persistir = motor['buildCotizacionItemData'].bind(motor);

async function preparar(copias: number, faz: 1 | 2, anillado = true) {
  const doc: DocumentoInput = {
    id: 'documento-ficticio',
    nombre: 'Manual ficticio.pdf',
    paginas: 25,
    copias,
    tamano: 'A4',
    tamanoAnchoMm: 210,
    tamanoAltoMm: 297,
    papelMateriaPrimaId: papel,
    gramaje: 80,
    color: 'BN',
    faz,
    terminaciones: anillado ? ['Anillado'] : [],
    tipoAnillo: 'ESPIRAL_PLASTICO',
  };
  const hojas = Math.ceil(doc.paginas / faz) * copias;
  // El costeador sigue midiendo hojas; únicamente se simulan sus importes.
  const cotizacion = {
    cantidadPedida: hojas,
    cantidadEfectiva: hojas,
    cantidadComercialReal: hojas,
    cantidadComercialPricing: hojas,
    unidadComercialPricing: 'hojas',
    pasos: [],
    costos: { total: 1000 * copias, unitario: (1000 * copias) / hojas },
    desglosePrecio: {
      precioNetoTotal: 2000 * copias,
      precioBrutoTotal: 2420 * copias,
      precioNetoUnitario: (2000 * copias) / hojas,
      precioBrutoUnitario: (2420 * copias) / hojas,
      descuento: { montoTotal: 0 },
    },
  };
  const service = new CentroCopiadoService(
    {} as never,
    {
      cotizar: jest.fn().mockResolvedValue({ exitoso: true, cotizacion }),
    } as never,
  );
  const construir = (d: DocumentoInput) =>
    service['construirDocumento'](
      'empresa-ficticia',
      d,
      contexto,
      undefined,
      '20000000-0000-4000-8000-000000000001',
      null,
    );
  const inicial = await construir(doc);
  expect(inicial.error).toBeNull();
  const args = {
    tenantId: 'empresa-ficticia',
    cotizacionId: 'cotizacion-ficticia',
    productoId: contexto.productoId,
    jobContext: inicial.jobContext,
    producto: {
      productoId: contexto.productoId,
      unidadComercial: 'hojas',
      pasos: [],
    },
    cotizacion,
    inputHash: 'ensayo',
    periodo: '2026-10',
  } as unknown as Parameters<typeof persistir>[0];
  const data = persistir(args);
  const original = {
    id: '30000000-0000-4000-8000-000000000001',
    productoId: contexto.productoId,
    cantidad: new Prisma.Decimal(data.cantidad),
    jobContextJson: data.jobContextJson as Prisma.JsonObject,
    snapshotJson: data.snapshotJson as Prisma.JsonObject,
  };
  const reconstruir = async (item = original) => {
    const solicitud = solicitudDesdeSnapshot(item, null);
    return construir(solicitud.documentos[0] as DocumentoInput);
  };
  return { hojas, inicial, data, original, reconstruir, args };
}

it.each(
  [1, 2, 5].flatMap((copias) =>
    ([1, 2] as const).map((faz) => ({ copias, faz })),
  ),
)(
  'guarda y reconstruye $copias libros a $faz caras sin confundirlos con hojas',
  async ({ copias, faz }) => {
    const f = await preparar(copias, faz);
    const reconstruido = await f.reconstruir();
    // Antes de la corrección este paso dispara el mismo error que bloquea la OT.
    expect(() => exigirMismoTrabajo(f.original, reconstruido)).not.toThrow();
    expect(f.data.cantidad).toBe(String(copias));
    expect(f.original.jobContextJson.cantidad).toBe(f.hojas);
    expect(f.data).toMatchObject({
      costoUnitario: '1000',
      precioNetoUnitario: '2000',
      precioUnitario: '2420',
    });
    expect(Number(f.data.precioTotal)).toBe(2420 * copias);
    expect(Number(f.data.precioNetoTotal)).toBe(2000 * copias);
    expect(Number(f.data.costoTotal)).toBe(1000 * copias);
    expect(f.data.snapshotJson).toMatchObject({
      producto: { unidadComercial: 'libros' },
      ejecucion: {
        cantidadPedida: f.hojas,
        cantidadComercialReal: f.hojas,
        unidadComercialPricing: 'hojas',
      },
    });
  },
);

it('conserva hojas y su precio unitario cuando no hay anillado', async () => {
  const f = await preparar(2, 2, false);
  expect(f.data.cantidad).toBe('26');
  expect(Number(f.data.precioUnitario)).toBeCloseTo(4840 / 26);
  expect(f.data.snapshotJson).toMatchObject({
    producto: { unidadComercial: 'hojas' },
  });
  const reconstruido = await f.reconstruir();
  expect(() => exigirMismoTrabajo(f.original, reconstruido)).not.toThrow();
});

it('no cambia la unidad de productos anillados ajenos al Centro de copiado', async () => {
  const f = await preparar(2, 2);
  const { _centroCopiado: _meta, ...jobContext } = f.args.jobContext;
  void _meta;
  const data = persistir({ ...f.args, jobContext });
  expect(data.cantidad).toBe('26');
  expect(Number(data.precioUnitario)).toBeCloseTo(4840 / 26);
});

it.each([{ copias: 3 }, { paginas: 20 }, { faz: 1 }, { terminaciones: [] }])(
  'sigue rechazando metadata que cambia el trabajo: %j',
  async (cambio) => {
    const f = await preparar(2, 2);
    const alterado = {
      ...f.original,
      jobContextJson: {
        ...f.original.jobContextJson,
        _centroCopiado: {
          ...(f.original.jobContextJson._centroCopiado as Prisma.JsonObject),
          ...cambio,
        },
      },
    };
    const reconstruido = await f.reconstruir(alterado);
    expect(() => exigirMismoTrabajo(alterado, reconstruido)).toThrow(
      'no coinciden',
    );
  },
);
