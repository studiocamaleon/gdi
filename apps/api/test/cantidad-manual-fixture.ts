import { MotorUniversalService } from '../src/motor-universal/motor.service';
import { AplicarPrecioService } from '../src/productos-servicios/precio/aplicar-precio.service';
import type {
  PasoCargado,
  ProductoCargado,
} from '../src/motor-universal/tipos';

export function fixtureCantidadManual() {
  const comun: PasoCargado = {
    rutaPasoId: 'ploteo',
    rutaPasoOrden: 1,
    configPasoId: 'ploteo',
    familiaCodigo: 'impresion_por_area',
    nombreVisible: 'Ploteo',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-2',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: {
      productivityValue: 12,
      productivityUnit: 'm2_h',
      productivityQuantitySource: 'area_piezas_m2',
      nestingConfig: {
        algorithm: 'shelf-rollo',
        margins: {
          topMm: 0,
          bottomMm: 0,
          leftMm: 0,
          rightMm: 0,
          startMm: 0,
          endMm: 0,
        },
        pieceBleedMm: 0,
        gapMm: 0,
      },
    },
    maquinaM1Id: null,
    perfilM1Id: 'perfil',
    perfil: {
      id: 'perfil',
      nombre: 'BN ficticio',
      tipoPerfil: 'IMPRESION',
      activo: true,
      productivityValue: 12,
      productivityUnit: 'm2_h',
      setupMin: 0,
      cleanupMin: 0,
      detalleJson: { colores: ['BN'] },
    } as PasoCargado['perfil'],
    centroCostoId: 'centro',
    centroCosto: { id: 'centro', nombre: 'Taller ficticio', codigo: 'TALLER' },
    setupOverrideMin: 0,
    cleanupOverrideMin: 0,
    tiempoFijoOverrideMin: 0,
    slots: [
      {
        slotCodigo: 'sustrato_principal',
        slotRol: 'SUSTRATO',
        modoSeleccion: 'HARDCODED',
        formula: 'por_m2',
        aplicaMultiCaras: false,
        mermaAdicionalPct: 0,
        materialVariante: {
          id: 'vinilo',
          sku: 'VIN-TEST',
          materiaPrimaNombre: 'Vinilo ficticio',
          materiaPrimaTemplateId: 'sustrato_rollo_flexible_v1',
          subfamilia: 'SUSTRATO_ROLLO_FLEXIBLE',
          unidadStock: 'M2',
          unidadPrecio: 'M2',
          precioReferencia: 2000,
          atributosVarianteJson: { anchoMm: 1000, largoRolloMm: 50000 },
        },
      },
    ],
    maquina: {
      id: 'impresora',
      nombre: 'Impresora ficticia',
      plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
      parametrosTecnicosJson: { geometria: 'ROLLO', anchoMaxRolloMm: 1000 },
      consumibles: [
        {
          id: 'tinta',
          perfilOperativoId: 'perfil',
          nombre: 'Tinta negra ficticia',
          tipo: 'tinta',
          unidad: 'ml',
          rendimientoEstimado: null,
          consumoBase: 1,
          consumoPorCoberturaJson: null,
          activo: true,
          detalleJson: { color: 'negro' },
          materialVariante: {
            id: 'tinta',
            sku: 'INK-TEST',
            materiaPrimaNombre: 'Tinta ficticia',
            precioReferencia: 100,
            unidadStock: 'ml',
            unidadPrecio: 'ml',
          },
        },
      ],
      componentesDesgaste: [],
    } as PasoCargado['maquina'],
    cargosDirectosPaso: [],
  };
  const desploteo: PasoCargado = {
    ...comun,
    rutaPasoId: 'desploteo',
    configPasoId: 'desploteo',
    rutaPasoOrden: 2,
    familiaCodigo: 'trabajo_manual',
    nombreVisible: 'Desploteo',
    modoActivacion: 'OPCIONAL',
    mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
    maquina: undefined,
    perfil: undefined,
    perfilM1Id: null,
    slots: [],
    paramsPasoJson: {
      productivityValue: 8,
      productivityUnit: 'unidades_h',
      productivityQuantitySource: 'cantidad_manual',
      cantidadManual: { etiqueta: 'Superficie a desplotear', unidad: 'm²' },
      niveles: {
        etiqueta: 'Dificultad',
        opciones: [
          {
            codigo: 'normal',
            nombre: 'Normal',
            esDefault: true,
            overrides: { productividadHora: 8 },
          },
          {
            codigo: 'dificil',
            nombre: 'Difícil',
            esDefault: false,
            overrides: { productividadHora: 4 },
          },
        ],
      },
    },
  };
  const producto: ProductoCargado = {
    productoId: 'producto',
    productoCodigo: 'VIN-TEST',
    productoNombre: 'Ploteo ficticio',
    unidadComercial: 'm2',
    modoMedidas: 'LIBRE',
    dimensionesRequeridas: ['ANCHO', 'ALTO'],
    minimoComercialPolitica: 'NONE',
    minimoComercialCantidad: null,
    minimoComercialBase: 'cantidad_comercial',
    medidaDefaultAnchoMm: null,
    medidaDefaultAltoMm: null,
    rutaAlternativaId: 'alternativa',
    rutaAlternativaNombre: 'Principal',
    rutaId: 'ruta',
    rutaVersion: 1,
    rutaCodigo: 'RUTA',
    rutaNombre: 'Ruta ficticia',
    pasos: [comun, desploteo],
    cargosDirectosCotizacion: [],
  };
  const contexto = {
    cantidad: 1,
    piezas: [{ anchoMm: 1000, altoMm: 12000, cantidad: 1 }],
    piezaAreaTotalM2: 12,
    opcionalesActivados: { desploteo: true },
    cantidadManual_desploteo: 5,
  };
  return { producto, contexto, ploteo: comun, desploteo };
}
export function motorCantidadManual(db?: unknown) {
  const prisma = db ?? {
    producto: {
      findFirst: async () => ({
        precioConfigJson: {
          metodoCalculo: 'por_margen',
          detalle: { marginPct: 50 },
        },
        categoriaFiscal: 'general',
      }),
    },
    centroCostoTarifaPeriodo: {
      findMany: async () => [
        {
          centroCostoId: 'centro',
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
  return new MotorUniversalService(
    prisma as never,
    new AplicarPrecioService(),
    { buscarActivo: async () => null } as never,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    {
      exigirTodas: async () => undefined,
      exigirOperacionTx: async () => undefined,
    } as never,
  );
}
