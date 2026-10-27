import { MotorUniversalService } from '../motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { materialUnitConversion } from '../../inventario/material-units';
import type { PasoCargado, ProductoCargado, SlotCargado } from '../tipos';

const material = (
  id: string,
  attrs: Record<string, unknown>,
  precio: number,
  unidadStock: string,
): NonNullable<SlotCargado['materialVariante']> => ({
  id,
  sku: id,
  precioReferencia: precio,
  atributosVarianteJson: attrs,
  unidadStock,
  contextoUnidades: {
    templateId:
      id === 'tira' ? 'tira_led_carteleria_v1' : 'fuente_alimentacion_led_v1',
    atributos: attrs,
    unidadStock,
    unidadUso: unidadStock,
    unidadCompra: unidadStock,
    unidadPrecio: unidadStock,
  },
});
const slot = (
  codigo: string,
  m: NonNullable<SlotCargado['materialVariante']>,
  formula: string,
): SlotCargado => ({
  id: codigo,
  slotCodigo: codigo,
  modoSeleccion: 'HARDCODED',
  candidatos: [],
  materialVarianteId: m.id,
  materialVariante: m,
  formula,
  aplicaMultiCaras: false,
});

async function cotizar(cantidad: number, tensionFuente = '12V') {
  const iluminacion: PasoCargado = {
    rutaPasoId: 'luz',
    configPasoId: 'luz',
    rutaPasoOrden: 1,
    familiaCodigo: 'iluminacion_tira_led',
    nombreVisible: 'Iluminación ficticia',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-2',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: {
      separacionCm: 10,
      retiroBordeCm: 2.5,
      margenFuentePct: 30,
      timeCalculationMode: 'productivity',
      productivityValue: 30,
      productivityUnit: 'unidades_h',
    },
    maquinaM1Id: null,
    perfilM1Id: null,
    centroCostoId: 'taller',
    centroCosto: { id: 'taller', codigo: 'TALLER', nombre: 'Taller ficticio' },
    setupOverrideMin: 0,
    cleanupOverrideMin: 0,
    tiempoFijoOverrideMin: null,
    cargosDirectosPaso: [],
    slots: [
      slot(
        'tira_led',
        material(
          'tira',
          { potencia: 8, tension: '12V', corte: 25, largo: 50 },
          1000,
          'METRO_LINEAL',
        ),
        'por_metro_lineal',
      ),
      slot(
        'fuente',
        material(
          'fuente',
          { capacidad: 150, tension: tensionFuente },
          2000,
          'UNIDAD',
        ),
        'fijo',
      ),
    ],
  };
  const producto: ProductoCargado = {
    productoId: 'backlight',
    productoCodigo: 'BACKLIGHT-PRUEBA',
    productoNombre: 'Backlight ficticio',
    unidadComercial: 'unidad',
    modoMedidas: 'LIBRE',
    dimensionesRequeridas: ['ANCHO', 'ALTO'],
    minimoComercialPolitica: 'NONE',
    minimoComercialCantidad: null,
    minimoComercialBase: 'cantidad_comercial',
    medidaDefaultAnchoMm: null,
    medidaDefaultAltoMm: null,
    rutaAlternativaId: 'ruta',
    rutaAlternativaNombre: 'Ruta de prueba',
    rutaId: 'ruta',
    rutaVersion: 1,
    rutaCodigo: 'RUTA',
    rutaNombre: 'Ruta de prueba',
    pasos: [iluminacion],
    cargosDirectosCotizacion: [],
  };
  const db = {
    producto: {
      findFirst: async () => ({
        precioConfigJson: {
          metodoCalculo: 'por_margen',
          detalle: { marginPct: 25 },
        },
        categoriaFiscal: 'general',
      }),
    },
    centroCostoTarifaPeriodo: {
      findMany: async () => [
        {
          centroCostoId: 'taller',
          periodo: '2026-10',
          estado: 'PUBLICADA',
          tarifaCalculada: 6000,
          tarifaManoObra: 0,
        },
      ],
    },
    politicaReservasMaterial: { findUnique: async () => null },
    productoComisionAplicada: { findMany: async () => [] },
    productoComisionCatalogo: { findMany: async () => [] },
    productoImpuestoCatalogo: { findMany: async () => [] },
    configuracionFiscal: { findUnique: async () => null },
    datosEmpresa: { findUnique: async () => null },
  };
  const motor = new MotorUniversalService(
    db as never,
    new AplicarPrecioService(),
    { buscarActivo: async () => null } as never,
    undefined,
    undefined,
    {
      resolverPublicadaParaCotizar: async () => ({
        id: 'revision',
        version: 1,
        huella: 'ficticia',
        snapshot: {},
        componentes: [],
        pasosCompuestos: [],
      }),
    } as never,
    undefined,
    undefined,
    { exigirTodas: async () => undefined } as never,
  );
  jest
    .spyOn(motor as never, 'cargarProductoYRuta' as never)
    .mockResolvedValue(producto as never);
  return motor.cotizar({
    tenantId: 'empresa-ficticia',
    productoId: 'backlight',
    periodo: '2026-10',
    jobContext: {
      cantidad,
      profundidadMm: 150,
      medidaCustomMm: { anchoMm: 2400, altoMm: 1200 },
      piezas: [{ cantidad, anchoMm: 2400, altoMm: 1200 }],
    },
  });
}

it.each([1, 2])(
  'cotiza %s carteles con metros, fuentes y costos correspondientes',
  async (cantidad) => {
    const r = await cotizar(cantidad);
    expect(r.errores.filter((e) => e.severidad === 'ERROR')).toEqual([]);
    expect(r.exitoso).toBe(true);
    const p = r.cotizacion!.pasos[0];
    const m = p.materiales!;
    expect(m.find((v) => v.slotCodigo === 'tira_led')).toMatchObject({
      cantidad: 28.2 * cantidad,
      costoTotal: 28200 * cantidad,
    });
    expect(m.find((v) => v.slotCodigo === 'fuente')).toMatchObject({
      cantidad: 2 * cantidad,
      costoTotal: 4000 * cantidad,
    });
    expect(p.iluminacionTira).toMatchObject({
      metrosPorCartel: 28.2,
      fuentes: { porCartel: 2 },
    });
  },
);

it('no cotiza una tira de 12 V con una fuente fija de 24 V', async () => {
  const r = await cotizar(1, '24V');
  expect(r.exitoso).toBe(false);
  expect(
    r.errores.some((e) => e.codigo === 'tira_led_sin_fuente_compatible'),
  ).toBe(true);
});

it('convierte el rollo comercial a metros para comprar y costear', () => {
  expect(
    materialUnitConversion(
      {
        templateId: 'tira_led_carteleria_v1',
        atributos: { largo: 50 },
        unidadCompra: 'rollo',
        unidadStock: 'metro_lineal',
      },
      'rollo',
      'metro_lineal',
    ),
  ).toMatchObject({ ok: true, factor: 50 });
});
