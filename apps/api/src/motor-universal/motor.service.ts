import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolverFamilia } from '../productos-servicios/pasos/familias';
import type {
  DefinicionFamiliaResuelta,
  FamiliaCodigo,
} from '../productos-servicios/pasos/types';
import { evaluarRegla } from './evaluador-jsonlogic';
import { loadTarifasHorarias } from '../productos-servicios/costing/load-tarifas';
import { calcularPrecio, type PrecioConfig } from './calculador-precio';
import { resolverCostoTercerizado } from './tercerizado-costo';
import { AplicarPrecioService } from '../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import type {
  ImpuestoSnapshot as PrecioImpuestoSnapshot,
  ComisionSnapshot as PrecioComisionSnapshot,
  PrecioConfig as TabPrecioConfig,
} from '../productos-servicios/precio/aplicar-precio.types';
import type {
  CotizarInput,
  CotizarOutput,
  CotizacionResultado,
  PasoEjecutado,
  ErrorMotor,
  ProductoCargado,
  PasoCargado,
  SlotCargado,
  JobContext,
  MaterialEjecutado,
  CargoDirectoEjecutado,
  CargoPasoCargado,
  NestingEjecutado,
  NestingCostingPreview,
  TiempoManualConfig,
  MutacionAplicada,
  ComponenteDesgasteCargado,
  DefaultsFamiliaPaso,
} from './tipos';
import {
  runNestingForPaso,
  type NestingDispatchResult,
} from './nesting-dispatcher';
import {
  resolveNestingConfig,
  type MaterialResueltoParaNestingConfig,
  type NestingConfigResolved,
  type PrintSheetCandidateMaterial,
} from './nesting-config';
import { calcularOutputsCanonicos } from './outputs-canonicos';
import {
  capacidadesEmitidas,
  KEY_CAPACIDADES_POR_PASO,
  resolverHerenciaExplicita,
  type CapacidadEmitida,
} from '../productos-servicios/pasos/capacidades';
import {
  aplicarCentroDefault,
  productividadPropiaEfectiva,
  tiempoFijoEfectivoMin,
} from './familia-defaults';
import {
  getConsumableChannelFromDetail,
  getPerfilConsumableChannels,
  PRINTER_TEMPLATES_WITH_MACHINE_CONSUMABLES,
  type ConsumableChannel,
} from '../maquinaria/consumibles-impresion';
import {
  applyCostingStrategy,
  type CostingStrategyKind,
} from '../productos-servicios/nesting/costing';
import { calculateSustratoToPliegoConversion } from '../productos-servicios/nesting/helpers/sustrato-to-pliego';
import {
  getModoColorsFromPerfil,
  MODO_COLOR_LABELS,
  modoColorMatchesPerfil,
  normalizeModoColor,
} from '../productos-servicios/modo-color-comercial';
import {
  calcularPerimetroPiezasM,
  congelarMedidaVisible,
} from './job-context-metrics';
import {
  familiaMutaMedidasEnPrePasada,
  familiaSinConsumiblesMaquina,
  magnitudTiempoDefaultDeFamilia,
  perfilCompatibleConFamilia,
  slotIgnoraMultiplicadorCaras,
} from '../productos-servicios/pasos/familias';
import { resolverArrastreOpcionales } from './arrastre-opcionales';
import { paramsEfectivos } from './params-runtime';
import { regionalDelTenant } from '../common/regional';
import {
  aplicarMutacionPre,
  calcularMetrosLinealesUnion,
  parsearParamsModificacionPre,
} from './modificaciones-pre';
import {
  calcularCantidadOjales,
  calcularLayoutOjales,
  parsearParamsColocacionOjales,
} from './colocacion-ojales';

const MODO_SIN_IMPRESION = 'SIN_IMPRESION';
const FAMILIAS_IMPRESION = new Set([
  'impresion_por_area',
  'impresion_por_hoja',
]);

/**
 * Sub-fase 3 — shapes del config embebido de un paso extra. Espejan el draft
 * que envía el editor (mismos campos que UpsertSlotMaterialDto / cargo de paso),
 * guardando sólo ids: el motor hidrata variantes/catálogos en cotización.
 */
interface PasoExtraSlotJson {
  slotCodigo: string;
  slotNombre?: string | null;
  slotRol?: string | null;
  modoSeleccion: string;
  criterioMotorAuto?: string | null;
  criterioInputCampo?: string | null;
  criterioMaterialCampo?: string | null;
  materialVarianteId?: string | null;
  candidatos?: Array<{
    materiaPrimaId: string;
    defaultVarianteId?: string | null;
    orden?: number;
    varianteIds?: string[];
  }>;
  estrategiaCosto?: string;
  formula?: string;
  cantidadFactor?: number | string | null;
  cantidadBase?: string | null;
  aplicaMultiCaras?: boolean;
}

interface PasoExtraCargoJson {
  cargoDirectoCatalogoId: string;
  modoActivacion: string;
  condicionActivacionJson?: unknown;
  configOverrideJson?: unknown;
}

interface PasoExtraCandidataJson {
  maquinaId: string;
  perfilDefaultId?: string | null;
  modoColorAllowedModes?: string[];
  esPreferida?: boolean;
  orden?: number;
}

type MinimoComercialBase = 'cantidad_comercial' | 'pliegos_impresos';

type MinimoComercialContext = {
  base: MinimoComercialBase;
  cantidadReal: number;
  unidadLabel: string;
  error?: ErrorMotor;
};

/**
 * G-M9 — Resuelve la unidad efectiva de un material consumido. Cuando la
 * fórmula del slot tiene dimensión implícita (`por_m2`, `por_metro_lineal`),
 * la unidad del consumo es esa dimensión. Para el resto (`fijo`, `por_pieza`,
 * `por_unidad_productiva`), se hereda la unidad de stock de la materia prima
 * (PLIEGO, ROLLO, METRO_LINEAL, UNIDAD, KG, M2, etc.) en minúsculas para
 * presentación humana. Si no hay info, fallback `'unidad'` para no romper.
 */
function unidadEfectivaDeFormula(
  formula: string,
  unidadStock: string | null | undefined,
): string {
  switch (formula) {
    case 'por_m2':
      return 'm2';
    case 'por_metro_lineal':
      return 'm_lineales';
    case 'por_pieza':
    case 'por_unidad_productiva':
    case 'fijo':
      return unidadStock ? unidadStock.toLowerCase() : 'unidad';
    default:
      return unidadStock ? unidadStock.toLowerCase() : 'unidad';
  }
}

function isNestingCostingStrategy(value: string): value is CostingStrategyKind {
  return (
    value === 'm2-exact' ||
    value === 'consumed-length' ||
    value === 'plate-segments'
  );
}

type UnidadConvertible = {
  familia: 'masa' | 'volumen' | 'lineal' | 'area' | 'unidad';
  factorBase: number;
};

const UNIDADES_CONVERTIBLES: Record<string, UnidadConvertible> = {
  GRAMO: { familia: 'masa', factorBase: 1 },
  KG: { familia: 'masa', factorBase: 1000 },
  ML: { familia: 'volumen', factorBase: 1 },
  LITRO: { familia: 'volumen', factorBase: 1000 },
  METRO_LINEAL: { familia: 'lineal', factorBase: 1 },
  M2: { familia: 'area', factorBase: 1 },
  UNIDAD: { familia: 'unidad', factorBase: 1 },
  PIEZA: { familia: 'unidad', factorBase: 1 },
  HOJA: { familia: 'unidad', factorBase: 1 },
  PLIEGO: { familia: 'unidad', factorBase: 1 },
  PAGINA: { familia: 'unidad', factorBase: 1 },
  A4_EQUIV: { familia: 'unidad', factorBase: 1 },
};

function normalizarUnidad(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toUpperCase()
    .replaceAll('-', '_')
    .replaceAll(' ', '_');
  const aliases: Record<string, string> = {
    G: 'GRAMO',
    GR: 'GRAMO',
    GRAM: 'GRAMO',
    GRAMOS: 'GRAMO',
    KILO: 'KG',
    KILOS: 'KG',
    L: 'LITRO',
    LITROS: 'LITRO',
    MILILITRO: 'ML',
    MILILITROS: 'ML',
    M_LINEAL: 'METRO_LINEAL',
    M_LINEALES: 'METRO_LINEAL',
    METROS_LINEALES: 'METRO_LINEAL',
    METRO_CUADRADO: 'M2',
    METROS_CUADRADOS: 'M2',
    PAGINAS: 'PAGINA',
  };
  return aliases[normalized] ?? normalized;
}

function precioPorUnidadDeConsumo(
  precioReferencia: number,
  unidadStock: string | null | undefined,
  unidadConsumo: string | null | undefined,
  rendimientoEstimado: number | null | undefined,
): number {
  const stock = normalizarUnidad(unidadStock);
  const consumo = normalizarUnidad(unidadConsumo);
  const stockConv = stock ? UNIDADES_CONVERTIBLES[stock] : undefined;
  const consumoConv = consumo ? UNIDADES_CONVERTIBLES[consumo] : undefined;

  if (
    stockConv &&
    consumoConv &&
    stockConv.familia === consumoConv.familia &&
    (stockConv.familia !== 'unidad' || stock === consumo)
  ) {
    return (precioReferencia / stockConv.factorBase) * consumoConv.factorBase;
  }

  const rendimiento = Number(rendimientoEstimado ?? 0);
  if (Number.isFinite(rendimiento) && rendimiento > 0) {
    return precioReferencia / rendimiento;
  }

  return precioReferencia;
}

function readPositiveNumber(
  attrs: Record<string, unknown> | null | undefined,
  keys: string[],
): number {
  if (!attrs) return 0;
  for (const key of keys) {
    const value = Number(attrs[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function getRolloAnchoMm(attrs: Record<string, unknown> | null | undefined) {
  const anchoMm = readPositiveNumber(attrs, ['anchoMm', 'widthMm']);
  if (anchoMm > 0) return anchoMm;
  const anchoM = readPositiveNumber(attrs, ['ancho', 'widthM']);
  return anchoM > 0 ? anchoM * 1000 : 0;
}

function getRolloLargoMm(attrs: Record<string, unknown> | null | undefined) {
  const largoMm = readPositiveNumber(attrs, [
    'largoRolloMm',
    'largoMm',
    'altoMm',
    'heightMm',
  ]);
  if (largoMm > 0) return largoMm;
  const largoM = readPositiveNumber(attrs, ['largoRolloM', 'largo', 'heightM']);
  return largoM > 0 ? largoM * 1000 : 0;
}

function isRolloMaterial(
  unidadStock: string | null | undefined,
  attrs: Record<string, unknown> | null | undefined,
) {
  return (
    normalizarUnidad(unidadStock) === 'ROLLO' || getRolloLargoMm(attrs) > 0
  );
}

function precioMaterialPorUnidadDeConsumo(
  precioReferencia: number,
  unidadStock: string | null | undefined,
  unidadConsumo: string | null | undefined,
  attrs: Record<string, unknown> | null | undefined,
): number {
  const stock = normalizarUnidad(unidadStock);
  const consumo = normalizarUnidad(unidadConsumo);
  const precioConvertido = precioPorUnidadDeConsumo(
    precioReferencia,
    unidadStock,
    unidadConsumo,
    null,
  );
  if (precioConvertido !== precioReferencia) return precioConvertido;

  const anchoMm = getRolloAnchoMm(attrs);
  const largoMm = getRolloLargoMm(attrs);
  const anchoM = anchoMm > 0 ? anchoMm / 1000 : 0;
  const largoM = largoMm > 0 ? largoMm / 1000 : 0;

  if (stock === 'ROLLO' && consumo === 'METRO_LINEAL' && largoM > 0) {
    return precioReferencia / largoM;
  }
  if (stock === 'ROLLO' && consumo === 'M2' && anchoM > 0 && largoM > 0) {
    return precioReferencia / (anchoM * largoM);
  }
  if (stock === 'METRO_LINEAL' && consumo === 'M2' && anchoM > 0) {
    return precioReferencia / anchoM;
  }
  if (stock === 'M2' && consumo === 'METRO_LINEAL' && anchoM > 0) {
    return precioReferencia * anchoM;
  }

  return precioReferencia;
}

/**
 * G-M2 — Mapeo familia → output canónico que hereda por default cuando
 * `mecanismoCantidad = HEREDAR_DEL_OUTPUT_CANONICO` y no se especificó
 * `campoOutput` en `mecanismoCantidadConfigJson`. Convención: cada familia
 * espera el output natural del paso anterior.
 */
function defaultOutputParaHeredar(familiaCodigo: string): string | null {
  switch (familiaCodigo) {
    case 'impresion_por_hoja':
      return 'pliegos_calculados';
    case 'corte_guillotina':
      return 'pliegos_impresos';
    case 'corte_manual':
      return 'pliegos_impresos';
    case 'laminado':
      return 'pliegos_impresos';
    case 'barniz':
      return 'pliegos_impresos';
    case 'plegado':
      return 'pliegos_impresos';
    case 'troquelado_digital':
      return 'pliegos_impresos';
    case 'engomado_emblocado':
      return 'pliegos_impresos';
    case 'encuadernado_engrapado':
    case 'encuadernado_anillado':
      return 'pliegos_impresos';
    case 'modificacion_post':
      return 'piezas_cortadas';
    default:
      return null;
  }
}

/**
 * Motor Universal por Pasos.
 *
 * MVP de F.2 — implementa el bucle base + sub-tareas básicas:
 * - Cargar producto + ruta seleccionada del DB
 * - Iterar pasos en orden
 * - Por cada paso: D.1 activación → D.4 tiempo simple → D.5 materiales HARDCODED
 *   → costos
 * - Acumular trazabilidad
 * - Devolver costo total + trazabilidad + errores
 *
 * Sub-fases CUBIERTAS (auditoría 2026-04-25 + G-M3 + G-M1 + G-M2):
 * - F.2.1 bucle a-i, F.2.2 JsonLogic CONDICIONAL, F.2.3 mecanismos cantidad
 *   (DIRECT, CONVERSION, HEREDAR_DEL_OUTPUT_CANONICO real (G-M2),
 *   CALCULADO_POR_PASO con nesting real (G-M1)),
 * - F.2.4 selección perfil heurística (doble/simple), F.2.5 materiales (3 modos
 *   × 3 criterios), F.2.6 multiplicadores, F.2.7 cargos directos a nivel
 *   COTIZACIÓN y a nivel PASO (G-M3), F.2.8 validaciones D.7 (5/5 tipos —
 *   EXISTS_OUTPUT real con G-M2/G-M4), F.2.9 outputs canónicos al jobContext
 *   con look-ahead pre_prensa (G-M2), F.2.10 tarifas reales del centro de
 *   costo, F.2.11 snapshot CotizacionItem, F.2.12 Tab Precio integration,
 *   F.2.13 nesting (shelf-rollo + grid-2d-single, G-M1).
 *
 * Pendientes (ver `docs/motor-por-pasos-analisis/auditoria-gaps-2026-04-25.md`):
 * - G-M6: sub-productos / SELECTOR (DAG).
 * - G-M7/M8: nesting MAYOR_APROVECHAMIENTO real con cada candidato + perfil
 *   con regla declarativa.
 */
@Injectable()
export class MotorUniversalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aplicarPrecio: AplicarPrecioService,
    private readonly preciosEspecialesClientes: PreciosEspecialesClientesService,
  ) {}

  /**
   * Params del paso con los campos que el modelador dejó ABIERTOS pisados por
   * lo que eligió el comercial. Ver `params-runtime.ts`.
   */
  private paramsEfectivosDelPaso(
    paso: { configPasoId: string; paramsPasoJson?: unknown },
    jobContext: JobContext,
  ): Record<string, unknown> {
    return paramsEfectivos(
      paso.paramsPasoJson,
      jobContext.configPasoRuntime?.[paso.configPasoId],
    );
  }

  private valueToMessage(value: unknown) {
    if (value === null || value === undefined) {
      return '?';
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    return JSON.stringify(value);
  }

  async cotizar(
    input: CotizarInput,
    opciones?: {
      omitirPrecioReferenciaMinimo?: boolean;
      /**
       * Producto ya cargado por el caller (mismo tenant/producto/ruta), para
       * evitar recargar el "include gigante" cuando cotizar-y-guardar ya lo
       * tiene en memoria.
       */
      productoPrecargado?: ProductoCargado;
    },
  ): Promise<CotizarOutput> {
    const errores: ErrorMotor[] = [];

    // 1. INICIALIZACIÓN
    let producto: ProductoCargado;
    try {
      producto =
        opciones?.productoPrecargado ??
        (await this.cargarProductoYRuta(
          input.tenantId,
          input.productoId,
          input.rutaAlternativaId ?? null,
        ));
    } catch (err) {
      return {
        exitoso: false,
        errores: [
          {
            codigo: 'producto_no_encontrado',
            severidad: 'ERROR',
            mensaje: err instanceof Error ? err.message : String(err),
            sugerencia:
              'Verificar que el producto y la ruta alternativa existen.',
          },
        ],
      };
    }

    // JobContext mutable (los pasos PRE pueden mutarlo) + defaults sensatos
    const jobContext: JobContext = {
      caras: 1, // simple faz por defecto (se sobrescribe con input)
      ...input.jobContext,
    };

    // G-M2 — Si el producto declara `medidaDefault` (FIJA, COMERCIAL_ELIGE o
    // MIXTA) y el comercial NO cargó `piezas[]` ni `medidaCustomMm`,
    // sintetizamos `medidaCustomMm` para que el dispatcher de nesting
    // (pre_prensa look-ahead) tenga una pieza válida con la que correr el
    // grid 2D. Esto preserva el contrato: cuando el modelador declara medidas
    // fijas en el producto, el comercial no necesita repetirlas al cotizar.
    if (
      !jobContext.piezas &&
      !jobContext.medidaCustomMm &&
      producto.medidaDefaultAnchoMm &&
      producto.medidaDefaultAltoMm
    ) {
      jobContext.medidaCustomMm = {
        anchoMm: producto.medidaDefaultAnchoMm,
        altoMm: producto.medidaDefaultAltoMm,
      };
    }
    if (!jobContext.piezas && jobContext.medidaCustomMm) {
      jobContext.piezas = [
        {
          cantidad: Number(jobContext.cantidad ?? 0),
          anchoMm: jobContext.medidaCustomMm.anchoMm,
          altoMm: jobContext.medidaCustomMm.altoMm,
        },
      ];
    }
    // Congelar la medida VISIBLE antes de que ningún paso PRE la mute. Los
    // pasos que miden sobre el borde terminado (soldadura de bolsillo,
    // colocación de ojales) leen de acá; `piezas[]`/`medidaCustomMm` describen
    // el material y sí crecen con la demasía.
    // Ver docs/modificaciones-fisicas-lona-diseno.md §3.
    congelarMedidaVisible(jobContext);

    await this.enriquecerJobContextConGramajePrincipal(
      input.tenantId,
      producto,
      jobContext,
    );
    this.enriquecerJobContextConTecnologias(producto.pasos, jobContext);

    // 1b. Cargar tarifas horarias publicadas para el período (F.2.10)
    // Incluye los centros de las máquinas candidatas M-2: si el comercial
    // elige una candidata cuyo centro difiere del de la M-1, la tarifa de
    // ese centro también tiene que estar en el mapa (G-F2).
    const periodo = input.periodo ?? this.getPeriodoActual();
    const centroIds = Array.from(
      new Set(
        producto.pasos
          .flatMap((p) => [
            this.resolveCentroCostoPaso(p).id,
            ...(p.maquinasCandidatas ?? []).map(
              (mc) => mc.maquina?.centroCostoPrincipalId ?? null,
            ),
          ])
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const tarifasMap = await loadTarifasHorarias(this.prisma as never, {
      tenantId: input.tenantId,
      periodo,
      centroCostoIds: centroIds,
    });

    // 1c. ARRASTRE ENTRE OPCIONALES — un paso puede exigir que otros se
    // ejecuten (ojales requiere el refuerzo perimetral). Va ANTES del bucle
    // porque la dependencia apunta hacia atrás en la ruta: cuando el motor
    // llega a los ojales, el refuerzo ya pasó.
    // Ver docs/modificaciones-fisicas-lona-diseno.md
    const arrastre = resolverArrastreOpcionales(
      producto.pasos.map((p) => ({
        rutaPasoId: p.rutaPasoId,
        configPasoId: p.configPasoId,
        nombreVisible: p.nombreVisible,
        familiaCodigo: p.familiaCodigo,
        modoActivacion: p.modoActivacion,
        requiereRutaPasoIds: p.requiereRutaPasoIds,
      })),
      jobContext.opcionalesActivados ?? {},
    );
    jobContext.opcionalesActivados = arrastre.opcionalesActivados;
    const arrastrePorConfigPasoId = new Map(
      arrastre.arrastres.map((a) => [a.configPasoId, a]),
    );
    for (const conflicto of arrastre.conflictos) {
      errores.push({
        codigo: 'dependencia_de_paso_no_resoluble',
        severidad: 'ERROR',
        rutaPasoId: conflicto.rutaPasoId,
        mensaje: `"${conflicto.requeridoPorNombre}" necesita otro paso que no se puede ejecutar: ${conflicto.motivo}.`,
        sugerencia:
          'Revisar la dependencia declarada en el paso, o habilitar el paso requerido en esta ruta.',
      });
    }

    // 1d. PRE-PASADA DE MEDIDAS — las familias que declaran
    // `mutaMedidasEnPrePasada` aplican su demasía ANTES del bucle, sin importar
    // dónde estén en la ruta. Así el modelador puede ordenar la ruta como se
    // produce de verdad (una lona se imprime y DESPUÉS se refuerza) sin que la
    // impresión cotice sobre la medida chica.
    //
    // Es seguro porque esas familias no pueden depender de nada que publique un
    // paso anterior: no soportan HEREDAR_DEL_OUTPUT_CANONICO y su regla
    // CONDICIONAL no puede mirar outputs canónicos (`validacion-pre-pasada.ts`).
    // Ver docs/modificaciones-fisicas-lona-diseno.md §6.1.
    const mutacionesPrePasada = new Map<string, MutacionAplicada>();
    for (const paso of producto.pasos) {
      if (!familiaMutaMedidasEnPrePasada(paso.familiaCodigo)) continue;
      const activacion = this.evaluarActivacion(paso, jobContext);
      if (!activacion.activado) continue;

      const nombrePaso = paso.nombreVisible ?? paso.familiaCodigo;
      const params = parsearParamsModificacionPre(
        this.paramsEfectivosDelPaso(paso, jobContext),
      );
      if (!params) {
        // Corta la cotización a propósito: un PRE activo pero sin lados ni
        // demasía dejaría la medida de material sin agrandar y cobraría de
        // menos EN SILENCIO — justo lo que esta familia existe para evitar.
        errores.push({
          codigo: 'modificacion_pre_mal_configurada',
          severidad: 'ERROR',
          rutaPasoId: paso.rutaPasoId,
          rutaPasoOrden: paso.rutaPasoOrden,
          familiaCodigo: paso.familiaCodigo,
          mensaje: `El paso "${nombrePaso}" no declara lados afectados ni demasía válida, así que no puede agrandar la medida de material.`,
          sugerencia:
            'Configurar en el paso los lados afectados (superior/inferior/izquierdo/derecho) y la demasía por lado en mm.',
        });
        continue;
      }
      const traza = aplicarMutacionPre(jobContext, params, {
        rutaPasoId: paso.rutaPasoId,
        nombrePaso,
      });
      if (traza) mutacionesPrePasada.set(paso.rutaPasoId, traza);
    }

    // 2. ITERAR PASOS EN ORDEN TOPOLÓGICO (orden simple por ahora)
    const pasosEjecutados: PasoEjecutado[] = [];
    /**
     * G-M2 — Outputs canónicos publicados por pasos anteriores. Cada paso
     * puede leer de aquí (HEREDAR_DEL_OUTPUT_CANONICO) y escribir lo suyo.
     * Se materializa también como flat keys en `jobContext` para que las
     * validaciones COMPARE/REQUIRES_INPUT puedan referenciarlos.
     */
    const outputsAcumulados = new Set<string>();
    let huboErrorEnPasoAnterior = false;

    for (let i = 0; i < producto.pasos.length; i++) {
      if (huboErrorEnPasoAnterior) {
        // Si un paso falló, no avanzamos a los siguientes (D.7 multi-error híbrido)
        break;
      }
      const paso = producto.pasos[i];

      const ejecucion = await this.ejecutarPaso(
        input.tenantId,
        paso,
        jobContext,
        errores,
        tarifasMap,
        periodo,
        outputsAcumulados,
      );
      // Si el paso se encendió por arrastre, el comercial tiene que verlo: si
      // no, el precio sube sin explicación.
      const arrastrado = arrastrePorConfigPasoId.get(paso.configPasoId);
      if (arrastrado && ejecucion.activado) {
        ejecucion.activadoPorDependencia = {
          requeridoPorNombre: arrastrado.requeridoPorNombre,
        };
      }
      pasosEjecutados.push(ejecucion);

      // Si este paso generó errores, marcar para no seguir
      if (
        errores.some(
          (e) => e.rutaPasoId === paso.rutaPasoId && e.severidad === 'ERROR',
        )
      ) {
        huboErrorEnPasoAnterior = true;
        continue;
      }

      // G-M2 — Mergear outputs canónicos al jobContext mutado para que los
      // siguientes pasos puedan leerlos (HEREDAR_DEL_OUTPUT_CANONICO) o
      // validar su existencia (EXISTS_OUTPUT).
      if (ejecucion.outputsCanonicos) {
        for (const [key, value] of Object.entries(ejecucion.outputsCanonicos)) {
          if (value === null || value === undefined) continue;
          (jobContext as Record<string, unknown>)[key] = value;
          outputsAcumulados.add(key);
        }
      }

      // B.3.3 — Herencia explícita: además del merge flat (donde el último
      // emisor pisa al anterior), publicar las capacidades del paso
      // indexadas por rutaPasoId bajo una clave reservada, para que un
      // paso posterior pueda heredar "de ESTE paso" sin ambigüedad.
      if (ejecucion.capacidades?.length) {
        const ctx = jobContext as Record<string, unknown>;
        const porPaso = (ctx[KEY_CAPACIDADES_POR_PASO] ?? {}) as Record<
          string,
          CapacidadEmitida[]
        >;
        porPaso[paso.rutaPasoId] = ejecucion.capacidades;
        ctx[KEY_CAPACIDADES_POR_PASO] = porPaso;
      }

      // Sub-tarea (i) — la mutación YA se aplicó en la pre-pasada (va antes del
      // bucle para que el orden de la ruta pueda ser el orden real de
      // producción). Acá sólo se adjunta la traza para el desglose y la OT.
      // Ver docs/modificaciones-fisicas-lona-diseno.md §6.1.
      const trazaPre = mutacionesPrePasada.get(paso.rutaPasoId);
      if (trazaPre) ejecucion.mutacionAplicada = trazaPre;

      // Misma lógica para ojales: sin separación ni lados la cantidad sale 0 y
      // el paso no cobra nada, otra vez en silencio.
      // FRONTERA-PRIMITIVA: colocacion_ojales calcula su layout con geometría
      // propia (calcularLayoutOjales) — Tipo B, no es dato declarable.
      if (paso.familiaCodigo === 'colocacion_ojales' && ejecucion.activado) {
        const paramsOjales = parsearParamsColocacionOjales(
          this.paramsEfectivosDelPaso(paso, jobContext),
        );
        if (paramsOjales) {
          // Layout para el visor de nesting: dónde va cada ojal.
          const layout = calcularLayoutOjales(jobContext, paramsOjales);
          if (layout.length > 0) {
            ejecucion.ojalesLayout = layout;
            ejecucion.ojalesConfig = {
              separacionMaxMm: paramsOjales.separacionMaxMm,
              lados: paramsOjales.lados,
              esquinasSiempre: paramsOjales.esquinasSiempre,
            };
          }
        }
        if (!paramsOjales) {
          errores.push({
            codigo: 'colocacion_ojales_mal_configurada',
            severidad: 'ERROR',
            rutaPasoId: paso.rutaPasoId,
            rutaPasoOrden: paso.rutaPasoOrden,
            familiaCodigo: paso.familiaCodigo,
            mensaje: `El paso "${ejecucion.nombreVisible ?? paso.familiaCodigo}" no declara separación entre ojales ni lados, así que no puede calcular cuántos ojales entran.`,
            sugerencia:
              'Configurar en el paso la separación máxima entre ojales (mm) y los lados donde van.',
          });
        }
      }
    }

    // 3. SI HAY ERRORES, NO COMPONER COTIZACIÓN
    if (errores.length > 0) {
      return { exitoso: false, errores };
    }

    // 4. F.2.7 — Aplicar cargos directos a nivel COTIZACIÓN
    const subtotalSinCargosCotizacion = pasosEjecutados.reduce(
      (acc, p) => acc + p.costoTotal,
      0,
    );
    const cargosDirectosCotizacion = this.aplicarCargosCotizacion(
      producto.cargosDirectosCotizacion,
      jobContext,
      subtotalSinCargosCotizacion,
    );

    // 5. COMPONER RESULTADO
    const tiempoTotal = pasosEjecutados.reduce(
      (acc, p) => acc + (p.tiempo?.costo ?? 0),
      0,
    );
    const materialesTotal = pasosEjecutados.reduce(
      (acc, p) =>
        acc + (p.materiales?.reduce((m, mat) => m + mat.costoTotal, 0) ?? 0),
      0,
    );
    const cargosDirectosPasoTotal = pasosEjecutados.reduce(
      (acc, p) =>
        acc + (p.cargosDirectosPaso?.reduce((c, cd) => c + cd.monto, 0) ?? 0),
      0,
    );
    const cargosDirectosCotizacionTotal = cargosDirectosCotizacion.reduce(
      (acc, c) => acc + c.monto,
      0,
    );
    const cargosDirectosTotal =
      cargosDirectosPasoTotal + cargosDirectosCotizacionTotal;
    // Los pasos TERCERIZADOS aportan su costo directo (no tienen tiempo/material);
    // se suman aparte para no perderlos ni duplicar el costo de los internos.
    const tercerizadoTotal = pasosEjecutados.reduce(
      (acc, p) => acc + (p.tercerizado ? p.costoTotal : 0),
      0,
    );
    const total =
      tiempoTotal + materialesTotal + cargosDirectosTotal + tercerizadoTotal;
    const cantidadEfectiva = jobContext.cantidad ?? 1;
    const cantidadComercialReal = this.resolverCantidadComercialBase(
      producto,
      jobContext,
      pasosEjecutados,
    );
    const minimoComercialContext = this.resolverMinimoComercialContext(
      producto,
      cantidadComercialReal,
      pasosEjecutados,
    );
    if (minimoComercialContext.error) {
      return { exitoso: false, errores: [minimoComercialContext.error] };
    }
    const errorMinimo = this.validarMinimoComercial(
      producto,
      minimoComercialContext,
    );
    if (errorMinimo) {
      return { exitoso: false, errores: [errorMinimo] };
    }
    const cantidadComercialPricing = this.resolverCantidadComercialPricing(
      producto,
      jobContext,
      pasosEjecutados,
      minimoComercialContext,
    );
    const costoUnitarioComercial = this.resolverCostoUnitarioComercial(
      total,
      minimoComercialContext.base === 'pliegos_impresos'
        ? minimoComercialContext.cantidadReal
        : cantidadComercialReal,
      cantidadComercialPricing,
    );

    const cotizacion: CotizacionResultado = {
      productoId: producto.productoId,
      productoNombre: producto.productoNombre,
      rutaAlternativaId: producto.rutaAlternativaId,
      rutaNombre: producto.rutaAlternativaNombre,
      cantidadEfectiva,
      cantidadPedida: input.jobContext.cantidad,
      cantidadComercialReal,
      cantidadComercialPricing,
      unidadComercialPricing:
        minimoComercialContext.base === 'pliegos_impresos'
          ? 'pliegos'
          : producto.unidadComercial,
      minimoComercialAplicado: this.buildMinimoComercialAplicado(
        producto,
        minimoComercialContext,
        cantidadComercialPricing,
      ),
      costos: {
        tiempoTotal,
        materialesTotal,
        cargosDirectosTotal,
        tercerizadoTotal,
        total,
        unitario: costoUnitarioComercial,
      },
      pasos: pasosEjecutados,
      cargosDirectosCotizacion,
    };

    let desglose: Awaited<ReturnType<typeof this.calcularPrecioConSnapshots>>;
    try {
      // F.2.12 — Calcular precio a partir del costo + Tab Precio del producto
      if (producto.precioConfigJson) {
        cotizacion.precio = calcularPrecio(
          cotizacion.costos.unitario,
          cantidadComercialPricing,
          producto.precioConfigJson as PrecioConfig,
        );
      }

      // Sprint 5.a — Desglose completo (impuestos + comisiones + override cliente).
      // Se calcula en cualquier caso (no sólo al guardar) para que el cotizador en
      // preview muestre el precio bruto real.
      desglose = await this.calcularPrecioConSnapshots({
        tenantId: input.tenantId,
        productoId: input.productoId,
        clienteId: input.clienteId ?? undefined,
        costoUnitario: cotizacion.costos.unitario,
        cantidad: cantidadComercialPricing,
      });
    } catch (error) {
      return {
        exitoso: false,
        errores: [
          {
            codigo: 'PRECIO_NO_CALCULABLE',
            severidad: 'ERROR',
            mensaje:
              error instanceof Error
                ? error.message
                : 'No se pudo calcular el precio comercial del producto.',
            contexto: {
              productoId: producto.productoId,
              unidadComercial: producto.unidadComercial,
              cantidadComercialPricing,
              costoUnitario: cotizacion.costos.unitario,
            },
            sugerencia:
              'Revisá el margen objetivo, impuestos y comisiones configurados en Pricing.',
          },
        ],
      };
    }
    if (desglose) {
      cotizacion.desglosePrecio = {
        precioConfig: desglose.snapshots.precioConfig as never,
        impuestos: desglose.snapshots.impuestos,
        comisiones: desglose.snapshots.comisiones,
        precioEspecialCliente: desglose.snapshots.precioEspecialCliente
          ? {
              precioEspecialId:
                desglose.snapshots.precioEspecialCliente.precioEspecialId,
              clienteId: desglose.snapshots.precioEspecialCliente.clienteId,
            }
          : null,
        precioBase: desglose.precioBase,
        totalComisiones: desglose.totalComisiones,
        totalImpuestos: desglose.totalImpuestos,
        margenEfectivoPct: desglose.margenEfectivoPct,
        precioNetoUnitario: desglose.precioNetoUnitario,
        precioBrutoUnitario: desglose.precioBrutoUnitario,
        precioNetoTotal: desglose.precioNetoTotal,
        precioBrutoTotal: desglose.precioBrutoTotal,
      };
    }

    const cotizacionReferenciaMinimo =
      await this.resolverCotizacionReferenciaMinimoComercial({
        input,
        producto,
        minimoContext: minimoComercialContext,
        cantidadComercialReal,
        cantidadComercialPricing,
        omitir: opciones?.omitirPrecioReferenciaMinimo ?? false,
      });
    if (cotizacionReferenciaMinimo?.desglosePrecio) {
      cotizacion.precio = cotizacionReferenciaMinimo.precio;
      cotizacion.desglosePrecio = cotizacionReferenciaMinimo.desglosePrecio;
    }

    return { exitoso: true, errores: [], cotizacion };
  }

  /**
   * F.2.11 — Cotiza y persiste el resultado como CotizacionItem con snapshot
   * completo (sub-tema 07 §7).
   *
   * Crea (o agrega a) una Cotizacion + un CotizacionItem con:
   *  - jobContextJson (input del comercial al cotizar)
   *  - snapshotJson (ruta + producto + materiales + valores + cargos +
   *    selección de ruta alternativa)
   *  - costoUnitario, costoTotal, trazabilidadJson
   *
   * Si `cotizacionId` se pasa, agrega item a esa cotización; si no, crea
   * una cotización nueva en estado borrador.
   */
  async cotizarYGuardar(
    input: CotizarInput & { cotizacionId?: string },
  ): Promise<{
    result: CotizarOutput;
    cotizacionId?: string;
    cotizacionItemId?: string;
  }> {
    // Cargamos el producto una sola vez y lo reutilizamos tanto para cotizar
    // como para el snapshot (A2: evita recargar el "include gigante"). Si la
    // carga falla, dejamos que cotizar produzca el error estándar.
    let producto: ProductoCargado | null = null;
    try {
      producto = await this.cargarProductoYRuta(
        input.tenantId,
        input.productoId,
        input.rutaAlternativaId ?? null,
      );
    } catch {
      producto = null;
    }
    const result = await this.cotizar(
      input,
      producto ? { productoPrecargado: producto } : undefined,
    );
    if (!result.exitoso || !result.cotizacion || !producto) {
      return { result };
    }

    // Crear (o reusar) la cotización y su item de forma ATÓMICA (M6): si el
    // item falla, no queda una cotización borrador huérfana.
    const productoCargado = producto;
    const { cotizacionId, itemId } = await this.prisma.$transaction(
      async (tx) => {
        let cid = input.cotizacionId;
        if (cid) {
          // La cotización debe pertenecer al tenant y estar en borrador
          // (evita IDOR de escritura cross-tenant).
          const existente = await tx.cotizacion.findFirst({
            where: { id: cid, tenantId: input.tenantId },
            select: { id: true, estado: true },
          });
          if (!existente) {
            throw new NotFoundException('No se encontró la cotización.');
          }
          if (existente.estado !== 'borrador') {
            throw new BadRequestException(
              'Solo se pueden agregar items a una cotización en borrador.',
            );
          }
        } else {
          // El cliente asociado debe pertenecer al tenant.
          if (input.clienteId) {
            const cliente = await tx.cliente.findFirst({
              where: { id: input.clienteId, tenantId: input.tenantId },
              select: { id: true },
            });
            if (!cliente) {
              throw new NotFoundException('No se encontró el cliente.');
            }
          }
          const nueva = await tx.cotizacion.create({
            data: {
              tenantId: input.tenantId,
              clienteId: input.clienteId ?? null,
              estado: 'borrador',
            },
          });
          cid = nueva.id;
        }

        const item = await tx.cotizacionItem.create({
          data: this.buildCotizacionItemData({
            tenantId: input.tenantId,
            cotizacionId: cid,
            productoId: input.productoId,
            jobContext: input.jobContext,
            producto: productoCargado,
            cotizacion: result.cotizacion!,
          }),
        });

        return { cotizacionId: cid, itemId: item.id };
      },
    );

    return { result, cotizacionId, cotizacionItemId: itemId };
  }

  async recotizarItem(input: {
    tenantId: string;
    cotizacionItemId: string;
    rutaAlternativaId?: string | null;
    jobContext: JobContext;
    clienteId?: string | null;
    periodo?: string | null;
  }): Promise<{
    result: CotizarOutput;
    cotizacionId?: string;
    cotizacionItemId?: string;
  }> {
    const item = await this.prisma.cotizacionItem.findFirst({
      where: { id: input.cotizacionItemId, tenantId: input.tenantId },
      include: {
        cotizacion: { select: { id: true, estado: true, clienteId: true } },
      },
    });
    if (!item) {
      throw new NotFoundException('No se encontró el item de cotización.');
    }
    if (item.cotizacion.estado !== 'borrador') {
      throw new BadRequestException(
        'Solo se pueden recotizar items de una cotización en borrador.',
      );
    }

    const result = await this.cotizar({
      tenantId: input.tenantId,
      productoId: item.productoId,
      rutaAlternativaId: input.rutaAlternativaId ?? item.rutaAlternativaId,
      jobContext: input.jobContext,
      clienteId: input.clienteId ?? item.cotizacion.clienteId ?? null,
      periodo: input.periodo ?? null,
    });
    if (!result.exitoso || !result.cotizacion) {
      return { result };
    }

    const producto = await this.cargarProductoYRuta(
      input.tenantId,
      item.productoId,
      result.cotizacion.rutaAlternativaId ?? input.rutaAlternativaId ?? null,
    );

    await this.prisma.cotizacionItem.update({
      where: { id: item.id },
      data: this.buildCotizacionItemData({
        tenantId: input.tenantId,
        cotizacionId: item.cotizacionId,
        productoId: item.productoId,
        jobContext: input.jobContext,
        producto,
        cotizacion: result.cotizacion,
      }),
    });

    return {
      result,
      cotizacionId: item.cotizacionId,
      cotizacionItemId: item.id,
    };
  }

  private buildCotizacionItemData(args: {
    tenantId: string;
    cotizacionId: string;
    productoId: string;
    jobContext: JobContext;
    producto: ProductoCargado;
    cotizacion: CotizacionResultado;
  }) {
    const desglosePrecio = args.cotizacion.desglosePrecio;
    const precioResultado = desglosePrecio
      ? {
          precioUnitario: desglosePrecio.precioBrutoUnitario,
          precioTotal: desglosePrecio.precioBrutoTotal,
          snapshots: {
            precioConfig: desglosePrecio.precioConfig,
            impuestos: desglosePrecio.impuestos,
            comisiones: desglosePrecio.comisiones,
            precioEspecialCliente: desglosePrecio.precioEspecialCliente,
          },
        }
      : null;

    return {
      tenantId: args.tenantId,
      cotizacionId: args.cotizacionId,
      productoId: args.productoId,
      rutaAlternativaId: args.cotizacion.rutaAlternativaId,
      cantidad: args.cotizacion.cantidadComercialReal.toString(),
      jobContextJson: args.jobContext as never,
      snapshotJson: {
        producto: {
          id: args.producto.productoId,
          codigo: args.producto.productoCodigo,
          nombre: args.producto.productoNombre,
          unidadComercial: args.producto.unidadComercial,
          modoMedidas: args.producto.modoMedidas,
          minimoComercialBase: args.producto.minimoComercialBase,
        },
        ruta: {
          id: args.producto.rutaId,
          codigo: args.producto.rutaCodigo,
          nombre: args.producto.rutaNombre,
          alternativa: args.producto.rutaAlternativaNombre,
          pasos: args.producto.pasos.map((p) => ({
            orden: p.rutaPasoOrden,
            familia: p.familiaCodigo,
            maquina: p.maquina?.codigo,
            perfil: p.perfil?.nombre,
            materialesEnSlots: p.slots.map((s) => ({
              slot: s.slotCodigo,
              modo: s.modoSeleccion,
              materialSku: s.materialVariante?.sku,
            })),
          })),
        },
        ejecucion: {
          cantidadEfectiva: args.cotizacion.cantidadEfectiva,
          cantidadPedida: args.cotizacion.cantidadPedida,
          cantidadComercialReal: args.cotizacion.cantidadComercialReal,
          cantidadComercialPricing: args.cotizacion.cantidadComercialPricing,
          unidadComercialPricing: args.cotizacion.unidadComercialPricing,
          minimoComercialAplicado: args.cotizacion.minimoComercialAplicado,
          costos: args.cotizacion.costos,
        },
      } as never,
      costoUnitario: args.cotizacion.costos.unitario.toString(),
      costoTotal: args.cotizacion.costos.total.toString(),
      precioUnitario: precioResultado?.precioUnitario?.toString() ?? null,
      precioTotal: precioResultado?.precioTotal?.toString() ?? null,
      trazabilidadJson: {
        pasos: args.cotizacion.pasos,
        cargosDirectosCotizacion: args.cotizacion.cargosDirectosCotizacion,
      } as never,
      precioConfigSnapshotJson: (precioResultado?.snapshots.precioConfig ??
        null) as never,
      impuestosSnapshotJson: (precioResultado?.snapshots.impuestos ??
        null) as never,
      comisionesSnapshotJson: (precioResultado?.snapshots.comisiones ??
        null) as never,
      precioEspecialClienteSnapshotJson: (precioResultado?.snapshots
        .precioEspecialCliente ?? null) as never,
    };
  }

  /**
   * Sprint 5.a — Resuelve la capa comercial al cotizar:
   *   1) Lee `precioConfigJson` del producto (o del override por cliente si aplica).
   *   2) Carga impuestos y comisiones aplicados al producto (con sus catálogos).
   *   3) Llama a `AplicarPrecioService.aplicar()` con todo eso y el costo del motor.
   *
   * Devuelve `null` si el producto no tiene `precioConfigJson` configurado
   * (caso transición: producto creado sin Tab Precio). En ese caso el item
   * se persiste sin precio y la UI mostrará "—".
   */
  private async calcularPrecioConSnapshots(args: {
    tenantId: string;
    productoId: string;
    clienteId?: string;
    costoUnitario: number;
    cantidad: number;
  }): Promise<{
    precioUnitario: number;
    precioTotal: number;
    precioBase: number;
    totalComisiones: number;
    totalImpuestos: number;
    margenEfectivoPct: number;
    precioNetoUnitario: number;
    precioBrutoUnitario: number;
    precioNetoTotal: number;
    precioBrutoTotal: number;
    snapshots: {
      precioConfig: TabPrecioConfig;
      impuestos: PrecioImpuestoSnapshot[];
      comisiones: PrecioComisionSnapshot[];
      precioEspecialCliente:
        | import('../productos-servicios/precio/aplicar-precio.types').PrecioEspecialClienteSnapshot
        | null;
    };
  } | null> {
    // 1. Producto y su precio standard
    const productoDb = await this.prisma.producto.findFirst({
      where: { id: args.productoId, tenantId: args.tenantId },
      select: { precioConfigJson: true },
    });
    if (!productoDb?.precioConfigJson) return null;
    const precioStandard =
      productoDb.precioConfigJson as unknown as TabPrecioConfig;

    // 2. Override por cliente (si hay clienteId)
    let precioConfigEfectivo: TabPrecioConfig = precioStandard;
    let precioEspecialSnapshot:
      | import('../productos-servicios/precio/aplicar-precio.types').PrecioEspecialClienteSnapshot
      | null = null;
    if (args.clienteId) {
      const override = await this.preciosEspecialesClientes.buscarActivo(
        args.tenantId,
        args.productoId,
        args.clienteId,
      );
      if (override) {
        precioConfigEfectivo =
          override.configJson as unknown as TabPrecioConfig;
        precioEspecialSnapshot = {
          precioEspecialId: override.id,
          clienteId: override.clienteId,
          config: precioConfigEfectivo,
        };
      }
    }

    // 3. Impuestos y comisiones aplicados (con sus catálogos para snapshot).
    //    Además de los asociados al producto, entran los de alcance TENANT
    //    (IIBB, imp. al cheque): son de la empresa y aplican a toda cotización
    //    sin asociación explícita por producto.
    const [impuestosAplicados, comisionesAplicadas, impuestosTenant] =
      await Promise.all([
        this.prisma.productoImpuestoAplicado.findMany({
          where: { tenantId: args.tenantId, productoId: args.productoId },
          include: { impuestoCatalogo: true },
          orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
        }),
        this.prisma.productoComisionAplicada.findMany({
          where: { tenantId: args.tenantId, productoId: args.productoId },
          include: { comisionCatalogo: true },
          orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
        }),
        this.prisma.productoImpuestoCatalogo.findMany({
          where: { tenantId: args.tenantId, alcance: 'TENANT', activo: true },
          orderBy: { nombre: 'asc' },
        }),
      ]);

    const toImpuestoSnapshot = (
      catalogo: (typeof impuestosTenant)[number],
      orden: number,
    ): PrecioImpuestoSnapshot => ({
      catalogoId: catalogo.id,
      codigo: catalogo.codigo,
      nombre: catalogo.nombre,
      porcentaje: catalogo.porcentaje,
      orden,
      baseCalculo:
        catalogo.baseCalculo === 'BRUTO_COBRADO' ? 'BRUTO_COBRADO' : 'NETO',
      traslado:
        catalogo.traslado === 'POR_FUERA' ? 'POR_FUERA' : 'POR_DENTRO',
      desglosarCliente: this.getDesglosarImpuestoCliente(catalogo.detalleJson),
    });

    const impuestosSnapshot: PrecioImpuestoSnapshot[] = impuestosAplicados.map(
      (ia) => toImpuestoSnapshot(ia.impuestoCatalogo, ia.orden),
    );
    // Merge de los TENANT no asociados explícitamente (dedupe por catálogo).
    const catalogosYaAplicados = new Set(
      impuestosSnapshot.map((i) => i.catalogoId),
    );
    for (const catalogo of impuestosTenant) {
      if (catalogosYaAplicados.has(catalogo.id)) continue;
      impuestosSnapshot.push(
        toImpuestoSnapshot(catalogo, impuestosSnapshot.length),
      );
    }
    const comisionesSnapshot: PrecioComisionSnapshot[] =
      comisionesAplicadas.map((ca) => ({
        catalogoId: ca.comisionCatalogo.id,
        codigo: ca.comisionCatalogo.codigo,
        nombre: ca.comisionCatalogo.nombre,
        porcentaje: ca.comisionCatalogo.porcentaje,
        orden: ca.orden,
        baseCalculo:
          ca.comisionCatalogo.baseCalculo === 'BRUTO_COBRADO'
            ? 'BRUTO_COBRADO'
            : 'NETO',
      }));

    // 4. Aplicar
    // El redondeo del dinero lo decide el tenant: los decimales de su moneda
    // (0 en CLP) o directo a la unidad si eligió `redondeoPrecio: 'entero'`.
    const regional = await regionalDelTenant(this.prisma, args.tenantId);
    const out = this.aplicarPrecio.aplicar({
      costoUnitario: args.costoUnitario,
      cantidad: args.cantidad,
      precioConfig: precioConfigEfectivo,
      impuestos: impuestosSnapshot,
      comisiones: comisionesSnapshot,
      precioEspecialCliente: precioEspecialSnapshot ?? undefined,
      decimalesPrecio:
        regional.redondeoPrecio === 'entero' ? 0 : regional.moneda.decimales,
    });

    return {
      precioUnitario: out.precioBrutoUnitario,
      precioTotal: out.precioBrutoTotal,
      precioBase: out.desglose.precioBase,
      totalComisiones: out.desglose.totalComisiones,
      totalImpuestos: out.desglose.totalImpuestos,
      margenEfectivoPct: out.desglose.margenEfectivoPct,
      precioNetoUnitario: out.precioNetoUnitario,
      precioBrutoUnitario: out.precioBrutoUnitario,
      precioNetoTotal: out.precioNetoTotal,
      precioBrutoTotal: out.precioBrutoTotal,
      snapshots: out.snapshots,
    };
  }

  private resolverCantidadComercialPricing(
    producto: ProductoCargado,
    jobContext: JobContext,
    pasosEjecutados: PasoEjecutado[],
    minimoContext?: MinimoComercialContext,
  ): number {
    const context =
      minimoContext ??
      this.resolverMinimoComercialContext(
        producto,
        this.resolverCantidadComercialBase(producto, jobContext, pasosEjecutados),
        pasosEjecutados,
      );
    if (context.base === 'pliegos_impresos') {
      const minimo = this.getMinimoComercialCantidad(producto);
      if (
        producto.minimoComercialPolitica === 'ADVERTIR_FACTURAR_MINIMO' &&
        minimo &&
        context.cantidadReal < minimo
      ) {
        return minimo;
      }
      return context.cantidadReal;
    }
    const cantidadBase = this.resolverCantidadComercialBase(
      producto,
      jobContext,
      pasosEjecutados,
    );
    const minimo = this.getMinimoComercialCantidad(producto);
    if (
      producto.minimoComercialPolitica === 'ADVERTIR_FACTURAR_MINIMO' &&
      minimo &&
      cantidadBase < minimo
    ) {
      return minimo;
    }
    return cantidadBase;
  }

  private resolverMinimoComercialContext(
    producto: ProductoCargado,
    cantidadComercialReal: number,
    pasosEjecutados: PasoEjecutado[],
  ): MinimoComercialContext {
    const base = this.normalizarMinimoComercialBase(producto.minimoComercialBase);
    if (
      base !== 'pliegos_impresos' ||
      producto.minimoComercialPolitica === 'NONE' ||
      !this.getMinimoComercialCantidad(producto)
    ) {
      return {
        base: 'cantidad_comercial',
        cantidadReal: cantidadComercialReal,
        unidadLabel: this.labelUnidadComercial(producto.unidadComercial),
      };
    }

    const pliegos = this.resolverPliegosImpresosDesdePasos(pasosEjecutados);
    if (!pliegos) {
      return {
        base: 'pliegos_impresos',
        cantidadReal: 0,
        unidadLabel: 'pliegos',
        error: {
          codigo: 'minimo_comercial_pliegos_sin_output',
          severidad: 'ERROR',
          mensaje:
            'El mínimo comercial está configurado por pliegos impresos, pero la ruta no publicó pliegos_impresos.',
          contexto: {
            minimoComercialBase: 'pliegos_impresos',
            outputsDisponibles: pasosEjecutados.flatMap((paso) =>
              Object.keys(paso.outputsCanonicos ?? {}),
            ),
          },
          sugerencia:
            'Usá una ruta con impresión por hoja/nesting o cambiá la base del mínimo a cantidad comercial.',
        },
      };
    }

    return {
      base: 'pliegos_impresos',
      cantidadReal: pliegos,
      unidadLabel: 'pliegos',
    };
  }

  private resolverPliegosImpresosDesdePasos(
    pasosEjecutados: PasoEjecutado[],
  ): number | null {
    for (let index = pasosEjecutados.length - 1; index >= 0; index -= 1) {
      const value = this.numeroPositivo(
        pasosEjecutados[index]?.outputsCanonicos?.pliegos_impresos,
      );
      if (value) return value;
    }
    return null;
  }

  private resolverCantidadComercialBase(
    producto: ProductoCargado,
    jobContext: JobContext,
    pasosEjecutados: PasoEjecutado[],
  ): number {
    const unidad = producto.unidadComercial?.toLowerCase();
    const cantidadFallback = this.numeroPositivo(jobContext.cantidad) ?? 1;

    if (unidad === 'm2' || unidad === 'm²') {
      return (
        this.numeroPositivo(jobContext.cantidadComercial) ??
        this.numeroPositivo(jobContext.cantidadComercialPricing) ??
        this.numeroPositivo(jobContext.piezaAreaTotalM2) ??
        this.calcularM2ComercialDesdePiezas(jobContext.piezas) ??
        this.calcularM2DesdeMedida(jobContext, producto) ??
        cantidadFallback
      );
    }

    if (
      unidad === 'metro_lineal' ||
      unidad === 'ml' ||
      unidad === 'metro lineal'
    ) {
      return (
        this.numeroPositivo(jobContext.cantidadComercial) ??
        this.numeroPositivo(jobContext.metrosLineales) ??
        this.numeroPositivo(jobContext.metroLineal) ??
        this.numeroPositivo(jobContext.ml) ??
        this.resolverMetrosLinealesDesdeNesting(pasosEjecutados) ??
        this.numeroPositivo(jobContext.cantidadComercialPricing) ??
        cantidadFallback
      );
    }

    return (
      this.numeroPositivo(jobContext.cantidadComercial) ??
      this.numeroPositivo(jobContext.cantidadComercialPricing) ??
      cantidadFallback
    );
  }

  private resolverCostoUnitarioComercial(
    costoTotalReal: number,
    cantidadComercialReal: number,
    cantidadComercialPricing: number,
  ) {
    const cantidadBase =
      cantidadComercialReal > 0 ? cantidadComercialReal : cantidadComercialPricing;
    return cantidadBase > 0 ? costoTotalReal / cantidadBase : 0;
  }

  private async resolverCotizacionReferenciaMinimoComercial(args: {
    input: CotizarInput;
    producto: ProductoCargado;
    minimoContext: MinimoComercialContext;
    cantidadComercialReal: number;
    cantidadComercialPricing: number;
    omitir: boolean;
  }): Promise<CotizacionResultado | null> {
    if (args.omitir) return null;
    if (
      args.producto.minimoComercialPolitica !== 'ADVERTIR_FACTURAR_MINIMO' ||
      args.cantidadComercialPricing <= args.minimoContext.cantidadReal
    ) {
      return null;
    }

    const jobContextReferencia = this.crearJobContextReferenciaMinimoComercial(
      args.input.jobContext,
      args.producto,
      args.cantidadComercialReal,
      args.cantidadComercialPricing,
      args.minimoContext,
    );
    const resultado = await this.cotizar(
      {
        ...args.input,
        jobContext: jobContextReferencia,
      },
      { omitirPrecioReferenciaMinimo: true },
    );

    if (!resultado.exitoso || !resultado.cotizacion) return null;
    return resultado.cotizacion;
  }

  private crearJobContextReferenciaMinimoComercial(
    jobContext: JobContext,
    producto: ProductoCargado,
    cantidadComercialReal: number,
    cantidadComercialPricing: number,
    minimoContext?: MinimoComercialContext,
  ): JobContext {
    const next = JSON.parse(JSON.stringify(jobContext)) as JobContext;
    const unidad = producto.unidadComercial?.toLowerCase();
    const minimoBase = minimoContext?.base ?? 'cantidad_comercial';
    const ratioBase =
      minimoBase === 'pliegos_impresos'
        ? (minimoContext?.cantidadReal ?? 0)
        : cantidadComercialReal;
    const ratio = ratioBase > 0 ? cantidadComercialPricing / ratioBase : 1;

    if (minimoBase === 'pliegos_impresos') {
      next.cantidad = Math.max(1, Math.ceil(cantidadComercialPricing));
      next.cantidadComercial = next.cantidad;
      next.cantidadComercialPricing = next.cantidad;
      delete next.piezas;
      delete next.medidaCustomMm;
      delete next.piezaAreaTotalM2;
      delete next.metrosLineales;
      delete next.metroLineal;
      delete next.ml;
      return next;
    }

    if (unidad === 'm2' || unidad === 'm²') {
      next.cantidadComercial = cantidadComercialPricing;
      next.cantidadComercialPricing = cantidadComercialPricing;
      next.piezaAreaTotalM2 = cantidadComercialPricing;
    } else if (
      unidad === 'metro_lineal' ||
      unidad === 'ml' ||
      unidad === 'metro lineal'
    ) {
      next.cantidadComercial = cantidadComercialPricing;
      next.cantidadComercialPricing = cantidadComercialPricing;
      next.metrosLineales = cantidadComercialPricing;
      next.metroLineal = cantidadComercialPricing;
      next.ml = cantidadComercialPricing;
    } else {
      next.cantidad = cantidadComercialPricing;
      next.cantidadComercial = cantidadComercialPricing;
      next.cantidadComercialPricing = cantidadComercialPricing;
    }

    if (next.piezas?.length) {
      next.piezas = next.piezas.map((pieza) => ({
        ...pieza,
        cantidad: Math.max(1, Math.round(pieza.cantidad * ratio)),
      }));
    }

    return next;
  }

  private getMinimoComercialCantidad(producto: ProductoCargado) {
    const minimo = Number(producto.minimoComercialCantidad ?? 0);
    return Number.isFinite(minimo) && minimo > 0 ? minimo : null;
  }

  private validarMinimoComercial(
    producto: ProductoCargado,
    minimoContext: MinimoComercialContext,
  ): ErrorMotor | null {
    if (producto.minimoComercialPolitica !== 'BLOQUEAR') return null;
    const minimo = this.getMinimoComercialCantidad(producto);
    if (!minimo || minimoContext.cantidadReal >= minimo) return null;
    return {
      codigo: 'minimo_comercial_no_alcanzado',
      severidad: 'ERROR',
      mensaje: `La cantidad (${this.formatCantidadComercial(
        minimoContext.cantidadReal,
      )}) es menor al mínimo requerido (${this.formatCantidadComercial(
        minimo,
      )} ${minimoContext.unidadLabel}).`,
      contexto: {
        cantidadComercialReal: minimoContext.cantidadReal,
        minimoComercialCantidad: minimo,
        minimoComercialPolitica: producto.minimoComercialPolitica,
        minimoComercialBase: minimoContext.base,
        unidadComercial: producto.unidadComercial,
        unidadMinimo: minimoContext.unidadLabel,
      },
      sugerencia: 'Aumentá la cantidad o ajustá el mínimo comercial del producto.',
    };
  }

  private buildMinimoComercialAplicado(
    producto: ProductoCargado,
    minimoContext: MinimoComercialContext,
    cantidadComercialPricing: number,
  ): CotizacionResultado['minimoComercialAplicado'] {
    const minimo = this.getMinimoComercialCantidad(producto);
    if (producto.minimoComercialPolitica === 'NONE' || !minimo) return null;
    return {
      base: minimoContext.base,
      cantidadMinima: minimo,
      cantidadReal: minimoContext.cantidadReal,
      cantidadPricing: cantidadComercialPricing,
      aplicado:
        producto.minimoComercialPolitica === 'ADVERTIR_FACTURAR_MINIMO' &&
        cantidadComercialPricing > minimoContext.cantidadReal,
      unidadLabel: minimoContext.unidadLabel,
      politica: producto.minimoComercialPolitica,
    };
  }

  private normalizarMinimoComercialBase(
    base: string | null | undefined,
  ): MinimoComercialBase {
    return base === 'pliegos_impresos' ? 'pliegos_impresos' : 'cantidad_comercial';
  }

  private formatCantidadComercial(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(4);
  }

  private labelUnidadComercial(unidad: string) {
    if (unidad === 'm2') return 'm²';
    if (unidad === 'metro_lineal') return 'ml';
    return 'u.';
  }

  private resolverMetrosLinealesDesdeNesting(
    pasosEjecutados: PasoEjecutado[],
  ): number | undefined {
    for (const paso of pasosEjecutados) {
      const nesting = paso.nestingResult;
      if (nesting?.unidad !== 'm_lineales') continue;
      const cantidad = this.numeroPositivo(nesting.cantidadCalculada);
      if (cantidad) return cantidad;
    }
    return undefined;
  }

  private calcularM2ComercialDesdePiezas(
    piezas: JobContext['piezas'],
  ): number | undefined {
    if (!Array.isArray(piezas) || piezas.length === 0) return undefined;
    const total = piezas.reduce((acc, pieza) => {
      const cantidad = this.numeroPositivo(pieza.cantidad) ?? 0;
      const anchoMm = this.numeroPositivo(pieza.anchoMm) ?? 0;
      const altoMm = this.numeroPositivo(pieza.altoMm) ?? 0;
      return acc + (cantidad * anchoMm * altoMm) / 1_000_000;
    }, 0);
    return total > 0 ? total : undefined;
  }

  private calcularM2DesdeMedida(
    jobContext: JobContext,
    producto: ProductoCargado,
  ): number | undefined {
    const medida = jobContext.medidaCustomMm;
    const anchoMm =
      this.numeroPositivo(medida?.anchoMm) ??
      this.numeroPositivo(producto.medidaDefaultAnchoMm);
    const altoMm =
      this.numeroPositivo(medida?.altoMm) ??
      this.numeroPositivo(producto.medidaDefaultAltoMm);
    const cantidad = this.numeroPositivo(jobContext.cantidad) ?? 0;
    if (!anchoMm || !altoMm || !cantidad) return undefined;
    return (cantidad * anchoMm * altoMm) / 1_000_000;
  }

  private numeroPositivo(value: unknown): number | undefined {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private getDesglosarImpuestoCliente(detalleJson: unknown): boolean {
    const detalle = this.asRecord(detalleJson);
    const value =
      detalle.desglosarCliente ??
      detalle.mostrarCliente ??
      detalle.visibleCliente ??
      true;
    return value !== false;
  }

  /**
   * Deja el gramaje del sustrato principal en el JobContext, que es de donde
   * lo leen los escalones de perfil (guillotina e impresión láser).
   *
   * Contempla las dos formas de llegar al material: el que está fijado en la
   * ruta (HARDCODED) y el que elige el comercial al cotizar. Sin la segunda,
   * un producto cuyo papel se elige en la cotización dejaba el contexto sin
   * gramaje y los escalones no actuaban —el motor se quedaba con el primer
   * perfil, en silencio—.
   */
  private async enriquecerJobContextConGramajePrincipal(
    tenantId: string,
    producto: ProductoCargado,
    jobContext: JobContext,
  ) {
    const ctx = jobContext as Record<string, unknown>;
    if (
      this.numeroPositivo(ctx.gramajeMaterialGr ?? ctx.gramajeGr ?? ctx.gramaje)
    ) {
      return;
    }

    const leerGramaje = (atributos: unknown) => {
      const attrs = this.asRecord(atributos);
      return this.numeroPositivo(
        attrs.gramajeGr ?? attrs.gramaje ?? attrs.gramaje_g_m2,
      );
    };
    const anotar = (gramaje: number) => {
      ctx.gramajeMaterialGr = gramaje;
      ctx.gramajeGr = gramaje;
    };

    for (const paso of producto.pasos) {
      for (const slot of paso.slots) {
        if (slot.slotCodigo !== 'sustrato_principal') continue;

        if (slot.modoSeleccion === 'HARDCODED') {
          const gramaje = leerGramaje(slot.materialVariante?.atributosVarianteJson);
          if (gramaje) {
            anotar(gramaje);
            return;
          }
          continue;
        }

        // El comercial eligió el papel en la cotización: se carga esa
        // variante para leerle el gramaje. Sólo se acepta si es uno de los
        // candidatos declarados, igual que en resolverMaterialSlot.
        const eleccion = this.getEleccionMaterialComercial(
          slot,
          jobContext,
          paso,
        );
        if (!eleccion) continue;
        if (!this.getSlotCandidatoVarianteIds(slot).includes(eleccion)) continue;
        const variante = await this.cargarVariantePorId(tenantId, eleccion);
        const gramaje = leerGramaje(variante?.atributosVarianteJson);
        if (gramaje) {
          anotar(gramaje);
          return;
        }
      }
    }
  }

  private enriquecerJobContextConTecnologias(
    pasos: PasoCargado[],
    jobContext: JobContext,
  ) {
    const ctx = jobContext as Record<string, unknown>;
    const tecnologias = new Set<string>();
    for (const paso of pasos) {
      const pasoConMaquina = this.resolverMaquinaM2(paso, jobContext);
      const tecnologia = this.resolverTecnologiaMaquina(pasoConMaquina.maquina);
      if (!tecnologia) continue;
      ctx[`tecnologia_${pasoConMaquina.configPasoId}`] = tecnologia;
      ctx[`tecnologia_${pasoConMaquina.rutaPasoId}`] = tecnologia;
      tecnologias.add(tecnologia);
    }
    if (tecnologias.size === 1) {
      ctx.tecnologia = Array.from(tecnologias)[0];
    }
    if (tecnologias.size > 0) {
      ctx.tecnologiasPorPaso = Object.fromEntries(
        Object.entries(ctx).filter(
          ([key, value]) =>
            key.startsWith('tecnologia_') && typeof value === 'string',
        ),
      );
    }
  }

  private resolverTecnologiaMaquina(
    maquina: PasoCargado['maquina'] | undefined,
  ) {
    if (!maquina) return null;
    const params = maquina.parametrosTecnicosJson ?? {};
    const raw =
      typeof params.tecnologia === 'string' && params.tecnologia.trim()
        ? params.tecnologia
        : typeof params.tecnologiaMaquina === 'string' &&
            params.tecnologiaMaquina.trim()
          ? params.tecnologiaMaquina
          : null;
    const normalized = raw ? this.normalizarTecnologiaMaquina(raw) : null;
    if (normalized) return normalized;
    return this.tecnologiaPorPlantilla(maquina.plantilla);
  }

  private normalizarTecnologiaMaquina(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s-]+/g, '_');
    if (normalized === 'solvente') return 'eco_solvente';
    if (normalized === 'eco_solvente') return 'eco_solvente';
    if (normalized === 'ultravioleta') return 'uv';
    if (normalized === 'latex') return 'latex';
    if (normalized === 'laser') return 'laser';
    if (normalized === 'sublimacion') return 'sublimacion';
    if (normalized === 'dtf_textil') return 'dtf_textil';
    if (normalized === 'dtf_uv') return 'dtf_uv';
    if (normalized === 'inkjet') return 'inkjet';
    if (normalized === 'uv') return 'uv';
    return normalized || null;
  }

  private tecnologiaPorPlantilla(plantilla: string | undefined) {
    const normalized = plantilla?.toLowerCase();
    if (!normalized) return null;
    if (normalized === 'impresora_laser') return 'laser';
    // Los plotters CAD son siempre inkjet (tecnología fija por plantilla).
    if (normalized === 'plotter_cad') return 'inkjet';
    return null;
  }

  // ============================================================================
  // EJECUCIÓN DE UN PASO (sub-tareas a-i — versión MVP)
  // ============================================================================

  /** Devuelve el período actual en formato 'YYYY-MM'. */
  private getPeriodoActual(): string {
    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }

  /**
   * Costo de un paso tercerizado (lo compra un proveedor). No consume máquina ni
   * tiempo interno; el motor lo suma como cualquier paso. Delega el costeo al
   * módulo puro `tercerizado-costo`. docs/productos-tercerizados-diseno.md §5.
   */
  /**
   * Etiquetas (eje→valor) de los atributos elegidos de un paso tercerizado con
   * matriz, para mostrarlos en Especificaciones. Excluye el eje `cantidad` (ya
   * se ve en la cantidad del ítem). Usa las etiquetas del config; cae al valor
   * crudo si falta.
   */
  private etiquetasEjesTercerizado(
    config: Record<string, unknown>,
    seleccion: Record<string, unknown>,
  ): Array<{ eje: string; valor: string }> {
    const ejes = Array.isArray(config.ejes)
      ? (config.ejes as Array<Record<string, unknown>>)
      : [];
    const filas: Array<{ eje: string; valor: string }> = [];
    for (const eje of ejes) {
      const clave = typeof eje.clave === 'string' ? eje.clave : '';
      if (!clave || clave === 'cantidad') continue;
      const valorClave = seleccion[clave];
      if (valorClave == null || valorClave === '') continue;
      const valores = Array.isArray(eje.valores)
        ? (eje.valores as Array<Record<string, unknown>>)
        : [];
      const match = valores.find((v) => v.clave === valorClave);
      filas.push({
        eje: (typeof eje.label === 'string' && eje.label) || clave,
        valor:
          (match && typeof match.label === 'string' && match.label) ||
          String(valorClave),
      });
    }
    return filas;
  }

  private ejecutarPasoTercerizado(
    paso: PasoCargado,
    jobContext: JobContext,
    errores: ErrorMotor[],
  ): PasoEjecutado {
    const config = (paso.tercerizadoConfigJson ?? {}) as Record<string, unknown>;
    const seleccionMatriz =
      ((jobContext as Record<string, unknown>)[
        `tercerizado_${paso.configPasoId}`
      ] as Record<string, unknown>) ?? {};
    const base = {
      rutaPasoId: paso.rutaPasoId,
      rutaPasoOrden: paso.rutaPasoOrden,
      familiaCodigo: paso.familiaCodigo,
      nombreVisible: paso.nombreVisible,
      configPasoId: paso.configPasoId,
      activado: true,
      tercerizado: true,
      proveedorId: paso.proveedorId ?? null,
      plazoProveedorDias: paso.plazoProveedorDias ?? null,
      tecnologiaTercerizado:
        typeof config.tecnologia === 'string' ? config.tecnologia : null,
      tercerizadoEtiquetas: this.etiquetasEjesTercerizado(config, seleccionMatriz),
    };
    const resultado = resolverCostoTercerizado({
      fuente: paso.fuenteCostoTercerizado ?? '',
      config,
      magnitudes: {
        area_m2: jobContext.piezaAreaTotalM2,
        perimetro_ml: jobContext.piezaPerimetroTotalM,
        ml: jobContext.metrosLineales ?? jobContext.ml,
        cantidad: jobContext.cantidad ?? jobContext.cantidadComercial,
      },
      seleccionMatriz,
      entradas: paso.tercerizadoEntradas ?? [],
    });
    if (!resultado.ok) {
      errores.push({
        codigo: 'tercerizado_no_resoluble',
        severidad: 'ERROR',
        mensaje: resultado.error,
        rutaPasoId: paso.rutaPasoId,
        rutaPasoOrden: paso.rutaPasoOrden,
        familiaCodigo: paso.familiaCodigo,
        contexto: {
          configPasoId: paso.configPasoId,
          fuente: paso.fuenteCostoTercerizado,
        },
      });
      return { ...base, costoTotal: 0 };
    }
    return {
      ...base,
      costoTotal: resultado.costo,
      tercerizadoDetalle: resultado.detalle,
    };
  }

  private async ejecutarPaso(
    tenantId: string,
    paso: PasoCargado,
    jobContext: JobContext,
    errores: ErrorMotor[],
    tarifasMap: Map<string, unknown>,
    periodo: string,
    outputsAcumulados: Set<string> = new Set(),
  ): Promise<PasoEjecutado> {
    const familia = resolverFamilia(paso.familiaCodigo);

    // a) ACTIVACIÓN (D.1)
    const activacion = this.evaluarActivacion(paso, jobContext);
    if (!activacion.activado) {
      return {
        rutaPasoId: paso.rutaPasoId,
        rutaPasoOrden: paso.rutaPasoOrden,
        familiaCodigo: paso.familiaCodigo,
        configPasoId: paso.configPasoId,
        activado: false,
        razonNoActivado: activacion.razon,
        costoTotal: 0,
      };
    }

    // TERCERIZADO — el paso lo compra un proveedor: costo por su fuente, sin
    // máquina ni tiempo interno. docs/productos-tercerizados-diseno.md §5.
    if (paso.tercerizado) {
      return this.ejecutarPasoTercerizado(paso, jobContext, errores);
    }

    // a.1) F.2.8 — Ejecutar validaciones D.7 declaradas por la familia
    if (familia) {
      const erroresValidacion = this.ejecutarValidaciones(
        familia,
        paso,
        jobContext,
        outputsAcumulados,
      );
      if (erroresValidacion.length > 0) {
        errores.push(...erroresValidacion);
        return {
          rutaPasoId: paso.rutaPasoId,
          rutaPasoOrden: paso.rutaPasoOrden,
          familiaCodigo: paso.familiaCodigo,
          configPasoId: paso.configPasoId,
          activado: true,
          costoTotal: 0,
        };
      }
    }

    // b) G-F2 — Resolver máquina M-2 si el paso tiene candidatas. El comercial
    //    puede elegir vía `jobContext[\`maquinaSeleccionada_${configPasoId}\`]`.
    //    Si no eligió, gana esPreferida o la primera (orden ya es preferidas
    //    primero, después orden ascendente). Si no hay candidatas, mantiene M-1.
    const pasoConMaquina = this.resolverMaquinaM2(paso, jobContext);

    // c) RESOLVER PERFIL automáticamente si aplica (F.2.4 — D.2)
    const modoColorElegido = this.resolverModoColorComercial(
      pasoConMaquina,
      jobContext,
    );
    const sinImpresion = this.esModoSinImpresion(pasoConMaquina, jobContext);
    if (
      modoColorElegido &&
      !sinImpresion &&
      !this.findPerfilCompatiblePorModoColor(pasoConMaquina, modoColorElegido)
    ) {
      errores.push({
        codigo: 'perfil_modo_color_no_compatible',
        severidad: 'ERROR',
        mensaje: `El paso ${pasoConMaquina.rutaPasoOrden} no tiene perfil compatible con el modo de color seleccionado (${modoColorElegido}).`,
        rutaPasoId: pasoConMaquina.rutaPasoId,
        rutaPasoOrden: pasoConMaquina.rutaPasoOrden,
        familiaCodigo: pasoConMaquina.familiaCodigo,
        contexto: {
          configPasoId: pasoConMaquina.configPasoId,
          modoColor: modoColorElegido,
        },
        sugerencia:
          'Configurá un perfil operativo con ese modo de color o restringí las opciones comerciales del paso.',
      });
      return {
        rutaPasoId: pasoConMaquina.rutaPasoId,
        rutaPasoOrden: pasoConMaquina.rutaPasoOrden,
        familiaCodigo: pasoConMaquina.familiaCodigo,
        configPasoId: pasoConMaquina.configPasoId,
        activado: true,
        costoTotal: 0,
      };
    }
    const perfilResuelto = sinImpresion
      ? null
      : this.resolverPerfil(pasoConMaquina, jobContext);
    if (!sinImpresion) {
      this.avisarFaltaPerfilDobleFaz(
        errores,
        pasoConMaquina,
        jobContext,
        perfilResuelto,
      );
    }
    paso = pasoConMaquina; // todo lo siguiente usa el paso con máquina resuelta

    // c.0) DOBLE FAZ — si el sustrato de este paso se duplica (aplicaMultiCaras),
    //   el paso procesa `cantidad × caras` piezas reales (cara + contracara). A
    //   partir de acá trabajamos con un JobContext del paso con las cantidades
    //   duplicadas y `caras=1`, para que el nesting (incl. la elección de rollo),
    //   el material y el tiempo salgan de las piezas reales SIN contar doble por
    //   los multiplicadores escalares de caras. El perfil (doble faz) ya se
    //   resolvió arriba con las caras originales. El precio comercial NO se ve
    //   afectado (usa la cantidad original, fuera de este método).
    const carasProcesadas = this.carasProcesadasPaso(paso, jobContext);
    if (carasProcesadas > 1) {
      jobContext = this.duplicarJobContextPorCaras(jobContext, carasProcesadas);
    }

    // c.1) RESOLVER MATERIAL PRELIMINAR (necesario para el nesting de pliegos
    //      o rollos: el algoritmo necesita conocer las dimensiones del sustrato).
    //      Si el slot principal no se puede resolver, el dispatcher devuelve null y
    //      se cae al fallback de m² crudos / cantidad directa.
    const slotPrincipal = paso.slots[0] ?? null;
    const materialPreliminar = slotPrincipal
      ? await this.resolverMaterialSlot(tenantId, slotPrincipal, jobContext, paso)
      : null;

    // d) NESTING (G-M1 — F.2.13): si el paso usa CALCULADO_POR_PASO y la familia
    //    está soportada por el dispatcher, ejecutamos el algoritmo correspondiente
    //    y obtenemos cantidadCalculada con desperdicio real. Para impresión por
    //    hoja mantenemos compatibilidad con rutas viejas: si está configurada
    //    como HEREDAR pero no existe output previo de pre-prensa, calcula su
    //    propio nesting en el paso productivo.
    let nestingDispatch: NestingDispatchResult | null = null;
    const debeCalcularNestingProductivo =
      paso.mecanismoCantidad === 'CALCULADO_POR_PASO' ||
      this.debeAutocalcularNestingSiNoHayOutput(paso, jobContext) ||
      this.debeCalcularNestingLaminado(paso);
    if (debeCalcularNestingProductivo) {
      nestingDispatch = await runNestingForPaso(
        paso,
        this.getJobContextParaNesting(paso, jobContext),
        materialPreliminar,
        {
          loadPrintSheetMaterial: (varianteId) =>
            this.cargarPrintSheetMaterial(tenantId, varianteId),
        },
      );
    }
    // FRONTERA-NESTING: cada familia del sistema que DEBE acomodar declara
    // cuándo cortar y con qué diagnóstico. El diagnóstico queda PROPIO de cada
    // familia —ahí está su valor: laminado compara film vs máquina, área
    // encuentra la pieza que no entra, montaje distingue la fuente de piezas—
    // pero el andamiaje (condición + corte con la cantidad en 0) es uno solo.
    // Cortan sólo si la familia debía nestear y el dispatcher no dio layout.
    // Tipo B, se parametrizan en la Etapa B.
    if (debeCalcularNestingProductivo && !nestingDispatch) {
      const guardsNesting: Array<{
        familia: string;
        debeCortar: () => boolean;
        error: () => ErrorMotor;
      }> = [
        {
          familia: 'laminado',
          debeCortar: () =>
            !!materialPreliminar && this.debeCalcularNestingLaminado(paso),
          error: () =>
            this.errorNestingLaminadoInvalido(
              paso,
              jobContext,
              materialPreliminar!,
            ),
        },
        {
          familia: 'plastificado_pouch',
          debeCortar: () =>
            !!materialPreliminar &&
            paso.mecanismoCantidad === 'CALCULADO_POR_PASO',
          error: () =>
            this.errorNestingPouchInvalido(
              paso,
              jobContext,
              materialPreliminar!,
            ),
        },
        {
          familia: 'impresion_por_hoja',
          debeCortar: () => this.tienePliegoImpresionAutomatico(paso),
          error: () => this.errorPliegoImpresionAutomaticoInvalido(paso),
        },
        {
          // Sólo corta si el sustrato es resoluble (rollo o pliego con
          // medidas): entonces una pieza NO ENTRA. Sin sustrato resoluble se
          // mantiene el fallback silencioso (material sin resolver).
          familia: 'impresion_por_area',
          debeCortar: () =>
            this.areaTieneSustratoResoluble(paso, jobContext, materialPreliminar),
          error: () =>
            this.errorPiezaNoEntraEnSustrato(
              paso,
              jobContext,
              resolveNestingConfig(
                paso,
                this.getJobContextParaNesting(paso, jobContext),
                materialPreliminar,
              ),
            ),
        },
        {
          // Sin layout, cotizar con la cantidad cruda dejaría el montaje sin
          // plan. Causa típica: fuentePiezasMontaje='pliegos_impresos' cuando
          // la impresión previa va en rollo y no publica pliegos.
          familia: 'montaje_sobre_sustrato',
          debeCortar: () => true,
          error: () => this.errorMontajeSinNesting(paso, jobContext),
        },
      ];

      const guard = guardsNesting.find(
        (g) => g.familia === paso.familiaCodigo && g.debeCortar(),
      );
      if (guard) {
        errores.push(guard.error());
        return this.pasoAbortado(paso);
      }
    }

    // d.1) El look-ahead de pre_prensa se retiró: pre-prensa espiaba el paso
    //      de impresión siguiente para correr SU nesting y publicar la
    //      imposición. Mientras fue así, ningún producto podía imprimirse sin
    //      un paso de pre-prensa. Ahora acomoda el paso que imprime, que es
    //      el que conoce la máquina, el pliego y el material.

    // e) TIEMPO (D.4) — usa el perfil resuelto si difiere del default; si hay
    //    nesting, su cantidadCalculada se usa como cantidad efectiva del paso.
    const pasoConPerfil: PasoCargado = perfilResuelto
      ? { ...paso, perfil: perfilResuelto }
      : paso;
    if (
      pasoConPerfil.perfil &&
      !this.esTipoPerfilCompatibleConFamilia(
        pasoConPerfil.familiaCodigo,
        pasoConPerfil.perfil.tipoPerfil,
      )
    ) {
      errores.push({
        codigo: 'perfil_maquina_incompatible_con_familia',
        severidad: 'ERROR',
        mensaje: `El perfil ${pasoConPerfil.perfil.nombre} no es compatible con la familia ${pasoConPerfil.familiaCodigo}.`,
        rutaPasoId: pasoConPerfil.rutaPasoId,
        rutaPasoOrden: pasoConPerfil.rutaPasoOrden,
        familiaCodigo: pasoConPerfil.familiaCodigo,
        contexto: {
          perfilId: pasoConPerfil.perfil.id,
          tipoPerfil: pasoConPerfil.perfil.tipoPerfil ?? null,
        },
        sugerencia:
          'Seleccionar un perfil operativo compatible con el tipo de operación del paso.',
      });
      return this.pasoAbortado(pasoConPerfil);
    }
    const tiempo = sinImpresion
      ? this.tiempoCero()
      : this.calcularTiempo(
          pasoConPerfil,
          jobContext,
          errores,
          tarifasMap,
          periodo,
          nestingDispatch,
          materialPreliminar,
        );

    // f) MATERIALES (D.5) — F.2.5: HARDCODED + COMERCIAL_ELIGE + MOTOR_ELIGE_AUTO.
    //    Si hay nesting con cantidad calculada, usamos esa cantidad para fórmulas
    //    compatibles (por_metro_lineal con shelf-rollo, por_unidad_productiva con
    //    grid-2d-single → pliegos).
    const materiales = await this.calcularMateriales(
      tenantId,
      pasoConPerfil,
      jobContext,
      nestingDispatch,
      errores,
      materialPreliminar,
    );
    const materialesCosto = materiales.reduce(
      (acc, m) => acc + m.costoTotal,
      0,
    );

    // g) CARGOS DIRECTOS A NIVEL PASO (G-M3 / D.6)
    //    Base de PORCENTAJE_SOBRE_BASE = subtotal del PASO (tiempo + materiales).
    const subtotalPaso = tiempo.costo + materialesCosto;
    const cargosDirectosPaso = sinImpresion
      ? []
      : this.aplicarCargosPaso(
          paso.cargosDirectosPaso,
          jobContext,
          subtotalPaso,
        );
    const cargosPasoTotal = cargosDirectosPaso.reduce(
      (acc, c) => acc + c.monto,
      0,
    );

    // h) G-M2 — Outputs canónicos: la familia declara qué publica al jobContext.
    //    Cantidad efectiva del paso depende del mecanismo:
    //      - DIRECT_FROM_JOBCONTEXT: jobContext.cantidad
    //      - HEREDAR_DEL_OUTPUT_CANONICO: ya resuelto en calcularTiempo
    //      - CALCULADO_POR_PASO: nestingDispatch.cantidadCalculada
    //      - CONVERSION: piezas/unidades de empaque (ya calculado por resolverCantidad)
    const cantidadEfectiva = nestingDispatch
      ? nestingDispatch.cantidadCalculada
      : this.resolverCantidad(paso, jobContext, null, materialPreliminar);

    const outputsCanonicos = calcularOutputsCanonicos(familia, {
      paso,
      jobContext,
      tiempo,
      materiales,
      nestingDispatch,
      cantidadEfectiva,
    });

    // B.3.2 — Vista estandarizada de los outputs (Registro de Capacidades),
    // para trazabilidad y UI. Aditiva: las keys planas siguen intactas.
    const capacidades = capacidadesEmitidas({
      outputsCanonicos,
      cantidadEfectiva,
      totalMin: tiempo?.totalMin,
    });

    const nestingResult: NestingEjecutado | undefined = nestingDispatch
      ? {
          algorithm: nestingDispatch.algorithm,
          cantidadCalculada: nestingDispatch.cantidadCalculada,
          unidad: nestingDispatch.unidad,
          aprovechamientoPct: nestingDispatch.aprovechamientoPct,
          substrates: nestingDispatch.substrates,
          placements: nestingDispatch.placements,
          piezasPorPliego: nestingDispatch.piezasPorPliego,
          consumedLengthMm: nestingDispatch.consumedLengthMm,
          piezasAcomodadas: nestingDispatch.piezasAcomodadas,
          visualConfig: nestingDispatch.visualConfig,
          outputsCanonicos,
          costingPreview: this.buildNestingCostingPreview(
            nestingDispatch,
            materiales,
          ),
          pliegoImpresionSeleccionado:
            nestingDispatch.pliegoImpresionSeleccionado,
          talonarioGrouping: nestingDispatch.talonarioGrouping,
        }
      : undefined;

    return {
      rutaPasoId: paso.rutaPasoId,
      rutaPasoOrden: paso.rutaPasoOrden,
      familiaCodigo: paso.familiaCodigo,
      nombreVisible: this.resolverNombreVisiblePaso(paso, jobContext),
      configPasoId: paso.configPasoId,
      activado: true,
      tiempo,
      materiales,
      cargosDirectosPaso,
      costoTotal: subtotalPaso + cargosPasoTotal,
      outputsCanonicos,
      capacidades,
      nestingResult,
    };
  }

  /**
   * G-M3 — Aplica los cargos directos a nivel PASO.
   *
   * Misma semántica que `aplicarCargosCotizacion`, pero el `subtotalBase` para
   * PORCENTAJE_SOBRE_BASE es el costo del paso (tiempo + materiales), no de la
   * cotización completa.
   *
   * Reutiliza los helpers `evaluarActivacionCargo` y `calcularMontoCargo`,
   * que son genéricos por construcción.
   */
  private aplicarCargosPaso(
    cargos: CargoPasoCargado[],
    jobContext: JobContext,
    subtotalPaso: number,
  ): CargoDirectoEjecutado[] {
    const ejecutados: CargoDirectoEjecutado[] = [];
    for (const cargo of cargos) {
      const activado = this.evaluarActivacionCargo(cargo, jobContext);
      if (!activado) continue;

      const config = (cargo.configOverrideJson ??
        cargo.catalogo.configJson) as Record<string, unknown> | null;
      const monto = this.calcularMontoCargo(
        cargo.catalogo.modoCalculo,
        config,
        jobContext,
        subtotalPaso,
      );

      ejecutados.push({
        cargoDirectoCatalogoId: cargo.cargoDirectoCatalogoId,
        cargoCodigo: cargo.catalogo.codigo,
        cargoNombre: cargo.catalogo.nombre,
        modoCalculo: cargo.catalogo.modoCalculo as
          'MONTO_FIJO_PLANO' | 'PORCENTAJE_SOBRE_BASE' | 'POR_UNIDAD_INPUT',
        monto,
        detalle: { config, baseCalculo: subtotalPaso, scope: 'PASO' },
      });
    }
    return ejecutados;
  }

  private esPasoImpresion(paso: Pick<PasoCargado, 'familiaCodigo'>) {
    return FAMILIAS_IMPRESION.has(paso.familiaCodigo);
  }

  private esModoSinImpresion(paso: PasoCargado, jobContext: JobContext) {
    return (
      this.esPasoImpresion(paso) &&
      this.resolverModoColorComercial(paso, jobContext) === MODO_SIN_IMPRESION
    );
  }

  private tiempoCero(): NonNullable<PasoEjecutado['tiempo']> {
    return {
      setupMin: 0,
      runMin: 0,
      cleanupMin: 0,
      tiempoFijoMin: 0,
      totalMin: 0,
      costo: 0,
    };
  }

  private getJobContextParaNesting(paso: PasoCargado, jobContext: JobContext) {
    if (!this.esModoSinImpresion(paso, jobContext)) return jobContext;

    const currentRuntime =
      jobContext.configPasoRuntime &&
      typeof jobContext.configPasoRuntime === 'object' &&
      !Array.isArray(jobContext.configPasoRuntime)
        ? jobContext.configPasoRuntime
        : {};
    const currentPasoRuntime =
      currentRuntime[paso.configPasoId] &&
      typeof currentRuntime[paso.configPasoId] === 'object' &&
      !Array.isArray(currentRuntime[paso.configPasoId])
        ? currentRuntime[paso.configPasoId]
        : {};
    const currentNesting =
      currentPasoRuntime.nestingConfig &&
      typeof currentPasoRuntime.nestingConfig === 'object' &&
      !Array.isArray(currentPasoRuntime.nestingConfig)
        ? currentPasoRuntime.nestingConfig
        : {};

    return {
      ...jobContext,
      configPasoRuntime: {
        ...currentRuntime,
        [paso.configPasoId]: {
          ...currentPasoRuntime,
          nestingConfig: {
            ...currentNesting,
            pieceBleedMm: 0,
            separationHMm: 0,
            separationVMm: 0,
            margins: {
              leftMm: 0,
              rightMm: 0,
              topMm: 0,
              bottomMm: 0,
              startMm: 0,
              endMm: 0,
            },
            extraMargins: {
              leftMm: 0,
              rightMm: 0,
              topMm: 0,
              bottomMm: 0,
              startMm: 0,
              endMm: 0,
            },
          },
        },
      },
    } satisfies JobContext;
  }

  private resolverNombreVisiblePaso(paso: PasoCargado, jobContext: JobContext) {
    if (this.esModoSinImpresion(paso, jobContext))
      return 'Material sin impresión';

    // [Etapa C] El nombre real de la familia va antes que humanizar el
    // código: para una familia tenant el código es un UUID y "humanizarlo"
    // es mostrarle el UUID al comercial (bug encontrado en el E2E).
    const base =
      paso.nombreVisible?.trim() ||
      resolverFamilia(paso.familiaCodigo)?.nombre ||
      this.humanizarCodigo(paso.familiaCodigo);
    if (!this.esPasoImpresion(paso)) return base;

    const modoColor = this.resolverModoColorComercial(paso, jobContext);
    if (!modoColor || modoColor === MODO_SIN_IMPRESION) return base;
    const label = MODO_COLOR_LABELS[modoColor] ?? modoColor;
    return base
      .toLocaleLowerCase('es-AR')
      .includes(label.toLocaleLowerCase('es-AR'))
      ? base
      : `${base} ${label}`;
  }

  private humanizarCodigo(value: string) {
    return value
      .replaceAll('_', ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\w/, (char) => char.toUpperCase());
  }

  private debeAutocalcularNestingSiNoHayOutput(
    paso: PasoCargado,
    jobContext: JobContext,
  ): boolean {
    if (paso.mecanismoCantidad !== 'HEREDAR_DEL_OUTPUT_CANONICO') {
      return false;
    }
    if (paso.familiaCodigo !== 'impresion_por_hoja') {
      return false;
    }

    const config = (paso.mecanismoCantidadConfigJson ?? {}) as Record<
      string,
      unknown
    >;
    const campoExplicito =
      typeof config.campoOutput === 'string' ? config.campoOutput : null;
    const campo =
      campoExplicito ?? defaultOutputParaHeredar(paso.familiaCodigo);
    if (!campo) return true;

    const valor = (jobContext as Record<string, unknown>)[campo];
    return !(typeof valor === 'number' && Number.isFinite(valor) && valor > 0);
  }

  /** D.1 — Decidir si el paso se activa. */
  private evaluarActivacion(
    paso: PasoCargado,
    jobContext: JobContext,
  ): { activado: boolean; razon?: string } {
    const modo = paso.modoActivacion ?? 'OBLIGATORIO';

    if (modo === 'NO_EJECUTAR') {
      return {
        activado: false,
        razon: 'Paso configurado como NO EJECUTAR para esta ruta del producto',
      };
    }

    if (modo === 'OBLIGATORIO') {
      return { activado: true };
    }

    if (modo === 'OPCIONAL') {
      const opcionales = jobContext.opcionalesActivados ?? {};
      const activadoPorComercial = opcionales[paso.configPasoId] === true;
      return {
        activado: activadoPorComercial,
        razon: activadoPorComercial
          ? undefined
          : 'Paso OPCIONAL no activado por el comercial',
      };
    }

    if (modo === 'CONDICIONAL') {
      // F.2.2: evaluar JsonLogic contra el JobContext
      const evaluacion = evaluarRegla(
        paso.condicionActivacionJson,
        jobContext as unknown as Record<string, unknown>,
      );
      if (evaluacion.error) {
        return {
          activado: false,
          razon: `Error evaluando regla CONDICIONAL: ${evaluacion.error}`,
        };
      }
      return {
        activado: evaluacion.resultado,
        razon: evaluacion.resultado
          ? undefined
          : 'Regla CONDICIONAL no se cumple en el contexto actual',
      };
    }

    return {
      activado: false,
      razon: `Modo de activación desconocido: ${modo}`,
    };
  }

  /** D.4 — Calcular tiempo del paso (versión MVP + F.2.10 tarifas reales). */
  private calcularTiempo(
    paso: PasoCargado,
    jobContext: JobContext,
    errores: ErrorMotor[],
    tarifasMap: Map<string, unknown>,
    periodo: string,
    nestingDispatch: NestingDispatchResult | null = null,
    materialPreliminar: {
      atributosVarianteJson?: Record<string, unknown> | null;
    } | null = null,
  ): NonNullable<PasoEjecutado['tiempo']> {
    const modoTiempo = paso.modoTiempo ?? 'T-1';

    // Tiempo manual del comercial (docs/tiempo-manual-por-paso-diseno.md):
    // gana sobre cualquier modoTiempo. Es una estimación ABSOLUTA del trabajo
    // (los multiplicadores no aplican) y reemplaza al tiempoFijo del paso para
    // no contar doble; setup/cleanup se suman igual porque preparar la máquina
    // no depende del trabajo puntual.
    const tiempoManualMin = this.resolverTiempoManualMin(
      paso,
      jobContext,
      errores,
    );

    // Setup, cleanup, tiempoFijo: jerarquía override > perfil > familia > 0
    const setupMin = paso.setupOverrideMin ?? paso.perfil?.setupMin ?? 0;
    const cleanupMin = paso.cleanupOverrideMin ?? paso.perfil?.cleanupMin ?? 0;
    const tiempoFijoMin =
      tiempoManualMin != null ? 0 : tiempoFijoEfectivoMin(paso);

    let runMin = 0;

    if (tiempoManualMin != null) {
      runMin = tiempoManualMin;
    } else if (modoTiempo === 'T-1') {
      // Fijo: solo el tiempoFijo cuenta
      runMin = 0;
    } else if (modoTiempo === 'T-2') {
      // G-M5 — Productividad PROPIA del paso (típico de pasos M-0 manuales:
      // embalaje, conteo, lijado, modificacion_post, instalacion). Soporta:
      //
      //  1) `paramsPaso.horasEstimadas`: input absoluto en HORAS. El comercial
      //     o el modelador estiman directamente cuántas horas tarda el paso
      //     (independiente de cantidad). Útil para `diseno_grafico` y casos
      //     donde no hay productividad estable.
      //  2) `jobContext[campoOverride]` con `campoOverride = paramsPaso.campoHorasJobContext`:
      //     permite que el comercial sobrescriba en runtime (ej. T-4 INPUT_MANUAL
      //     queda cubierto vía este path: el comercial ingresa el valor del RIP
      //     del láser).
      //  3) `paramsPaso.productivityValue`: cantidad/hora del operario.
      //     `runMin = (cantidadEfectiva × multiplicadores) / productividad × 60`.
      //  4) Fallback: 0 (tiempo fijo y/o cleanup cubren el caso).
      const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
      const campoOverride =
        typeof params.campoHorasJobContext === 'string'
          ? params.campoHorasJobContext
          : null;
      const horasOverride = campoOverride
        ? Number((jobContext as Record<string, unknown>)[campoOverride])
        : NaN;
      const horasParams = Number(params.horasEstimadas ?? NaN);
      const productividadPropia = productividadPropiaEfectiva(params, paso);
      const modoCalculoT2 =
        typeof params.timeCalculationMode === 'string'
          ? params.timeCalculationMode
          : 'productivity';

      if (Number.isFinite(horasOverride) && horasOverride > 0) {
        runMin = horasOverride * 60;
      } else if (Number.isFinite(horasParams) && horasParams > 0) {
        runMin = horasParams * 60;
      } else if (modoCalculoT2 === 'batch_time') {
        const minutosPorBloque = Number(params.batchTimeMin ?? 0);
        const cantidadPorBloque = Number(params.batchSize ?? 0);
        if (minutosPorBloque > 0 && cantidadPorBloque > 0) {
          let cantidadEfectiva = this.resolverCantidadProductividadPropia(
            paso,
            jobContext,
            nestingDispatch,
            materialPreliminar,
          );
          cantidadEfectiva = this.aplicarMultiplicadores(
            cantidadEfectiva,
            paso,
            jobContext,
          );
          runMin =
            Math.ceil(cantidadEfectiva / cantidadPorBloque) * minutosPorBloque;
        }
      } else if (productividadPropia > 0) {
        let cantidadEfectiva = this.resolverCantidadProductividadPropia(
          paso,
          jobContext,
          nestingDispatch,
          materialPreliminar,
        );
        cantidadEfectiva = this.aplicarMultiplicadores(
          cantidadEfectiva,
          paso,
          jobContext,
        );
        runMin = (cantidadEfectiva / productividadPropia) * 60;
      }
    } else if (
      modoTiempo === 'T-3' &&
      // FRONTERA-PRIMITIVA: guillotina deriva el run de los cortes calculados,
      // no de la productividad del perfil — algoritmo propio, Tipo B.
      paso.familiaCodigo === 'corte_guillotina'
    ) {
      runMin = this.calcularRunMinGuillotina(paso, jobContext);
    } else if (modoTiempo === 'T-3') {
      // Productividad del perfil — necesita: cantidad y productividad
      const productividad = Number(paso.perfil?.productivityValue ?? 0);
      if (productividad > 0) {
        // F.2.3 — Mecanismo de cantidad (nesting tiene prioridad si aplica)
        let cantidadEfectiva = this.resolverCantidad(
          paso,
          jobContext,
          nestingDispatch,
          materialPreliminar,
        );
        // Para T-3 con shelf-rollo, la productividad suele estar en m²/h y la
        // cantidadCalculada del nesting está en metros lineales. Convertimos a m²
        // multiplicando por el ancho útil del rollo (que viene en el sustrato).
        if (
          (nestingDispatch?.algorithm === 'shelf-rollo' ||
            nestingDispatch?.algorithm === 'maxrects-rollo' ||
            nestingDispatch?.algorithm === 'secuencial-rollo') &&
          paso.perfil?.productivityUnit === 'M2_H'
        ) {
          const ancho =
            nestingDispatch.visualConfig?.usableArea.widthMm != null
              ? nestingDispatch.visualConfig.usableArea.widthMm / 1000
              : nestingDispatch.substrates[0]?.kind === 'roll'
                ? nestingDispatch.substrates[0].widthMm / 1000
                : 0;
          cantidadEfectiva = nestingDispatch.cantidadCalculada * ancho; // m_lin × ancho_m = m²
        }
        // F.2.6 — aplicar multiplicadores activos después de normalizar la
        // unidad efectiva. En rollo M2_H, hacerlo antes se perdía al convertir
        // metros lineales a m².
        cantidadEfectiva = this.aplicarMultiplicadores(
          cantidadEfectiva,
          paso,
          jobContext,
        );
        runMin = this.calcularTiempoRunPorProductividad(
          cantidadEfectiva,
          productividad,
          paso,
          jobContext,
          nestingDispatch,
        );
      }
    }

    const totalMin = Math.ceil(setupMin + runMin + cleanupMin + tiempoFijoMin);

    // F.2.10 — Tarifa horaria. Prioridad:
    //   1. Centro de costo principal de la máquina.
    //   2. Centro de costo manual del paso cuando no hay máquina.
    let tarifaHora = 0;
    const centroCosto = this.resolveCentroCostoPaso(paso);
    if (centroCosto.id) {
      const tarifaCentro = tarifasMap.get(centroCosto.id) as
        | { tarifa: unknown }
        | undefined;
      if (tarifaCentro != null) {
        tarifaHora = Number(tarifaCentro.tarifa);
      }
    }

    if (totalMin > 0 && !centroCosto.id) {
      errores.push({
        codigo: 'centro_costo_paso_faltante',
        severidad: 'ERROR',
        mensaje:
          'El paso no tiene centro de costo aplicable para calcular su tarifa.',
        rutaPasoId: paso.rutaPasoId,
        rutaPasoOrden: paso.rutaPasoOrden,
        familiaCodigo: paso.familiaCodigo,
        sugerencia:
          'Asigná una máquina con centro de costo principal o elegí un centro de costo horario en la configuración del paso.',
      });
    } else if (
      totalMin > 0 &&
      centroCosto.id &&
      !tarifasMap.has(centroCosto.id)
    ) {
      errores.push({
        codigo: 'centro_costo_sin_tarifa_publicada',
        severidad: 'ERROR',
        mensaje: `El centro de costo ${centroCosto.nombre ?? centroCosto.id} no tiene tarifa publicada para ${periodo}.`,
        rutaPasoId: paso.rutaPasoId,
        rutaPasoOrden: paso.rutaPasoOrden,
        familiaCodigo: paso.familiaCodigo,
        contexto: {
          centroCostoId: centroCosto.id,
          centroCostoNombre: centroCosto.nombre,
        },
        sugerencia:
          'Calculá y publicá la tarifa del centro de costo para el período antes de cotizar.',
      });
    }
    // El paso paga la fracción de la capacidad del centro que ocupó, a la
    // tarifa del centro —una sola, con sueldos, energía, amortización y la
    // estructura absorbida adentro—.
    //
    // Hasta 2026-07-28 la mano de obra se descontaba del run "porque el
    // operario no está mientras la máquina corre sola". Se revirtió: la
    // dedicación del empleado YA decidió qué parte de su sueldo carga este
    // centro, y sacarla del run no la manda a otro lado, la hace desaparecer.
    // Peor: era irrecuperable por construcción. Un centro de 120 h que absorbe
    // $900.000 de sueldos necesitaría 1.440 setups de 5 min para recuperarlos
    // —o sea, el mes entero preparando y sin imprimir un minuto—.
    // Ver docs/hora-hombre-setup-cleanup-diseno.md §Reversión.
    //
    // Dotación: multiplica sólo donde la capacidad se mide en horas-hombre, o
    // sea en los pasos sin máquina. Dos personas media hora consumen una hora
    // de las del centro. Con máquina no multiplica: la capacidad son
    // horas-máquina y la máquina es una sola, la atiendan uno o cuatro.
    const tieneMaquina = paso.maquina?.centroCostoPrincipalId != null;
    const dotacionOperarios = Math.max(1, Math.round(paso.dotacionOperarios ?? 1));
    const costo =
      (totalMin / 60) * tarifaHora * (tieneMaquina ? 1 : dotacionOperarios);

    return {
      setupMin,
      runMin,
      cleanupMin,
      tiempoFijoMin,
      totalMin,
      centroCostoId: centroCosto.id,
      centroCostoNombre: centroCosto.nombre,
      tarifaHora,
      dotacionOperarios,
      costo,
      ...(tiempoManualMin != null
        ? { origenTiempo: 'manual_comercial' as const }
        : {}),
    };
  }

  /**
   * Tiempo manual del paso (docs/tiempo-manual-por-paso-diseno.md): si el paso
   * habilita `paramsPasoJson.tiempoManual`, lee los minutos que el comercial
   * ingresó en `jobContext.tiempoManualMin_<configPasoId>`.
   *
   * Devuelve null cuando no aplica o no hay valor válido (> 0) — el paso cae
   * al cálculo estándar de su modoTiempo. Si el config lo marca `obligatorio`
   * y falta el valor, emite `tiempo_manual_requerido` (corta la cotización);
   * el sheet bloquea antes, esto es defensa en profundidad.
   */
  private resolverTiempoManualMin(
    paso: PasoCargado,
    jobContext: JobContext,
    errores: ErrorMotor[],
  ): number | null {
    const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
    const config = params.tiempoManual as TiempoManualConfig | undefined;
    if (!config || typeof config !== 'object' || config.habilitado !== true) {
      return null;
    }

    const clave = `tiempoManualMin_${paso.configPasoId}`;
    const valor = Number((jobContext as Record<string, unknown>)[clave]);
    if (Number.isFinite(valor) && valor > 0) {
      return valor;
    }

    if (config.obligatorio === true) {
      const nombrePaso =
        paso.nombreVisible?.trim() || this.humanizarCodigo(paso.familiaCodigo);
      errores.push({
        codigo: 'tiempo_manual_requerido',
        severidad: 'ERROR',
        mensaje: `El paso ${nombrePaso} requiere que el comercial ingrese el tiempo estimado.`,
        rutaPasoId: paso.rutaPasoId,
        rutaPasoOrden: paso.rutaPasoOrden,
        familiaCodigo: paso.familiaCodigo,
        contexto: { configPasoId: paso.configPasoId, clave },
        sugerencia:
          'Ingresá el tiempo estimado del paso en el cotizador antes de agregar el producto.',
      });
    }
    return null;
  }

  private resolveCentroCostoPaso(paso: PasoCargado): {
    id: string | null;
    nombre: string | null;
  } {
    if (paso.maquina?.centroCostoPrincipalId) {
      return {
        id: paso.maquina.centroCostoPrincipalId,
        nombre: paso.maquina.centroCostoPrincipalNombre ?? null,
      };
    }
    return {
      id: paso.centroCostoId,
      nombre: paso.centroCosto?.nombre ?? null,
    };
  }

  private buildNestingCostingPreview(
    nestingDispatch: NestingDispatchResult,
    materiales: MaterialEjecutado[],
  ): NestingCostingPreview | undefined {
    const substrate = nestingDispatch.substrates[0];
    if (!substrate) return undefined;

    const materialConCosteo = materiales.find(
      (material) => material.detalleCosteoNesting,
    );
    const materialPrincipal =
      materialConCosteo ??
      materiales.find(
        (material) =>
          material.modoSeleccion !== 'MAQUINA_CONSUMIBLE' &&
          material.modoSeleccion !== 'MAQUINA_DESGASTE',
      ) ??
      materiales[0];

    const detail = materialConCosteo?.detalleCosteoNesting;
    const strategy =
      detail?.strategy ??
      (nestingDispatch.algorithm === 'shelf-rollo' ||
      nestingDispatch.algorithm === 'maxrects-rollo' ||
      nestingDispatch.algorithm === 'secuencial-rollo'
        ? 'consumed-length'
        : materialPrincipal?.estrategiaCosto === 'simple'
          ? 'simple'
          : undefined);

    if (
      strategy !== 'simple' &&
      strategy !== 'm2-exact' &&
      strategy !== 'consumed-length' &&
      strategy !== 'plate-segments'
    ) {
      return undefined;
    }

    const widthMm = substrate.widthMm;
    const heightMm =
      substrate.kind === 'roll' ? substrate.lengthMm : substrate.heightMm;
    const totalAreaMm2 =
      nestingDispatch.substrates.reduce((acc, sub) => {
        if (sub.kind === 'roll') return acc + sub.widthMm * sub.lengthMm;
        return acc + sub.widthMm * sub.heightMm * sub.count;
      }, 0) || widthMm * heightMm;
    const placedAreaMm2 = nestingDispatch.placements.reduce(
      (acc, placement) => acc + placement.widthMm * placement.heightMm,
      0,
    );

    if (strategy === 'm2-exact') {
      return {
        strategy,
        label: 'm² exactos de piezas',
        chargedAreaMm2: placedAreaMm2,
        wasteAreaMm2: 0,
      };
    }

    if (strategy === 'consumed-length') {
      const chargedLengthMm =
        nestingDispatch.consumedLengthMm ??
        nestingDispatch.metricasRaw.largoConsumidoMm ??
        heightMm;
      const ratio = heightMm > 0 ? Math.min(1, chargedLengthMm / heightMm) : 0;
      const chargedAreaMm2 = widthMm * chargedLengthMm;
      return {
        strategy,
        label:
          substrate.kind === 'roll'
            ? 'largo consumido del rollo'
            : 'largo consumido del sustrato',
        chargedLengthMm,
        chargedRatio: ratio,
        chargedAreaMm2,
        chargedBounds: {
          xMm: 0,
          yMm: 0,
          widthMm,
          heightMm: chargedLengthMm,
        },
        wasteAreaMm2: Math.max(0, chargedAreaMm2 - placedAreaMm2),
      };
    }

    if (strategy === 'plate-segments') {
      const segmentAppliedPct =
        detail?.lastUnit?.segmentApplied ??
        (detail && detail.fullUnits > 0 && !detail.lastUnit ? 100 : null);
      const chargedRatio = (segmentAppliedPct ?? 100) / 100;
      const chargedAreaMm2 = totalAreaMm2 * chargedRatio;
      return {
        strategy,
        label: 'segmentos de placa',
        chargedRatio,
        chargedAreaMm2,
        chargedBounds: {
          xMm: 0,
          yMm: 0,
          widthMm,
          heightMm: heightMm * chargedRatio,
        },
        wasteAreaMm2: Math.max(0, chargedAreaMm2 - placedAreaMm2),
        segmentAppliedPct,
      };
    }

    return {
      strategy: 'simple',
      label: 'costeo simple del material',
    };
  }

  // FRONTERA-NESTING: laminado nestea sólo si su film va por metro lineal.
  private debeCalcularNestingLaminado(paso: PasoCargado): boolean {
    return (
      paso.familiaCodigo === 'laminado' &&
      paso.slots.some(
        (slot) =>
          slot.slotCodigo === 'film' && slot.formula === 'por_metro_lineal',
      )
    );
  }

  /** Paso que se activó pero se cortó por error: cotiza en 0. La forma la
   *  comparten todos los guards de nesting y el de perfil incompatible. */
  private pasoAbortado(paso: PasoCargado): PasoEjecutado {
    return {
      rutaPasoId: paso.rutaPasoId,
      rutaPasoOrden: paso.rutaPasoOrden,
      familiaCodigo: paso.familiaCodigo,
      configPasoId: paso.configPasoId,
      activado: true,
      costoTotal: 0,
    };
  }

  /** ¿El área tiene un sustrato con dimensiones (rollo con ancho útil o pliego
   *  con medidas)? Si lo tiene y aun así no hubo layout, una pieza no entra y
   *  el guard corta; si no, se mantiene el fallback silencioso. */
  private areaTieneSustratoResoluble(
    paso: PasoCargado,
    jobContext: JobContext,
    material: MaterialResueltoParaNestingConfig | null,
  ): boolean {
    const nestConfig = resolveNestingConfig(
      paso,
      this.getJobContextParaNesting(paso, jobContext),
      material,
    );
    const anchoUtilRolloMm =
      nestConfig.rollWidthMm != null
        ? nestConfig.rollWidthMm -
          nestConfig.margins.leftMm -
          nestConfig.margins.rightMm
        : null;
    const tieneSustratoRollo = (anchoUtilRolloMm ?? 0) > 0;
    const tieneSustratoPliego =
      (nestConfig.sheetWidthMm ?? 0) > 0 &&
      (nestConfig.sheetHeightMm ?? 0) > 0;
    return tieneSustratoRollo || tieneSustratoPliego;
  }

  private errorPiezaNoEntraEnSustrato(
    paso: PasoCargado,
    jobContext: JobContext,
    config: NestingConfigResolved,
  ): ErrorMotor {
    const piezas = jobContext.piezas ?? [];
    const anchoUtilRolloMm =
      config.rollWidthMm != null
        ? Math.max(
            0,
            config.rollWidthMm - config.margins.leftMm - config.margins.rightMm,
          )
        : null;
    const esRollo = anchoUtilRolloMm != null && anchoUtilRolloMm > 0;
    const limiteAnchoMm = esRollo
      ? (anchoUtilRolloMm as number)
      : (config.sheetWidthMm ?? 0);
    const limiteAltoMm = esRollo ? null : (config.sheetHeightMm ?? null);

    // Lado que restringe el encaje: con rotación permitida basta que el lado
    // menor entre en el ancho útil; sin rotación es el ancho declarado.
    const ladoRestrictivo = (p: { anchoMm: number; altoMm: number }) =>
      config.allowRotation ? Math.min(p.anchoMm, p.altoMm) : p.anchoMm;
    const piezaOfensora =
      piezas
        .filter((p) => ladoRestrictivo(p) > limiteAnchoMm)
        .sort((a, b) => ladoRestrictivo(b) - ladoRestrictivo(a))[0] ??
      piezas.sort((a, b) => ladoRestrictivo(b) - ladoRestrictivo(a))[0] ??
      null;

    const detalleSustrato = esRollo
      ? `ancho útil del sustrato ${limiteAnchoMm}mm`
      : `sustrato ${limiteAnchoMm}×${limiteAltoMm ?? '?'}mm`;
    const detallePieza = piezaOfensora
      ? `La pieza de ${piezaOfensora.anchoMm}×${piezaOfensora.altoMm}mm`
      : 'Una de las piezas';

    return {
      codigo: 'pieza_no_entra_en_sustrato',
      severidad: 'ERROR',
      mensaje: `${detallePieza} no entra en el ${detalleSustrato}. Activá el panelizado para dividirla o elegí un sustrato más ancho.`,
      rutaPasoId: paso.rutaPasoId,
      rutaPasoOrden: paso.rutaPasoOrden,
      familiaCodigo: paso.familiaCodigo,
      contexto: {
        limiteAnchoMm,
        limiteAltoMm,
        allowRotation: config.allowRotation,
        panelizadoActivo: config.panelizado?.enabled ?? false,
        piezaAnchoMm: piezaOfensora?.anchoMm ?? null,
        piezaAltoMm: piezaOfensora?.altoMm ?? null,
      },
      sugerencia:
        'Activá el panelizado en la configuración del paso para dividir la pieza, o usá un sustrato/rollo más ancho.',
    };
  }

  private errorMontajeSinNesting(
    paso: PasoCargado,
    jobContext: JobContext,
  ): ErrorMotor {
    const params =
      paso.paramsPasoJson && typeof paso.paramsPasoJson === 'object'
        ? (paso.paramsPasoJson as Record<string, unknown>)
        : {};
    const fuente =
      typeof params.fuentePiezasMontaje === 'string'
        ? params.fuentePiezasMontaje
        : 'piezas_jobcontext';
    const ctx = jobContext as Record<string, unknown>;
    const hayPliegos =
      Number(ctx.pliegos_impresos ?? ctx.pliegos_calculados ?? 0) > 0;

    if (fuente === 'pliegos_impresos' && !hayPliegos) {
      return {
        codigo: 'montaje_sin_pliegos_para_montar',
        severidad: 'ERROR',
        mensaje:
          'El montaje toma las piezas de "Pliegos impresos", pero el paso de impresión previo no publicó pliegos (imprime en rollo/por área). Cambiá la fuente de piezas del montaje a "Piezas del job".',
        rutaPasoId: paso.rutaPasoId,
        rutaPasoOrden: paso.rutaPasoOrden,
        familiaCodigo: paso.familiaCodigo,
        contexto: { fuentePiezasMontaje: fuente },
        sugerencia:
          'En la config del paso de montaje, seteá "Fuente de piezas" en "Piezas del job", o asegurate de que el paso previo imprima sobre pliegos.',
      };
    }

    return {
      codigo: 'montaje_sin_nesting',
      severidad: 'ERROR',
      mensaje:
        'El montaje sobre material no pudo calcular el nesting: no encontró piezas para montar ni un sustrato con dimensiones. Revisá el material del montaje y la fuente de piezas.',
      rutaPasoId: paso.rutaPasoId,
      rutaPasoOrden: paso.rutaPasoOrden,
      familiaCodigo: paso.familiaCodigo,
      contexto: { fuentePiezasMontaje: fuente },
      sugerencia:
        'Verificá que el paso de montaje tenga un sustrato con medidas y una fuente de piezas válida.',
    };
  }

  private errorNestingLaminadoInvalido(
    paso: PasoCargado,
    jobContext: JobContext,
    material: {
      atributosVarianteJson?: Record<string, unknown> | null;
    },
  ): ErrorMotor {
    const ctx = jobContext as Record<string, unknown>;
    const pliegosImpresos = Number(ctx.pliegos_impresos ?? 0);
    const anchoPliegoMm = Number(ctx.pliego_impresion_ancho_mm ?? 0);
    const altoPliegoMm = Number(ctx.pliego_impresion_alto_mm ?? 0);
    const attrs = material.atributosVarianteJson ?? {};
    const anchoFilmMm = Number(
      attrs.anchoMm ?? attrs.widthMm ?? attrs.ancho ?? 0,
    );
    const maqParams = paso.maquina?.parametrosTecnicosJson ?? {};
    const anchoMaxMaquinaMm = Number(
      maqParams.anchoMaxRolloMm ??
        maqParams.anchoMaxMm ??
        maqParams.anchoUtil ??
        paso.maquina?.anchoUtil ??
        0,
    );

    if (
      Number.isFinite(anchoFilmMm) &&
      anchoFilmMm > 0 &&
      Number.isFinite(anchoMaxMaquinaMm) &&
      anchoMaxMaquinaMm > 0 &&
      anchoFilmMm > anchoMaxMaquinaMm
    ) {
      return {
        codigo: 'film_laminado_no_entra_en_maquina',
        severidad: 'ERROR',
        mensaje: `El film de laminado (${anchoFilmMm}mm) supera el ancho útil de la laminadora (${anchoMaxMaquinaMm}mm).`,
        rutaPasoId: paso.rutaPasoId,
        rutaPasoOrden: paso.rutaPasoOrden,
        familiaCodigo: paso.familiaCodigo,
        contexto: {
          anchoFilmMm,
          anchoMaxMaquinaMm,
          maquinaId: paso.maquina?.id ?? null,
        },
        sugerencia:
          'Elegí un film más angosto o una laminadora que soporte ese ancho.',
      };
    }

    const faltantes: string[] = [];
    if (!Number.isFinite(pliegosImpresos) || pliegosImpresos <= 0) {
      faltantes.push('pliegos impresos');
    }
    if (!Number.isFinite(anchoPliegoMm) || anchoPliegoMm <= 0) {
      faltantes.push('ancho del pliego de impresión');
    }
    if (!Number.isFinite(altoPliegoMm) || altoPliegoMm <= 0) {
      faltantes.push('alto del pliego de impresión');
    }
    if (!Number.isFinite(anchoFilmMm) || anchoFilmMm <= 0) {
      faltantes.push('ancho del film');
    }

    return {
      codigo: 'nesting_laminado_invalido',
      severidad: 'ERROR',
      mensaje: `No se pudo calcular el nesting de laminado en rollo${
        faltantes.length > 0 ? `: falta ${faltantes.join(', ')}.` : '.'
      }`,
      rutaPasoId: paso.rutaPasoId,
      rutaPasoOrden: paso.rutaPasoOrden,
      familiaCodigo: paso.familiaCodigo,
      contexto: {
        pliegosImpresos,
        anchoPliegoMm,
        altoPliegoMm,
        anchoFilmMm,
      },
      sugerencia:
        'Verificá que impresión publique pliegos y medidas, y que el film tenga ancho en sus atributos.',
    };
  }

  private errorNestingPouchInvalido(
    paso: PasoCargado,
    jobContext: JobContext,
    material: {
      atributosVarianteJson?: Record<string, unknown> | null;
    },
  ): ErrorMotor {
    const piezas =
      Array.isArray(jobContext.piezas) && jobContext.piezas.length > 0
        ? jobContext.piezas
        : jobContext.medidaCustomMm
          ? [
              {
                cantidad: Number(jobContext.cantidad ?? 0),
                anchoMm: jobContext.medidaCustomMm.anchoMm,
                altoMm: jobContext.medidaCustomMm.altoMm,
              },
            ]
          : [];
    const pieza = piezas[0] ?? null;
    const attrs = material.atributosVarianteJson ?? {};
    const anchoPouchMm = Number(attrs.anchoMm ?? attrs.ancho ?? 0);
    const altoPouchMm = Number(
      attrs.altoMm ?? attrs.largoMm ?? attrs.alto ?? 0,
    );
    const margenNoUsableMm = Number(attrs.margenNoUsableMm ?? 0);

    return {
      codigo: 'nesting_pouch_invalido',
      severidad: 'ERROR',
      mensaje:
        'La pieza no entra en el pouch seleccionado considerando margen no usable y separación.',
      rutaPasoId: paso.rutaPasoId,
      rutaPasoOrden: paso.rutaPasoOrden,
      familiaCodigo: paso.familiaCodigo,
      contexto: {
        piezaAnchoMm: pieza?.anchoMm ?? null,
        piezaAltoMm: pieza?.altoMm ?? null,
        anchoPouchMm,
        altoPouchMm,
        margenNoUsableMm,
      },
      sugerencia:
        'Elegí un pouch más grande, reducí el margen no usable o ajustá la separación entre piezas.',
    };
  }

  private tienePliegoImpresionAutomatico(paso: PasoCargado): boolean {
    if (paso.familiaCodigo !== 'impresion_por_hoja') return false;
    const params = this.asRecord(paso.paramsPasoJson);
    const nestingConfig = this.asRecord(params.nestingConfig);
    const pliego = this.asRecord(nestingConfig.pliegoImpresion);
    const modo = String(pliego.modo ?? pliego.mode ?? '').toLowerCase();
    return modo === 'automatico' || modo === 'automatic';
  }

  private errorPliegoImpresionAutomaticoInvalido(
    paso: PasoCargado,
  ): ErrorMotor {
    return {
      codigo: 'pliego_impresion_automatico_sin_candidato_valido',
      severidad: 'ERROR',
      mensaje:
        'Ningún pliego candidato admite las piezas con los márgenes configurados.',
      rutaPasoId: paso.rutaPasoId,
      rutaPasoOrden: paso.rutaPasoOrden,
      familiaCodigo: paso.familiaCodigo,
      contexto: {
        configPasoId: paso.configPasoId,
      },
      sugerencia:
        'Agregá un candidato más grande, activá candidatos válidos o revisá márgenes/separación del paso de impresión.',
    };
  }

  /** D.5 — Calcular materiales consumidos. F.2.5: soporta los 3 modos de selección. */
  private async calcularMateriales(
    tenantId: string,
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null = null,
    errores: ErrorMotor[] = [],
    materialPreliminar: {
      id: string;
      atributosVarianteJson?: Record<string, unknown> | null;
    } | null = null,
  ): Promise<MaterialEjecutado[]> {
    const ejecutados: MaterialEjecutado[] = [];
    const familia = resolverFamilia(paso.familiaCodigo);
    const automaticSlotCodes = new Set(
      (familia?.slotsRequeridos ?? [])
        .filter((slot) => slot.tipo === 'CONSUMIBLE_MAQUINA')
        .map((slot) => slot.codigo),
    );

    for (const slot of paso.slots) {
      if (automaticSlotCodes.has(slot.slotCodigo)) {
        continue;
      }
      const materialSlot = await this.resolverMaterialSlot(
        tenantId,
        slot,
        jobContext,
        paso,
      );
      if (!materialSlot) {
        if (slot.modoSeleccion === 'COMERCIAL_ELIGE') {
          errores.push(
            this.errorMaterialComercialRequerido(slot, paso, jobContext),
          );
        }
        continue;
      }
      // Origen de costo 'por_candidato': si el pliego automático eligió un
      // candidato con MP propia, el sustrato se costea con ESA variante
      // (precio real) y no con la MP fija del slot. La variante viaja en el
      // dispatch del propio paso o, en rutas con pre_prensa (HEREDAR), por
      // el output canónico `pliego_impresion_mp_variante_id`.
      const materialResuelto = await this.resolverMateriaPrimaDeCandidato(
        tenantId,
        slot,
        materialSlot,
        nestingDispatch,
        jobContext,
      );

      // Cantidad: depende de la fórmula. Si hay nesting, ajustamos a la
      // cantidad real con desperdicio.
      let cantidad = 0;
      const cantidadPorBase = this.resolverCantidadSlotPorBase(
        slot,
        paso,
        jobContext,
        nestingDispatch,
        materialResuelto,
      );
      if (cantidadPorBase !== null) {
        cantidad = cantidadPorBase;
      } else if (slot.formula === 'por_unidad_productiva') {
        // G-M9 fix (validación end-to-end 2026-04-25): la cantidad de
        // material por_unidad_productiva debe respetar el mecanismo del paso:
        //   - CALCULADO_POR_PASO con nesting → cantidadCalculada (pliegos).
        //   - HEREDAR_DEL_OUTPUT_CANONICO → output del paso anterior
        //     (ej. impresion_por_hoja hereda pliegos_calculados de pre_prensa).
        //   - DIRECT_FROM_JOBCONTEXT / CONVERSION → vía resolverCantidad.
        // Antes leía siempre `jobContext.cantidad` cuando no había nesting,
        // lo que causaba que tarjetas consumiera 1000 pliegos en vez de 18.
        const materialParaCantidad =
          paso.mecanismoCantidad === 'CONVERSION'
            ? (materialPreliminar ?? materialResuelto)
            : materialResuelto;
        cantidad = this.resolverCantidad(
          paso,
          jobContext,
          nestingDispatch,
          materialParaCantidad,
        );
        cantidad = this.ajustarCantidadSustratoComprado(
          paso,
          slot.slotCodigo,
          cantidad,
          jobContext,
          nestingDispatch,
          materialResuelto,
        );
      } else if (slot.formula === 'por_pieza') {
        cantidad = Number(jobContext.cantidad ?? 0);
      } else if (slot.formula === 'fijo') {
        cantidad = 1;
      } else if (slot.formula === 'por_m2') {
        const areaPersonalizacion = this.areaPersonalizacionM2(paso, jobContext);
        if (areaPersonalizacion !== null) {
          // El slot decora una personalización: su área es la de la estampa/film.
          cantidad = areaPersonalizacion;
        } else {
          const areaPliegoImpresion = this.calcularM2DesdePliegoImpresion(
            paso,
            jobContext,
            nestingDispatch,
          );
          if (areaPliegoImpresion > 0) {
            cantidad = areaPliegoImpresion;
          } else if (nestingDispatch?.substrates?.length) {
            // Cobra por m² consumidos del sustrato, incluyendo desperdicio:
            // rollo = largo consumido × ancho; placa/pliego = placas × ancho × alto.
            cantidad = nestingDispatch.substrates.reduce((acc, sub) => {
              if (sub.kind === 'roll') {
                return acc + (sub.lengthMm * sub.widthMm) / 1_000_000;
              }
              return acc + (sub.count * sub.widthMm * sub.heightMm) / 1_000_000;
            }, 0);
          } else {
            cantidad = this.calcularM2DesdePiezas(jobContext);
          }
        }
      } else if (slot.formula === 'por_metro_lineal') {
        if (
          (nestingDispatch?.algorithm === 'shelf-rollo' ||
            nestingDispatch?.algorithm === 'maxrects-rollo' ||
            nestingDispatch?.algorithm === 'secuencial-rollo') &&
          nestingDispatch.consumedLengthMm
        ) {
          cantidad = nestingDispatch.consumedLengthMm / 1000;
        } else {
          const metrosPliegoImpresion =
            this.calcularMetrosLinealesDesdePliegoImpresion(
              paso,
              jobContext,
              nestingDispatch,
            );
          if (metrosPliegoImpresion > 0) {
            cantidad = metrosPliegoImpresion;
          } else {
            cantidad = this.calcularMetrosLinealesDesdePiezas(jobContext);
          }
        }
      }

      const ignoraCaras = this.ignoraCarasEnMaterial(paso, slot.slotCodigo);
      const aplicaMultiCaras = slot.aplicaMultiCaras && !ignoraCaras;

      // F.2.6 — multi-caras (legacy flag)
      if (aplicaMultiCaras) {
        const carasSlot = this.carasEfectivasPaso(paso, jobContext);
        if (carasSlot > 1) cantidad *= carasSlot;
      }
      // F.2.6 — multiplicadores activos
      if (
        paso.multiplicadoresActivos &&
        paso.multiplicadoresActivos.length > 0
      ) {
        for (const codigoMult of paso.multiplicadoresActivos) {
          if (codigoMult === 'caras') {
            continue;
          }
          const valor = (jobContext as Record<string, unknown>)[codigoMult];
          if (typeof valor === 'number' && valor > 0) {
            cantidad *= valor;
          }
        }
      }

      const unidadConsumo = unidadEfectivaDeFormula(
        slot.formula,
        materialResuelto.unidadStock,
      );
      const precioUnitario = precioMaterialPorUnidadDeConsumo(
        Number(materialResuelto.precioReferencia ?? 0),
        materialResuelto.unidadStock,
        unidadConsumo,
        materialResuelto.atributosVarianteJson,
      );
      const costeoNesting = this.calcularCosteoNestingMaterial(
        this.resolverEstrategiaCosteoNesting(paso, slot.estrategiaCosto),
        precioUnitario,
        jobContext,
        nestingDispatch,
        paso,
      );
      if (costeoNesting && precioUnitario > 0) {
        cantidad = costeoNesting.totalCost / precioUnitario;
      }
      const costoTotal = costeoNesting?.totalCost ?? cantidad * precioUnitario;

      ejecutados.push({
        slotCodigo: slot.slotCodigo,
        slotNombre: slot.slotNombre ?? null,
        slotRol: slot.slotRol ?? null,
        materialVarianteId: materialResuelto.id,
        materialNombre: materialResuelto.sku,
        materialSku: materialResuelto.sku,
        materialDisplayName: this.getMaterialDisplayName(materialResuelto),
        materiaPrimaNombre: materialResuelto.materiaPrimaNombre ?? null,
        materiaPrimaTemplateId: materialResuelto.materiaPrimaTemplateId ?? null,
        materiaPrimaTipoTecnico:
          materialResuelto.materiaPrimaTipoTecnico ?? null,
        atributosVarianteJson: materialResuelto.atributosVarianteJson ?? null,
        tipoLineaCosto: 'MATERIAL',
        cantidad,
        // G-M9: la unidad efectiva depende de la fórmula del slot. Para
        // fórmulas con dimensión implícita (`por_m2`, `por_metro_lineal`)
        // usamos esa unidad. Para `fijo`, `por_pieza`, `por_unidad_productiva`
        // heredamos la unidad de stock de la materia prima (PLIEGO, ROLLO,
        // METRO_LINEAL, UNIDAD, etc.) en minúsculas.
        unidad: unidadConsumo,
        precioUnitario,
        costoTotal,
        estrategiaCosto:
          costeoNesting?.strategy ??
          this.resolverEstrategiaCosteoNesting(paso, slot.estrategiaCosto),
        detalleCosteoNesting: costeoNesting
          ? {
              strategy: costeoNesting.strategy,
              totalCost: costeoNesting.totalCost,
              unitPrice: costeoNesting.breakdown.unitPrice,
              pricePerM2: costeoNesting.breakdown.pricePerM2,
              fullUnits: costeoNesting.breakdown.fullUnits,
              fullUnitsCost: costeoNesting.breakdown.fullUnitsCost,
              lastUnit: costeoNesting.breakdown.lastUnit,
            }
          : undefined,
        modoSeleccion: slot.modoSeleccion as
          'HARDCODED' | 'COMERCIAL_ELIGE' | 'MOTOR_ELIGE_AUTO',
      });
    }

    ejecutados.push(
      ...(this.esModoSinImpresion(paso, jobContext)
        ? []
        : this.calcularConsumiblesMaquina(
            paso,
            jobContext,
            nestingDispatch,
            errores,
            materialPreliminar,
          )),
    );

    ejecutados.push(
      ...(this.esModoSinImpresion(paso, jobContext)
        ? []
        : this.calcularDesgasteMaquina(paso, jobContext, nestingDispatch)),
    );

    return ejecutados;
  }

  /**
   * Origen de costo 'por_candidato' — si el pliego automático eligió un
   * candidato con MP propia, devuelve ESA variante para costear el sustrato
   * principal. Si no aplica (modo derivado, otro slot, o la variante no se
   * puede cargar), devuelve el material del slot sin tocar.
   */
  private async resolverMateriaPrimaDeCandidato<
    T extends { id: string },
  >(
    tenantId: string,
    slot: PasoCargado['slots'][number],
    materialSlot: T,
    nestingDispatch: NestingDispatchResult | null,
    jobContext: JobContext,
  ): Promise<T | NonNullable<Awaited<ReturnType<MotorUniversalService['cargarVariantePorId']>>>> {
    if (slot.slotCodigo !== 'sustrato_principal') return materialSlot;
    const ctx = jobContext as Record<string, unknown>;
    const varianteId =
      nestingDispatch?.pliegoImpresionSeleccionado?.materiaPrima?.varianteId ??
      (typeof ctx.pliego_impresion_mp_variante_id === 'string'
        ? ctx.pliego_impresion_mp_variante_id
        : null);
    if (!varianteId || varianteId === materialSlot.id) return materialSlot;
    const variante = await this.cargarVariantePorId(tenantId, varianteId);
    return variante ?? materialSlot;
  }

  private ignoraCarasEnMaterial(
    paso: PasoCargado,
    slotCodigo: string,
  ): boolean {
    // [Etapa A] Lo declara el slot de la familia (ignoraMultiplicadorCaras).
    return slotIgnoraMultiplicadorCaras(paso.familiaCodigo, slotCodigo);
  }

  /**
   * Factor de caras que debe procesar el paso de impresión cuando el sustrato
   * se duplica por doble faz. Doble faz = se imprime cara y contracara como
   * piezas separadas, así que el paso procesa `cantidad × caras` piezas.
   *
   * Devuelve 1 salvo que el slot del sustrato (slot 0, el que se nestea) tenga
   * `aplicaMultiCaras` activo y `jobContext.caras > 1` — misma condición que el
   * costeo de material usa para su ×caras (F.2.6).
   */
  private carasProcesadasPaso(
    paso: PasoCargado,
    jobContext: JobContext,
  ): number {
    const caras = this.carasEfectivasPaso(paso, jobContext);
    if (caras <= 1) return 1;
    const slot = paso.slots?.[0];
    if (!slot) return 1;
    const aplica =
      slot.aplicaMultiCaras &&
      !this.ignoraCarasEnMaterial(paso, slot.slotCodigo);
    return aplica ? caras : 1;
  }

  /**
   * Caras que procesa ESTE paso: el override por paso del comercial
   * (`caras_<configPasoId>`, UI avanzada "caras por paso") gana sobre la
   * elección global (`jobContext.caras`). Permite, por ej., un talonario
   * con el original doble faz y el duplicado simple.
   */
  private carasEfectivasPaso(
    paso: PasoCargado,
    jobContext: JobContext,
  ): number {
    const ctx = jobContext as Record<string, unknown>;
    const override = Number(
      ctx[`caras_${paso.configPasoId}`] ?? ctx[`caras_${paso.rutaPasoId}`] ?? 0,
    );
    if (override === 1 || override === 2) return override;
    return typeof jobContext.caras === 'number' && jobContext.caras > 0
      ? jobContext.caras
      : 1;
  }

  /**
   * Devuelve un JobContext "del paso" con las cantidades de TRABAJO duplicadas
   * por `caras` (piezas, cantidad, área y perímetro totales) y `caras` puesto en
   * 1. Así todo lo que depende de las piezas impresas —nesting (incl. elección
   * de rollo), material y tiempo— trabaja sobre las piezas reales (ej. 20 en vez
   * de 10), y los multiplicadores escalares de caras (material F.2.6, tiempo,
   * tinta = área × caras) quedan neutralizados (×1) para no contar doble.
   *
   * NO se usa para el precio comercial (que sigue con la cantidad original,
   * fuera de `ejecutarPaso`): solo afecta el costo/tiempo internos del paso.
   */
  private duplicarJobContextPorCaras(
    jobContext: JobContext,
    caras: number,
  ): JobContext {
    if (caras <= 1) return jobContext;
    const jc = jobContext as Record<string, unknown>;
    const dup: Record<string, unknown> = { ...jc, caras: 1 };
    // Neutralizar también los overrides por paso (`caras_<configPasoId>`):
    // las cantidades ya quedaron duplicadas, un override en 2 contaría doble.
    for (const key of Object.keys(dup)) {
      if (key.startsWith('caras_')) dup[key] = 1;
    }
    if (typeof jc.cantidad === 'number') dup.cantidad = jc.cantidad * caras;
    for (const campo of ['piezas', 'piezasVisibles'] as const) {
      if (!Array.isArray(jc[campo])) continue;
      dup[campo] = (jc[campo] as Array<Record<string, unknown>>).map((p) => ({
        ...p,
        cantidad:
          typeof p.cantidad === 'number' ? p.cantidad * caras : p.cantidad,
      }));
    }
    for (const campo of ['piezaAreaTotalM2', 'piezaPerimetroTotalM'] as const) {
      if (typeof jc[campo] === 'number') {
        dup[campo] = (jc[campo] as number) * caras;
      }
    }
    return dup as JobContext;
  }

  private ajustarCantidadSustratoComprado(
    paso: PasoCargado,
    slotCodigo: string,
    cantidadPliegosImpresion: number,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
    materialResuelto: {
      unidadStock?: string | null;
      atributosVarianteJson?: Record<string, unknown> | null;
    },
  ): number {
    if (paso.familiaCodigo !== 'impresion_por_hoja') {
      return cantidadPliegosImpresion;
    }
    if (slotCodigo !== 'sustrato_principal') {
      return cantidadPliegosImpresion;
    }
    if (
      !Number.isFinite(cantidadPliegosImpresion) ||
      cantidadPliegosImpresion <= 0
    ) {
      return cantidadPliegosImpresion;
    }

    const printSheet = nestingDispatch?.substrates.find(
      (
        sub,
      ): sub is Extract<
        (typeof nestingDispatch.substrates)[number],
        { kind: 'sheet' }
      > => sub.kind === 'sheet',
    );
    const ctx = jobContext as Record<string, unknown>;
    const printSheetWidthMm = Number(
      printSheet?.widthMm ?? ctx.pliego_impresion_ancho_mm ?? 0,
    );
    const printSheetHeightMm = Number(
      printSheet?.heightMm ?? ctx.pliego_impresion_alto_mm ?? 0,
    );
    if (
      !Number.isFinite(printSheetWidthMm) ||
      printSheetWidthMm <= 0 ||
      !Number.isFinite(printSheetHeightMm) ||
      printSheetHeightMm <= 0
    ) {
      return cantidadPliegosImpresion;
    }

    const attrs = materialResuelto.atributosVarianteJson ?? {};
    const anchoSustratoMm = Number(attrs.anchoMm ?? attrs.widthMm ?? 0);
    const altoSustratoMm = Number(
      attrs.largoMm ?? attrs.altoMm ?? attrs.heightMm ?? 0,
    );
    if (
      !Number.isFinite(anchoSustratoMm) ||
      anchoSustratoMm <= 0 ||
      !Number.isFinite(altoSustratoMm) ||
      altoSustratoMm <= 0
    ) {
      return cantidadPliegosImpresion;
    }

    const conversion = calculateSustratoToPliegoConversion({
      sustrato: { anchoMm: anchoSustratoMm, altoMm: altoSustratoMm },
      pliegoImpresion: {
        anchoMm: printSheetWidthMm,
        altoMm: printSheetHeightMm,
      },
    });

    if (!conversion.esDerivado || conversion.pliegosPorSustrato <= 1) {
      return cantidadPliegosImpresion;
    }
    return Math.ceil(cantidadPliegosImpresion / conversion.pliegosPorSustrato);
  }

  private calcularM2DesdePliegoImpresion(
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
  ): number {
    const pliego = this.resolverPliegoImpresionParaTerminacion(
      paso,
      jobContext,
      nestingDispatch,
    );
    if (!pliego) return 0;
    return (pliego.cantidad * pliego.anchoMm * pliego.altoMm) / 1_000_000;
  }

  private calcularMetrosLinealesDesdePliegoImpresion(
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
  ): number {
    const pliego = this.resolverPliegoImpresionParaTerminacion(
      paso,
      jobContext,
      nestingDispatch,
    );
    if (!pliego) return 0;
    return (pliego.cantidad * pliego.altoMm) / 1000;
  }

  private resolverPliegoImpresionParaTerminacion(
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
  ): { cantidad: number; anchoMm: number; altoMm: number } | null {
    const sheet = nestingDispatch?.substrates.find(
      (sub) => sub.kind === 'sheet',
    );
    const anchoDesdeNesting = sheet?.kind === 'sheet' ? sheet.widthMm : 0;
    const altoDesdeNesting = sheet?.kind === 'sheet' ? sheet.heightMm : 0;
    const ctx = jobContext as Record<string, unknown>;
    const anchoMm = Number(ctx.pliego_impresion_ancho_mm ?? anchoDesdeNesting);
    const altoMm = Number(ctx.pliego_impresion_alto_mm ?? altoDesdeNesting);
    if (
      !Number.isFinite(anchoMm) ||
      anchoMm <= 0 ||
      !Number.isFinite(altoMm) ||
      altoMm <= 0
    ) {
      return null;
    }

    const cantidad = this.resolverCantidad(paso, jobContext, nestingDispatch);
    if (!Number.isFinite(cantidad) || cantidad <= 0) return null;
    return { cantidad, anchoMm, altoMm };
  }

  private calcularCosteoNestingMaterial(
    estrategiaCosto: string,
    precioUnitario: number,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
    paso: PasoCargado,
  ) {
    if (!nestingDispatch || precioUnitario <= 0) return null;
    if (!isNestingCostingStrategy(estrategiaCosto)) return null;
    if (nestingDispatch.substrates[0]?.kind !== 'sheet') return null;

    const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
    const nestingConfig =
      typeof params.nestingConfig === 'object' &&
      params.nestingConfig !== null &&
      !Array.isArray(params.nestingConfig)
        ? (params.nestingConfig as Record<string, unknown>)
        : {};
    const costingConfig =
      typeof nestingConfig.costing === 'object' &&
      nestingConfig.costing !== null &&
      !Array.isArray(nestingConfig.costing)
        ? (nestingConfig.costing as Record<string, unknown>)
        : {};
    const segmentSteps = Array.isArray(costingConfig.segmentSteps)
      ? costingConfig.segmentSteps
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item) && item > 0 && item <= 100)
      : undefined;

    const totalPieces = this.totalPiezasParaCosteo(jobContext);
    const unitsNeeded =
      nestingDispatch.substrates.reduce((acc, sub) => {
        if (sub.kind !== 'sheet') return acc;
        return acc + sub.count;
      }, 0) || Math.ceil(nestingDispatch.cantidadCalculada);

    return applyCostingStrategy({
      strategy: estrategiaCosto,
      nesting: {
        algorithm: nestingDispatch.algorithm,
        substrates: nestingDispatch.substrates,
        placements: nestingDispatch.placements,
        metrics: nestingDispatch.metricasRaw,
      },
      unitPrice: precioUnitario,
      totalPieces,
      unitsNeeded,
      pieceWidthMm: jobContext.medidaCustomMm?.anchoMm,
      pieceHeightMm: jobContext.medidaCustomMm?.altoMm,
      segmentSteps,
    });
  }

  private resolverEstrategiaCosteoNesting(
    paso: PasoCargado,
    estrategiaSlot: string,
  ): string {
    const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
    const nestingConfig =
      typeof params.nestingConfig === 'object' &&
      params.nestingConfig !== null &&
      !Array.isArray(params.nestingConfig)
        ? (params.nestingConfig as Record<string, unknown>)
        : {};
    const costingConfig =
      typeof nestingConfig.costing === 'object' &&
      nestingConfig.costing !== null &&
      !Array.isArray(nestingConfig.costing)
        ? (nestingConfig.costing as Record<string, unknown>)
        : {};
    const strategy = costingConfig.strategy;
    return typeof strategy === 'string' && strategy !== 'simple'
      ? strategy
      : estrategiaSlot;
  }

  private totalPiezasParaCosteo(jobContext: JobContext): number {
    const piezas = jobContext.piezas ?? [];
    if (piezas.length > 0) {
      return piezas.reduce((acc, pieza) => acc + pieza.cantidad, 0);
    }
    return Number(jobContext.cantidad ?? 0);
  }

  /**
   * Costo por click: las piezas que se gastan con el uso de la máquina
   * (drum, fusor, cuchilla de limpieza, barra de cera…).
   *
   * A diferencia del tóner, el desgaste NO depende de la cobertura: una hoja
   * al 2% gasta el cilindro igual que una al 60%, porque dio la misma vuelta.
   * El driver es la cantidad de páginas —clicks A4-equivalentes—, que es como
   * el fabricante declara la vida útil de cada pieza.
   *
   *   clicks = pliegos × caras × factorA4   (A4 = 1, A3 = 2; entero, como
   *                                          cuenta el contador del equipo)
   *   costo  = Σ (precio del repuesto / vida útil) × clicks
   *
   * Ver docs/costo-por-click-desgaste-diseno.md
   */
  private calcularDesgasteMaquina(
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
  ): MaterialEjecutado[] {
    const maquina = paso.maquina;
    const componentes = maquina?.componentesDesgaste ?? [];
    if (!maquina || componentes.length === 0) return [];
    if (paso.familiaCodigo !== 'impresion_por_hoja') return [];

    const clicks = this.clicksA4DelPaso(paso, jobContext, nestingDispatch);
    if (clicks <= 0) return [];

    // Un trabajo en blanco y negro mueve sólo el drum negro: las piezas de
    // color no giran y no se cobran.
    const modoColor = this.resolverModoColorEfectivoConsumibles(
      paso,
      jobContext,
    );
    const esColor = modoColor !== 'BN';

    const ejecutados: MaterialEjecutado[] = [];
    for (const componente of componentes) {
      if (componente.soloColor && !esColor) continue;

      const vidaUtil = this.numeroPositivo(componente.vidaUtilEstimada);
      if (!vidaUtil) continue;

      // El precio de la variante manda; el suelto es para el repuesto que
      // todavía no está dado de alta en inventario.
      const precioRepuesto =
        this.numeroPositivo(
          componente.materiaPrimaVariante?.precioReferencia,
        ) ?? this.numeroPositivo(componente.precioUnitario);
      if (!precioRepuesto) continue;

      const costoPorClick = precioRepuesto / vidaUtil;
      const costoTotal = costoPorClick * clicks;

      ejecutados.push({
        slotCodigo: `desgaste_${componente.id}`,
        slotNombre: componente.nombre,
        slotRol: 'desgaste',
        materialVarianteId: componente.materiaPrimaVarianteId ?? '',
        materialNombre: componente.nombre,
        materialSku: componente.materiaPrimaVariante?.sku ?? '',
        materialDisplayName: componente.nombre,
        materiaPrimaNombre: componente.nombre,
        tipoLineaCosto: 'DESGASTE_MAQUINA',
        cantidad: clicks,
        unidad: 'a4_equiv',
        precioUnitario: costoPorClick,
        costoTotal,
        estrategiaCosto: 'costo_por_click',
        // La pieza la declara la máquina, no un slot que alguien elija.
        modoSeleccion: 'MAQUINA_DESGASTE',
      });
    }

    return ejecutados;
  }

  /**
   * Clicks A4-equivalentes que consume el paso: lo que contaría el contador
   * de la máquina. Cada cara impresa de cada pliego es un click, y un pliego
   * más grande que un A4 cuenta como los A4 que entran en él, redondeado
   * para arriba (un SRA3 son 2 clicks, no 2,31).
   */
  private clicksA4DelPaso(
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
  ): number {
    // El acomodo va SÍ o SÍ: los clicks son pliegos que pasan por la máquina,
    // y sin él la cantidad cae a las piezas del trabajo — 500 tarjetas
    // contarían 500 clicks cuando la máquina sólo vio 50 pliegos. Mientras la
    // imposición la hacía pre-prensa, este paso heredaba pliegos y el error
    // no se veía.
    const pliegos = this.resolverCantidad(paso, jobContext, nestingDispatch);
    if (!Number.isFinite(pliegos) || pliegos <= 0) return 0;
    const caras = this.resolverCarasConsumible(paso, jobContext);
    const factorA4 = Math.ceil(
      this.factorA4EquivalenteParaImpresionPorHoja(
        paso,
        jobContext,
        nestingDispatch,
      ),
    );
    return Math.ceil(pliegos) * caras * Math.max(1, factorA4);
  }

  private calcularConsumiblesMaquina(
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
    errores: ErrorMotor[],
    materialPreliminar: {
      id: string;
      atributosVarianteJson?: Record<string, unknown> | null;
    } | null,
  ): MaterialEjecutado[] {
    const maquina = paso.maquina;
    if (
      !maquina ||
      !PRINTER_TEMPLATES_WITH_MACHINE_CONSUMABLES.has(maquina.plantilla)
    ) {
      return [];
    }
    // [Etapa A] `sinConsumiblesMaquina` lo declara la familia; la mitad del
    // perfil CORTE queda: un perfil de corte no gasta tinta sea cual sea la
    // familia.
    if (
      familiaSinConsumiblesMaquina(paso.familiaCodigo) ||
      paso.perfil?.tipoPerfil === 'CORTE'
    ) {
      return [];
    }

    const perfilDetalle =
      (paso.perfil?.detalleJson as Record<string, unknown> | null) ??
      ((paso.perfilesDisponibles?.find((p) => p.id === paso.perfilM1Id)
        ?.detalleJson ?? null) as Record<string, unknown> | null);
    const modoColorEfectivo = this.resolverModoColorEfectivoConsumibles(
      paso,
      jobContext,
    );
    const channels = getPerfilConsumableChannels(
      perfilDetalle,
      maquina.parametrosTecnicosJson ?? null,
      modoColorEfectivo,
    );

    if (channels.length === 0) {
      errores.push({
        codigo: 'consumibles_maquina_sin_canales',
        severidad: 'ERROR',
        mensaje: `El paso ${paso.rutaPasoOrden} usa una impresora, pero el perfil no declara canales de color.`,
        rutaPasoId: paso.rutaPasoId,
        rutaPasoOrden: paso.rutaPasoOrden,
        familiaCodigo: paso.familiaCodigo,
        sugerencia:
          'Revisar el perfil operativo de la máquina y completar el campo Colores.',
      });
      return [];
    }

    const areaImpresaM2 = this.calcularAreaImpresaConsumiblesM2(
      paso,
      jobContext,
      nestingDispatch,
      materialPreliminar,
    );
    const caras = this.resolverCarasConsumible(paso, jobContext);
    if (!Number.isFinite(areaImpresaM2) || areaImpresaM2 <= 0) {
      errores.push({
        codigo: 'consumibles_maquina_area_invalida',
        severidad: 'ERROR',
        mensaje: `No se pudo calcular el área impresa para los consumibles del paso ${paso.rutaPasoOrden}.`,
        rutaPasoId: paso.rutaPasoId,
        rutaPasoOrden: paso.rutaPasoOrden,
        familiaCodigo: paso.familiaCodigo,
        sugerencia:
          'Revisar medidas del producto, nesting o dimensiones del sustrato principal.',
      });
      return [];
    }

    const consumibles = maquina.consumibles ?? [];
    const ejecutados: MaterialEjecutado[] = [];

    for (const channel of channels) {
      // El tóner/tinta del PERFIL gana; el declarado a nivel máquina queda
      // como respaldo de las láser cargadas antes de que el consumo pudiera
      // variar por perfil (2026-07-28).
      const consumible = this.findConsumibleMaquina(
        consumibles,
        paso.perfil?.id ?? paso.perfilM1Id,
        channel,
      );

      if (!consumible) {
        errores.push({
          codigo: 'consumible_maquina_faltante',
          severidad: 'ERROR',
          mensaje: `Falta configurar el consumible ${channel} en la máquina ${maquina.nombre}.`,
          rutaPasoId: paso.rutaPasoId,
          rutaPasoOrden: paso.rutaPasoOrden,
          familiaCodigo: paso.familiaCodigo,
          contexto: {
            maquinaId: maquina.id,
            perfilId: paso.perfil?.id ?? paso.perfilM1Id,
            channel,
          },
          sugerencia:
            'Ir a Maquinaria > Consumibles y vincular una variante activa para ese canal.',
        });
        continue;
      }

      const consumoBase = Number(consumible.consumoBase ?? 0);
      if (!Number.isFinite(consumoBase) || consumoBase <= 0) {
        errores.push({
          codigo: 'consumible_maquina_sin_consumo',
          severidad: 'ERROR',
          mensaje: `El consumible ${consumible.nombre} no tiene consumo base valido.`,
          rutaPasoId: paso.rutaPasoId,
          rutaPasoOrden: paso.rutaPasoOrden,
          familiaCodigo: paso.familiaCodigo,
          sugerencia:
            'Completar el consumo por m² del consumible en Maquinaria.',
        });
        continue;
      }

      const precioReferencia = consumible.materialVariante.precioReferencia;
      if (precioReferencia == null) {
        errores.push({
          codigo: 'consumible_maquina_sin_precio',
          severidad: 'ERROR',
          mensaje: `La variante ${consumible.materialVariante.sku} no tiene precio de referencia.`,
          rutaPasoId: paso.rutaPasoId,
          rutaPasoOrden: paso.rutaPasoOrden,
          familiaCodigo: paso.familiaCodigo,
          sugerencia:
            'Completar el precio de referencia de la variante de materia prima.',
        });
        continue;
      }

      const cantidad = consumoBase * areaImpresaM2 * caras;
      const precioUnitario = precioPorUnidadDeConsumo(
        precioReferencia,
        consumible.materialVariante.unidadStock,
        consumible.unidad,
        consumible.rendimientoEstimado,
      );
      const costoTotal = cantidad * precioUnitario;

      ejecutados.push({
        slotCodigo: `consumible_maquina:${channel}`,
        materialVarianteId: consumible.materialVariante.id,
        materialNombre: consumible.materialVariante.sku,
        materialSku: consumible.materialVariante.sku,
        materialDisplayName: this.getConsumibleMaterialDisplayName(
          channel,
          consumible.materialVariante,
        ),
        materiaPrimaNombre:
          consumible.materialVariante.materiaPrimaNombre ?? null,
        materiaPrimaTemplateId:
          consumible.materialVariante.materiaPrimaTemplateId ?? null,
        materiaPrimaTipoTecnico:
          consumible.materialVariante.materiaPrimaTipoTecnico ?? null,
        atributosVarianteJson:
          consumible.materialVariante.atributosVarianteJson ?? null,
        tipoLineaCosto: 'CONSUMIBLE_MAQUINA',
        cantidad,
        unidad: consumible.unidad,
        precioUnitario,
        costoTotal,
        estrategiaCosto: 'consumo_maquina_por_m2',
        modoSeleccion: 'MAQUINA_CONSUMIBLE',
      });
    }

    return ejecutados;
  }

  private findConsumibleMaquina(
    consumibles: NonNullable<
      NonNullable<PasoCargado['maquina']>['consumibles']
    >,
    perfilId: string | null | undefined,
    channel: ConsumableChannel,
    /** Sólo para callers que quieran el de la máquina por delante. */
    preferGlobal = false,
  ) {
    const matchesChannel = (consumible: (typeof consumibles)[number]) =>
      consumible.activo &&
      getConsumableChannelFromDetail(
        (consumible.detalleJson as Record<string, unknown> | null) ?? null,
      ) === channel;

    const global = consumibles.find(
      (consumible) =>
        matchesChannel(consumible) && consumible.perfilOperativoId === null,
    );
    const scoped = consumibles.find(
      (consumible) =>
        matchesChannel(consumible) && consumible.perfilOperativoId === perfilId,
    );

    return (preferGlobal ? (global ?? scoped) : (scoped ?? global)) ?? null;
  }

  /**
   * Si el paso toma su medida de una personalización (paramsPasoJson.fuenteMedida
   * = 'personalizacion:<codigo>'), devuelve su área en m² del jobContext
   * (personalizacion_<codigo>_areaM2). Devuelve null si el paso usa la medida
   * global del producto (comportamiento por defecto).
   * Ver docs/personalizaciones-diseno.md
   */
  private areaPersonalizacionM2(
    paso: PasoCargado,
    jobContext: JobContext,
  ): number | null {
    const params = paso.paramsPasoJson;
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      return null;
    }
    const rec = params as Record<string, unknown>;
    const PREFIX = 'personalizacion:';
    // Multi-selección (nuevo): array de códigos que este paso imprime/costea
    // JUNTOS (ej. varias estampas en un mismo DTF). El área es la SUMA.
    const codigos: string[] = [];
    if (Array.isArray(rec.fuenteMedidaPersonalizaciones)) {
      for (const c of rec.fuenteMedidaPersonalizaciones) {
        if (typeof c === 'string' && c.trim()) codigos.push(c.trim());
      }
    }
    // Legacy: single string 'personalizacion:<codigo>'.
    if (codigos.length === 0) {
      const fuente = rec.fuenteMedida;
      if (typeof fuente === 'string' && fuente.startsWith(PREFIX)) {
        const c = fuente.slice(PREFIX.length).trim();
        if (c) codigos.push(c);
      }
    }
    if (codigos.length === 0) return null;
    // El paso está marcado con personalización(es): usamos la suma de sus áreas
    // (0 si todavía no hay medidas cargadas), NO caemos al área global.
    let total = 0;
    for (const codigo of codigos) {
      const area = Number(
        (jobContext as Record<string, unknown>)[
          `personalizacion_${codigo}_areaM2`
        ],
      );
      if (Number.isFinite(area) && area > 0) total += area;
    }
    return total;
  }

  private calcularAreaImpresaConsumiblesM2(
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
    materialPreliminar: {
      id: string;
      unidadStock?: string | null;
      atributosVarianteJson?: Record<string, unknown> | null;
    } | null,
  ) {
    // Prioridad máxima: si el paso decora una personalización, su área es la de
    // la personalización (film DTF), no el área global del producto.
    const areaPersonalizacion = this.areaPersonalizacionM2(paso, jobContext);
    if (areaPersonalizacion !== null) return areaPersonalizacion;

    if (nestingDispatch?.substrates?.length) {
      const area = nestingDispatch.substrates.reduce((acc, sub) => {
        if (sub.kind === 'roll') {
          return acc + (sub.lengthMm * sub.widthMm) / 1_000_000;
        }
        return acc + (sub.count * sub.widthMm * sub.heightMm) / 1_000_000;
      }, 0);
      if (area > 0) return area;
    }

    const areaPliegoImpresion = this.calcularM2DesdePliegoImpresion(
      paso,
      jobContext,
      nestingDispatch,
    );
    if (areaPliegoImpresion > 0) return areaPliegoImpresion;

    const attrs = materialPreliminar?.atributosVarianteJson ?? null;
    if (!isRolloMaterial(materialPreliminar?.unidadStock, attrs)) {
      const areaSustratoM2 = this.getAreaM2FromAttrs(attrs);
      if (areaSustratoM2 > 0) {
        const cantidad = this.resolverCantidad(
          paso,
          jobContext,
          nestingDispatch,
        );
        if (cantidad > 0) return areaSustratoM2 * cantidad;
      }
    }

    const ctx = jobContext as Record<string, unknown>;
    const explicitM2 = Number(
      ctx.m2 ?? ctx.areaM2 ?? ctx.metrosCuadrados ?? ctx.m2_impresos ?? 0,
    );
    if (Number.isFinite(explicitM2) && explicitM2 > 0) return explicitM2;

    const piezasM2 = this.calcularM2DesdePiezas(jobContext);
    if (piezasM2 > 0) return piezasM2;

    if (jobContext.medidaCustomMm) {
      const cantidad = this.resolverCantidad(paso, jobContext, nestingDispatch);
      return (
        (jobContext.medidaCustomMm.anchoMm *
          jobContext.medidaCustomMm.altoMm *
          cantidad) /
        1_000_000
      );
    }

    return 0;
  }

  private getAreaM2FromAttrs(attrs: Record<string, unknown> | null) {
    if (!attrs) return 0;
    const anchoMm = Number(attrs.anchoMm ?? attrs.widthMm ?? 0);
    const largoMm = Number(
      attrs.largoMm ?? attrs.altoMm ?? attrs.heightMm ?? 0,
    );
    if (
      Number.isFinite(anchoMm) &&
      anchoMm > 0 &&
      Number.isFinite(largoMm) &&
      largoMm > 0
    ) {
      return (anchoMm * largoMm) / 1_000_000;
    }

    const anchoCm = Number(attrs.ancho ?? attrs.widthCm ?? 0);
    const largoCm = Number(attrs.alto ?? attrs.largo ?? attrs.heightCm ?? 0);
    if (
      Number.isFinite(anchoCm) &&
      anchoCm > 0 &&
      Number.isFinite(largoCm) &&
      largoCm > 0
    ) {
      return (anchoCm * largoCm) / 10_000;
    }

    return 0;
  }

  private resolverCarasConsumible(paso: PasoCargado, jobContext: JobContext) {
    const ctx = jobContext as Record<string, unknown>;
    const override = Number(
      ctx[`caras_${paso.configPasoId}`] ?? ctx[`caras_${paso.rutaPasoId}`] ?? 0,
    );
    if (override === 1 || override === 2) return override;
    if (typeof jobContext.caras === 'number' && jobContext.caras > 0) {
      return jobContext.caras;
    }
    const detalle = (paso.perfil?.detalleJson ?? {}) as Record<string, unknown>;
    return detalle.caras === 'DOBLE_FAZ' ? 2 : 1;
  }

  /**
   * F.2.5 — Resuelve qué material concreto usar según el modo de selección.
   *
   * Modos soportados:
   *  - HARDCODED: usa slot.materialVariante directamente
   *  - COMERCIAL_ELIGE: lee del JobContext la elección explícita del comercial
   *    (key: `slotMaterial_<configPasoId>_<slotCodigo>`; compat temporal con
   *    `slotMaterial_<slotCodigo>`). Si no eligió, no resuelve material.
   *  - MOTOR_ELIGE_AUTO: aplica criterio del slot
   *    (MENOR_COSTO / MAYOR_APROVECHAMIENTO / MENOR_CAPACIDAD_QUE_CUMPLA)
   */
  private async resolverMaterialSlot(
    tenantId: string,
    slot: PasoCargado['slots'][number],
    jobContext: JobContext,
    /**
     * G-M7: si se pasa `paso`, MAYOR_APROVECHAMIENTO ejecuta el dispatcher
     * de nesting con CADA candidato y elige el de mayor aprovechamientoPct
     * (en vez de la heurística "más ancho"). Si no se pasa, mantiene la
     * heurística (compat para callers que no necesitan nesting real).
     */
    paso?: PasoCargado,
  ): Promise<{
    id: string;
    sku: string;
    nombreVariante?: string | null;
    materiaPrimaNombre?: string | null;
    materiaPrimaTemplateId?: string | null;
    materiaPrimaTipoTecnico?: string | null;
    precioReferencia: number | null;
    unidadStock?: string | null;
    atributosVarianteJson?: Record<string, unknown> | null;
  } | null> {
    if (slot.modoSeleccion === 'HARDCODED') {
      return slot.materialVariante ?? null;
    }

    const candidatoVarianteIds = this.getSlotCandidatoVarianteIds(slot);
    if (candidatoVarianteIds.length === 0) return null;

    const eleccionExplicita = this.getEleccionMaterialComercial(
      slot,
      jobContext,
      paso,
    );

    if (slot.modoSeleccion === 'COMERCIAL_ELIGE') {
      return eleccionExplicita &&
        candidatoVarianteIds.includes(eleccionExplicita)
        ? await this.cargarVariantePorId(tenantId, eleccionExplicita)
        : null;
    }

    if (slot.modoSeleccion === 'MOTOR_ELIGE_AUTO') {
      if (
        eleccionExplicita &&
        candidatoVarianteIds.includes(eleccionExplicita)
      ) {
        return await this.cargarVariantePorId(tenantId, eleccionExplicita);
      }

      // Cargar todos los candidatos con su info
      const variantes = await Promise.all(
        candidatoVarianteIds.map((variantId) =>
          this.cargarVariantePorId(tenantId, variantId),
        ),
      );
      const validos = variantes.filter(
        (v): v is NonNullable<typeof v> => v != null,
      );
      if (validos.length === 0) return null;

      const criterio = slot.criterioMotorAuto ?? 'MENOR_COSTO';

      if (criterio === 'MENOR_COSTO') {
        return validos.sort(
          (a, b) =>
            Number(a.precioReferencia ?? 0) - Number(b.precioReferencia ?? 0),
        )[0];
      }

      if (criterio === 'MAYOR_APROVECHAMIENTO') {
        // G-M7: si recibimos `paso`, corremos el dispatcher de nesting con cada
        // candidato y elegimos el de mayor `aprovechamientoPct`. Si el dispatcher
        // no aplica para ningún candidato (familia no soportada), caemos a la
        // heurística histórica (más ancho = mejor para rollos).
        if (paso) {
          const evaluados = await Promise.all(
            validos.map(async (v) => {
              const dispatch = await runNestingForPaso(paso, jobContext, {
                id: v.id,
                atributosVarianteJson: v.atributosVarianteJson ?? null,
              });
              return { v, aprovechamiento: dispatch?.aprovechamientoPct ?? -1 };
            }),
          );
          const conNesting = evaluados.filter((e) => e.aprovechamiento >= 0);
          if (conNesting.length > 0) {
            conNesting.sort((a, b) => b.aprovechamiento - a.aprovechamiento);
            return conNesting[0].v;
          }
          // Ningún candidato cubierto por nesting → fallback heurístico.
        }
        // Heurística (fallback): el más ancho gana (favorece rollos grandes).
        return validos.sort((a, b) => {
          const attrsA = (a.atributosVarianteJson ?? {}) as Record<
            string,
            unknown
          >;
          const attrsB = (b.atributosVarianteJson ?? {}) as Record<
            string,
            unknown
          >;
          const anchoA = Number(attrsA.anchoMm ?? attrsA.ancho ?? 0);
          const anchoB = Number(attrsB.anchoMm ?? attrsB.ancho ?? 0);
          return anchoB - anchoA;
        })[0];
      }

      if (criterio === 'MENOR_CAPACIDAD_QUE_CUMPLA') {
        // Necesita criterioInputCampo del JobContext y criterioMaterialCampo de cada variante
        const inputValor = Number(
          (jobContext as Record<string, unknown>)[
            slot.criterioInputCampo ?? ''
          ] ?? 0,
        );
        const validosOrdenados = validos
          .map((v) => ({
            v,
            cap: Number(
              (v as Record<string, unknown>)[
                slot.criterioMaterialCampo ?? ''
              ] ?? 0,
            ),
          }))
          .filter((x) => x.cap >= inputValor)
          .sort((a, b) => a.cap - b.cap);
        return validosOrdenados[0]?.v ?? null;
      }
    }

    return null;
  }

  private getSlotCandidatoVarianteIds(slot: PasoCargado['slots'][number]) {
    return Array.from(
      new Set(
        slot.candidatos.flatMap((candidato) => {
          const variantIds = candidato.variantes.map((v) => v.varianteId);
          return candidato.defaultVarianteId
            ? [candidato.defaultVarianteId, ...variantIds]
            : variantIds;
        }),
      ),
    );
  }

  private getEleccionMaterialComercial(
    slot: PasoCargado['slots'][number],
    jobContext: JobContext,
    paso?: PasoCargado,
  ): string | null {
    const ctx = jobContext as Record<string, unknown>;
    const slotMateriales =
      ctx.slotMateriales &&
      typeof ctx.slotMateriales === 'object' &&
      !Array.isArray(ctx.slotMateriales)
        ? (ctx.slotMateriales as Record<string, unknown>)
        : {};
    const scopedSelectionKey = paso
      ? `${paso.configPasoId}_${slot.slotCodigo}`
      : null;
    const scopedKey = paso
      ? `slotMaterial_${paso.configPasoId}_${slot.slotCodigo}`
      : null;
    const legacyKey = `slotMaterial_${slot.slotCodigo}`;
    const value = scopedSelectionKey
      ? (slotMateriales[scopedSelectionKey] ?? slotMateriales[scopedKey!])
      : undefined;
    const flatValue = scopedKey ? ctx[scopedKey] : undefined;
    const legacyValue =
      slotMateriales[slot.slotCodigo] ??
      slotMateriales[legacyKey] ??
      ctx[legacyKey];
    const selected = typeof value === 'string' ? value : flatValue;
    const finalSelected = typeof selected === 'string' ? selected : legacyValue;
    return typeof finalSelected === 'string' && finalSelected.trim()
      ? finalSelected.trim()
      : null;
  }

  private errorMaterialComercialRequerido(
    slot: PasoCargado['slots'][number],
    paso: PasoCargado,
    jobContext: JobContext,
  ): ErrorMotor {
    const candidatoVarianteIds = this.getSlotCandidatoVarianteIds(slot);
    const eleccion = this.getEleccionMaterialComercial(slot, jobContext, paso);
    const slotLabel = slot.slotCodigo.replace(/_/g, ' ');
    const base = {
      severidad: 'ERROR' as const,
      rutaPasoId: paso.rutaPasoId,
      rutaPasoOrden: paso.rutaPasoOrden,
      familiaCodigo: paso.familiaCodigo,
      contexto: {
        configPasoId: paso.configPasoId,
        slotCodigo: slot.slotCodigo,
        eleccion: eleccion ?? null,
      },
    };

    if (eleccion && !candidatoVarianteIds.includes(eleccion)) {
      return {
        ...base,
        codigo: 'material_comercial_invalido',
        mensaje: `La selección de material ${slotLabel} no es válida para el paso ${paso.rutaPasoOrden}.`,
        sugerencia:
          'Elegir uno de los materiales candidatos configurados para el paso.',
      };
    }

    return {
      ...base,
      codigo: 'material_comercial_requerido',
      mensaje: `El paso ${paso.rutaPasoOrden} requiere elegir el material ${slotLabel}.`,
      sugerencia: 'Seleccionar un material antes de cotizar.',
    };
  }

  /** Carga una variante de materia prima por ID (helper para resolución de materiales). */
  private async cargarVariantePorId(
    tenantId: string,
    variantId: string,
  ): Promise<{
    id: string;
    sku: string;
    nombreVariante?: string | null;
    materiaPrimaNombre?: string | null;
    materiaPrimaTemplateId?: string | null;
    materiaPrimaTipoTecnico?: string | null;
    precioReferencia: number | null;
    anchoMm?: number;
    /** G-M9: unidad de stock heredada (PLIEGO, METRO_LINEAL, etc.). */
    unidadStock?: string | null;
    /** G-M7: necesario para correr nesting con cada candidato. */
    atributosVarianteJson?: Record<string, unknown> | null;
  } | null> {
    // Scope obligatorio por tenant: la variante debe pertenecer al tenant.
    const v = await this.prisma.materiaPrimaVariante.findFirst({
      where: { id: variantId, tenantId },
      include: {
        materiaPrima: {
          select: {
            nombre: true,
            unidadStock: true,
            templateId: true,
            tipoTecnico: true,
          },
        },
      },
    });
    if (!v) return null;
    const attrs = v.atributosVarianteJson as Record<string, unknown> | null;
    return {
      id: v.id,
      sku: v.sku,
      nombreVariante: v.nombreVariante,
      materiaPrimaNombre: v.materiaPrima?.nombre ?? null,
      materiaPrimaTemplateId: v.materiaPrima?.templateId ?? null,
      materiaPrimaTipoTecnico: v.materiaPrima?.tipoTecnico ?? null,
      precioReferencia: v.precioReferencia ? Number(v.precioReferencia) : null,
      anchoMm: typeof attrs?.anchoMm === 'number' ? attrs.anchoMm : undefined,
      // Variante puede tener override; sino hereda de la materia prima padre.
      unidadStock: v.unidadStock ?? v.materiaPrima?.unidadStock ?? null,
      atributosVarianteJson: attrs,
    };
  }

  /**
   * Carga la MP propia de un candidato de pliego (origen de costo
   * 'por_candidato') en el shape que espera el dispatcher para el score.
   */
  private async cargarPrintSheetMaterial(
    tenantId: string,
    varianteId: string,
  ): Promise<PrintSheetCandidateMaterial | null> {
    const variante = await this.cargarVariantePorId(tenantId, varianteId);
    if (!variante) return null;
    const attrs = variante.atributosVarianteJson ?? {};
    const leerMm = (...values: unknown[]) => {
      for (const value of values) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
      }
      return null;
    };
    return {
      varianteId: variante.id,
      sku: variante.sku,
      nombre: this.getMaterialDisplayName(variante),
      precioReferencia: variante.precioReferencia,
      anchoMm: leerMm(attrs.anchoMm, attrs.widthMm),
      altoMm: leerMm(attrs.largoMm, attrs.altoMm, attrs.heightMm),
    };
  }

  private getMaterialDisplayName(material: {
    sku: string;
    nombreVariante?: string | null;
    materiaPrimaNombre?: string | null;
  }) {
    return (
      material.nombreVariante?.trim() ||
      material.materiaPrimaNombre?.trim() ||
      material.sku
    );
  }

  private getConsumibleMaterialDisplayName(
    channel: ConsumableChannel,
    material: {
      sku: string;
      nombreVariante?: string | null;
      materiaPrimaNombre?: string | null;
    },
  ) {
    const channelLabel =
      MODO_COLOR_LABELS[channel.toUpperCase()] ??
      channel.charAt(0).toUpperCase() + channel.slice(1);
    return `${channelLabel} · ${this.getMaterialDisplayName(material)}`;
  }

  /** Calcula m² totales desde la lista de piezas del JobContext (para fórmula por_m2). */
  private calcularM2DesdePiezas(jobContext: JobContext): number {
    if (!jobContext.piezas || jobContext.piezas.length === 0) return 0;
    return jobContext.piezas.reduce((acc, p) => {
      const m2Pieza = (p.anchoMm * p.altoMm) / 1_000_000;
      return acc + m2Pieza * p.cantidad;
    }, 0);
  }

  private calcularM2DesdePliegosImpresos(jobContext: JobContext): number {
    const ctx = jobContext as Record<string, unknown>;
    const pliegos = Number(ctx.pliegos_impresos ?? ctx.pliegos_calculados ?? 0);
    const anchoMm = Number(ctx.pliego_impresion_ancho_mm ?? 0);
    const altoMm = Number(ctx.pliego_impresion_alto_mm ?? 0);
    if (
      !Number.isFinite(pliegos) ||
      pliegos <= 0 ||
      !Number.isFinite(anchoMm) ||
      anchoMm <= 0 ||
      !Number.isFinite(altoMm) ||
      altoMm <= 0
    ) {
      return 0;
    }
    return (pliegos * anchoMm * altoMm) / 1_000_000;
  }

  private esPlotterCorteSobreHojas(paso: PasoCargado): boolean {
    if (paso.familiaCodigo !== 'plotter_corte') return false;
    const detalle = this.asRecord(paso.perfil?.detalleJson);
    return String(detalle.modoOperacion ?? '').toUpperCase() === 'HOJAS';
  }

  /** Metros lineales desde la lista de piezas (para fórmula por_metro_lineal). */
  private calcularMetrosLinealesDesdePiezas(jobContext: JobContext): number {
    if (!jobContext.piezas || jobContext.piezas.length === 0) return 0;
    return jobContext.piezas.reduce((acc, p) => {
      const largoMtsPieza = p.altoMm / 1000;
      return acc + largoMtsPieza * p.cantidad;
    }, 0);
  }

  /**
   * F.2.8 — Ejecuta las validaciones declaradas por la familia (D.7 Tipo B + C).
   *
   * Cada familia puede declarar validaciones tipadas:
   *  - REQUIRES_INPUT: chequea que un campo del JobContext exista y no sea null
   *  - COMPARE: compara dos valores (jobContext vs maquina/material/etc.)
   *  - IN_RANGE: chequea que un valor esté entre min y max
   *  - ONE_OF: chequea que un valor pertenezca a una lista
   *  - EXISTS_OUTPUT: chequea que un output canónico haya sido escrito por algún paso anterior
   *
   * Devuelve array de errores. Si hay al menos 1, el paso falla.
   * Acumula TODOS los errores del mismo paso (multi-error híbrido).
   */
  private ejecutarValidaciones(
    familia: DefinicionFamiliaResuelta,
    paso: PasoCargado,
    jobContext: JobContext,
    outputsAcumulados: Set<string> = new Set(),
  ): ErrorMotor[] {
    const errores: ErrorMotor[] = [];
    if (!familia.validaciones || familia.validaciones.length === 0) {
      return errores;
    }

    const ctx = jobContext as unknown as Record<string, unknown>;

    for (const v of familia.validaciones) {
      let cumple = true;
      let contextoError: Record<string, unknown> = {};

      if (v.tipo === 'REQUIRES_INPUT') {
        const valor = ctx[v.campo];
        cumple = valor !== undefined && valor !== null && valor !== '';
        contextoError = { campo: v.campo, valor };
      } else if (v.tipo === 'COMPARE') {
        const a = Number(ctx[v.campoJobContext] ?? NaN);
        let b: number = NaN;
        if (v.fuenteB === 'JOBCONTEXT') {
          b = Number(ctx[v.campoB] ?? NaN);
        } else if (v.fuenteB === 'MAQUINA') {
          const params = paso.maquina?.parametrosTecnicosJson as
            Record<string, unknown> | undefined;
          b = Number(params?.[v.campoB] ?? NaN);
        } else if (v.fuenteB === 'MATERIAL' && v.slotMaterial) {
          const slot = paso.slots.find((s) => s.slotCodigo === v.slotMaterial);
          const attrs = slot?.materialVariante?.atributosVarianteJson as
            Record<string, unknown> | undefined;
          b = Number(attrs?.[v.campoB] ?? NaN);
        } else if (v.fuenteB === 'CONFIG_PASO') {
          const params = paso.paramsPasoJson as
            Record<string, unknown> | undefined;
          b = Number(params?.[v.campoB] ?? NaN);
        }
        // Si falta uno de los datos, NO se valida (skip silencioso).
        // Validar requiere ambos lados definidos.
        if (Number.isNaN(a) || Number.isNaN(b)) {
          cumple = true;
        } else {
          switch (v.operador) {
            case '<=':
              cumple = a <= b;
              break;
            case '>=':
              cumple = a >= b;
              break;
            case '==':
              cumple = a === b;
              break;
            case '!=':
              cumple = a !== b;
              break;
            case '<':
              cumple = a < b;
              break;
            case '>':
              cumple = a > b;
              break;
          }
        }
        contextoError = {
          jc: { [v.campoJobContext]: a },
          valorB: b,
          operador: v.operador,
        };
      } else if (v.tipo === 'IN_RANGE') {
        const valor = Number(ctx[v.campo] ?? NaN);
        cumple =
          !Number.isNaN(valor) &&
          (v.min == null || valor >= v.min) &&
          (v.max == null || valor <= v.max);
        contextoError = { campo: v.campo, valor, min: v.min, max: v.max };
      } else if (v.tipo === 'ONE_OF') {
        const rawValor = ctx[v.campo];
        const valor =
          typeof rawValor === 'string' ||
          typeof rawValor === 'number' ||
          typeof rawValor === 'boolean'
            ? String(rawValor)
            : '';
        cumple = v.valoresPermitidos.includes(valor);
        contextoError = {
          campo: v.campo,
          valor,
          valoresPermitidos: v.valoresPermitidos,
        };
      } else if (v.tipo === 'EXISTS_OUTPUT') {
        // G-M2 / G-M4 — Chequear que el output canónico haya sido publicado
        // por algún paso anterior (registrado en outputsAcumulados).
        cumple = outputsAcumulados.has(v.outputCanonico);
        contextoError = {
          outputCanonico: v.outputCanonico,
          outputsDisponibles: Array.from(outputsAcumulados),
        };
      }

      if (!cumple) {
        const mensaje = this.interpolarMensaje(
          v.mensaje,
          contextoError,
          paso,
          jobContext,
        );
        errores.push({
          codigo: v.codigo,
          severidad: 'ERROR',
          mensaje,
          rutaPasoId: paso.rutaPasoId,
          rutaPasoOrden: paso.rutaPasoOrden,
          familiaCodigo: paso.familiaCodigo,
          contexto: contextoError,
        });
      }
    }
    return errores;
  }

  /** Interpola placeholders {jc.campo}, {maq.campo}, etc. en mensajes de error. */
  private interpolarMensaje(
    template: string,
    contexto: Record<string, unknown>,
    paso: PasoCargado,
    jobContext: JobContext,
  ): string {
    return template.replace(
      /\{(jc|maq|mat)\.(\w+)\}/g,
      (_match, fuente: string, campo: string) => {
        if (fuente === 'jc') {
          return this.valueToMessage(
            (jobContext as Record<string, unknown>)[campo],
          );
        }
        if (fuente === 'maq') {
          const params = paso.maquina?.parametrosTecnicosJson as
            Record<string, unknown> | undefined;
          return this.valueToMessage(params?.[campo]);
        }
        if (fuente === 'mat') {
          // Buscar en cualquier slot
          for (const s of paso.slots) {
            const attrs = s.materialVariante?.atributosVarianteJson as
              Record<string, unknown> | undefined;
            if (attrs && attrs[campo] !== undefined)
              return this.valueToMessage(attrs[campo]);
          }
        }
        return this.valueToMessage(contexto[campo]);
      },
    );
  }

  /**
   * F.2.3 — Resuelve la CANTIDAD a producir según el mecanismo declarado.
   *
   * 4 mecanismos de D.3:
   *  - DIRECT_FROM_JOBCONTEXT: lee directo `jobContext.cantidad` (default)
   *  - HEREDAR_DEL_OUTPUT_CANONICO: lee output canónico de paso anterior
   *    (config: { campoOutput: 'pliegos_calculados' })
   *  - CALCULADO_POR_PASO: el paso ejecuta cálculo propio (típicamente
   *    nesting). MVP: usa m² total de las piezas para impresion_por_area
   *  - CONVERSION: aplica fórmula a otro valor
   *    (config: { piezasPorCaja: 100 } → ceil(cantidad / piezasPorCaja))
   */
  private resolverCantidad(
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null = null,
    materialResuelto: {
      atributosVarianteJson?: Record<string, unknown> | null;
    } | null = null,
  ): number {
    const mecanismo = paso.mecanismoCantidad ?? 'DIRECT_FROM_JOBCONTEXT';

    if (mecanismo === 'DIRECT_FROM_JOBCONTEXT') {
      return Number(jobContext.cantidad ?? 0);
    }

    if (mecanismo === 'HEREDAR_DEL_OUTPUT_CANONICO') {
      // G-M2: lee el output canónico publicado por un paso anterior. La key
      // se determina por:
      //  0) B.3.3 — `config.origen { rutaPasoId, capacidad }`: herencia
      //     EXPLÍCITA, el que modela señala el paso. Manda sobre todo.
      //  1) `mecanismoCantidadConfigJson.campoOutput` (override explícito).
      //  2) Default por familia (mapeo abajo).
      const config = (paso.mecanismoCantidadConfigJson ?? {}) as Record<
        string,
        unknown
      >;
      const heredadoExplicito = resolverHerenciaExplicita(
        config,
        jobContext as Record<string, unknown>,
      );
      if (heredadoExplicito !== null) return heredadoExplicito;
      // Si había origen señalado pero no publicó (paso salteado o aún no
      // ejecutado), cae al camino legacy — mismo comportamiento histórico.
      const campoExplicito =
        typeof config.campoOutput === 'string' ? config.campoOutput : null;
      const campo =
        campoExplicito ?? defaultOutputParaHeredar(paso.familiaCodigo);
      if (campo) {
        const v = (jobContext as Record<string, unknown>)[campo];
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
      }
      // Fallback histórico: si el output no fue publicado, cae a cantidad
      // directa para no romper cotizaciones donde pre_prensa todavía no
      // escribe outputs (G-M1 sin look-ahead).
      return Number(jobContext.cantidad ?? 0);
    }

    if (mecanismo === 'CALCULADO_POR_PASO') {
      // FRONTERA-PRIMITIVA: las ramas por familia de este bloque
      // (modificacion_pre, colocacion_ojales, área/plotter) son los cálculos
      // propios de cada primitiva de geometría — Tipo B.
      // G-M1: si el dispatcher devolvió nesting, usar la cantidad calculada
      // con desperdicio real (m_lineales para shelf-rollo, pliegos para grid).
      if (nestingDispatch) {
        return nestingDispatch.cantidadCalculada;
      }
      // Etapa B — `modificacion_pre` calcula sus propios metros lineales de
      // unión sobre la medida VISIBLE (la costura corre por el borde
      // terminado, no crece con la demasía). Es el driver del tiempo T-2.
      if (paso.familiaCodigo === 'modificacion_pre') {
        const params = parsearParamsModificacionPre(
          this.paramsEfectivosDelPaso(paso, jobContext),
        );
        if (params) return calcularMetrosLinealesUnion(jobContext, params);
        return 0;
      }
      // Etapa C — `colocacion_ojales` deriva su cantidad del perímetro VISIBLE
      // (el ojal va al borde terminado, no crece con la demasía del refuerzo).
      if (paso.familiaCodigo === 'colocacion_ojales') {
        const params = parsearParamsColocacionOjales(
          this.paramsEfectivosDelPaso(paso, jobContext),
        );
        if (params) return calcularCantidadOjales(jobContext, params);
        return 0;
      }
      // Fallback histórico: m² crudos de las piezas (sin desperdicio) cuando
      // la familia no tiene algoritmo soportado por el dispatcher.
      if (
        paso.familiaCodigo === 'impresion_por_area' ||
        paso.familiaCodigo === 'plotter_corte'
      ) {
        if (this.esPlotterCorteSobreHojas(paso)) {
          const m2Pliegos = this.calcularM2DesdePliegosImpresos(jobContext);
          if (m2Pliegos > 0) return m2Pliegos;
        }
        return this.calcularM2DesdePiezas(jobContext);
      }
      return Number(jobContext.cantidad ?? 0);
    }

    if (mecanismo === 'CONVERSION') {
      const config = (paso.mecanismoCantidadConfigJson ?? {}) as Record<
        string,
        unknown
      >;
      const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
      const cantidadBase = Number(jobContext.cantidad ?? 0);
      const capacidad = this.resolverCapacidadConversion(
        config,
        params,
        materialResuelto,
      );
      if (capacidad > 0) {
        return Math.ceil(cantidadBase / capacidad);
      }
      return cantidadBase;
    }

    return Number(jobContext.cantidad ?? 0);
  }

  private resolverCantidadSlotPorBase(
    slot: SlotCargado,
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
    materialResuelto: {
      atributosVarianteJson?: Record<string, unknown> | null;
    } | null,
  ): number | null {
    if (!slot.cantidadBase) return null;

    let base = 0;
    if (slot.cantidadBase === 'cantidad_pedida') {
      base = Number(jobContext.cantidad ?? 0);
    } else if (slot.cantidadBase === 'cantidad_efectiva_paso') {
      base = this.resolverCantidad(
        paso,
        jobContext,
        nestingDispatch,
        materialResuelto,
      );
    } else if (slot.cantidadBase === 'pliegos_impresos') {
      base = Number(
        jobContext.pliegos_impresos ?? jobContext.pliegos_calculados ?? 0,
      );
    } else if (slot.cantidadBase === 'talonario_pilas') {
      // Pilas del talonario grouping: publicadas por pre_prensa como output
      // canónico; fallback al dispatch del propio paso si lo tuviera.
      base = Number(
        (jobContext as Record<string, unknown>).talonario_pilas ??
          nestingDispatch?.talonarioGrouping?.pilas ??
          0,
      );
    } else {
      return null;
    }

    const factor = Number(slot.cantidadFactor ?? 1);
    return Math.max(0, base) * (Number.isFinite(factor) ? factor : 1);
  }

  private resolverCapacidadConversion(
    config: Record<string, unknown>,
    params: Record<string, unknown>,
    materialResuelto: {
      atributosVarianteJson?: Record<string, unknown> | null;
    } | null,
  ): number {
    const attrs = materialResuelto?.atributosVarianteJson ?? {};
    const candidatos = [
      config.piezasPorCaja,
      config.talonariosPorCaja,
      config.capacidadUnidades,
      config.unidadesPorCaja,
      params.piezasPorCaja,
      params.talonariosPorCaja,
      params.capacidadUnidades,
      params.unidadesPorCaja,
      attrs.capacidadUnidades,
      attrs.piezasPorCaja,
      attrs.talonariosPorCaja,
      attrs.unidadesPorCaja,
    ];

    for (const candidato of candidatos) {
      const capacidad = Number(candidato);
      if (Number.isFinite(capacidad) && capacidad > 0) {
        return capacidad;
      }
    }

    return 0;
  }

  private resolverCantidadProductividadPropia(
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null = null,
    materialResuelto: {
      atributosVarianteJson?: Record<string, unknown> | null;
    } | null = null,
  ): number {
    const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
    const sourceConfigurado =
      typeof params.productivityQuantitySource === 'string'
        ? params.productivityQuantitySource
        : '';
    // Si el modelador no eligió magnitud, la familia puede declarar la suya:
    // montaje cuenta piezas a pegar, no las placas que consumió el nesting.
    // 'cantidad' es lo que queda escrito cuando no se eligió nada, así que
    // cuenta como sin elegir. [Etapa A: era un if por familia cuyo cuerpo ya
    // existía idéntico en la rama genérica de abajo]
    const magnitudDefaultFamilia = magnitudTiempoDefaultDeFamilia(
      paso.familiaCodigo,
    );
    const source =
      magnitudDefaultFamilia &&
      (!sourceConfigurado || sourceConfigurado === 'cantidad')
        ? magnitudDefaultFamilia
        : sourceConfigurado;

    // Si el paso decora una personalización y su productividad es por área, la
    // magnitud es el área de esa personalización (film DTF), no las piezas
    // globales del producto. Ver docs/personalizaciones-diseno.md
    const areaPersonalizacion = this.areaPersonalizacionM2(paso, jobContext);
    if (
      areaPersonalizacion !== null &&
      (source === 'area_piezas_m2' || source === 'm2_instalados')
    ) {
      return areaPersonalizacion;
    }

    if (!source || source === 'cantidad') {
      return this.resolverCantidad(
        paso,
        jobContext,
        nestingDispatch,
        materialResuelto,
      );
    }

    if (source === 'cantidad_montaje') {
      return (
        this.numeroPositivo(this.resolverCantidadMontajeParaTiempo(paso, jobContext)) ??
        this.resolverCantidad(paso, jobContext, nestingDispatch, materialResuelto)
      );
    }

    if (source === 'area_piezas_m2') {
      return (
        this.numeroPositivo(jobContext.piezaAreaTotalM2) ??
        this.numeroPositivo(this.calcularM2DesdePiezas(jobContext)) ??
        this.numeroPositivo(jobContext.m2_instalados) ??
        this.resolverCantidad(
          paso,
          jobContext,
          nestingDispatch,
          materialResuelto,
        )
      );
    }

    if (source === 'm2_instalados') {
      return (
        this.numeroPositivo(jobContext.m2_instalados) ??
        this.numeroPositivo(jobContext.piezaAreaTotalM2) ??
        this.numeroPositivo(this.calcularM2DesdePiezas(jobContext)) ??
        this.resolverCantidad(
          paso,
          jobContext,
          nestingDispatch,
          materialResuelto,
        )
      );
    }

    if (source === 'metros_lineales') {
      return (
        this.numeroPositivo(jobContext.metrosLineales) ??
        this.numeroPositivo(jobContext.metroLineal) ??
        this.numeroPositivo(jobContext.ml) ??
        this.numeroPositivo(jobContext.cantidadComercial) ??
        this.numeroPositivo(jobContext.cantidadComercialPricing) ??
        this.resolverCantidad(
          paso,
          jobContext,
          nestingDispatch,
          materialResuelto,
        )
      );
    }

    if (source === 'perimetro_piezas_m') {
      return (
        this.numeroPositivo(jobContext.piezaPerimetroTotalM) ??
        this.numeroPositivo(calcularPerimetroPiezasM(jobContext)) ??
        this.resolverCantidad(
          paso,
          jobContext,
          nestingDispatch,
          materialResuelto,
        )
      );
    }

    return this.resolverCantidad(
      paso,
      jobContext,
      nestingDispatch,
      materialResuelto,
    );
  }

  private resolverCantidadMontajeParaTiempo(
    paso: PasoCargado,
    jobContext: JobContext,
  ): number {
    const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
    const fuente =
      typeof params.fuentePiezasMontaje === 'string'
        ? params.fuentePiezasMontaje
        : 'piezas_jobcontext';

    if (fuente === 'pliegos_impresos') {
      return (
        this.numeroPositivo((jobContext as Record<string, unknown>).pliegos_impresos) ??
        this.numeroPositivo((jobContext as Record<string, unknown>).pliegos_calculados) ??
        0
      );
    }

    const piezas = jobContext.piezas ?? [];
    if (piezas.length > 0) {
      return piezas.reduce((acc, pieza) => acc + pieza.cantidad, 0);
    }

    return Number(jobContext.cantidad ?? 0);
  }

  private calcularTiempoRunPorProductividad(
    cantidadEfectiva: number,
    productividad: number,
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
  ): number {
    if (
      !Number.isFinite(cantidadEfectiva) ||
      cantidadEfectiva <= 0 ||
      !Number.isFinite(productividad) ||
      productividad <= 0
    ) {
      return 0;
    }

    const unidad = String(paso.perfil?.productivityUnit ?? '').toUpperCase();

    if (unidad === 'PPM') {
      const factorA4 = this.factorA4EquivalenteParaImpresionPorHoja(
        paso,
        jobContext,
        nestingDispatch,
      );
      return (cantidadEfectiva * factorA4) / productividad;
    }

    if (
      unidad === 'CORTES_MIN' ||
      unidad === 'GOLPES_MIN' ||
      unidad === 'PLIEGOS_MIN' ||
      unidad === 'M_MIN'
    ) {
      return cantidadEfectiva / productividad;
    }

    if (unidad === 'MM_S') {
      return cantidadEfectiva / productividad / 60;
    }

    return (cantidadEfectiva / productividad) * 60;
  }

  private calcularRunMinGuillotina(
    paso: PasoCargado,
    jobContext: JobContext,
  ): number {
    const detalle = this.asRecord(paso.perfil?.detalleJson);
    const pliegosMaxPorTanda = Number(detalle.pliegosMaxPorTanda ?? 0);
    // El tiempo por corte vive en el perfil (2026-07-28). El valor de la
    // máquina queda como respaldo de las guillotinas cargadas antes del
    // cambio: sin él, ese paso costearía 0 minutos en silencio.
    const tiempoPorCorteSeg = Number(
      detalle.tiempoPorCorteSeg ??
        paso.maquina?.parametrosTecnicosJson?.tiempoPorCorteSeg ??
        0,
    );
    const cortesPorTanda = this.getCortesGuillotinaPorTanda(jobContext);
    const pliegos = this.resolverCantidad(paso, jobContext, null);

    if (
      !Number.isFinite(pliegos) ||
      pliegos <= 0 ||
      !Number.isFinite(pliegosMaxPorTanda) ||
      pliegosMaxPorTanda <= 0 ||
      !Number.isFinite(tiempoPorCorteSeg) ||
      tiempoPorCorteSeg <= 0 ||
      !Number.isFinite(cortesPorTanda) ||
      cortesPorTanda <= 0
    ) {
      return 0;
    }

    const tandas = Math.ceil(pliegos / pliegosMaxPorTanda);
    const cortesMin = (tandas * cortesPorTanda * tiempoPorCorteSeg) / 60;
    const recargasMin =
      Math.max(0, tandas - 1) * Number(paso.perfil?.feedReloadMin ?? 0);
    return cortesMin + recargasMin;
  }

  private getCortesGuillotinaPorTanda(jobContext: JobContext): number {
    const cortes = (jobContext as Record<string, unknown>).cortes_calculados;
    if (typeof cortes === 'number') return cortes;
    if (cortes && typeof cortes === 'object' && !Array.isArray(cortes)) {
      return Number((cortes as Record<string, unknown>).cortesTotales ?? 0);
    }
    return 0;
  }

  private factorA4EquivalenteParaImpresionPorHoja(
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
  ): number {
    if (paso.familiaCodigo !== 'impresion_por_hoja') {
      return 1;
    }

    const sheet = nestingDispatch?.substrates.find(
      (
        substrate,
      ): substrate is Extract<
        (typeof nestingDispatch.substrates)[number],
        { kind: 'sheet' }
      > => substrate.kind === 'sheet',
    );
    const ctx = jobContext as Record<string, unknown>;
    const anchoMm = Number(
      sheet?.widthMm ?? ctx.pliego_impresion_ancho_mm ?? 0,
    );
    const altoMm = Number(sheet?.heightMm ?? ctx.pliego_impresion_alto_mm ?? 0);
    if (
      !Number.isFinite(anchoMm) ||
      anchoMm <= 0 ||
      !Number.isFinite(altoMm) ||
      altoMm <= 0
    ) {
      return 1;
    }

    const areaA4Mm2 = 210 * 297;
    return Math.max(1, (anchoMm * altoMm) / areaA4Mm2);
  }

  /**
   * G-F2 — Resuelve qué máquina usar cuando el paso tiene candidatas M-2.
   *
   * Prioridad:
   *  1. Override del comercial: `jobContext[\`maquinaSeleccionada_${configPasoId}\`]`
   *     o `jobContext[\`maquinaSeleccionada_${rutaPasoId}\`]` (clave alternativa).
   *  2. Candidata `esPreferida = true` (las candidatas vienen ordenadas con
   *     preferidas primero, así que la primera de la lista cumple).
   *  3. Si no hay candidatas: usar la M-1 default (`maquinaM1Id`).
   *
   * Devuelve un nuevo `PasoCargado` con `maquina` (y perfilesDisponibles)
   * apuntando a la M-2 elegida, o el `paso` original si no había candidatas.
   */
  private resolverMaquinaM2(
    paso: PasoCargado,
    jobContext: JobContext,
  ): PasoCargado {
    if (!paso.maquinasCandidatas || paso.maquinasCandidatas.length === 0) {
      return paso; // sin candidatas, mantiene M-1 default
    }

    const ctx = jobContext as unknown as Record<string, unknown>;
    const keyById = `maquinaSeleccionada_${paso.configPasoId}`;
    const keyByPasoId = `maquinaSeleccionada_${paso.rutaPasoId}`;
    const eleccion =
      typeof ctx[keyById] === 'string'
        ? ctx[keyById]
        : typeof ctx[keyByPasoId] === 'string'
          ? ctx[keyByPasoId]
          : null;

    const candidatasCompatibles = paso.maquinasCandidatas.filter(
      (candidata) =>
        this.filtrarPerfilesCompatibles(
          paso.familiaCodigo,
          candidata.perfilesOperativos,
        ).length > 0,
    );

    const candidataElegida = eleccion
      ? paso.maquinasCandidatas.find(
          (c) => c.maquinaId === eleccion || c.id === eleccion,
        )
      : null;
    let elegida = candidataElegida ? candidataElegida : null;
    if (!elegida) {
      elegida = candidatasCompatibles[0] ?? paso.maquinasCandidatas[0]; // ya viene ordenada (preferida primero)
    }
    const perfilesCompatibles = this.filtrarPerfilesCompatibles(
      paso.familiaCodigo,
      elegida.perfilesOperativos,
    );
    const perfilesElegibles =
      perfilesCompatibles.length > 0
        ? perfilesCompatibles
        : elegida.perfilesOperativos;
    const perfilDefaultCandidata = perfilesElegibles.find(
      (perfil) => perfil.id === elegida.perfilDefaultId,
    );
    const perfilPreservado = perfilesElegibles.find(
      (perfil) => perfil.id === paso.perfilM1Id,
    );
    const perfilBase =
      perfilDefaultCandidata ?? perfilPreservado ?? perfilesElegibles[0];

    return {
      ...paso,
      maquinaM1Id: elegida.maquinaId,
      maquina: elegida.maquina,
      perfilesDisponibles: perfilesElegibles.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        tipoPerfil: p.tipoPerfil,
        activo: p.activo,
        productivityValue: p.productivityValue,
        productivityUnit: p.productivityUnit,
        setupMin: p.setupMin,
        cleanupMin: p.cleanupMin,
        feedReloadMin: p.feedReloadMin,
        detalleJson: p.detalleJson,
      })),
      // Mantener el perfil modelado cuando sigue disponible en la máquina
      // elegida; si no existe, usar el primer perfil elegible.
      perfil: perfilBase
        ? {
            id: perfilBase.id,
            nombre: perfilBase.nombre,
            tipoPerfil: perfilBase.tipoPerfil,
            productivityValue: perfilBase.productivityValue,
            productivityUnit: perfilBase.productivityUnit,
            setupMin: perfilBase.setupMin,
            cleanupMin: perfilBase.cleanupMin,
            feedReloadMin: perfilBase.feedReloadMin,
            detalleJson: perfilBase.detalleJson,
          }
        : paso.perfil,
      perfilM1Id: perfilBase?.id ?? paso.perfilM1Id,
    };
  }

  private esTipoPerfilCompatibleConFamilia(
    familiaCodigo: string,
    tipoPerfil?: string | null,
  ) {
    // [Etapa A] La compatibilidad la declara la familia (tiposPerfilCompatibles).
    return perfilCompatibleConFamilia(familiaCodigo, tipoPerfil);
  }

  private filtrarPerfilesCompatibles<
    T extends { activo: boolean; tipoPerfil?: string | null },
  >(familiaCodigo: string, perfiles: T[] | undefined | null): T[] {
    return (perfiles ?? []).filter(
      (perfil) =>
        perfil.activo &&
        this.esTipoPerfilCompatibleConFamilia(familiaCodigo, perfil.tipoPerfil),
    );
  }

  private resolverModoColorComercial(
    paso: PasoCargado,
    jobContext: JobContext,
  ) {
    const ctx = jobContext as Record<string, unknown>;
    const scopedByConfig = ctx[`modoColor_${paso.configPasoId}`];
    const scopedByPaso = ctx[`modoColor_${paso.rutaPasoId}`];
    const scopedMap =
      ctx.modoColorPorPaso &&
      typeof ctx.modoColorPorPaso === 'object' &&
      !Array.isArray(ctx.modoColorPorPaso)
        ? (ctx.modoColorPorPaso as Record<string, unknown>)
        : {};
    const mappedByConfig = scopedMap[paso.configPasoId];
    const mappedByPaso = scopedMap[paso.rutaPasoId];
    const scoped = normalizeModoColor(
      scopedByConfig ?? scopedByPaso ?? mappedByConfig ?? mappedByPaso,
    );
    if (scoped) return scoped;

    if (!this.pasoAdmiteModoColorComercial(paso)) return null;
    return normalizeModoColor(ctx.modoColor);
  }

  private pasoAdmiteModoColorComercial(paso: PasoCargado) {
    const perfilesDisponibles = this.filtrarPerfilesCompatibles(
      paso.familiaCodigo,
      paso.perfilesDisponibles,
    );
    return perfilesDisponibles.some(
      (perfil) => getModoColorsFromPerfil(perfil).length > 0,
    );
  }

  private resolverModoColorEfectivoConsumibles(
    paso: PasoCargado,
    jobContext: JobContext,
  ) {
    const elegido = this.resolverModoColorComercial(paso, jobContext);
    if (elegido) return elegido;

    const params =
      paso.paramsPasoJson &&
      typeof paso.paramsPasoJson === 'object' &&
      !Array.isArray(paso.paramsPasoJson)
        ? (paso.paramsPasoJson as Record<string, unknown>)
        : {};
    const modoColorConfig =
      params.modoColorConfig &&
      typeof params.modoColorConfig === 'object' &&
      !Array.isArray(params.modoColorConfig)
        ? (params.modoColorConfig as Record<string, unknown>)
        : {};
    const defaultMode = normalizeModoColor(modoColorConfig.defaultMode);
    if (defaultMode) return defaultMode;

    const perfil =
      paso.perfil ??
      paso.perfilesDisponibles?.find((item) => item.id === paso.perfilM1Id);
    const modos = getModoColorsFromPerfil(perfil);
    if (modos.length === 1) return modos[0];
    if (modos.includes('CMYK')) return 'CMYK';
    return modos[0] ?? null;
  }

  private findPerfilCompatiblePorModoColor(
    paso: PasoCargado,
    modoColor: string,
  ) {
    const perfilesDisponibles = this.filtrarPerfilesCompatibles(
      paso.familiaCodigo,
      paso.perfilesDisponibles,
    );
    return perfilesDisponibles.find((perfil) =>
      modoColorMatchesPerfil(perfil, modoColor),
    );
  }

  /**
   * Escalón de gramaje ("hasta N g/m²"), no rango: gana el escalón más chico
   * que todavía cubre el papel —papel de 150 g/m² con perfiles hasta
   * 100 / 250 / 400 elige el de 250—. Lo usan guillotina (cuántos pliegos
   * entran en la pila) e impresión láser (a más gramaje, menos ppm).
   *
   * Si ningún escalón lo cubre gana el más grueso: menos pliegos por tanda,
   * más tandas, que es el lado conservador para cotizar.
   */
  private elegirPorEscalonDeGramaje<
    T extends { activo: boolean; detalleJson?: unknown },
  >(perfiles: T[], gramaje: number): T | null {
    const escalones = perfiles
      .filter((perfil) => perfil.activo)
      .map((perfil) => ({
        perfil,
        hasta: this.numeroPositivo(
          this.asRecord(perfil.detalleJson).gramajeMaxGr,
        ),
      }))
      .filter(
        (item): item is { perfil: T; hasta: number } => item.hasta !== null,
      )
      .sort((a, b) => a.hasta - b.hasta);

    if (escalones.length === 0) return null;
    const cubre = escalones.find((item) => gramaje <= item.hasta);
    return (cubre ?? escalones[escalones.length - 1]).perfil;
  }

  /**
   * F.2.4 / G-M8 — Selección automática de perfil dentro de la máquina M-1.
   *
   * Estrategia (en orden):
   *  1. **Regla declarativa** (G-M8): cada perfil puede declarar
   *     `detalleJson.reglaSeleccion: JsonLogic`. El motor evalúa la regla
   *     contra el JobContext y elige el PRIMER perfil activo cuya regla
   *     devuelve `true`. Esto cubre cualquier criterio (caras, gramaje,
   *     tipo trabajo, calidad, etc.) sin código por familia.
   *  2. **Heurística legacy** (fallback): para `impresion_por_hoja` con
   *     `jobContext.caras`, busca perfil "doble"/"simple" por nombre o
   *     `detalleJson.dobleFaz`. Útil cuando los perfiles del seed no
   *     declaran reglas explícitas.
   *  3. Si nada match → mantener perfil default del config.
   *
   * Devuelve el perfil resuelto (o null si no se cambió nada respecto al default).
   */
  private resolverPerfil(
    paso: PasoCargado,
    jobContext: JobContext,
  ): NonNullable<PasoCargado['perfil']> | null {
    const perfilesDisponibles = this.filtrarPerfilesCompatibles(
      paso.familiaCodigo,
      paso.perfilesDisponibles,
    );
    if (perfilesDisponibles.length <= 1) {
      return null; // no hay alternativas, mantener default
    }

    const ctx = jobContext as unknown as Record<string, unknown>;

    // ─── 0. Override explícito del comercial ────────────────────────
    // `perfilSeleccionado_${configPasoId}` (o rutaPasoId): el comercial
    // eligió un perfil concreto en la OT ("Modificar perfil de impresión").
    // Gana a toda resolución automática — es una decisión técnica explícita.
    // Sólo aplica si el perfil pertenece a la máquina activa y es compatible.
    const perfilOverrideId =
      (typeof ctx[`perfilSeleccionado_${paso.configPasoId}`] === 'string'
        ? (ctx[`perfilSeleccionado_${paso.configPasoId}`] as string)
        : null) ??
      (typeof ctx[`perfilSeleccionado_${paso.rutaPasoId}`] === 'string'
        ? (ctx[`perfilSeleccionado_${paso.rutaPasoId}`] as string)
        : null);
    if (perfilOverrideId) {
      const elegido = perfilesDisponibles.find(
        (perfil) => perfil.id === perfilOverrideId,
      );
      if (elegido) {
        if (elegido.id === paso.perfilM1Id) return null; // ya es el default
        return {
          id: elegido.id,
          nombre: elegido.nombre,
          tipoPerfil: elegido.tipoPerfil,
          productivityValue: elegido.productivityValue,
          productivityUnit: elegido.productivityUnit ?? null,
          setupMin: elegido.setupMin,
          cleanupMin: elegido.cleanupMin,
          feedReloadMin: elegido.feedReloadMin,
          detalleJson: elegido.detalleJson,
        };
      }
      // Override inválido (perfil de otra máquina / inactivo): se ignora y
      // sigue la resolución automática.
    }

    // ─── 1. Impresión por hoja: color + caras + escalón de gramaje ──
    //
    // Los tres discriminantes se ENCADENAN como filtros en vez de competir:
    // antes ganaba el primer perfil que matcheara el color y el gramaje no
    // se miraba nunca —tres perfiles de la misma máquina que sólo diferían
    // en el papel eran inalcanzables—. Ver docs §5.
    const modoColor = this.resolverModoColorComercial(paso, jobContext);
    // FRONTERA-PRIMITIVA: la cadena color→caras→gramaje es la estrategia de
    // selección de perfil propia de impresión por hoja — Tipo B.
    const esImpresionPorHoja = paso.familiaCodigo === 'impresion_por_hoja';
    if (modoColor || esImpresionPorHoja) {
      const tieneSenalCaras =
        esImpresionPorHoja &&
        (typeof jobContext.caras === 'number' ||
          (jobContext as Record<string, unknown>)[
            `caras_${paso.configPasoId}`
          ] !== undefined);
      const buscarDoble =
        tieneSenalCaras && this.carasEfectivasPaso(paso, jobContext) === 2;

      // Filtro 1: modo de color. Si nadie lo declara, no descarta a nadie.
      let candidatos = modoColor
        ? perfilesDisponibles.filter((perfil) =>
            modoColorMatchesPerfil(perfil, modoColor),
          )
        : perfilesDisponibles;
      if (candidatos.length === 0) candidatos = perfilesDisponibles;

      // Filtro 2: caras. Si ningún perfil cubre las caras pedidas se sigue
      // sin filtrar (el aviso lo emite `avisarFaltaPerfilDobleFaz`).
      if (tieneSenalCaras) {
        const porCaras = candidatos.filter(
          (perfil) => this.perfilEsDobleFaz(perfil) === buscarDoble,
        );
        if (porCaras.length > 0) candidatos = porCaras;
      }

      // Filtro 3: escalón de gramaje, igual que en guillotina — gana el
      // "hasta" más chico que todavía cubre el papel. Sin gramaje en el
      // contexto o sin escalones declarados, queda el orden anterior.
      const gramaje = this.numeroPositivo(
        (jobContext as Record<string, unknown>).gramajeMaterialGr ??
          (jobContext as Record<string, unknown>).gramajeGr ??
          (jobContext as Record<string, unknown>).gramaje,
      );
      const candidato = gramaje
        ? (this.elegirPorEscalonDeGramaje(candidatos, gramaje) ?? candidatos[0])
        : candidatos[0];

      if (!candidato || candidato.id === paso.perfilM1Id) return null;
      return {
        id: candidato.id,
        nombre: candidato.nombre,
        tipoPerfil: candidato.tipoPerfil,
        productivityValue: candidato.productivityValue,
        productivityUnit: candidato.productivityUnit ?? null,
        setupMin: candidato.setupMin,
        cleanupMin: candidato.cleanupMin,
        feedReloadMin: candidato.feedReloadMin,
        detalleJson: candidato.detalleJson,
      };
    }

    // ─── 2. Guillotina: perfil por escalón de gramaje ────────────────
    // FRONTERA-PRIMITIVA: selección de perfil propia de guillotina — Tipo B.
    if (paso.familiaCodigo === 'corte_guillotina') {
      const gramaje = this.numeroPositivo(
        ctx.gramajeMaterialGr ?? ctx.gramajeGr ?? ctx.gramaje,
      );
      if (gramaje) {
        const candidato = this.elegirPorEscalonDeGramaje(
          perfilesDisponibles,
          gramaje,
        );
        if (candidato && candidato.id !== paso.perfilM1Id) {
          return {
            id: candidato.id,
            nombre: candidato.nombre,
            tipoPerfil: candidato.tipoPerfil,
            productivityValue: candidato.productivityValue,
            productivityUnit: candidato.productivityUnit ?? null,
            setupMin: candidato.setupMin,
            cleanupMin: candidato.cleanupMin,
            feedReloadMin: candidato.feedReloadMin,
            detalleJson: candidato.detalleJson,
          };
        }
      }
    }

    // ─── 3. G-M8 — Regla declarativa por perfil ──────────────────────
    for (const perfil of perfilesDisponibles) {
      if (!perfil.activo) continue;
      const detalle = (perfil.detalleJson ?? {}) as Record<string, unknown>;
      const regla = detalle.reglaSeleccion ?? detalle.condicion ?? null;
      if (regla === null || regla === undefined) continue;
      const evaluacion = evaluarRegla(regla, ctx);
      if (evaluacion.error) continue; // regla mal formada → ignorar perfil
      if (evaluacion.resultado === true && perfil.id !== paso.perfilM1Id) {
        return {
          id: perfil.id,
          nombre: perfil.nombre,
          tipoPerfil: perfil.tipoPerfil,
          productivityValue: perfil.productivityValue,
          productivityUnit: perfil.productivityUnit ?? null,
          setupMin: perfil.setupMin,
          cleanupMin: perfil.cleanupMin,
          feedReloadMin: perfil.feedReloadMin,
          detalleJson: perfil.detalleJson,
        };
      }
    }

    // (La heurística legacy "impresión por hoja según caras" se retiró:
    // el filtro encadenado del punto 1 corre para toda la familia y ya
    // contempla las caras, así que nunca se llegaba hasta acá.)

    // No hubo cambio
    return null;
  }

  /**
   * El trabajo pide doble faz y la máquina no tiene ningún perfil de doble
   * faz: el motor cae en un perfil de simple faz y el tiempo sale a la
   * mitad del real. Antes pasaba en silencio; ahora la cotización lo dice.
   *
   * Es WARNING y no ERROR a propósito: la cotización sale igual —la
   * imprenta puede querer cotizar mientras termina de cargar la máquina—,
   * pero queda escrito que ese tiempo está subestimado.
   */
  private avisarFaltaPerfilDobleFaz(
    errores: ErrorMotor[],
    paso: PasoCargado,
    jobContext: JobContext,
    perfilResuelto: NonNullable<PasoCargado['perfil']> | null,
  ) {
    if (paso.familiaCodigo !== 'impresion_por_hoja') return;
    const ctx = jobContext as Record<string, unknown>;
    const tieneSenalCaras =
      typeof jobContext.caras === 'number' ||
      ctx[`caras_${paso.configPasoId}`] !== undefined;
    if (!tieneSenalCaras) return;
    if (this.carasEfectivasPaso(paso, jobContext) !== 2) return;

    const perfilEnUso =
      perfilResuelto ??
      paso.perfilesDisponibles?.find((p) => p.id === paso.perfilM1Id) ??
      paso.perfil;
    if (perfilEnUso && this.perfilEsDobleFaz(perfilEnUso)) return;

    const hayAlguno = this.filtrarPerfilesCompatibles(
      paso.familiaCodigo,
      paso.perfilesDisponibles,
    ).some((perfil) => this.perfilEsDobleFaz(perfil));
    if (hayAlguno) return;

    errores.push({
      codigo: 'perfil_doble_faz_faltante',
      severidad: 'WARNING',
      mensaje: `El paso ${paso.rutaPasoOrden} se cotiza a doble faz, pero ${paso.maquina?.nombre ?? 'la máquina'} no tiene ningún perfil de doble faz: el tiempo sale calculado con uno de simple faz y queda subestimado.`,
      rutaPasoId: paso.rutaPasoId,
      rutaPasoOrden: paso.rutaPasoOrden,
      familiaCodigo: paso.familiaCodigo,
      sugerencia:
        'Agregar un perfil de doble faz a la máquina con su productividad real.',
      contexto: {
        maquinaId: paso.maquina?.id,
        perfilId: perfilEnUso?.id ?? null,
      },
    });
  }

  /**
   * v3.0 (doc §5): discriminante canónico `detalle.caras` ('SIMPLE_FAZ' |
   * 'DOBLE_FAZ'); retro-compat con `detalle.dobleFaz` y nombre del perfil.
   */
  private perfilEsDobleFaz(perfil: {
    nombre: string;
    detalleJson?: unknown;
  }): boolean {
    const detalle =
      perfil.detalleJson && typeof perfil.detalleJson === 'object'
        ? (perfil.detalleJson as Record<string, unknown>)
        : {};
    return (
      detalle.caras === 'DOBLE_FAZ' ||
      detalle.dobleFaz === true ||
      /doble/i.test(perfil.nombre)
    );
  }

  /**
   * F.2.7 — Calcula los cargos directos a nivel COTIZACIÓN.
   *
   * Itera los cargos pre-declarados en el producto, evalúa activación
   * (OBLIGATORIO/OPCIONAL/CONDICIONAL) y calcula el monto según el modo:
   *  - MONTO_FIJO_PLANO: lee del config (con override si aplica)
   *  - PORCENTAJE_SOBRE_BASE: % × subtotal de la cotización
   *  - POR_UNIDAD_INPUT: precioPorUnidad × valor del input declarado
   */
  private aplicarCargosCotizacion(
    cargos: ProductoCargado['cargosDirectosCotizacion'],
    jobContext: JobContext,
    subtotalCotizacion: number,
  ): CargoDirectoEjecutado[] {
    const ejecutados: CargoDirectoEjecutado[] = [];
    for (const cargo of cargos) {
      // Activación
      const activado = this.evaluarActivacionCargo(cargo, jobContext);
      if (!activado) continue;

      const config = (cargo.configOverrideJson ??
        cargo.catalogo.configJson) as Record<string, unknown> | null;
      const monto = this.calcularMontoCargo(
        cargo.catalogo.modoCalculo,
        config,
        jobContext,
        subtotalCotizacion,
      );

      ejecutados.push({
        cargoDirectoCatalogoId: cargo.cargoDirectoCatalogoId,
        cargoCodigo: cargo.catalogo.codigo,
        cargoNombre: cargo.catalogo.nombre,
        modoCalculo: cargo.catalogo.modoCalculo as
          'MONTO_FIJO_PLANO' | 'PORCENTAJE_SOBRE_BASE' | 'POR_UNIDAD_INPUT',
        monto,
        detalle: { config, baseCalculo: subtotalCotizacion },
      });
    }
    return ejecutados;
  }

  private evaluarActivacionCargo(
    cargo: {
      modoActivacion: string;
      condicionActivacionJson: unknown;
      id: string;
    },
    jobContext: JobContext,
  ): boolean {
    if (cargo.modoActivacion === 'OBLIGATORIO') return true;
    if (cargo.modoActivacion === 'OPCIONAL') {
      const opcionales = jobContext.opcionalesActivados ?? {};
      return opcionales[cargo.id] === true;
    }
    if (cargo.modoActivacion === 'CONDICIONAL') {
      const r = evaluarRegla(
        cargo.condicionActivacionJson,
        jobContext as unknown as Record<string, unknown>,
      );
      return r.resultado;
    }
    return false;
  }

  /**
   * F.2.7 — Calcula el monto del cargo según su modoCalculo.
   * Lee del configJson (puede haber override en la asociación producto/paso).
   */
  private calcularMontoCargo(
    modoCalculo: string,
    config: Record<string, unknown> | null,
    jobContext: JobContext,
    subtotalBase: number,
  ): number {
    if (!config) return 0;

    if (modoCalculo === 'MONTO_FIJO_PLANO') {
      // Si hay zonas (ej: viático), buscar la zona elegida en el JobContext
      const zonas = config.zonas as
        Array<{ codigo: string; monto: number }> | undefined;
      if (zonas && jobContext.zonaInstalacion) {
        const zona = zonas.find((z) => z.codigo === jobContext.zonaInstalacion);
        if (zona) return Number(zona.monto);
      }
      // Sino, usar el monto fijo
      return Number(config.monto ?? 0);
    }

    if (modoCalculo === 'PORCENTAJE_SOBRE_BASE') {
      const pct = Number(config.porcentaje ?? config.porcentajeDefault ?? 0);
      return (subtotalBase * pct) / 100;
    }

    if (modoCalculo === 'POR_UNIDAD_INPUT') {
      const precioPorUnidad = Number(config.precioPorUnidad ?? 0);
      const inputCantidad =
        typeof config.inputCantidad === 'string' ? config.inputCantidad : '';
      const valorInput = Number(
        (jobContext as Record<string, unknown>)[inputCantidad] ?? 0,
      );
      return precioPorUnidad * valorInput;
    }

    return 0;
  }

  /**
   * F.2.6 — Aplica los multiplicadores activos del paso a la cantidad base.
   *
   * El paso del producto declara `multiplicadoresActivos: string[]` (ej: ['caras', 'tipoCopia']).
   * Cada multiplicador lee su valor del JobContext y multiplica la cantidad.
   *
   * Multiplicadores soportados (MVP):
   *  - 'caras': multiplica por jobContext.caras (1 simple, 2 doble faz)
   *  - 'tipoCopia': multiplica por jobContext.tipoCopia (1, 2, 3)
   *  - 'hojasPorLibro': multiplica por jobContext.hojasPorLibro (anillado)
   *  - 'cantidadModificacionesPorPieza': multiplica por jobContext.cantidadModificacionesPorPieza
   *  - cualquier otro string: lee dinámicamente del JobContext (truthy default 1)
   */
  private aplicarMultiplicadores(
    cantidadBase: number,
    paso: PasoCargado,
    jobContext: JobContext,
  ): number {
    if (
      !paso.multiplicadoresActivos ||
      paso.multiplicadoresActivos.length === 0
    ) {
      return cantidadBase;
    }
    let resultado = cantidadBase;
    for (const codigoMult of paso.multiplicadoresActivos) {
      const valor =
        codigoMult === 'caras'
          ? this.carasEfectivasPaso(paso, jobContext)
          : (jobContext as Record<string, unknown>)[codigoMult];
      if (typeof valor === 'number' && valor > 0) {
        resultado *= valor;
      }
    }
    return resultado;
  }

  // ============================================================================
  // CARGA DE DATOS DEL DB
  // ============================================================================

  /**
   * Pieza de desgaste tal como la ve el motor. El precio sale de la variante
   * de inventario cuando el repuesto está dado de alta; si no, del precio
   * suelto que declaró la imprenta en la ficha de la máquina.
   */
  private toComponenteDesgasteCargado(componente: {
    id: string;
    nombre: string;
    tipo: string;
    vidaUtilEstimada: unknown;
    unidadDesgaste: string;
    precioUnitario: unknown;
    soloColor: boolean;
    activo: boolean;
    materiaPrimaVarianteId: string | null;
    materiaPrimaVariante?: {
      id: string;
      sku: string;
      precioReferencia: unknown;
    } | null;
  }): ComponenteDesgasteCargado {
    return {
      id: componente.id,
      nombre: componente.nombre,
      tipo: componente.tipo.toLowerCase(),
      vidaUtilEstimada:
        componente.vidaUtilEstimada == null
          ? null
          : Number(componente.vidaUtilEstimada),
      unidadDesgaste: componente.unidadDesgaste.toLowerCase(),
      precioUnitario:
        componente.precioUnitario == null
          ? null
          : Number(componente.precioUnitario),
      soloColor: componente.soloColor,
      activo: componente.activo,
      materiaPrimaVarianteId: componente.materiaPrimaVarianteId,
      materiaPrimaVariante: componente.materiaPrimaVariante
        ? {
            id: componente.materiaPrimaVariante.id,
            sku: componente.materiaPrimaVariante.sku,
            precioReferencia:
              componente.materiaPrimaVariante.precioReferencia == null
                ? null
                : Number(componente.materiaPrimaVariante.precioReferencia),
          }
        : null,
    };
  }

  private toConsumibleCargado(consumible: {
    id: string;
    perfilOperativoId: string | null;
    nombre: string;
    tipo: string;
    unidad: string;
    rendimientoEstimado: unknown;
    consumoBase: unknown;
    activo: boolean;
    detalleJson: unknown;
    materiaPrimaVariante: {
      id: string;
      sku: string;
      nombreVariante?: string | null;
      precioReferencia: unknown;
      unidadStock?: string | null;
      atributosVarianteJson: unknown;
      materiaPrima?: {
        nombre: string;
        unidadStock: string;
        templateId: string;
        tipoTecnico: string;
      };
    };
  }) {
    return {
      id: consumible.id,
      perfilOperativoId: consumible.perfilOperativoId,
      nombre: consumible.nombre,
      tipo: consumible.tipo.toLowerCase(),
      unidad: consumible.unidad.toLowerCase(),
      rendimientoEstimado:
        consumible.rendimientoEstimado == null
          ? null
          : Number(consumible.rendimientoEstimado),
      consumoBase:
        consumible.consumoBase == null ? null : Number(consumible.consumoBase),
      activo: consumible.activo,
      detalleJson: consumible.detalleJson,
      materialVariante: {
        id: consumible.materiaPrimaVariante.id,
        sku: consumible.materiaPrimaVariante.sku,
        nombreVariante: consumible.materiaPrimaVariante.nombreVariante ?? null,
        materiaPrimaNombre:
          consumible.materiaPrimaVariante.materiaPrima?.nombre ?? null,
        materiaPrimaTemplateId:
          consumible.materiaPrimaVariante.materiaPrima?.templateId ?? null,
        materiaPrimaTipoTecnico:
          consumible.materiaPrimaVariante.materiaPrima?.tipoTecnico ?? null,
        precioReferencia:
          consumible.materiaPrimaVariante.precioReferencia == null
            ? null
            : Number(consumible.materiaPrimaVariante.precioReferencia),
        unidadStock:
          consumible.materiaPrimaVariante.unidadStock ??
          consumible.materiaPrimaVariante.materiaPrima?.unidadStock ??
          null,
        atributosVarianteJson: consumible.materiaPrimaVariante
          .atributosVarianteJson as Record<string, unknown> | null,
      },
    };
  }

  private async cargarProductoYRuta(
    tenantId: string,
    productoId: string,
    rutaAlternativaIdInput: string | null,
  ): Promise<ProductoCargado> {
    const producto = await this.prisma.producto.findFirst({
      where: { id: productoId, tenantId, activo: true },
      include: {
        rutasAlternativas: {
          where: { activo: true },
          include: {
            ruta: true,
            configPasos: {
              include: {
                rutaPaso: true,
                maquinaM1: {
                  include: {
                    centroCostoPrincipal: {
                      select: { id: true, nombre: true },
                    },
                    perfilesOperativos: true,
                    componentesDesgaste: {
                      where: { activo: true },
                      include: { materiaPrimaVariante: true },
                    },
                    consumibles: {
                      where: { activo: true },
                      include: {
                        materiaPrimaVariante: {
                          include: {
                            materiaPrima: {
                              select: {
                                nombre: true,
                                unidadStock: true,
                                templateId: true,
                                tipoTecnico: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                perfilM1: true,
                centroCosto: true,
                tercerizadoEntradas: { where: { activo: true } },
                slotsMateriales: {
                  include: {
                    materialVariante: {
                      include: {
                        materiaPrima: {
                          select: {
                            nombre: true,
                            unidadStock: true,
                            templateId: true,
                            tipoTecnico: true,
                          },
                        },
                      },
                    },
                    candidatos: {
                      orderBy: { orden: 'asc' },
                      include: {
                        materiaPrima: {
                          select: {
                            id: true,
                            nombre: true,
                            familia: true,
                            subfamilia: true,
                            templateId: true,
                          },
                        },
                        defaultVariante: true,
                        variantes: {
                          orderBy: { orden: 'asc' },
                          include: {
                            variante: {
                              include: {
                                materiaPrima: {
                                  select: {
                                    nombre: true,
                                    unidadStock: true,
                                    templateId: true,
                                    tipoTecnico: true,
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                maquinasCandidatas: {
                  where: { activo: true },
                  orderBy: [{ esPreferida: 'desc' }, { orden: 'asc' }],
                  include: {
                    perfilDefault: true,
                    maquina: {
                      include: {
                        centroCostoPrincipal: {
                          select: { id: true, nombre: true },
                        },
                        perfilesOperativos: true,
                        componentesDesgaste: {
                          where: { activo: true },
                          include: { materiaPrimaVariante: true },
                        },
                        consumibles: {
                          where: { activo: true },
                          include: {
                            materiaPrimaVariante: {
                              include: {
                                materiaPrima: {
                                  select: {
                                    nombre: true,
                                    unidadStock: true,
                                    templateId: true,
                                    tipoTecnico: true,
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                cargosDirectosPaso: {
                  where: { activo: true },
                  include: { cargoDirectoCatalogo: true },
                },
              },
              orderBy: { rutaPaso: { orden: 'asc' } },
            },
          },
        },
        cargosDirectosCotizacion: {
          include: { cargoDirectoCatalogo: true },
        },
      },
    });

    if (!producto) {
      throw new Error(`Producto no encontrado: ${productoId}`);
    }
    if (producto.rutasAlternativas.length === 0) {
      throw new Error(
        `Producto ${producto.codigo} no tiene rutas alternativas`,
      );
    }

    // Elegir ruta alternativa: explícita > preferida > primera
    let rutaAlt = rutaAlternativaIdInput
      ? producto.rutasAlternativas.find((r) => r.id === rutaAlternativaIdInput)
      : producto.rutasAlternativas.find((r) => r.esPreferida);
    if (!rutaAlt) rutaAlt = producto.rutasAlternativas[0];

    if (!rutaAlt) {
      throw new Error(
        `No se pudo elegir ruta alternativa para producto ${producto.codigo}`,
      );
    }

    const rutaVersion = await this.prisma.rutaVersion.findFirst({
      where: {
        tenantId,
        rutaId: rutaAlt.rutaId,
        version: rutaAlt.rutaVersion,
      },
    });
    if (!rutaVersion) {
      throw new Error(
        `La ruta ${rutaAlt.ruta.codigo} no tiene snapshot de versión ${rutaAlt.rutaVersion}`,
      );
    }
    const snapshotPasos = this.parseRutaVersionSnapshot(
      rutaVersion.snapshotJson,
    );
    const snapshotById = new Map(
      snapshotPasos.filter((p) => p.id).map((p) => [p.id!, p]),
    );
    const usaSnapshotConIds = snapshotById.size > 0;
    const configPasosVersionados = rutaAlt.configPasos
      .filter((cp) => {
        if (usaSnapshotConIds) return snapshotById.has(cp.rutaPasoId);
        return cp.rutaPaso.version === rutaAlt.rutaVersion;
      })
      .sort((a, b) => {
        const ordenA =
          snapshotById.get(a.rutaPasoId)?.orden ?? a.rutaPaso.orden;
        const ordenB =
          snapshotById.get(b.rutaPasoId)?.orden ?? b.rutaPaso.orden;
        return ordenA - ordenB;
      });

    // E.1 — defaults declarados de las familias de la ruta (fallback vivo).
    const defaultsPorFamilia = await this.cargarDefaultsFamilias(
      tenantId,
      configPasosVersionados.map(
        (cp) =>
          snapshotById.get(cp.rutaPasoId)?.familiaCodigo ??
          cp.rutaPaso.familiaCodigo,
      ),
    );

    const pasos: PasoCargado[] = configPasosVersionados.map((cp) => {
      const snapshotPaso = snapshotById.get(cp.rutaPasoId);
      const defaultsFamilia = defaultsPorFamilia.get(
        snapshotPaso?.familiaCodigo ?? cp.rutaPaso.familiaCodigo,
      );
      return aplicarCentroDefault({
        rutaPasoId: cp.rutaPaso.id,
        rutaPasoOrden: snapshotPaso?.orden ?? cp.rutaPaso.orden,
        familiaCodigo: snapshotPaso?.familiaCodigo ?? cp.rutaPaso.familiaCodigo,
        nombreVisible: cp.nombreVisible,
        configPasoId: cp.id,
        modoActivacion: cp.modoActivacion,
        condicionActivacionJson: cp.condicionActivacionJson,
        modoTiempo: cp.modoTiempo,
        mecanismoCantidad: cp.mecanismoCantidad,
        mecanismoCantidadConfigJson: cp.mecanismoCantidadConfigJson,
        multiplicadoresActivos: cp.multiplicadoresActivos,
        paramsPasoJson: cp.paramsPasoJson,
        maquinaM1Id: cp.maquinaM1Id,
        perfilM1Id: cp.perfilM1Id,
        centroCostoId: cp.maquinaM1Id ? null : cp.centroCostoId,
        setupOverrideMin: cp.setupOverrideMin
          ? Number(cp.setupOverrideMin)
          : null,
        cleanupOverrideMin: cp.cleanupOverrideMin
          ? Number(cp.cleanupOverrideMin)
          : null,
        tiempoFijoOverrideMin: cp.tiempoFijoOverrideMin
          ? Number(cp.tiempoFijoOverrideMin)
          : null,
        dotacionOperarios: cp.dotacionOperarios ?? 1,
        requiereRutaPasoIds: cp.requiereRutaPasoIds ?? [],
        tercerizado: cp.tercerizado,
        proveedorId: cp.proveedorId,
        fuenteCostoTercerizado: cp.fuenteCostoTercerizado,
        tercerizadoConfigJson: cp.tercerizadoConfigJson,
        plazoProveedorDias: cp.plazoProveedorDias,
        tercerizadoEntradas: cp.tercerizadoEntradas.map((e) => ({
          claveMatch: e.claveMatch,
          valoresJson: e.valoresJson,
          cantidad: e.cantidad,
          costo: Number(e.costo),
        })),
        maquina: cp.maquinaM1
          ? {
              id: cp.maquinaM1.id,
              codigo: cp.maquinaM1.codigo,
              nombre: cp.maquinaM1.nombre,
              plantilla: cp.maquinaM1.plantilla,
              anchoUtil: cp.maquinaM1.anchoUtil
                ? Number(cp.maquinaM1.anchoUtil)
                : null,
              centroCostoPrincipalId: cp.maquinaM1.centroCostoPrincipalId,
              centroCostoPrincipalNombre:
                cp.maquinaM1.centroCostoPrincipal?.nombre ?? null,
              parametrosTecnicosJson: cp.maquinaM1
                .parametrosTecnicosJson as Record<string, unknown> | null,
              consumibles: cp.maquinaM1.consumibles.map((c) =>
                this.toConsumibleCargado(c),
              ),
              componentesDesgaste: cp.maquinaM1.componentesDesgaste.map((d) =>
                this.toComponenteDesgasteCargado(d),
              ),
            }
          : undefined,
        perfil: cp.perfilM1
          ? {
              id: cp.perfilM1.id,
              nombre: cp.perfilM1.nombre,
              tipoPerfil: cp.perfilM1.tipoPerfil,
              productivityValue: cp.perfilM1.productivityValue
                ? Number(cp.perfilM1.productivityValue)
                : null,
              productivityUnit: cp.perfilM1.productivityUnit,
              setupMin: cp.perfilM1.setupMin
                ? Number(cp.perfilM1.setupMin)
                : null,
              cleanupMin: cp.perfilM1.cleanupMin
                ? Number(cp.perfilM1.cleanupMin)
                : null,
              feedReloadMin: cp.perfilM1.feedReloadMin
                ? Number(cp.perfilM1.feedReloadMin)
                : null,
              detalleJson: cp.perfilM1.detalleJson,
            }
          : undefined,
        centroCosto:
          !cp.maquinaM1Id && cp.centroCosto
            ? {
                id: cp.centroCosto.id,
                codigo: cp.centroCosto.codigo,
                nombre: cp.centroCosto.nombre,
              }
            : undefined,
        defaultsFamilia,
        perfilesDisponibles: cp.maquinaM1?.perfilesOperativos.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          tipoPerfil: p.tipoPerfil,
          activo: p.activo,
          productivityValue: p.productivityValue
            ? Number(p.productivityValue)
            : null,
          productivityUnit: p.productivityUnit,
          setupMin: p.setupMin ? Number(p.setupMin) : null,
          cleanupMin: p.cleanupMin ? Number(p.cleanupMin) : null,
          feedReloadMin: p.feedReloadMin ? Number(p.feedReloadMin) : null,
          detalleJson: p.detalleJson,
        })),
        maquinasCandidatas: cp.maquinasCandidatas.map((mc) => ({
          id: mc.id,
          maquinaId: mc.maquinaId,
          perfilDefaultId: mc.perfilDefaultId,
          esPreferida: mc.esPreferida,
          orden: mc.orden,
          maquina: {
            id: mc.maquina.id,
            codigo: mc.maquina.codigo,
            nombre: mc.maquina.nombre,
            plantilla: mc.maquina.plantilla,
            anchoUtil: mc.maquina.anchoUtil
              ? Number(mc.maquina.anchoUtil)
              : null,
            centroCostoPrincipalId: mc.maquina.centroCostoPrincipalId,
            centroCostoPrincipalNombre:
              mc.maquina.centroCostoPrincipal?.nombre ?? null,
            parametrosTecnicosJson: mc.maquina.parametrosTecnicosJson as Record<
              string,
              unknown
            > | null,
            consumibles: mc.maquina.consumibles.map((c) =>
              this.toConsumibleCargado(c),
            ),
            componentesDesgaste: mc.maquina.componentesDesgaste.map((d) =>
              this.toComponenteDesgasteCargado(d),
            ),
          },
          perfilesOperativos: mc.maquina.perfilesOperativos.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            tipoPerfil: p.tipoPerfil,
            activo: p.activo,
            productivityValue: p.productivityValue
              ? Number(p.productivityValue)
              : null,
            productivityUnit: p.productivityUnit,
            setupMin: p.setupMin ? Number(p.setupMin) : null,
            cleanupMin: p.cleanupMin ? Number(p.cleanupMin) : null,
            feedReloadMin: p.feedReloadMin ? Number(p.feedReloadMin) : null,
            detalleJson: p.detalleJson,
          })),
          perfilDefault: mc.perfilDefault
            ? {
                id: mc.perfilDefault.id,
                nombre: mc.perfilDefault.nombre,
                tipoPerfil: mc.perfilDefault.tipoPerfil,
                activo: mc.perfilDefault.activo,
                productivityValue: mc.perfilDefault.productivityValue
                  ? Number(mc.perfilDefault.productivityValue)
                  : null,
                productivityUnit: mc.perfilDefault.productivityUnit,
                setupMin: mc.perfilDefault.setupMin
                  ? Number(mc.perfilDefault.setupMin)
                  : null,
                cleanupMin: mc.perfilDefault.cleanupMin
                  ? Number(mc.perfilDefault.cleanupMin)
                  : null,
                feedReloadMin: mc.perfilDefault.feedReloadMin
                  ? Number(mc.perfilDefault.feedReloadMin)
                  : null,
                detalleJson: mc.perfilDefault.detalleJson,
              }
            : null,
        })),
        slots: cp.slotsMateriales.map((s) => ({
          id: s.id,
          slotCodigo: s.slotCodigo,
          slotNombre: s.slotNombre,
          slotRol: s.slotRol,
          modoSeleccion: s.modoSeleccion,
          criterioMotorAuto: s.criterioMotorAuto,
          criterioInputCampo: s.criterioInputCampo,
          criterioMaterialCampo: s.criterioMaterialCampo,
          materialVarianteId: s.materialVarianteId,
          candidatos: s.candidatos.map((c) => ({
            id: c.id,
            materiaPrimaId: c.materiaPrimaId,
            defaultVarianteId: c.defaultVarianteId,
            orden: c.orden,
            variantes: c.variantes.map((cv) => ({
              varianteId: cv.varianteId,
              orden: cv.orden,
            })),
          })),
          estrategiaCosto: s.estrategiaCosto,
          formula: s.formula,
          cantidadFactor:
            s.cantidadFactor === null || s.cantidadFactor === undefined
              ? null
              : Number(s.cantidadFactor),
          cantidadBase: s.cantidadBase,
          aplicaMultiCaras: s.aplicaMultiCaras,
          materialVariante: s.materialVariante
            ? {
                id: s.materialVariante.id,
                sku: s.materialVariante.sku,
                nombreVariante: s.materialVariante.nombreVariante,
                materiaPrimaNombre:
                  s.materialVariante.materiaPrima?.nombre ?? null,
                materiaPrimaTemplateId:
                  s.materialVariante.materiaPrima?.templateId ?? null,
                materiaPrimaTipoTecnico:
                  s.materialVariante.materiaPrima?.tipoTecnico ?? null,
                precioReferencia: s.materialVariante.precioReferencia
                  ? Number(s.materialVariante.precioReferencia)
                  : null,
                atributosVarianteJson: s.materialVariante
                  .atributosVarianteJson as Record<string, unknown> | null,
                unidadStock:
                  s.materialVariante.unidadStock ??
                  s.materialVariante.materiaPrima?.unidadStock ??
                  null,
              }
            : undefined,
        })),
        cargosDirectosPaso: cp.cargosDirectosPaso.map((c) => ({
          id: c.id,
          cargoDirectoCatalogoId: c.cargoDirectoCatalogoId,
          modoActivacion: c.modoActivacion,
          condicionActivacionJson: c.condicionActivacionJson,
          configOverrideJson: c.configOverrideJson,
          catalogo: {
            codigo: c.cargoDirectoCatalogo.codigo,
            nombre: c.cargoDirectoCatalogo.nombre,
            modoCalculo: c.cargoDirectoCatalogo.modoCalculo,
            configJson: c.cargoDirectoCatalogo.configJson,
          },
        })),
      });
    });

    // G-F3 — Pasos extras inline: pasos puntuales de ESTA ruta alternativa del
    // producto (no de la ruta base reusable). Se cargan aparte y se insertan en
    // la secuencia según `insertarDespuesDeRutaPasoId` + `ordenInterno`.
    const pasosExtras = await this.cargarPasosExtras(
      tenantId,
      producto.id,
      rutaAlt.id,
    );
    const pasosConExtras =
      pasosExtras.length > 0
        ? this.insertarPasosExtras(pasos, pasosExtras)
        : pasos;

    return {
      productoId: producto.id,
      productoCodigo: producto.codigo,
      productoNombre: producto.nombre,
      unidadComercial: producto.unidadComercial,
      modoMedidas: producto.modoMedidas,
      minimoComercialPolitica: producto.minimoComercialPolitica,
      minimoComercialCantidad: producto.minimoComercialCantidad
        ? Number(producto.minimoComercialCantidad)
        : null,
      minimoComercialBase:
        producto.minimoComercialBase === 'pliegos_impresos'
          ? 'pliegos_impresos'
          : 'cantidad_comercial',
      medidaDefaultAnchoMm: producto.medidaDefaultAnchoMm
        ? Number(producto.medidaDefaultAnchoMm)
        : null,
      medidaDefaultAltoMm: producto.medidaDefaultAltoMm
        ? Number(producto.medidaDefaultAltoMm)
        : null,
      precioConfigJson: producto.precioConfigJson,
      rutaAlternativaId: rutaAlt.id,
      rutaAlternativaNombre: rutaAlt.nombre,
      rutaId: rutaAlt.ruta.id,
      rutaCodigo: rutaAlt.ruta.codigo,
      rutaNombre: rutaAlt.ruta.nombre,
      pasos: pasosConExtras,
      cargosDirectosCotizacion: producto.cargosDirectosCotizacion.map((c) => ({
        id: c.id,
        cargoDirectoCatalogoId: c.cargoDirectoCatalogoId,
        modoActivacion: c.modoActivacion,
        condicionActivacionJson: c.condicionActivacionJson,
        configOverrideJson: c.configOverrideJson,
        catalogo: {
          codigo: c.cargoDirectoCatalogo.codigo,
          nombre: c.cargoDirectoCatalogo.nombre,
          modoCalculo: c.cargoDirectoCatalogo.modoCalculo,
          configJson: c.cargoDirectoCatalogo.configJson,
        },
      })),
    };
  }

  private parseRutaVersionSnapshot(snapshotJson: unknown): Array<{
    id?: string;
    orden: number;
    familiaCodigo: string;
  }> {
    const snapshot = snapshotJson as { pasos?: unknown[] } | null;
    if (!snapshot || !Array.isArray(snapshot.pasos)) return [];

    type SnapshotPaso = { id?: string; orden: number; familiaCodigo: string };
    return snapshot.pasos
      .map((paso) => {
        const item = paso as Record<string, unknown>;
        const orden = typeof item.orden === 'number' ? item.orden : null;
        const familiaCodigo =
          typeof item.familiaCodigo === 'string'
            ? item.familiaCodigo
            : typeof item.familia === 'string'
              ? item.familia
              : null;
        if (orden == null || !familiaCodigo) return null;
        const parsed: SnapshotPaso = {
          id: typeof item.id === 'string' ? item.id : undefined,
          orden,
          familiaCodigo,
        };
        return parsed;
      })
      .filter((item): item is SnapshotPaso => item !== null);
  }

  // ==========================================================================
  // G-F3 — PASOS EXTRAS INLINE
  // ==========================================================================

  /**
   * Carga los pasos extras activos de una ruta alternativa (con su máquina,
   * perfil y centro de costo) y los mapea a `PasoCargado` con metadata de
   * posición. Los extras viven en el producto pero se resuelven por ruta.
   */
  private async cargarPasosExtras(
    tenantId: string,
    productoId: string,
    rutaAlternativaId: string,
  ): Promise<
    Array<{
      paso: PasoCargado;
      insertarDespuesDeRutaPasoId: string | null;
      ordenInterno: number;
    }>
  > {
    const rows = await this.prisma.productoPasoExtra.findMany({
      where: { tenantId, productoId, rutaAlternativaId, activo: true },
      orderBy: { ordenInterno: 'asc' },
      include: {
        maquinaM1: {
          include: {
            centroCostoPrincipal: { select: { id: true, nombre: true } },
            perfilesOperativos: true,
            componentesDesgaste: {
              where: { activo: true },
              include: { materiaPrimaVariante: true },
            },
            consumibles: {
              where: { activo: true },
              include: {
                materiaPrimaVariante: {
                  include: {
                    materiaPrima: {
                      select: {
                        nombre: true,
                        unidadStock: true,
                        templateId: true,
                        tipoTecnico: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        perfilM1: true,
        centroCosto: { select: { id: true, codigo: true, nombre: true } },
      },
    });

    // Sub-fase 3: los cargos de paso de un extra viven en configCargosDirectosJson
    // (sólo ids). Hidratamos los catálogos referenciados en una sola query.
    const cargoCatalogoIds = new Set<string>();
    for (const row of rows) {
      for (const c of this.parsePasoExtraCargos(row.configCargosDirectosJson)) {
        if (c.cargoDirectoCatalogoId) cargoCatalogoIds.add(c.cargoDirectoCatalogoId);
      }
    }
    const catalogos = cargoCatalogoIds.size
      ? await this.prisma.cargoDirectoCatalogo.findMany({
          where: { tenantId, id: { in: [...cargoCatalogoIds] }, activo: true },
        })
      : [];
    const catalogoMap = new Map(catalogos.map((c) => [c.id, c]));

    // M-2 en extras: las candidatas viven en configMaquinasCandidatasJson
    // (sólo ids). Hidratamos las máquinas referenciadas en una sola query,
    // con el mismo include que la M-1 (perfiles + consumibles + centro).
    const candidataMaquinaIds = new Set<string>();
    for (const row of rows) {
      for (const c of this.parsePasoExtraCandidatas(
        row.configMaquinasCandidatasJson,
      )) {
        if (c.maquinaId) candidataMaquinaIds.add(c.maquinaId);
      }
    }
    const candidataMaquinas = candidataMaquinaIds.size
      ? await this.prisma.maquina.findMany({
          where: {
            tenantId,
            id: { in: [...candidataMaquinaIds] },
            activo: true,
          },
          include: {
            centroCostoPrincipal: { select: { id: true, nombre: true } },
            perfilesOperativos: true,
            componentesDesgaste: {
              where: { activo: true },
              include: { materiaPrimaVariante: true },
            },
            consumibles: {
              where: { activo: true },
              include: {
                materiaPrimaVariante: {
                  include: {
                    materiaPrima: {
                      select: {
                        nombre: true,
                        unidadStock: true,
                        templateId: true,
                        tipoTecnico: true,
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : [];
    const candidataMaquinaMap = new Map(
      candidataMaquinas.map((m) => [m.id, m]),
    );

    return Promise.all(
      rows.map(async (row) => ({
        paso: await this.mapPasoExtraToPasoCargado(
          row,
          tenantId,
          catalogoMap,
          candidataMaquinaMap,
        ),
        insertarDespuesDeRutaPasoId: row.insertarDespuesDeRutaPasoId,
        ordenInterno: row.ordenInterno,
      })),
    );
  }

  /** Parseo defensivo de configMaquinasCandidatasJson de un paso extra. */
  private parsePasoExtraCandidatas(json: unknown): PasoExtraCandidataJson[] {
    return Array.isArray(json) ? (json as PasoExtraCandidataJson[]) : [];
  }

  /** Parseo defensivo de configSlotsMaterialesJson de un paso extra. */
  private parsePasoExtraSlots(json: unknown): PasoExtraSlotJson[] {
    return Array.isArray(json) ? (json as PasoExtraSlotJson[]) : [];
  }

  /** Parseo defensivo de configCargosDirectosJson de un paso extra. */
  private parsePasoExtraCargos(json: unknown): PasoExtraCargoJson[] {
    return Array.isArray(json) ? (json as PasoExtraCargoJson[]) : [];
  }

  /** Mapea un ProductoPasoExtra (con includes) al shape `PasoCargado`. */
  private async mapPasoExtraToPasoCargado(
    row: Prisma.ProductoPasoExtraGetPayload<{
      include: {
        maquinaM1: {
          include: {
            centroCostoPrincipal: { select: { id: true; nombre: true } };
            perfilesOperativos: true;
            componentesDesgaste: { include: { materiaPrimaVariante: true } };
            consumibles: {
              include: {
                materiaPrimaVariante: {
                  include: {
                    materiaPrima: {
                      select: {
                        nombre: true;
                        unidadStock: true;
                        templateId: true;
                        tipoTecnico: true;
                      };
                    };
                  };
                };
              };
            };
          };
        };
        perfilM1: true;
        centroCosto: { select: { id: true; codigo: true; nombre: true } };
      };
    }>,
    tenantId: string,
    catalogoMap: Map<
      string,
      { id: string; codigo: string; nombre: string; modoCalculo: string; configJson: unknown }
    >,
    candidataMaquinaMap: Map<
      string,
      Prisma.MaquinaGetPayload<{
        include: {
          centroCostoPrincipal: { select: { id: true; nombre: true } };
          perfilesOperativos: true;
          componentesDesgaste: { include: { materiaPrimaVariante: true } };
          consumibles: {
            include: {
              materiaPrimaVariante: {
                include: {
                  materiaPrima: {
                    select: {
                      nombre: true;
                      unidadStock: true;
                      templateId: true;
                      tipoTecnico: true;
                    };
                  };
                };
              };
            };
          };
        };
      }>
    >,
  ): Promise<PasoCargado> {
    const maquina = row.maquinaM1;
    const perfil = row.perfilM1;
    const slots = await this.buildSlotsPasoExtra(tenantId, row.id, row.configSlotsMaterialesJson);
    const cargosDirectosPaso = this.buildCargosPasoExtra(
      row.id,
      row.configCargosDirectosJson,
      catalogoMap,
    );
    const maquinasCandidatas = this.buildCandidatasPasoExtra(
      row.id,
      row.configMaquinasCandidatasJson,
      candidataMaquinaMap,
    );
    // E.1 — defaults declarados de la familia del extra (fallback vivo).
    const defaultsFamilia = (
      await this.cargarDefaultsFamilias(tenantId, [row.familiaCodigo])
    ).get(row.familiaCodigo);
    return aplicarCentroDefault({
      // El extra no tiene RutaPaso ni ConfigPaso: usamos su propio id como
      // identificador sintético (único) para overrides/snapshots/tecnología.
      rutaPasoId: row.id,
      defaultsFamilia,
      rutaPasoOrden: 0, // se renumera al insertar en la secuencia final
      familiaCodigo: row.familiaCodigo,
      nombreVisible: row.nombreVisible,
      configPasoId: row.id,
      modoActivacion: row.modoActivacion,
      condicionActivacionJson: row.condicionActivacionJson,
      modoTiempo: row.modoTiempo,
      mecanismoCantidad: row.mecanismoCantidad,
      mecanismoCantidadConfigJson: row.mecanismoCantidadConfigJson,
      multiplicadoresActivos: row.multiplicadoresActivos,
      paramsPasoJson: row.paramsPasoJson,
      maquinaM1Id: row.maquinaM1Id,
      perfilM1Id: row.perfilM1Id,
      centroCostoId: row.maquinaM1Id ? null : row.centroCostoId,
      setupOverrideMin: row.setupOverrideMin
        ? Number(row.setupOverrideMin)
        : null,
      cleanupOverrideMin: row.cleanupOverrideMin
        ? Number(row.cleanupOverrideMin)
        : null,
      tiempoFijoOverrideMin: row.tiempoFijoOverrideMin
        ? Number(row.tiempoFijoOverrideMin)
        : null,
      // Los pasos extra no tienen dotación configurable → 1 (default del motor).
      maquina: maquina
        ? {
            id: maquina.id,
            codigo: maquina.codigo,
            nombre: maquina.nombre,
            plantilla: maquina.plantilla,
            anchoUtil: maquina.anchoUtil ? Number(maquina.anchoUtil) : null,
            centroCostoPrincipalId: maquina.centroCostoPrincipalId,
            centroCostoPrincipalNombre:
              maquina.centroCostoPrincipal?.nombre ?? null,
            parametrosTecnicosJson: maquina.parametrosTecnicosJson as Record<
              string,
              unknown
            > | null,
            consumibles: maquina.consumibles.map((c) =>
              this.toConsumibleCargado(c),
            ),
            componentesDesgaste: maquina.componentesDesgaste.map((d) =>
              this.toComponenteDesgasteCargado(d),
            ),
          }
        : undefined,
      perfil: perfil
        ? {
            id: perfil.id,
            nombre: perfil.nombre,
            tipoPerfil: perfil.tipoPerfil,
            productivityValue: perfil.productivityValue
              ? Number(perfil.productivityValue)
              : null,
            productivityUnit: perfil.productivityUnit,
            setupMin: perfil.setupMin ? Number(perfil.setupMin) : null,
            cleanupMin: perfil.cleanupMin ? Number(perfil.cleanupMin) : null,
            feedReloadMin: perfil.feedReloadMin
              ? Number(perfil.feedReloadMin)
              : null,
            detalleJson: perfil.detalleJson,
          }
        : undefined,
      centroCosto:
        !row.maquinaM1Id && row.centroCosto
          ? {
              id: row.centroCosto.id,
              codigo: row.centroCosto.codigo,
              nombre: row.centroCosto.nombre,
            }
          : undefined,
      perfilesDisponibles: maquina?.perfilesOperativos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        tipoPerfil: p.tipoPerfil,
        activo: p.activo,
        productivityValue: p.productivityValue
          ? Number(p.productivityValue)
          : null,
        productivityUnit: p.productivityUnit,
        setupMin: p.setupMin ? Number(p.setupMin) : null,
        cleanupMin: p.cleanupMin ? Number(p.cleanupMin) : null,
        feedReloadMin: p.feedReloadMin ? Number(p.feedReloadMin) : null,
        detalleJson: p.detalleJson,
      })),
      maquinasCandidatas,
      slots,
      cargosDirectosPaso,
    });
  }

  /**
   * E.1 — Carga los defaults declarados (FamiliaPasoDefaults) de un set de
   * familias, con el centro de costo resuelto para display/tarifa. Devuelve
   * un mapa por familiaCodigo (código del catálogo o UUID tenant).
   */
  private async cargarDefaultsFamilias(
    tenantId: string,
    familiaCodigos: string[],
  ): Promise<Map<string, DefaultsFamiliaPaso>> {
    const codigos = [...new Set(familiaCodigos)];
    if (codigos.length === 0) return new Map();
    const rows = await this.prisma.familiaPasoDefaults.findMany({
      where: { tenantId, familiaCodigo: { in: codigos } },
      include: {
        centroCosto: { select: { id: true, codigo: true, nombre: true } },
      },
    });
    return new Map(
      rows.map((r) => [
        r.familiaCodigo,
        {
          centroCostoId: r.centroCostoId,
          centroCostoCodigo: r.centroCosto?.codigo ?? null,
          centroCostoNombre: r.centroCosto?.nombre ?? null,
          productividadHora:
            r.productividadHora != null ? Number(r.productividadHora) : null,
          tiempoFijoMin:
            r.tiempoFijoMin != null ? Number(r.tiempoFijoMin) : null,
          demasiaMm: r.demasiaMm != null ? Number(r.demasiaMm) : null,
          solapePanelMm:
            r.solapePanelMm != null ? Number(r.solapePanelMm) : null,
        },
      ]),
    );
  }

  /**
   * M-2 en extras — reconstruye las `maquinasCandidatas` de un paso extra
   * desde su `configMaquinasCandidatasJson` + las máquinas hidratadas.
   * Mismo shape que las candidatas normalizadas de ProductoConfigPaso, así
   * `resolverMaquinaM2` opera idéntico (preferida primero, override del
   * comercial vía `maquinaSeleccionada_${extraId}`). Descarta candidatas
   * cuya máquina no exista o esté inactiva.
   */
  private buildCandidatasPasoExtra(
    pasoExtraId: string,
    json: unknown,
    candidataMaquinaMap: Map<
      string,
      Prisma.MaquinaGetPayload<{
        include: {
          centroCostoPrincipal: { select: { id: true; nombre: true } };
          perfilesOperativos: true;
          componentesDesgaste: { include: { materiaPrimaVariante: true } };
          consumibles: {
            include: {
              materiaPrimaVariante: {
                include: {
                  materiaPrima: {
                    select: {
                      nombre: true;
                      unidadStock: true;
                      templateId: true;
                      tipoTecnico: true;
                    };
                  };
                };
              };
            };
          };
        };
      }>
    >,
  ): NonNullable<PasoCargado['maquinasCandidatas']> {
    const toPerfil = (p: {
      id: string;
      nombre: string;
      tipoPerfil: string | null;
      activo: boolean;
      productivityValue: Prisma.Decimal | null;
      productivityUnit: string | null;
      setupMin: Prisma.Decimal | null;
      cleanupMin: Prisma.Decimal | null;
      feedReloadMin: Prisma.Decimal | null;
      detalleJson: unknown;
    }) => ({
      id: p.id,
      nombre: p.nombre,
      tipoPerfil: p.tipoPerfil,
      activo: p.activo,
      productivityValue: p.productivityValue
        ? Number(p.productivityValue)
        : null,
      productivityUnit: p.productivityUnit,
      setupMin: p.setupMin ? Number(p.setupMin) : null,
      cleanupMin: p.cleanupMin ? Number(p.cleanupMin) : null,
      feedReloadMin: p.feedReloadMin ? Number(p.feedReloadMin) : null,
      detalleJson: p.detalleJson,
    });

    return this.parsePasoExtraCandidatas(json)
      .flatMap((c, i) => {
        const maquina = candidataMaquinaMap.get(c.maquinaId);
        if (!maquina) return [];
        const perfilDefault = c.perfilDefaultId
          ? (maquina.perfilesOperativos.find(
              (p) => p.id === c.perfilDefaultId,
            ) ?? null)
          : null;
        return [
          {
            id: `${pasoExtraId}:cand:${i}`,
            maquinaId: c.maquinaId,
            perfilDefaultId: c.perfilDefaultId ?? null,
            esPreferida: c.esPreferida ?? false,
            orden: c.orden ?? i,
            maquina: {
              id: maquina.id,
              codigo: maquina.codigo,
              nombre: maquina.nombre,
              plantilla: maquina.plantilla,
              anchoUtil: maquina.anchoUtil ? Number(maquina.anchoUtil) : null,
              centroCostoPrincipalId: maquina.centroCostoPrincipalId,
              centroCostoPrincipalNombre:
                maquina.centroCostoPrincipal?.nombre ?? null,
              parametrosTecnicosJson:
                maquina.parametrosTecnicosJson as Record<
                  string,
                  unknown
                > | null,
              consumibles: maquina.consumibles.map((con) =>
                this.toConsumibleCargado(con),
              ),
              componentesDesgaste: maquina.componentesDesgaste.map((d) =>
                this.toComponenteDesgasteCargado(d),
              ),
            },
            perfilesOperativos: maquina.perfilesOperativos.map(toPerfil),
            perfilDefault: perfilDefault ? toPerfil(perfilDefault) : null,
          },
        ];
      })
      .sort(
        (a, b) =>
          Number(b.esPreferida) - Number(a.esPreferida) || a.orden - b.orden,
      );
  }

  /**
   * Sub-fase 3 — reconstruye los `SlotCargado[]` de un paso extra desde su
   * `configSlotsMaterialesJson`. Para HARDCODED hidrata la variante concreta
   * (precio/atributos) por id; los candidatos se hidratan on-demand en
   * `resolverMaterialSlot` durante la cotización.
   */
  private async buildSlotsPasoExtra(
    tenantId: string,
    pasoExtraId: string,
    json: unknown,
  ): Promise<SlotCargado[]> {
    const slotsJson = this.parsePasoExtraSlots(json);
    return Promise.all(
      slotsJson.map(async (s, i) => {
        const materialVariante =
          s.modoSeleccion === 'HARDCODED' && s.materialVarianteId
            ? ((await this.cargarVariantePorId(tenantId, s.materialVarianteId)) ??
              undefined)
            : undefined;
        return {
          id: `${pasoExtraId}:slot:${i}`,
          slotCodigo: s.slotCodigo,
          slotNombre: s.slotNombre ?? null,
          slotRol: s.slotRol ?? null,
          modoSeleccion: s.modoSeleccion,
          criterioMotorAuto: s.criterioMotorAuto ?? null,
          criterioInputCampo: s.criterioInputCampo ?? null,
          criterioMaterialCampo: s.criterioMaterialCampo ?? null,
          materialVarianteId: s.materialVarianteId ?? null,
          candidatos: (s.candidatos ?? []).map((c, ci) => ({
            id: `${pasoExtraId}:slot:${i}:cand:${ci}`,
            materiaPrimaId: c.materiaPrimaId,
            defaultVarianteId: c.defaultVarianteId ?? null,
            orden: c.orden ?? ci,
            variantes: (c.varianteIds ?? []).map((vid, vi) => ({
              varianteId: vid,
              orden: vi,
            })),
          })),
          estrategiaCosto: s.estrategiaCosto ?? 'AUTO',
          formula: s.formula ?? '',
          cantidadFactor:
            s.cantidadFactor === undefined ? null : s.cantidadFactor,
          cantidadBase: s.cantidadBase ?? null,
          aplicaMultiCaras: s.aplicaMultiCaras ?? false,
          materialVariante,
        };
      }),
    );
  }

  /**
   * Sub-fase 3 — reconstruye los `CargoPasoCargado[]` de un paso extra desde su
   * `configCargosDirectosJson`, usando el catálogo ya hidratado. Descarta
   * cargos cuyo catálogo no exista/esté inactivo.
   */
  private buildCargosPasoExtra(
    pasoExtraId: string,
    json: unknown,
    catalogoMap: Map<
      string,
      { id: string; codigo: string; nombre: string; modoCalculo: string; configJson: unknown }
    >,
  ): CargoPasoCargado[] {
    return this.parsePasoExtraCargos(json).flatMap((c, i) => {
      const cat = catalogoMap.get(c.cargoDirectoCatalogoId);
      if (!cat) return [];
      return [
        {
          id: `${pasoExtraId}:cargo:${i}`,
          cargoDirectoCatalogoId: c.cargoDirectoCatalogoId,
          modoActivacion: c.modoActivacion,
          condicionActivacionJson: c.condicionActivacionJson ?? null,
          configOverrideJson: c.configOverrideJson ?? null,
          catalogo: {
            codigo: cat.codigo,
            nombre: cat.nombre,
            modoCalculo: cat.modoCalculo,
            configJson: cat.configJson,
          },
        },
      ];
    });
  }

  /**
   * Inserta los pasos extras en la secuencia de pasos base según su posición
   * (`insertarDespuesDeRutaPasoId`: null = al inicio; UUID = después de ese
   * RutaPaso) y `ordenInterno`. Renumera `rutaPasoOrden` 1..N sobre la
   * secuencia final (es sólo display/output, no afecta la ejecución).
   */
  private insertarPasosExtras(
    pasos: PasoCargado[],
    extras: Array<{
      paso: PasoCargado;
      insertarDespuesDeRutaPasoId: string | null;
      ordenInterno: number;
    }>,
  ): PasoCargado[] {
    const porOrden = (
      a: { ordenInterno: number },
      b: { ordenInterno: number },
    ) => a.ordenInterno - b.ordenInterno;

    const alInicio = extras
      .filter((e) => e.insertarDespuesDeRutaPasoId == null)
      .sort(porOrden);
    const despuesDe = new Map<
      string,
      Array<(typeof extras)[number]>
    >();
    for (const e of extras) {
      if (e.insertarDespuesDeRutaPasoId == null) continue;
      const arr = despuesDe.get(e.insertarDespuesDeRutaPasoId) ?? [];
      arr.push(e);
      despuesDe.set(e.insertarDespuesDeRutaPasoId, arr);
    }

    const rutaPasoIdsPresentes = new Set(pasos.map((p) => p.rutaPasoId));
    const resultado: PasoCargado[] = [];
    resultado.push(...alInicio.map((e) => e.paso));
    for (const paso of pasos) {
      resultado.push(paso);
      const extrasDelPaso = despuesDe.get(paso.rutaPasoId);
      if (extrasDelPaso) {
        resultado.push(...[...extrasDelPaso].sort(porOrden).map((e) => e.paso));
      }
    }
    // Defensa: extras que apuntan a un RutaPaso que no está en esta ruta
    // (no debería pasar con scope por ruta) se agregan al final.
    for (const e of extras) {
      const ref = e.insertarDespuesDeRutaPasoId;
      if (ref != null && !rutaPasoIdsPresentes.has(ref)) {
        resultado.push(e.paso);
      }
    }

    // Renumerar orden de display 1..N.
    resultado.forEach((paso, index) => {
      paso.rutaPasoOrden = index + 1;
    });
    return resultado;
  }
}
