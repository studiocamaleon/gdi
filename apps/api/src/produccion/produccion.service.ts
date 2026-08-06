import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertEstacionDto } from './dto/upsert-estacion.dto';
import type { CrearDiaNoLaborableDto } from './dto/crear-dia-no-laborable.dto';
import type { ActualizarConfiguracionProduccionDto } from './dto/actualizar-configuracion-produccion.dto';
import {
  colaConsolidacionDeFamilia,
  FAMILIAS,
  resolverFamilia,
} from '../productos-servicios/pasos/familias';
import type { FamiliaCodigo } from '../productos-servicios/pasos/types';
import {
  normalizarCalendarioAlmacenado,
  parseCalendario,
  type CalendarioEstacion,
} from './calendario';
import { evaluateRollLayoutForConfiguredAlgorithm } from '../motor-universal/nesting-dispatcher';
import type { SimularNestingDto } from './dto/simular-nesting.dto';

/**
 * Mínimo de pasos hechos por familia para publicar su mediana histórica:
 * no se proyecta cola sobre anécdota (D6 de capacidad-estaciones-diseno.md).
 */
const MIN_MUESTRAS_MEDIANA = 3;

/** Serializa el calendario validado para la columna Json nullable. */
function calendarioAJson(calendario: CalendarioEstacion | null) {
  return calendario === null
    ? Prisma.DbNull
    : (calendario as unknown as Prisma.InputJsonValue);
}

// ── Simulador de impresión: extracción del snapshot ──────────────────────

type PiezaSimulador = { anchoMm: number; altoMm: number; cantidad: number };

/** Paso de trazabilidad del snapshot (sólo lo que el simulador lee). */
type TrazabilidadPasoSimulador = {
  rutaPasoId?: string | null;
  materiales?: Array<{
    tipoLineaCosto?: string;
    materialVarianteId?: string;
    materialSku?: string;
    materiaPrimaNombre?: string;
    precioUnitario?: number;
    unidad?: string;
    atributosVarianteJson?: { anchoMm?: unknown } | null;
    materiaPrimaId?: string;
  }>;
  nestingResult?: {
    placements?: Array<{ widthMm?: number; heightMm?: number }>;
    consumedLengthMm?: number;
    algorithm?: unknown;
    visualConfig?: {
      margins?: { topMm?: unknown; leftMm?: unknown; rightMm?: unknown; bottomMm?: unknown } | null;
      spacing?: { horizontalMm?: unknown; verticalMm?: unknown } | null;
      allowRotation?: unknown;
      pieceBleedMm?: unknown;
    } | null;
  } | null;
};

/**
 * Config de acomodo con la que el MOTOR costeó este paso, para volver a
 * acomodar la tanda consolidada con el mismo motor y los mismos parámetros.
 * Comparar contra un acomodo hecho con otros márgenes daba "ahorros"
 * negativos que no existían. Sin nesting en el snapshot → null.
 */
type NestingConfigSnapshot = {
  margenLateralMm: number;
  margenLongitudinalMm: number;
  separacionHMm: number;
  separacionVMm: number;
  /**
   * La demasía se come un borde de cada lado ADEMÁS del margen de máquina:
   * el motor acomoda dentro de `printable − 2×demasía` (por eso el snapshot
   * guarda usableArea 565 contra printableArea 570 en un rollo de 600).
   */
  demasiaMm: number;
  permitirRotacion: boolean;
  algorithm: NestingAlgorithm;
};

/** Algoritmos de rollo que el simulador sabe correr (el resto → 'auto'). */
type NestingAlgorithm = 'auto' | 'shelf-rollo' | 'maxrects-rollo';

function nestingConfigDeSnapshot(
  trazPaso: TrazabilidadPasoSimulador | null,
): NestingConfigSnapshot | null {
  const nesting = trazPaso?.nestingResult;
  const visual = nesting?.visualConfig;
  if (!visual) return null;
  const margins = visual.margins ?? {};
  const spacing = visual.spacing ?? {};
  // Conservador: el lado más ancho manda, el rollo es uno solo.
  const lateral = Math.max(numeroONull(margins.leftMm) ?? 0, numeroONull(margins.rightMm) ?? 0);
  const longitudinal = Math.max(
    numeroONull(margins.topMm) ?? 0,
    numeroONull(margins.bottomMm) ?? 0,
  );
  const algorithm = nesting?.algorithm;
  return {
    margenLateralMm: lateral,
    margenLongitudinalMm: longitudinal,
    separacionHMm: numeroONull(spacing.horizontalMm) ?? 0,
    separacionVMm: numeroONull(spacing.verticalMm) ?? 0,
    demasiaMm: numeroONull(visual.pieceBleedMm) ?? 0,
    permitirRotacion: visual.allowRotation !== false,
    // Se respeta el algoritmo con el que se COTIZÓ: correr otro haría aparecer
    // un ahorro que viene del algoritmo y no de juntar los trabajos.
    algorithm:
      algorithm === 'shelf-rollo' || algorithm === 'maxrects-rollo' ? algorithm : 'auto',
  };
}

function numeroONull(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

/**
 * Piezas físicas del job: los placements del nestingResult (post-panelizado
 * y con demasía — lo que la máquina imprime de verdad), comprimidos por
 * dimensión. Fallback: jobContext.piezas (mm). [] = sin medidas (D2).
 */
function piezasDeSnapshot(
  trazPaso: TrazabilidadPasoSimulador | null,
  jobContext: Record<string, unknown> | null,
): PiezaSimulador[] {
  const placements = trazPaso?.nestingResult?.placements;
  if (Array.isArray(placements) && placements.length > 0) {
    const porDim = new Map<string, PiezaSimulador>();
    for (const placement of placements) {
      const anchoMm = numeroONull(placement.widthMm);
      const altoMm = numeroONull(placement.heightMm);
      if (anchoMm === null || altoMm === null) continue;
      const clave = `${anchoMm}x${altoMm}`;
      const previa = porDim.get(clave);
      if (previa) previa.cantidad += 1;
      else porDim.set(clave, { anchoMm, altoMm, cantidad: 1 });
    }
    if (porDim.size > 0) return [...porDim.values()];
  }
  const piezas = jobContext?.piezas;
  if (Array.isArray(piezas)) {
    return piezas
      .map((pieza) => {
        const anchoMm = numeroONull((pieza as { anchoMm?: unknown }).anchoMm);
        const altoMm = numeroONull((pieza as { altoMm?: unknown }).altoMm);
        const cantidad = numeroONull((pieza as { cantidad?: unknown }).cantidad) ?? 1;
        if (anchoMm === null || altoMm === null) return null;
        return { anchoMm, altoMm, cantidad: Math.max(1, Math.round(cantidad)) };
      })
      .filter((pieza): pieza is PiezaSimulador => pieza !== null);
  }
  return [];
}

/** Lo que `acomodarTanda` necesita de un paso ya cargado de la DB. */
type PasoParaAcomodar = {
  id: string;
  rutaPasoId: string | null;
  item: {
    cotizacionItem: {
      jobContextJson: Prisma.JsonValue;
      trazabilidadJson: Prisma.JsonValue;
    } | null;
  };
};

/**
 * Acomoda la tanda consolidada con el motor real, un resultado por ancho de
 * rollo candidato. Las piezas y la config salen del snapshot de cada paso.
 * Exportada para test: es el pegamento entre el snapshot y el motor.
 */
export function acomodarTanda(pasos: PasoParaAcomodar[], anchosMm: number[]) {
  // Un `medidas[i]` por paso: el motor devuelve `piece-<i>-<copia>`, así se
  // sabe de qué trabajo es cada pieza acomodada.
  const medidas: Array<{ anchoMm: number; altoMm: number; cantidad: number }> = [];
  const pasoDeMedida: string[] = [];
  const configs: NestingConfigSnapshot[] = [];
  const sinMedidas: string[] = [];

  for (const paso of pasos) {
    const jobContext =
      (paso.item.cotizacionItem?.jobContextJson as Record<string, unknown> | null) ?? null;
    const pasosTraza = (
      paso.item.cotizacionItem?.trazabilidadJson as {
        pasos?: TrazabilidadPasoSimulador[];
      } | null
    )?.pasos;
    const trazPaso =
      (Array.isArray(pasosTraza)
        ? pasosTraza.find((t) => t.rutaPasoId && t.rutaPasoId === paso.rutaPasoId)
        : null) ?? null;

    const piezas = piezasDeSnapshot(trazPaso, jobContext);
    if (piezas.length === 0) {
      sinMedidas.push(paso.id);
      continue;
    }
    const config = nestingConfigDeSnapshot(trazPaso);
    if (config) configs.push(config);
    for (const pieza of piezas) {
      medidas.push({ anchoMm: pieza.anchoMm, altoMm: pieza.altoMm, cantidad: pieza.cantidad });
      pasoDeMedida.push(paso.id);
    }
  }

  // Config de la tanda: la más conservadora, el rollo es uno solo.
  const config = configs.reduce<NestingConfigSnapshot | null>(
    (acc, cur) =>
      acc === null
        ? cur
        : {
            margenLateralMm: Math.max(acc.margenLateralMm, cur.margenLateralMm),
            margenLongitudinalMm: Math.max(acc.margenLongitudinalMm, cur.margenLongitudinalMm),
            separacionHMm: Math.max(acc.separacionHMm, cur.separacionHMm),
            separacionVMm: Math.max(acc.separacionVMm, cur.separacionVMm),
            demasiaMm: Math.max(acc.demasiaMm, cur.demasiaMm),
            permitirRotacion: acc.permitirRotacion && cur.permitirRotacion,
            algorithm: acc.algorithm === cur.algorithm ? acc.algorithm : 'auto',
          },
      null,
  );
  if (!config || medidas.length === 0) return { sinMedidas, anchos: [] };

  // Bordes efectivos: margen de máquina MÁS demasía, igual que al cotizar
  // (el snapshot guarda usableArea 565 contra printableArea 570 en un 600).
  const bordeLateralMm = config.margenLateralMm + config.demasiaMm;
  const bordeLongitudinalMm = config.margenLongitudinalMm + config.demasiaMm;

  const vacio = (anchoMm: number, incompatibles: string[]) => ({
    anchoMm,
    consumedLengthMm: null,
    aprovechamientoPct: null,
    piezasAcomodadas: 0,
    incompatibles,
    placements: [] as Array<Record<string, unknown>>,
  });

  const anchos = anchosMm.map((anchoMm) => {
    const printableWidthMm = anchoMm - bordeLateralMm * 2;
    // Piezas que no entran ni de canto: el job entero queda afuera del batch.
    const incompatibles = [
      ...new Set(
        medidas
          .map((medida, idx) =>
            Math.min(medida.anchoMm, medida.altoMm) > printableWidthMm ? pasoDeMedida[idx] : null,
          )
          .filter((pasoId): pasoId is string => pasoId !== null),
      ),
    ];
    const indicesUsados = medidas
      .map((_, idx) => idx)
      .filter((idx) => !incompatibles.includes(pasoDeMedida[idx]));

    if (printableWidthMm <= 0 || indicesUsados.length === 0) return vacio(anchoMm, incompatibles);

    const candidato = evaluateRollLayoutForConfiguredAlgorithm(
      {
        printableWidthMm,
        marginLeftMm: bordeLateralMm,
        marginStartMm: bordeLongitudinalMm,
        marginEndMm: bordeLongitudinalMm,
        separacionHorizontalMm: config.separacionHMm,
        separacionVerticalMm: config.separacionVMm,
        permitirRotacion: config.permitirRotacion,
        medidas: indicesUsados.map((idx) => medidas[idx]),
      },
      config.algorithm,
    );
    if (!candidato) return vacio(anchoMm, incompatibles);

    const { result } = candidato;
    const areaTotalMm2 = anchoMm * result.consumedLengthMm;
    return {
      anchoMm,
      consumedLengthMm: result.consumedLengthMm,
      aprovechamientoPct:
        areaTotalMm2 > 0
          ? Math.round(((result.usefulAreaM2 * 1_000_000) / areaTotalMm2) * 10000) / 100
          : 0,
      piezasAcomodadas: result.placements.length,
      incompatibles,
      placements: result.placements.map((p) => {
        // `piece-<medidaIndex>-<copia>`; medidaIndex indexa el array que se le
        // pasó al motor, que acá viene filtrado por incompatibles.
        const medidaIndex = Number.parseInt((p.sourcePieceId ?? '').split('-')[1] ?? '', 10);
        const idxOriginal = indicesUsados[medidaIndex];
        return {
          pasoId: idxOriginal !== undefined ? pasoDeMedida[idxOriginal] : null,
          xMm: p.centerXMm - p.widthMm / 2,
          yMm: p.centerYMm - p.heightMm / 2,
          widthMm: p.widthMm,
          heightMm: p.heightMm,
          rotated: p.rotated,
        };
      }),
    };
  });

  return { sinMedidas, anchos };
}

/** Paso de trazabilidad para el simulador LÁSER (por hoja). */
type TrazabilidadPasoLaser = {
  rutaPasoId?: string | null;
  configPasoId?: string | null;
  materiales?: Array<{
    tipoLineaCosto?: string;
    materiaPrimaNombre?: string;
    cantidad?: number;
    unidad?: string;
    atributosVarianteJson?: {
      gramaje?: unknown;
      gramajeGr?: unknown;
      formatoComercial?: unknown;
      anchoMm?: unknown;
      altoMm?: unknown;
    } | null;
  }>;
  outputsCanonicos?: {
    pliegos_impresos?: unknown;
    pliego_impresion_ancho_mm?: unknown;
    pliego_impresion_alto_mm?: unknown;
  } | null;
};

function buildLaserJob(
  orden: {
    id: string;
    numero: string;
    fechaEntrega: Date | null;
    cliente: { nombre: string } | null;
  },
  item: {
    id: string;
    nombre: string;
    ordenIndice: number;
    cotizacionItem: {
      jobContextJson: Prisma.JsonValue;
      trazabilidadJson: Prisma.JsonValue;
    } | null;
    pasos: Array<{ indice: number; nombre: string; estado: string }>;
  },
  frontera: {
    id: string;
    indice: number;
    rutaPasoId: string | null;
    estado: string;
    centroCostoId: string | null;
    centroCostoNombre: string | null;
    duracionEstimadaMin: Prisma.Decimal | null;
    iniciadoEl: Date | null;
  },
) {
  const jobContext =
    (item.cotizacionItem?.jobContextJson as Record<string, unknown> | null) ?? null;
  const pasosTraza = (
    item.cotizacionItem?.trazabilidadJson as { pasos?: TrazabilidadPasoLaser[] } | null
  )?.pasos;
  const trazPaso =
    (Array.isArray(pasosTraza)
      ? pasosTraza.find((paso) => paso.rutaPasoId && paso.rutaPasoId === frontera.rutaPasoId)
      : null) ?? null;
  const sustrato =
    trazPaso?.materiales?.find((mat) => mat.tipoLineaCosto === 'MATERIAL') ?? null;
  const atributos = sustrato?.atributosVarianteJson ?? null;

  // Las claves por-paso del jobContext se indexan por CONFIG del paso
  // (configPasoId), no por rutaPasoId.
  const configPasoId = trazPaso?.configPasoId ?? null;
  const modoPorPaso = (jobContext?.modoColorPorPaso as Record<string, unknown> | undefined)?.[
    configPasoId ?? ''
  ];
  const modoColor =
    (typeof modoPorPaso === 'string' && modoPorPaso) ||
    (typeof jobContext?.modoColor === 'string' && jobContext.modoColor) ||
    null;
  // Máquina ASIGNADA al cotizar (elegible en el sheet); la default de la
  // config se resuelve después si acá no hay nada.
  const maquinaSeleccionada = jobContext?.[`maquinaSeleccionada_${configPasoId ?? ''}`];
  const carasCrudo = numeroONull(jobContext?.caras);
  const caras = carasCrudo === 1 || carasCrudo === 2 ? carasCrudo : null;

  // Adónde va DESPUÉS: los pasos siguientes del item, como contexto.
  const acabados = item.pasos
    .filter((paso) => paso.indice > frontera.indice)
    .map((paso) => paso.nombre)
    .slice(0, 4);

  // PLIEGO DE IMPRESIÓN (lo que se carga en la máquina) ≠ formato de
  // compra del papel: acá los outputs canónicos; si vienen null (cotización
  // vieja) se resuelve después desde la config del paso.
  const pliegoAnchoMm = numeroONull(trazPaso?.outputsCanonicos?.pliego_impresion_ancho_mm);
  const pliegoAltoMm = numeroONull(trazPaso?.outputsCanonicos?.pliego_impresion_alto_mm);

  // Hojas físicas que pasan por la máquina = pliegos de impresión; los
  // clics multiplican por caras.
  const pliegos = numeroONull(trazPaso?.outputsCanonicos?.pliegos_impresos);
  const gramaje = numeroONull(atributos?.gramaje) ?? numeroONull(atributos?.gramajeGr);
  const letraItem = String.fromCharCode(65 + (item.ordenIndice % 26));
  return {
    pasoId: frontera.id,
    itemId: item.id,
    ordenId: orden.id,
    codigo: `${orden.numero} · ${letraItem}`,
    cliente: orden.cliente?.nombre ?? 'Sin cliente',
    producto: item.nombre,
    fechaEntrega: orden.fechaEntrega ? orden.fechaEntrega.toISOString().slice(0, 10) : null,
    estado: frontera.estado as 'pendiente' | 'en_curso',
    iniciadoEl: frontera.iniciadoEl ? frontera.iniciadoEl.toISOString() : null,
    duracionEstimadaMin:
      frontera.duracionEstimadaMin != null ? Number(frontera.duracionEstimadaMin) : null,
    centroCostoId: frontera.centroCostoId,
    centroCostoNombre: frontera.centroCostoNombre,
    configPasoId,
    maquinaId: typeof maquinaSeleccionada === 'string' ? maquinaSeleccionada : null,
    maquinaNombre: null as string | null, // se resuelve con el catálogo
    papel: sustrato
      ? {
          nombre: sustrato.materiaPrimaNombre ?? 'Papel sin identificar',
          gramaje,
        }
      : null,
    pliego:
      pliegoAnchoMm !== null && pliegoAltoMm !== null
        ? { preset: null as string | null, anchoMm: pliegoAnchoMm, altoMm: pliegoAltoMm }
        : (null as { preset: string | null; anchoMm: number | null; altoMm: number | null } | null),
    hojas: pliegos,
    clics: pliegos !== null ? pliegos * (caras ?? 1) : null,
    caras,
    modoColor,
    acabados,
  };
}

function buildSimuladorJob(
  orden: {
    id: string;
    numero: string;
    fechaEntrega: Date | null;
    cliente: { nombre: string } | null;
  },
  item: {
    id: string;
    codigo: string;
    nombre: string;
    ordenIndice: number;
    cotizacionItem: {
      jobContextJson: Prisma.JsonValue;
      trazabilidadJson: Prisma.JsonValue;
    } | null;
  },
  frontera: {
    id: string;
    rutaPasoId: string | null;
    duracionEstimadaMin: Prisma.Decimal | null;
  },
) {
  const jobContext =
    (item.cotizacionItem?.jobContextJson as Record<string, unknown> | null) ?? null;
  const pasosTraza = (
    item.cotizacionItem?.trazabilidadJson as { pasos?: TrazabilidadPasoSimulador[] } | null
  )?.pasos;
  const trazPaso =
    (Array.isArray(pasosTraza)
      ? pasosTraza.find((paso) => paso.rutaPasoId && paso.rutaPasoId === frontera.rutaPasoId)
      : null) ?? null;

  // Sustrato: la línea MATERIAL del paso (las tintas son CONSUMIBLE_MAQUINA).
  const sustrato =
    trazPaso?.materiales?.find((mat) => mat.tipoLineaCosto === 'MATERIAL') ?? null;

  // Tecnología elegida al cotizar: la del paso, o la global del job.
  const tecnologiaPaso = frontera.rutaPasoId
    ? jobContext?.[`tecnologia_${frontera.rutaPasoId}`]
    : null;
  const tecnologia =
    (typeof tecnologiaPaso === 'string' && tecnologiaPaso) ||
    (typeof jobContext?.tecnologia === 'string' && jobContext.tecnologia) ||
    null;

  const letraItem = String.fromCharCode(65 + (item.ordenIndice % 26));
  return {
    pasoId: frontera.id,
    itemId: item.id,
    ordenId: orden.id,
    codigo: `${orden.numero} · ${letraItem}`,
    cliente: orden.cliente?.nombre ?? 'Sin cliente',
    producto: item.nombre,
    fechaEntrega: orden.fechaEntrega ? orden.fechaEntrega.toISOString().slice(0, 10) : null,
    tecnologia,
    materiaPrimaId: null as string | null, // se resuelve abajo con la variante
    materiaPrimaNombre: sustrato?.materiaPrimaNombre ?? null,
    varianteCotizada: sustrato?.materialVarianteId
      ? {
          id: sustrato.materialVarianteId,
          sku: sustrato.materialSku ?? '',
          anchoMm: numeroONull(sustrato.atributosVarianteJson?.anchoMm),
          precioMl: numeroONull(sustrato.precioUnitario),
        }
      : null,
    consumoCotizadoMm: numeroONull(trazPaso?.nestingResult?.consumedLengthMm),
    piezas: piezasDeSnapshot(trazPaso, jobContext),
    // Prellenar "¿cuánto duró la tanda?" (registro-tiempos D11).
    duracionEstimadaMin:
      frontera.duracionEstimadaMin != null
        ? Number(frontera.duracionEstimadaMin)
        : null,
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

/** Include de la proyección completa de una estación. */
const ESTACION_INCLUDE = {
  // Fase D: la regla "por familia" vive en EstacionRegla (tipo='familia'), junto
  // con tecnología/paso. Ya no se lee EstacionFamilia (legacy, sólo respaldo).
  reglas: { select: { tipo: true, valor: true } },
  empleados: {
    include: {
      empleado: { select: { id: true, nombreCompleto: true, sector: true } },
    },
  },
  maquinas: {
    // centroCostoPrincipalId es el vínculo real paso→máquina: la
    // trazabilidad del paso guarda centroCostoId, no maquinaId.
    select: {
      id: true,
      codigo: true,
      nombre: true,
      centroCostoPrincipalId: true,
    },
    orderBy: { codigo: 'asc' as const },
  },
} satisfies Prisma.EstacionInclude;

type EstacionConRelaciones = Prisma.EstacionGetPayload<{
  include: typeof ESTACION_INCLUDE;
}>;

@Injectable()
export class ProduccionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Estaciones ───────────────────────────────────────────────────────
  // La estación agrupa familias de pasos (ruteo del tablero), máquinas y
  // empleados habilitados. Ver docs/estaciones-diseno.md

  async findEstaciones(tenantId: string) {
    const rows = await this.prisma.estacion.findMany({
      where: { tenantId: tenantId },
      include: ESTACION_INCLUDE,
      orderBy: [{ nombre: 'asc' }],
    });
    return rows.map((item) => this.toEstacion(item));
  }

  /**
   * Catálogo de familias de pasos (fuente de verdad: el catálogo del motor)
   * + qué estación tiene tomada cada una, para el picker del panel.
   */
  async findFamiliasPasos(auth: CurrentAuth) {
    // Fase D: las reglas "por familia" viven en EstacionRegla (tipo='familia').
    const asignadas = await this.prisma.estacionRegla.findMany({
      where: { tenantId: auth.tenantId, tipo: 'familia' },
      include: {
        estacion: {
          select: {
            id: true,
            nombre: true,
            maquinas: { select: { id: true }, take: 1 },
          },
        },
      },
      orderBy: { estacion: { nombre: 'asc' } },
    });
    const porFamilia = new Map<
      string,
      Array<{ id: string; nombre: string; conMaquinas: boolean }>
    >();
    for (const fila of asignadas) {
      const lista = porFamilia.get(fila.valor) ?? [];
      lista.push({
        id: fila.estacion.id,
        nombre: fila.estacion.nombre,
        conMaquinas: fila.estacion.maquinas.length > 0,
      });
      porFamilia.set(fila.valor, lista);
    }
    // Catálogo del sistema + familias del TENANT (pasos componibles, Etapa
    // C): las dos tienen que poder asignarse a una estación, así que el
    // picker lista ambas. Las tenant inhabilitadas no se ofrecen.
    const familiasTenant = await this.prisma.familiaTenant.findMany({
      where: { tenantId: auth.tenantId, activo: true },
      select: { id: true, nombre: true, categoria: true },
      orderBy: { nombre: 'asc' },
    });
    return [
      ...Object.values(FAMILIAS).map((familia) => ({
        codigo: familia.codigo as string,
        nombre: familia.nombre,
        categoria: familia.categoria as string,
        visibleEnSelector: familia.visibleEnSelector !== false,
        origen: 'sistema' as const,
        estaciones: porFamilia.get(familia.codigo) ?? [],
      })),
      ...familiasTenant.map((familia) => ({
        codigo: familia.id,
        nombre: familia.nombre,
        categoria: familia.categoria,
        visibleEnSelector: true,
        origen: 'tenant' as const,
        estaciones: porFamilia.get(familia.id) ?? [],
      })),
    ];
  }

  /**
   * Mediana histórica de duración REAL por familia de pasos (fallback de
   * `duracionEstimadaMin` para la cola del tablero, D6 del doc de capacidad):
   * `tiempoRealMin` de los pasos `hecho` del tenant, SOLO fuentes medidas
   * (D14 de registro-tiempos: 'estimado' acá cerraría el círculo
   * estimado→"real"→estimado, y 'declarado' es percepción, no medición).
   * Mediana y no promedio: resiste el outlier.
   */
  async findDuracionesFamilias(tenantId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{ familiaCodigo: string; medianaMin: number; muestras: number }>
    >`
      SELECT "familiaCodigo",
             percentile_cont(0.5) WITHIN GROUP (
               ORDER BY "tiempoRealMin"
             ) AS "medianaMin",
             COUNT(*)::int AS "muestras"
      FROM "OrdenTrabajoItemPaso"
      WHERE "tenantId" = ${tenantId}::uuid
        AND "estado" = 'hecho'
        AND "tiempoRealMin" IS NOT NULL
        AND "tiempoFuente" IN ('medido', 'medido_lote')
      GROUP BY "familiaCodigo"
      HAVING COUNT(*) >= ${MIN_MUESTRAS_MEDIANA}
      ORDER BY "familiaCodigo" ASC
    `;
    return rows.map((row) => ({
      familiaCodigo: row.familiaCodigo,
      medianaMin: Math.round(Number(row.medianaMin) * 10) / 10,
      muestras: Number(row.muestras),
    }));
  }

  // ── Simulador de impresión (cola real por área) ──────────────────────
  // Pasos de familia impresion_por_area en FRONTERA de órdenes vivas, con
  // sus piezas físicas (nestingResult del snapshot), el sustrato cotizado
  // y el catálogo de anchos/stock de cada materia prima involucrada.
  // Ver docs/simulador-impresion-diseno.md

  async simulador(auth: CurrentAuth) {
    const ordenes = await this.prisma.ordenTrabajo.findMany({
      where: { tenantId: auth.tenantId, estado: { in: ['pendiente', 'produccion'] } },
      select: {
        id: true,
        numero: true,
        fechaEntrega: true,
        cliente: { select: { nombre: true } },
        items: {
          orderBy: { ordenIndice: 'asc' },
          select: {
            id: true,
            codigo: true,
            nombre: true,
            ordenIndice: true,
            cotizacionItem: {
              select: { jobContextJson: true, trazabilidadJson: true },
            },
            pasos: {
              orderBy: { indice: 'asc' },
              select: {
                id: true,
                indice: true,
                familiaCodigo: true,
                estado: true,
                tipoEjecucion: true,
                rutaPasoId: true,
                duracionEstimadaMin: true,
              },
            },
          },
        },
      },
    });

    const jobs: Array<ReturnType<typeof buildSimuladorJob>> = [];
    for (const orden of ordenes) {
      for (const item of orden.items) {
        // Frontera de la secuencia: el primer paso no hecho del item.
        // [Tanda A] Entra a esta cola si su familia declara impresión sobre
        // material continuo — antes preguntaba por familiaCodigo.
        const frontera = item.pasos.find((paso) => paso.estado !== 'hecho');
        if (
          !frontera ||
          colaConsolidacionDeFamilia(frontera.familiaCodigo) !== 'gran_formato'
        )
          continue;
        // Bloqueado no es imprimible ni completable: el tablero lo señala.
        if (frontera.estado === 'bloqueado') continue;
        // El tercerizado lo imprime el proveedor: vive en Compras, no en el taller.
        if (frontera.tipoEjecucion === 'tercerizado') continue;
        jobs.push(buildSimuladorJob(orden, item, frontera));
      }
    }

    // La trazabilidad guarda la VARIANTE pero no la materia prima: se
    // resuelve acá para poder agrupar y traer los anchos hermanos.
    const varianteIds = [
      ...new Set(
        jobs
          .map((job) => job.varianteCotizada?.id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
    const variantes = varianteIds.length
      ? await this.prisma.materiaPrimaVariante.findMany({
          where: { tenantId: auth.tenantId, id: { in: varianteIds } },
          select: { id: true, materiaPrimaId: true },
        })
      : [];
    const materiaPrimaPorVariante = new Map(
      variantes.map((variante) => [variante.id, variante.materiaPrimaId]),
    );
    for (const job of jobs) {
      job.materiaPrimaId = job.varianteCotizada?.id
        ? (materiaPrimaPorVariante.get(job.varianteCotizada.id) ?? null)
        : null;
    }

    // Catálogo de anchos por materia prima involucrada (variantes + stock).
    const materiaPrimaIds = [
      ...new Set(jobs.map((job) => job.materiaPrimaId).filter((id): id is string => id !== null)),
    ];
    const materiasPrimas = materiaPrimaIds.length
      ? await this.prisma.materiaPrima.findMany({
          where: { tenantId: auth.tenantId, id: { in: materiaPrimaIds } },
          select: {
            id: true,
            nombre: true,
            variantes: {
              where: { activo: true },
              select: {
                id: true,
                sku: true,
                atributosVarianteJson: true,
                precioReferencia: true,
                stocks: { select: { cantidadDisponible: true } },
              },
            },
          },
        })
      : [];

    const materiales = materiasPrimas.map((materiaPrima) => ({
      materiaPrimaId: materiaPrima.id,
      nombre: materiaPrima.nombre,
      anchos: materiaPrima.variantes
        .map((variante) => {
          const atributos = variante.atributosVarianteJson as { anchoMm?: unknown } | null;
          const anchoMm = typeof atributos?.anchoMm === 'number' ? atributos.anchoMm : null;
          if (anchoMm === null || anchoMm <= 0) return null;
          const stockMl = variante.stocks.reduce(
            (acc, stock) => acc + Number(stock.cantidadDisponible),
            0,
          );
          return {
            varianteId: variante.id,
            sku: variante.sku,
            anchoMm,
            precioMl: variante.precioReferencia != null ? Number(variante.precioReferencia) : null,
            stockMl: variante.stocks.length > 0 ? stockMl : null,
          };
        })
        .filter((ancho): ancho is NonNullable<typeof ancho> => ancho !== null)
        .sort((a, b) => a.anchoMm - b.anchoMm),
    }));

    return { jobs, materiales };
  }

  /**
   * Re-acomoda cada tanda del simulador con el MOTOR real (mismo nesting que
   * usó la cotización) para cada ancho de rollo candidato.
   *
   * Existe para que el simulador no tenga packer propio: cuando lo tenía, sus
   * márgenes y separaciones no eran los del motor, le entraban menos piezas
   * por fila que al cotizar y el "ahorro vs. cotizado" salía negativo.
   */
  async simuladorNesting(auth: CurrentAuth, dto: SimularNestingDto) {
    const pasoIds = [...new Set(dto.grupos.flatMap((grupo) => grupo.pasoIds))];
    const pasos = await this.prisma.ordenTrabajoItemPaso.findMany({
      where: { tenantId: auth.tenantId, id: { in: pasoIds } },
      select: {
        id: true,
        rutaPasoId: true,
        item: {
          select: {
            cotizacionItem: { select: { jobContextJson: true, trazabilidadJson: true } },
          },
        },
      },
    });
    if (pasos.length === 0) throw new NotFoundException('No se encontraron los pasos.');
    const porId = new Map(pasos.map((paso) => [paso.id, paso]));

    return {
      grupos: dto.grupos.map((grupo) => ({
        key: grupo.key,
        ...acomodarTanda(
          grupo.pasoIds
            .map((id) => porId.get(id))
            .filter((paso): paso is (typeof pasos)[number] => paso !== undefined),
          grupo.anchosMm,
        ),
      })),
    };
  }

  // ── Simulador de impresión LÁSER (cola real por hoja) ────────────────
  // Pasos impresion_por_hoja en FRONTERA de órdenes vivas: el operador de
  // láser carga la bandeja una vez por batch (papel+pliego+color+caras) y
  // manda todo junto. Datos del snapshot, no recalculados (D6).
  // Ver docs/simulador-laser-diseno.md

  async simuladorLaser(auth: CurrentAuth) {
    const ordenes = await this.prisma.ordenTrabajo.findMany({
      where: { tenantId: auth.tenantId, estado: { in: ['pendiente', 'produccion'] } },
      select: {
        id: true,
        numero: true,
        fechaEntrega: true,
        cliente: { select: { nombre: true } },
        items: {
          orderBy: { ordenIndice: 'asc' },
          select: {
            id: true,
            nombre: true,
            ordenIndice: true,
            cotizacionItem: {
              select: { jobContextJson: true, trazabilidadJson: true },
            },
            pasos: {
              orderBy: { indice: 'asc' },
              select: {
                id: true,
                indice: true,
                nombre: true,
                familiaCodigo: true,
                estado: true,
                tipoEjecucion: true,
                rutaPasoId: true,
                centroCostoId: true,
                centroCostoNombre: true,
                duracionEstimadaMin: true,
                iniciadoEl: true,
              },
            },
          },
        },
      },
    });

    const jobs: Array<ReturnType<typeof buildLaserJob>> = [];
    for (const orden of ordenes) {
      for (const item of orden.items) {
        // [Tanda A] Ídem gran formato: impresión sobre pliego declarada.
        const frontera = item.pasos.find((paso) => paso.estado !== 'hecho');
        if (
          !frontera ||
          colaConsolidacionDeFamilia(frontera.familiaCodigo) !== 'laser'
        )
          continue;
        if (frontera.estado === 'bloqueado') continue;
        // El tercerizado lo imprime el proveedor: vive en Compras, no en el taller.
        if (frontera.tipoEjecucion === 'tercerizado') continue;
        jobs.push(buildLaserJob(orden, item, frontera));
      }
    }

    // Pliego de impresión y máquina default desde la CONFIG del paso
    // (cotizaciones viejas no traen los outputs canónicos de pliego, y la
    // máquina del jobContext puede faltar → maquinaM1Id de la config).
    const configIds = [
      ...new Set(jobs.map((job) => job.configPasoId).filter((id): id is string => id !== null)),
    ];
    const configs = configIds.length
      ? await this.prisma.productoConfigPaso.findMany({
          where: { tenantId: auth.tenantId, id: { in: configIds } },
          select: { id: true, paramsPasoJson: true, maquinaM1Id: true },
        })
      : [];
    const configPorId = new Map(configs.map((config) => [config.id, config]));
    for (const job of jobs) {
      const config = job.configPasoId ? configPorId.get(job.configPasoId) : undefined;
      if (!config) continue;
      if (job.pliego === null) {
        const nesting = (config.paramsPasoJson as {
          nestingConfig?: { pliegoImpresion?: { preset?: unknown; anchoMm?: unknown; altoMm?: unknown } };
        } | null)?.nestingConfig?.pliegoImpresion;
        if (nesting) {
          job.pliego = {
            preset: typeof nesting.preset === 'string' ? nesting.preset : null,
            anchoMm: numeroONull(nesting.anchoMm),
            altoMm: numeroONull(nesting.altoMm),
          };
        }
      }
      if (job.maquinaId === null && config.maquinaM1Id) {
        job.maquinaId = config.maquinaM1Id;
      }
    }

    // Nombres de las máquinas asignadas.
    const maquinaIds = [
      ...new Set(jobs.map((job) => job.maquinaId).filter((id): id is string => id !== null)),
    ];
    const maquinas = maquinaIds.length
      ? await this.prisma.maquina.findMany({
          where: { tenantId: auth.tenantId, id: { in: maquinaIds } },
          select: { id: true, nombre: true },
        })
      : [];
    const maquinaPorId = new Map(maquinas.map((maquina) => [maquina.id, maquina.nombre]));
    for (const job of jobs) {
      job.maquinaNombre = job.maquinaId ? (maquinaPorId.get(job.maquinaId) ?? null) : null;
    }

    return { jobs };
  }

  // ── Configuración de producción (margen de la ETA sugerida) ──────────

  async getConfiguracion(tenantId: string) {
    const row = await this.prisma.configuracionProduccion.findUnique({
      where: { tenantId: tenantId },
    });
    return {
      margenEtaDias: row?.margenEtaDias ?? 0,
      tiempoEntrePasosMin: row?.tiempoEntrePasosMin ?? 0,
      corteJornada: row?.corteJornada ?? '20:00',
    };
  }

  async actualizarConfiguracion(
    auth: CurrentAuth,
    payload: ActualizarConfiguracionProduccionDto,
  ) {
    const row = await this.prisma.configuracionProduccion.upsert({
      where: { tenantId: auth.tenantId },
      create: {
        tenantId: auth.tenantId,
        margenEtaDias: payload.margenEtaDias,
        tiempoEntrePasosMin: payload.tiempoEntrePasosMin ?? 0,
        ...(payload.corteJornada ? { corteJornada: payload.corteJornada } : {}),
      },
      update: {
        margenEtaDias: payload.margenEtaDias,
        ...(payload.tiempoEntrePasosMin !== undefined
          ? { tiempoEntrePasosMin: payload.tiempoEntrePasosMin }
          : {}),
        ...(payload.corteJornada ? { corteJornada: payload.corteJornada } : {}),
      },
    });
    return {
      margenEtaDias: row.margenEtaDias,
      corteJornada: row.corteJornada,
      tiempoEntrePasosMin: row.tiempoEntrePasosMin,
    };
  }

  // ── Días no laborables (feriados y cierres del taller) ───────────────
  // Fechas puntuales a nivel tenant que la proyección de cola y la
  // simulación de flujo saltan. Ver docs/capacidad-estaciones-diseno.md D8.

  async findDiasNoLaborables(tenantId: string) {
    const rows = await this.prisma.diaNoLaborable.findMany({
      where: { tenantId: tenantId },
      orderBy: { fecha: 'asc' },
    });
    return rows.map((row) => this.toDiaNoLaborable(row));
  }

  async crearDiaNoLaborable(auth: CurrentAuth, payload: CrearDiaNoLaborableDto) {
    // El DTO valida el formato; acá el calendario real (30/02 → inválida).
    const fecha = new Date(`${payload.fecha}T00:00:00.000Z`);
    if (
      Number.isNaN(fecha.getTime()) ||
      fecha.toISOString().slice(0, 10) !== payload.fecha
    ) {
      throw new BadRequestException(`"${payload.fecha}" no es una fecha real.`);
    }
    try {
      const creado = await this.prisma.diaNoLaborable.create({
        data: {
          tenantId: auth.tenantId,
          fecha,
          descripcion: payload.descripcion?.trim() || null,
        },
      });
      return this.toDiaNoLaborable(creado);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Esa fecha ya está cargada como no laborable.');
      }
      throw error;
    }
  }

  async eliminarDiaNoLaborable(auth: CurrentAuth, id: string) {
    const existing = await this.prisma.diaNoLaborable.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Día no laborable no encontrado.');
    }
    await this.prisma.diaNoLaborable.delete({ where: { id } });
    return { ok: true };
  }

  private toDiaNoLaborable(row: {
    id: string;
    fecha: Date;
    descripcion: string | null;
  }) {
    return {
      id: row.id,
      fecha: row.fecha.toISOString().slice(0, 10),
      descripcion: row.descripcion ?? '',
    };
  }

  /**
   * Valida el payload contra el catálogo y el tenant, y devuelve las
   * referencias saneadas. La unicidad familia→estación se valida acá con
   * mensaje útil (la dueña); el constraint de DB es la red de seguridad.
   */
  private async validarReferencias(
    auth: CurrentAuth,
    payload: UpsertEstacionDto,
    exceptoEstacionId?: string,
  ) {
    const familias = [...new Set(payload.familias ?? [])];
    const empleadoIds = [...new Set(payload.empleadoIds ?? [])];
    const maquinaIds = [...new Set(payload.maquinaIds ?? [])];
    // Reglas nuevas (tecnología / paso), dedup por tipo+valor.
    const reglas = [
      ...new Map(
        (payload.reglas ?? []).map((r) => [`${r.tipo}::${r.valor}`, r]),
      ).values(),
    ];

    const invalidas = familias.filter((codigo) => !resolverFamilia(codigo));
    if (invalidas.length > 0) {
      throw new BadRequestException(
        `Familias de pasos desconocidas: ${invalidas.join(', ')}.`,
      );
    }

    // Una familia puede repetirse entre estaciones CON máquinas (filtran por
    // máquina y son disjuntas), pero a lo sumo hay UNA estación general (sin
    // máquinas) por familia: dos generales serían ruteo ambiguo (D1 del doc).
    const payloadEsGeneral = maquinaIds.length === 0;
    if (familias.length > 0 && payloadEsGeneral) {
      // Fase D: las reglas "por familia" viven en EstacionRegla (tipo='familia').
      const tomadas = await this.prisma.estacionRegla.findMany({
        where: {
          tenantId: auth.tenantId,
          tipo: 'familia',
          valor: { in: familias },
          ...(exceptoEstacionId
            ? { estacionId: { not: exceptoEstacionId } }
            : {}),
        },
        include: {
          estacion: {
            select: { nombre: true, maquinas: { select: { id: true }, take: 1 } },
          },
        },
      });
      const generales = tomadas.filter(
        (fila) => fila.estacion.maquinas.length === 0,
      );
      if (generales.length > 0) {
        const detalle = generales
          .map(
            (fila) =>
              `${resolverFamilia(fila.valor)?.nombre ?? fila.valor} (en "${fila.estacion.nombre}")`,
          )
          .join(' · ');
        throw new ConflictException(
          `Sólo puede haber una estación general (sin máquinas) por familia. Ya asignadas a otra estación general: ${detalle}. Asigná máquinas a esta estación para repartir la familia por máquina.`,
        );
      }
    }

    // Una tecnología / paso concreto lo captura A LO SUMO UNA estación: si dos
    // lo reclamaran, el ruteo por ese nivel sería ambiguo (docs/estaciones-
    // reglas-diseno.md §5). Mensaje con la dueña; el front ya lo deshabilita,
    // esto es la red de seguridad del backend.
    if (reglas.length > 0) {
      const enConflicto = await this.prisma.estacionRegla.findMany({
        where: {
          tenantId: auth.tenantId,
          OR: reglas.map((r) => ({ tipo: r.tipo, valor: r.valor })),
          ...(exceptoEstacionId
            ? { estacionId: { not: exceptoEstacionId } }
            : {}),
        },
        include: { estacion: { select: { nombre: true } } },
      });
      if (enConflicto.length > 0) {
        const detalle = enConflicto
          .map((fila) => `${fila.tipo} "${fila.valor}" (en "${fila.estacion.nombre}")`)
          .join(' · ');
        throw new ConflictException(
          `Estas reglas ya las captura otra estación: ${detalle}. Cada tecnología o paso concreto vive en una sola estación.`,
        );
      }
    }

    if (empleadoIds.length > 0) {
      const encontrados = await this.prisma.empleado.count({
        where: { tenantId: auth.tenantId, id: { in: empleadoIds } },
      });
      if (encontrados !== empleadoIds.length) {
        throw new NotFoundException('Algún empleado referenciado no existe.');
      }
    }
    if (maquinaIds.length > 0) {
      const encontradas = await this.prisma.maquina.count({
        where: { tenantId: auth.tenantId, id: { in: maquinaIds } },
      });
      if (encontradas !== maquinaIds.length) {
        throw new NotFoundException('Alguna máquina referenciada no existe.');
      }
    }

    return { familias, empleadoIds, maquinaIds, reglas };
  }

  /**
   * Sincroniza las tres listas de la estación (reemplazo completo). Las
   * máquinas se MUEVEN: asignar acá una máquina que estaba en otra estación
   * le pisa el estacionId (una máquina vive en un solo lugar).
   */
  private async sincronizarListas(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    estacionId: string,
    listas: {
      familias: string[];
      empleadoIds: string[];
      maquinaIds: string[];
      reglas: Array<{ tipo: string; valor: string }>;
    },
  ) {
    // Fase D: todo el ruteo declarado (familia + tecnología + paso) vive en
    // EstacionRegla; se reemplaza entero. Ya no se escribe EstacionFamilia.
    await tx.estacionRegla.deleteMany({
      where: { tenantId: auth.tenantId, estacionId },
    });
    const reglasAEscribir = [
      ...listas.familias.map((valor) => ({ tipo: 'familia', valor })),
      ...listas.reglas.map((regla) => ({ tipo: regla.tipo, valor: regla.valor })),
    ];
    if (reglasAEscribir.length > 0) {
      await tx.estacionRegla.createMany({
        data: reglasAEscribir.map((regla) => ({
          tenantId: auth.tenantId,
          estacionId,
          tipo: regla.tipo,
          valor: regla.valor,
        })),
      });
    }

    await tx.estacionEmpleado.deleteMany({
      where: { tenantId: auth.tenantId, estacionId },
    });
    if (listas.empleadoIds.length > 0) {
      await tx.estacionEmpleado.createMany({
        data: listas.empleadoIds.map((empleadoId) => ({
          tenantId: auth.tenantId,
          estacionId,
          empleadoId,
        })),
      });
    }

    // Desasigna las que salieron de la estación, asigna (o mueve) las nuevas.
    await tx.maquina.updateMany({
      where: {
        tenantId: auth.tenantId,
        estacionId,
        id: { notIn: listas.maquinaIds },
      },
      data: { estacionId: null },
    });
    if (listas.maquinaIds.length > 0) {
      await tx.maquina.updateMany({
        where: { tenantId: auth.tenantId, id: { in: listas.maquinaIds } },
        data: { estacionId },
      });
    }
  }

  async createEstacion(auth: CurrentAuth, payload: UpsertEstacionDto) {
    const listas = await this.validarReferencias(auth, payload);
    try {
      const creada = await this.prisma.$transaction(async (tx) => {
        const estacion = await tx.estacion.create({
          data: {
            tenantId: auth.tenantId,
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            activo: payload.activo ?? true,
            etapa: payload.etapa ?? 'preprensa',
            icono: payload.icono?.trim() || null,
            capacidadConcurrente: payload.capacidadConcurrente ?? 1,
            tiempoPreparacionMin: payload.tiempoPreparacionMin ?? null,
            calendarioJson: calendarioAJson(parseCalendario(payload.calendario)),
          },
        });
        await this.sincronizarListas(tx, auth, estacion.id, listas);
        return estacion;
      });
      return this.findEstacion(auth, creada.id);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Ya existe una estación con ese nombre.');
      }
      throw error;
    }
  }

  async updateEstacion(
    auth: CurrentAuth,
    id: string,
    payload: UpsertEstacionDto,
  ) {
    const existing = await this.prisma.estacion.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Estación no encontrada.');
    }
    const listas = await this.validarReferencias(auth, payload, id);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.estacion.update({
          where: { id },
          data: {
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            activo: payload.activo,
            etapa: payload.etapa ?? existing.etapa,
            icono: payload.icono?.trim() || null,
            capacidadConcurrente:
              payload.capacidadConcurrente ?? existing.capacidadConcurrente,
            tiempoPreparacionMin:
              payload.tiempoPreparacionMin !== undefined
                ? payload.tiempoPreparacionMin
                : existing.tiempoPreparacionMin,
            // undefined = no tocar; null explícito = borrar el calendario.
            calendarioJson:
              payload.calendario === undefined
                ? undefined
                : calendarioAJson(parseCalendario(payload.calendario)),
          },
        });
        await this.sincronizarListas(tx, auth, id, listas);
      });
      return this.findEstacion(auth, id);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Ya existe una estación con ese nombre.');
      }
      throw error;
    }
  }

  async toggleEstacion(auth: CurrentAuth, id: string) {
    const existing = await this.prisma.estacion.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Estación no encontrada.');
    }
    await this.prisma.estacion.update({
      where: { id },
      data: { activo: !existing.activo },
    });
    return this.findEstacion(auth, id);
  }

  /**
   * Borrado real: libera familias y empleados (cascade) y desasigna las
   * máquinas (SetNull). El trabajo vivo del tablero cae a "Sin estación".
   */
  async deleteEstacion(auth: CurrentAuth, id: string) {
    const existing = await this.prisma.estacion.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { id: true, nombre: true },
    });
    if (!existing) {
      throw new NotFoundException('Estación no encontrada.');
    }
    await this.prisma.estacion.delete({ where: { id } });
    return { ok: true };
  }

  private async findEstacion(auth: CurrentAuth, id: string) {
    const row = await this.prisma.estacion.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: ESTACION_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Estación no encontrada.');
    }
    return this.toEstacion(row);
  }

  private toEstacion(item: EstacionConRelaciones) {
    return {
      id: item.id,
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      activo: item.activo,
      etapa: item.etapa,
      icono: item.icono,
      capacidadConcurrente: item.capacidadConcurrente,
      tiempoPreparacionMin: item.tiempoPreparacionMin,
      // Normaliza el shape legado (una franja suelta por día) al de listas.
      calendario: normalizarCalendarioAlmacenado(item.calendarioJson),
      // Fase D: familia y tecnología/paso salen de EstacionRegla. El shape de la
      // API no cambia (el front sigue viendo `familias` y `reglas` separadas).
      familias: item.reglas
        .filter((r) => r.tipo === 'familia')
        .map((r) => r.valor),
      reglas: item.reglas
        .filter((r) => r.tipo !== 'familia')
        .map((r) => ({ tipo: r.tipo, valor: r.valor })),
      empleados: item.empleados.map((fila) => ({
        id: fila.empleado.id,
        nombreCompleto: fila.empleado.nombreCompleto,
        sector: fila.empleado.sector,
      })),
      maquinas: item.maquinas.map((maquina) => ({
        id: maquina.id,
        codigo: maquina.codigo,
        nombre: maquina.nombre,
        centroCostoId: maquina.centroCostoPrincipalId,
      })),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
