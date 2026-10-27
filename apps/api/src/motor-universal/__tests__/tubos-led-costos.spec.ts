import { MotorUniversalService } from '../motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
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
      'tubo_led_carteleria_v1',
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

async function cotizar(cantidad: number, anchoMm = 2360, altoMm = 1160, tension = '220V', eleccion?: string) {
  const iluminacion: PasoCargado = {
    rutaPasoId: 'luz',
    configPasoId: 'luz',
    rutaPasoOrden: 1,
    familiaCodigo: 'iluminacion_tubos_led',
    nombreVisible: 'Iluminación ficticia',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-2',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: {
      retiroBordeCm: 2,
      orientacion: 'automatico',
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
    slots: [{ ...slot('tubos_led', material('corto', { largo: 600, potencia: 9, paso: 300, tension }, 10, 'UNIDAD'), 'fijo'),
      modoSeleccion: 'MOTOR_ELIGE_AUTO', materialVariante: null, materialVarianteId: null,
      candidatos: [{ id: 'candidatos', materiaPrimaId: 'tubos', todasLasVariantes: false, defaultVarianteId: null,
        variantes: [{ varianteId: 'corto' }, { varianteId: 'largo' }] }],
    }],
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
  jest.spyOn(motor as never, 'cargarVariantePorId' as never).mockImplementation(async (...args: unknown[]) => args[1] === 'corto' ? material('corto', { largo: 600, potencia: 9, paso: 300, tension }, 10, 'UNIDAD') : material('largo', { largo: 1200, potencia: 18, paso: 300, tension }, 15, 'UNIDAD'));
  return motor.cotizar({
    tenantId: 'empresa-ficticia',
    productoId: 'backlight',
    periodo: '2026-10',
    jobContext: {
      cantidad,
      profundidadMm: 150,
      medidaCustomMm: { anchoMm, altoMm },
      ...(eleccion ? { slotMaterial_luz_tubos_led: eleccion } : {}),
      piezas: [{ cantidad, anchoMm, altoMm }],
    },
  });
}

it.each([1, 2])('cobra tubos de 60 cm y mano de obra para %s carteles, sin fuente', async cantidad => {
  const r = await cotizar(cantidad);
  expect(r.errores.filter(e => e.severidad === 'ERROR')).toEqual([]);
  expect(r.exitoso).toBe(true);
  const p = r.cotizacion!.pasos[0];
  expect(p.materiales).toHaveLength(1);
  expect(p.materiales![0]).toMatchObject({ materialVarianteId: 'corto', cantidad: 12 * cantidad, costoTotal: 120 * cantidad });
  expect(p.iluminacionTubos).toMatchObject({ tubosPorCartel: 12, unidades: cantidad, tensionV: 220 });
});
it('cambia automáticamente a 120 cm en un cartel mayor', async () => {
  const r = await cotizar(1, 2960, 1460);
  expect(r.exitoso).toBe(true);
  expect(r.cotizacion!.pasos[0].materiales![0]).toMatchObject({ materialVarianteId: 'largo', cantidad: 10, costoTotal: 150 });
});
it.each([[2360, 1160, '12V', undefined], [400, 400, '220V', undefined], [2360, 1160, '220V', 'largo'], [2360, 1160, '220V', 'ajeno']] as const)('rechaza material incompatible, caja pequeña o selección ajena', async (w,h,v,seleccion) => {
  const r = await cotizar(1,w,h,v,seleccion);
  expect(r.exitoso).toBe(false);
  expect(r.errores.some(e => e.severidad === 'ERROR')).toBe(true);
});
