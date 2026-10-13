import { MotorUniversalService } from '../motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import type {
  JobContext,
  PasoCargado,
  ProductoCargado,
  SlotCargado,
} from '../tipos';

// Catálogo y tarifas ficticios. Geometría, nesting, tiempos, materiales,
// composición y precio atraviesan el motor real.
const material = (
  id: string,
  attrs: Record<string, unknown>,
  precio: number,
): SlotCargado['materialVariante'] => ({
  id,
  sku: id,
  precioReferencia: precio,
  atributosVarianteJson: attrs,
  unidadStock: 'METRO_LINEAL',
  subfamilia: id === 'tela' ? 'SUSTRATO_ROLLO' : 'PERFIL',
  contextoUnidades: {
    templateId: id === 'liston' ? 'perfil_estructural_v1' : 'sustrato_rollo_v1',
    atributos: attrs,
    unidadCompra: 'METRO_LINEAL',
    unidadStock: 'METRO_LINEAL',
    unidadUso: 'METRO_LINEAL',
    unidadPrecio: 'METRO_LINEAL',
  },
});
const slot = (
  codigo: string,
  m: SlotCargado['materialVariante'],
): SlotCargado => ({
  id: codigo,
  slotCodigo: codigo,
  modoSeleccion: 'HARDCODED',
  candidatos: [],
  materialVarianteId: m!.id,
  materialVariante: m,
  formula: 'por_unidad_productiva',
  aplicaMultiCaras: false,
});
const paso = (id: string, familiaCodigo: string): PasoCargado => ({
  rutaPasoId: id,
  configPasoId: id,
  rutaPasoOrden: 1,
  familiaCodigo,
  modoActivacion: 'OBLIGATORIO',
  condicionActivacionJson: null,
  modoTiempo: 'T-2',
  mecanismoCantidad: 'CALCULADO_POR_PASO',
  mecanismoCantidadConfigJson: null,
  multiplicadoresActivos: [],
  paramsPasoJson: {},
  maquinaM1Id: null,
  perfilM1Id: null,
  centroCostoId: 'taller',
  centroCosto: { id: 'taller', codigo: 'TALLER', nombre: 'Taller ficticio' },
  setupOverrideMin: 0,
  cleanupOverrideMin: 0,
  tiempoFijoOverrideMin: null,
  slots: [],
  cargosDirectosPaso: [],
});
const producto = (id: string, pasos: PasoCargado[]): ProductoCargado => ({
  productoId: id,
  productoCodigo: id,
  productoNombre: id,
  unidadComercial: id === 'cuadro' ? 'unidad' : 'm2',
  modoMedidas: 'LIBRE',
  dimensionesRequeridas: ['ANCHO', 'ALTO'],
  minimoComercialPolitica: 'NONE',
  minimoComercialCantidad: null,
  minimoComercialBase: 'cantidad_comercial',
  medidaDefaultAnchoMm: null,
  medidaDefaultAltoMm: null,
  rutaAlternativaId: id,
  rutaAlternativaNombre: id,
  rutaId: id,
  rutaVersion: 1,
  rutaCodigo: id,
  rutaNombre: id,
  pasos,
  cargosDirectosCotizacion: [],
});

async function cotizar(piezas: NonNullable<JobContext['piezas']>) {
  const estructura = paso('estructura', 'estructura_bastidor');
  estructura.paramsPasoJson = {
    tipoBastidor: 'simple',
    sepRefuerzoVcm: 100,
    timeCalculationMode: 'productivity',
    productivityValue: 20,
    productivityUnit: 'unidades_h',
    productivityQuantitySource: 'derivada:cortes',
  };
  estructura.slots = [
    slot(
      'perfil_estructural',
      material('liston', { seccion: '25x25 mm', largoBarra: 3 }, 1000),
    ),
  ];
  const impresion = paso('impresion', 'impresion_por_area');
  impresion.modoTiempo = 'T-3';
  impresion.maquinaM1Id = 'impresora';
  impresion.perfilM1Id = 'cmyk';
  impresion.setupOverrideMin = 5;
  impresion.maquina = {
    id: 'impresora',
    codigo: 'IMP',
    nombre: 'Impresora ficticia',
    plantilla: 'impresora_rollo',
    centroCostoPrincipalId: 'taller',
    anchoUtil: 1370,
    parametrosTecnicosJson: { geometria: 'ROLLO', anchoMaxRolloMm: 1370 },
  };
  impresion.perfil = {
    id: 'cmyk',
    nombre: 'CMYK',
    tipoPerfil: 'IMPRESION',
    productivityValue: 10,
    productivityUnit: 'm2_h',
    setupMin: 5,
    cleanupMin: 0,
    feedReloadMin: null,
    detalleJson: { colores: ['CMYK'] },
  };
  impresion.slots = [
    slot(
      'sustrato_principal',
      material('tela', { anchoMm: 1370, largoRolloMm: 50000 }, 2000),
    ),
  ];
  const catalogo = {
    cuadro: producto('cuadro', [estructura]),
    tela: producto('tela', [impresion]),
  };
  const componentes = [
    {
      productoComponenteId: 'tela',
      codigo: 'TELA',
      nombre: 'Tela ficticia',
      cantidad: 1,
      unidad: 'm2',
      requerido: true,
      politicaEjecucion: 'INDEPENDIENTE',
      orden: 0,
      configuracionJson: {
        version: 1,
        bindings: [
          { clave: 'cantidad', origen: 'PADRE', padreClave: 'cantidad' },
          ...['anchoMm', 'altoMm'].map((lado) => ({
            clave: `medidaCustomMm.${lado}`,
            origen: 'FORMULA',
            regla: {
              campoPadre: `medidaCustomMm.${lado}`,
              operador: 'SUMAR',
              valor: 80,
            },
          })),
        ],
      },
    },
  ];
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
      resolverPublicadaParaCotizar: async (_tenant: string, id: string) => ({
        id: `revision-${id}`,
        version: 1,
        huella: id,
        snapshot: {},
        componentes: id === 'cuadro' ? componentes : [],
        pasosCompuestos: [],
      }),
    } as never,
    undefined,
    undefined,
    { exigirTodas: async () => undefined } as never,
  );
  jest
    .spyOn(motor as never, 'cargarProductoYRuta' as never)
    .mockImplementation(
      (async (_tenant: string, id: 'cuadro' | 'tela') => catalogo[id]) as never,
    );
  const cantidad = piezas.reduce((n, p) => n + p.cantidad, 0);
  const r = await motor.cotizar({
    tenantId: 'empresa-ficticia',
    productoId: 'cuadro',
    periodo: '2026-10',
    jobContext: {
      cantidad,
      piezas,
      ...(piezas.length === 1
        ? {
            medidaCustomMm: {
              anchoMm: piezas[0].anchoMm,
              altoMm: piezas[0].altoMm,
            },
          }
        : {}),
    },
  });
  expect(r.errores.filter((e) => e.severidad === 'ERROR')).toEqual([]);
  expect(r.exitoso).toBe(true);
  return r.cotizacion!;
}

it('cotiza 1, 2 y 3 cuadros distintos con costos completos y una preparación de impresión', async () => {
  const piezas = [
    { cantidad: 1, anchoMm: 250, altoMm: 350 },
    { cantidad: 1, anchoMm: 450, altoMm: 550 },
    { cantidad: 1, anchoMm: 650, altoMm: 750 },
  ];
  const resultados = [];
  for (const n of [1, 2, 3]) {
    const c = await cotizar(piezas.slice(0, n));
    resultados.push(c);
    expect(c.componentesFabricados).toHaveLength(1);
    const tela = c.componentesFabricados![0];
    expect(tela.jobContext.piezas as unknown[]).toHaveLength(n);
    expect(tela.pasos![0].nestingResult!.placements).toHaveLength(n);
    expect(tela.pasos![0].tiempo!.setupMin).toBe(5);
    expect(c.pasos[0].tiempo!.runMin).toBe(12 * n);
    expect(c.costos.total).toBeCloseTo(
      c.pasos[0].costoTotal + tela.costoTotal,
      2,
    );
    expect(c.precio!.precioTotal).toBeCloseTo(c.costos.total / 0.75, 1);
  }
  expect(resultados[1].pasos[0].estructuraBastidor!.barras).toMatchObject({
    cantidad: 2,
    metrosUtiles: 3,
  });
  expect(resultados[2].pasos[0].estructuraBastidor!.barras).toMatchObject({
    cantidad: 2,
    metrosUtiles: 5.7,
  });
  expect(resultados[1].precio!.precioTotal).toBeGreaterThan(
    resultados[0].precio!.precioTotal,
  );
  expect(resultados[2].precio!.precioTotal).toBeGreaterThan(
    resultados[1].precio!.precioTotal,
  );
});
