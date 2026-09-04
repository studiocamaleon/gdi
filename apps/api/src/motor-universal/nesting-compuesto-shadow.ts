import { createHash } from 'node:crypto';
import { nestGrid2DMulti } from '../productos-servicios/nesting/algorithms/grid-2d-multi';
import type { EvaluateGranFormatoMixedShelfLayoutInput } from '../productos-servicios/nesting/algorithms/shelf-rollo';
import {
  chargedBoundsAlongPlateLongAxis,
  resolvePlateAxes,
} from '../productos-servicios/nesting/helpers/plate-axis';
import {
  applyCostingStrategy,
  type CostingResult,
  type CostingStrategyKind,
} from '../productos-servicios/nesting/costing';
import { evaluateRollLayoutForConfiguredAlgorithm } from './nesting-dispatcher';
import {
  crearProblemaNestingIrregular,
  resolverProblemaNestingIrregular,
  type DemandaNesting,
  type ProblemaNesting,
  type SolucionNesting,
} from './geometria-vectorial/contrato-nesting';
import type {
  AnalisisNestingCompuestoShadow,
  ComponenteFabricadoCosteado,
  LoteNestingCompuestoSnapshot,
  MaterialEjecutado,
  NestingCostingPreview,
  NestingEjecutado,
  PoliticaNestingCompuesto,
  PasoEjecutado,
} from './tipos';

type Exclusion = AnalisisNestingCompuestoShadow['exclusiones'][number];

type OpcionRollo = NonNullable<
  MaterialEjecutado['opcionesNestingRollo']
>[number];

type CandidatoBase = {
  componente: ComponenteFabricadoCosteado;
  paso: PasoEjecutado;
  nesting: NestingEjecutado;
  material: MaterialEjecutado;
  firma: string;
  areaPiezasMm2: number;
};

type CandidatoPliego = CandidatoBase & {
  superficie: 'sheet';
  geometria: 'rectangular' | 'irregular';
  sustrato: {
    kind: 'sheet';
    widthMm: number;
    heightMm: number;
    margins: {
      leftMm: number;
      rightMm: number;
      topMm: number;
      bottomMm: number;
    };
  };
  separationHMm: number;
  separationVMm: number;
  allowRotation: boolean;
  sustratosIndependientes: number;
  configuracionIrregular?: ProblemaNesting['configuracion'];
};

type CandidatoRollo = CandidatoBase & {
  superficie: 'roll';
  sustrato: {
    kind: 'roll';
    widthMm: number;
    margins: {
      leftMm: number;
      rightMm: number;
      startMm: number;
      endMm: number;
    };
  };
  separationHMm: number;
  separationVMm: number;
  allowRotation: boolean;
  largoIndependienteMm: number;
  opcionesRollo: OpcionRollo[];
  algorithmPolicy: 'auto' | 'shelf-rollo' | 'maxrects-rollo';
  panelizado: EvaluateGranFormatoMixedShelfLayoutInput['panelizado'];
};

type Candidato = CandidatoPliego | CandidatoRollo;

type ResultadoConsolidado = {
  superficie: 'sheet' | 'roll';
  algorithm:
    | 'grid-2d-multi'
    | 'shelf-rollo'
    | 'maxrects-rollo'
    | 'irregular-2d-bottom-left-v1';
  substrates: NestingEjecutado['substrates'];
  placements: NestingEjecutado['placements'];
  metrics: {
    aprovechamientoPct: number;
    areaUtilMm2: number;
    areaTotalMm2: number;
  };
  consumedLengthMm?: number;
  opcionRollo?: OpcionRollo;
  panelizado?: NonNullable<NestingEjecutado['visualConfig']>['panelizado'];
  demandaNesting?: DemandaNesting[];
  solucionNesting?: SolucionNesting;
};

type AplicacionGrupo = {
  aplicacion: NonNullable<
    AnalisisNestingCompuestoShadow['grupos'][number]['aplicacion']
  >;
  lote?: LoteNestingCompuestoSnapshot;
};

function esRegistro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function redondear(value: number, decimales = 2) {
  const factor = 10 ** decimales;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function demandasDeNesting(nesting: NestingEjecutado): DemandaNesting[] {
  return nesting.demandaNesting ?? [];
}

function cantidadDemandada(nesting: NestingEjecutado): number {
  const genericas = demandasDeNesting(nesting);
  if (genericas.length > 0) {
    return genericas.reduce(
      (total, demanda) => total + Math.ceil(demanda.cantidad),
      0,
    );
  }
  return (nesting.demandaRectangular ?? []).reduce(
    (total, demanda) => total + Math.ceil(demanda.cantidad),
    0,
  );
}

function idsDemandados(nesting: NestingEjecutado): string[] {
  const genericas = demandasDeNesting(nesting);
  return genericas.length > 0
    ? genericas.map((demanda) => demanda.id)
    : (nesting.demandaRectangular ?? []).map((demanda) => demanda.pieceId);
}

function areaDemandaMm2(demanda: DemandaNesting): number {
  return demanda.geometria.tipo === 'POLIGONO'
    ? demanda.geometria.areaMm2 * Math.ceil(demanda.cantidad)
    : demanda.geometria.anchoMm *
        demanda.geometria.altoMm *
        Math.ceil(demanda.cantidad);
}

function areaContornosMeta(meta: unknown): number | null {
  if (!esRegistro(meta) || !Array.isArray(meta.contornos)) return null;
  let total = 0;
  for (const value of meta.contornos) {
    if (!esRegistro(value) || !Array.isArray(value.puntos)) return null;
    const puntos = value.puntos.filter(
      (punto): punto is { x: number; y: number } =>
        esRegistro(punto) &&
        Number.isFinite(punto.x) &&
        Number.isFinite(punto.y),
    );
    if (puntos.length !== value.puntos.length || puntos.length < 3) return null;
    const area = Math.abs(
      puntos.reduce((sum, punto, index) => {
        const siguiente = puntos[(index + 1) % puntos.length];
        return sum + punto.x * siguiente.y - siguiente.x * punto.y;
      }, 0) / 2,
    );
    total += value.esHueco === true ? -area : area;
  }
  return Math.max(0, total);
}

function areaPlacementMm2(
  placement: NestingEjecutado['placements'][number],
): number {
  return (
    areaContornosMeta(placement.meta) ?? placement.widthMm * placement.heightMm
  );
}

/**
 * Proyecta el MISMO desglose que acaba de devolver la estrategia de costeo al
 * overlay del visor. No vuelve a decidir escalones ni largos: usa
 * `breakdown.units`, que es el resultado económico autoritativo.
 */
function previewCosteoConsolidado(args: {
  costeo: CostingResult;
  substrates: Array<{
    kind: 'sheet';
    count: number;
    widthMm: number;
    heightMm: number;
  }>;
  placements: NestingEjecutado['placements'];
}): NestingCostingPreview | undefined {
  const { costeo, substrates, placements } = args;
  const labelPorEstrategia: Record<CostingStrategyKind, string> = {
    simple: 'sustratos completos',
    'm2-exact': 'm² exactos de piezas',
    'consumed-length': 'largo consumido del sustrato',
    'plate-segments': 'segmentos de placa',
  };
  if (costeo.strategy === 'simple') return undefined;

  const areaPiezasTotal = placements.reduce(
    (total, placement) => total + areaPlacementMm2(placement),
    0,
  );
  if (costeo.strategy === 'm2-exact') {
    return {
      strategy: costeo.strategy,
      label: labelPorEstrategia[costeo.strategy],
      chargedAreaMm2: areaPiezasTotal,
      wasteAreaMm2: 0,
    };
  }

  const perSubstrate = costeo.breakdown.units.flatMap((unit) => {
    const substrate = substrates[unit.index];
    if (!substrate) return [];
    const ratio =
      costeo.strategy === 'plate-segments'
        ? (unit.segmentApplied ?? 100) / 100
        : unit.occupationPct / 100;
    const chargedLengthMm = resolvePlateAxes(substrate).longSideMm * ratio;
    const chargedAreaMm2 = substrate.widthMm * substrate.heightMm * ratio;
    const placedAreaMm2 = placements
      .filter((placement) => (placement.substrateIndex ?? 0) === unit.index)
      .reduce((total, placement) => total + areaPlacementMm2(placement), 0);
    return [
      {
        index: unit.index,
        chargedRatio: ratio,
        chargedLengthMm,
        chargedAreaMm2,
        chargedBounds: chargedBoundsAlongPlateLongAxis(
          substrate,
          chargedLengthMm,
        ),
        wasteAreaMm2: Math.max(0, chargedAreaMm2 - placedAreaMm2),
        segmentAppliedPct: unit.segmentApplied,
      },
    ];
  });
  const last = perSubstrate[perSubstrate.length - 1];
  return {
    strategy: costeo.strategy,
    label: labelPorEstrategia[costeo.strategy],
    chargedRatio: last?.chargedRatio,
    chargedLengthMm: last?.chargedLengthMm,
    chargedAreaMm2: perSubstrate.reduce(
      (total, item) => total + (item.chargedAreaMm2 ?? 0),
      0,
    ),
    chargedBounds: last?.chargedBounds,
    wasteAreaMm2: perSubstrate.reduce(
      (total, item) => total + (item.wasteAreaMm2 ?? 0),
      0,
    ),
    segmentAppliedPct: last?.segmentAppliedPct,
    perSubstrate,
  };
}

function esEstrategiaCosteo(value: string): value is CostingStrategyKind {
  return ['simple', 'm2-exact', 'consumed-length', 'plate-segments'].includes(
    value,
  );
}

function asignarMonto(total: number, pesos: number[], decimales = 6) {
  const suma = pesos.reduce((acc, peso) => acc + Math.max(0, peso), 0);
  if (pesos.length === 0) return [];
  if (suma <= 0) {
    return asignarMonto(
      total,
      pesos.map(() => 1),
      decimales,
    );
  }
  const asignaciones: number[] = [];
  let acumulado = 0;
  for (let index = 0; index < pesos.length; index++) {
    const valor =
      index === pesos.length - 1
        ? redondear(total - acumulado, decimales)
        : redondear((total * Math.max(0, pesos[index])) / suma, decimales);
    asignaciones.push(valor);
    acumulado = redondear(acumulado + valor, decimales);
  }
  return asignaciones;
}

function costoPreparacion(candidato: Candidato) {
  const tiempo = candidato.paso.tiempo;
  if (!tiempo) return 0;
  const tarifa = Math.max(0, Number(tiempo.tarifaHora ?? 0));
  return ((tiempo.setupMin + tiempo.cleanupMin) / 60) * tarifa;
}

export function leerPoliticaNestingCompuesto(
  atributosComercialesJson: unknown,
): PoliticaNestingCompuesto {
  if (!esRegistro(atributosComercialesJson)) return 'INDEPENDIENTE';
  const config = atributosComercialesJson.nestingCompuesto;
  if (!esRegistro(config) || config.version !== 1) return 'INDEPENDIENTE';
  return config.politica === 'CONSOLIDAR_COMPATIBLES'
    ? 'CONSOLIDAR_COMPATIBLES'
    : 'INDEPENDIENTE';
}

export function leerExclusionNestingComponente(configuracionJson: unknown): {
  excluido: boolean;
  motivo: string | null;
} {
  if (!esRegistro(configuracionJson)) return { excluido: false, motivo: null };
  const config = configuracionJson.nestingCompuesto;
  if (!esRegistro(config) || config.version !== 1 || config.excluido !== true) {
    return { excluido: false, motivo: null };
  }
  return {
    excluido: true,
    motivo:
      typeof config.motivo === 'string' && config.motivo.trim()
        ? config.motivo.trim()
        : null,
  };
}

function materialDelNesting(
  paso: PasoEjecutado,
  nesting: NestingEjecutado,
): MaterialEjecutado | null {
  const materiales = (paso.materiales ?? []).filter(
    (material) => material.tipoLineaCosto === 'MATERIAL',
  );
  const variantePreferida =
    nesting.pliegoImpresionSeleccionado?.materiaPrima?.varianteId ??
    nesting.sustrato?.materialVarianteId ??
    null;
  if (variantePreferida) {
    const exacto = materiales.find(
      (material) => material.materialVarianteId === variantePreferida,
    );
    if (exacto) return exacto;
  }
  const costeadosPorNesting = materiales.filter(
    (material) => material.detalleCosteoNesting != null,
  );
  return costeadosPorNesting.length === 1 ? costeadosPorNesting[0] : null;
}

function candidatoDesdePaso(args: {
  tenantId: string;
  productoPadreId: string;
  recetaRevisionId: string;
  componente: ComponenteFabricadoCosteado;
  paso: PasoEjecutado;
}): { candidato?: Candidato; exclusion?: Exclusion } {
  const { componente, paso } = args;
  const nesting = paso.nestingResult;
  const baseExclusion = {
    componenteCodigo: componente.codigo,
    pasoClave: paso.configPasoId,
  };
  const esPliego =
    nesting?.unidad === 'pliegos' &&
    ['grid-2d-single', 'grid-2d-multi'].includes(nesting.algorithm) &&
    !nesting.talonarioGrouping;
  const esIrregular =
    nesting?.unidad === 'pliegos' &&
    nesting.algorithm === 'irregular-2d-bottom-left-v1';
  const esRollo =
    nesting?.unidad === 'm_lineales' &&
    ['shelf-rollo', 'maxrects-rollo'].includes(nesting.algorithm);
  if (!nesting || (!esPliego && !esRollo && !esIrregular)) {
    return {
      exclusion: {
        ...baseExclusion,
        codigo: 'SIN_NESTING_RECTANGULAR',
        motivo:
          'El paso no produce un nesting compatible sobre pliego o rollo.',
      },
    };
  }
  const demanda = nesting.demandaRectangular ?? [];
  const demandaGenerica = demandasDeNesting(nesting);
  const visual = nesting.visualConfig;
  const tieneDemanda = esIrregular
    ? demandaGenerica.length > 0 && nesting.solucionNesting != null
    : demanda.length > 0;
  if (!visual || !tieneDemanda || !nesting.maquina?.id) {
    return {
      exclusion: {
        ...baseExclusion,
        codigo: 'CONFIGURACION_INCOMPLETA',
        motivo:
          'Falta demanda, máquina o configuración geométrica para firmar el lote con seguridad.',
      },
    };
  }
  const material = materialDelNesting(paso, nesting);
  if (!material) {
    return {
      exclusion: {
        ...baseExclusion,
        codigo: 'SIN_MATERIAL_TRAZABLE',
        motivo:
          'No se pudo identificar una única variante costeada por el nesting.',
      },
    };
  }
  if (esIrregular && nesting.estrategiaDisposicion === 'composicion_original') {
    return {
      exclusion: {
        ...baseExclusion,
        codigo: 'CONFIGURACION_INCOMPLETA',
        motivo:
          'La composición vectorial debe conservar su disposición original y no puede mezclarse con otras piezas.',
      },
    };
  }
  if (!esIrregular && nesting.layoutVinculadoGeometriaVectorial) {
    return {
      exclusion: {
        ...baseExclusion,
        codigo: 'CONFIGURACION_INCOMPLETA',
        motivo:
          'El layout de impresión alimenta un corte vectorial y sólo puede consolidarse si ambos pasos comparten exactamente la misma solución.',
      },
    };
  }

  const areaPiezasMm2 = esIrregular
    ? demandaGenerica.reduce((total, pieza) => total + areaDemandaMm2(pieza), 0)
    : demanda.reduce(
        (total, pieza) =>
          total + pieza.anchoMm * pieza.altoMm * Math.ceil(pieza.cantidad),
        0,
      );

  if (esRollo) {
    const rolls = nesting.substrates.filter(
      (substrate): substrate is Extract<typeof substrate, { kind: 'roll' }> =>
        substrate.kind === 'roll',
    );
    const roll = rolls[0];
    const unidad = material.unidad.toLowerCase();
    const unidadRollo: OpcionRollo['unidad'] | null =
      unidad === 'm2'
        ? 'm2'
        : ['m_lineal', 'm_lineales', 'metro_lineal'].includes(unidad)
          ? 'm_lineales'
          : null;
    if (
      !roll ||
      rolls.length !== 1 ||
      nesting.substrates.length !== 1 ||
      !unidadRollo ||
      visual.panelizado?.mode === 'manual'
    ) {
      return {
        exclusion: {
          ...baseExclusion,
          codigo: 'CONFIGURACION_INCOMPLETA',
          motivo:
            visual.panelizado?.mode === 'manual'
              ? 'El panelizado manual mantiene su layout individual y no se consolida automáticamente.'
              : 'El rollo no tiene una única geometría o unidad lineal/área costeable.',
        },
      };
    }

    const opcionFija: OpcionRollo = {
      materialVarianteId: material.materialVarianteId,
      materialSku: material.materialSku,
      materialDisplayName: material.materialDisplayName,
      materiaPrimaId: material.materiaPrimaId ?? null,
      materiaPrimaNombre: material.materiaPrimaNombre ?? null,
      materiaPrimaTemplateId: material.materiaPrimaTemplateId ?? null,
      materiaPrimaTipoTecnico: material.materiaPrimaTipoTecnico ?? null,
      atributosVarianteJson: material.atributosVarianteJson ?? null,
      anchoMm: roll.widthMm,
      unidad: unidadRollo,
      precioUnitario: material.precioUnitario,
    };
    const opcionesRollo =
      material.modoSeleccion === 'MOTOR_ELIGE_AUTO' &&
      (material.opcionesNestingRollo?.length ?? 0) > 0
        ? material.opcionesNestingRollo!
        : [opcionFija];
    const algorithmPolicy = ['auto', 'shelf-rollo', 'maxrects-rollo'].includes(
      nesting.algorithmPolicy ?? '',
    )
      ? (nesting.algorithmPolicy as 'auto' | 'shelf-rollo' | 'maxrects-rollo')
      : (nesting.algorithm as 'shelf-rollo' | 'maxrects-rollo');
    const familiasMaterial = [
      ...new Set(
        opcionesRollo.map(
          (opcion) =>
            opcion.materiaPrimaId ??
            opcion.materiaPrimaTemplateId ??
            opcion.materialVarianteId,
        ),
      ),
    ].sort();
    const firmaBase = {
      version: 2,
      tenantId: args.tenantId,
      productoPadreId: args.productoPadreId,
      recetaRevisionId: args.recetaRevisionId,
      superficie: 'roll',
      familiasMaterial,
      politicaEjecucion: componente.politicaEjecucion,
      familiaCodigo: paso.familiaCodigo,
      algoritmo: algorithmPolicy,
      maquinaId: nesting.maquina.id,
      perfilId: nesting.perfil?.id ?? null,
      modoColor: nesting.modoColor ?? null,
      tecnologia: nesting.tecnologia ?? null,
      carasProcesadas: nesting.carasProcesadas ?? 1,
      tintasAdicionales: [...(nesting.tintasAdicionales ?? [])].sort(),
      margenes: {
        leftMm: visual.usableArea.xMm,
        rightMm:
          roll.widthMm - visual.usableArea.xMm - visual.usableArea.widthMm,
        startMm: visual.usableArea.yMm,
        endMm:
          roll.lengthMm - visual.usableArea.yMm - visual.usableArea.heightMm,
      },
      separacion: visual.spacing,
      demasiaMm: visual.pieceBleedMm ?? 0,
      allowRotation: visual.allowRotation,
      panelizado: visual.panelizado
        ? {
            enabled: visual.panelizado.enabled,
            mode: visual.panelizado.mode,
            axis: visual.panelizado.axis,
            overlapMm: visual.panelizado.overlapMm,
            maxPanelWidthMm: visual.panelizado.maxPanelWidthMm,
            distribution: visual.panelizado.distribution,
            widthInterpretation: visual.panelizado.widthInterpretation,
          }
        : null,
      mermaOperativaPct: redondear(
        Math.max(0, Number(material.mermaAdicional?.porcentaje ?? 0)),
        6,
      ),
      setupMin: paso.tiempo?.setupMin ?? 0,
      cleanupMin: paso.tiempo?.cleanupMin ?? 0,
      tarifaHora: paso.tiempo?.tarifaHora ?? 0,
    };
    const firma = createHash('sha256')
      .update(JSON.stringify(firmaBase))
      .digest('hex');
    const panel = visual.panelizado;
    return {
      candidato: {
        componente,
        paso,
        nesting,
        material,
        firma,
        superficie: 'roll',
        sustrato: {
          kind: 'roll',
          widthMm: roll.widthMm,
          margins: firmaBase.margenes,
        },
        separationHMm: visual.spacing.horizontalMm,
        separationVMm: visual.spacing.verticalMm,
        allowRotation: visual.allowRotation,
        largoIndependienteMm: roll.lengthMm,
        areaPiezasMm2,
        opcionesRollo,
        algorithmPolicy,
        panelizado:
          panel?.enabled && panel.maxPanelWidthMm && panel.overlapMm != null
            ? {
                activo: true,
                mode: 'automatico',
                axis: panel.axis ?? 'automatic',
                overlapMm: panel.overlapMm,
                maxPanelWidthMm: panel.maxPanelWidthMm,
                distribution: panel.distribution ?? 'equilibrada',
                widthInterpretation: panel.widthInterpretation ?? 'total',
              }
            : undefined,
      },
    };
  }

  const sheets = nesting.substrates.filter(
    (substrate): substrate is Extract<typeof substrate, { kind: 'sheet' }> =>
      substrate.kind === 'sheet',
  );
  const primero = sheets[0];
  if (
    !primero ||
    sheets.length !== nesting.substrates.length ||
    sheets.some(
      (sheet) =>
        sheet.widthMm !== primero.widthMm ||
        sheet.heightMm !== primero.heightMm,
    )
  ) {
    return {
      exclusion: {
        ...baseExclusion,
        codigo: 'CONFIGURACION_INCOMPLETA',
        motivo: 'El pliego no tiene un formato rectangular único.',
      },
    };
  }
  const sustratosIndependientes = sheets.reduce(
    (total, sheet) => total + Math.max(1, Math.ceil(sheet.count)),
    0,
  );
  const firmaBase = {
    version: esIrregular ? 2 : 1,
    tenantId: args.tenantId,
    productoPadreId: args.productoPadreId,
    recetaRevisionId: args.recetaRevisionId,
    materialVarianteId: material.materialVarianteId,
    materialUnidad: material.unidad,
    materialPrecioUnitario: material.precioUnitario,
    formato: { anchoMm: primero.widthMm, altoMm: primero.heightMm },
    politicaEjecucion: componente.politicaEjecucion,
    familiaCodigo: paso.familiaCodigo,
    algoritmo: esIrregular
      ? `irregular:${nesting.solucionNesting?.versionAlgoritmo ?? 1}`
      : nesting.algorithm,
    maquinaId: nesting.maquina.id,
    perfilId: nesting.perfil?.id ?? null,
    modoColor: nesting.modoColor ?? null,
    tecnologia: nesting.tecnologia ?? null,
    carasProcesadas: nesting.carasProcesadas ?? 1,
    tintasAdicionales: [...(nesting.tintasAdicionales ?? [])].sort(),
    margenes: visual.margins,
    separacion: visual.spacing,
    demasiaMm: visual.pieceBleedMm ?? 0,
    allowRotation: visual.allowRotation,
    configuracionIrregular: esIrregular
      ? nesting.solucionNesting?.problema.configuracion
      : null,
    estrategiaCosto: material.estrategiaCosto,
    costingSegmentSteps: nesting.costingSegmentSteps ?? [],
    mermaOperativaPct: redondear(
      Math.max(0, Number(material.mermaAdicional?.porcentaje ?? 0)),
      6,
    ),
    setupMin: paso.tiempo?.setupMin ?? 0,
    cleanupMin: paso.tiempo?.cleanupMin ?? 0,
    tarifaHora: paso.tiempo?.tarifaHora ?? 0,
  };
  const firma = createHash('sha256')
    .update(JSON.stringify(firmaBase))
    .digest('hex');

  return {
    candidato: {
      componente,
      paso,
      nesting,
      material,
      firma,
      superficie: 'sheet',
      geometria: esIrregular ? 'irregular' : 'rectangular',
      sustrato: {
        kind: 'sheet',
        widthMm: primero.widthMm,
        heightMm: primero.heightMm,
        margins: { ...visual.margins },
      },
      separationHMm: visual.spacing.horizontalMm,
      separationVMm: visual.spacing.verticalMm,
      allowRotation: visual.allowRotation,
      sustratosIndependientes,
      areaPiezasMm2,
      configuracionIrregular: esIrregular
        ? nesting.solucionNesting?.problema.configuracion
        : undefined,
    },
  };
}

async function consolidarParticipantes(
  participantes: Candidato[],
  resolverNestingIrregular?: (
    problema: ProblemaNesting,
  ) => Promise<SolucionNesting>,
): Promise<ResultadoConsolidado | null> {
  const base = participantes[0];
  if (
    !base ||
    participantes.some((item) => item.superficie !== base.superficie)
  ) {
    return null;
  }
  if (base.superficie === 'sheet') {
    const participantesPliego = participantes as CandidatoPliego[];
    if (
      participantesPliego.some(
        (participante) => participante.geometria !== base.geometria,
      )
    ) {
      return null;
    }
    if (base.geometria === 'irregular') {
      const demandas = participantesPliego.flatMap((participante) =>
        demandasDeNesting(participante.nesting).map((demanda) => ({
          ...demanda,
          id: `${participante.componente.codigo}:${participante.paso.configPasoId}:${demanda.id}`,
          propietario: {
            ...demanda.propietario,
            productoId: participante.componente.productoId,
            componenteCodigo: participante.componente.codigo,
            ocurrenciaId: participante.componente.ocurrenciaId,
            pasoClave: participante.paso.configPasoId,
          },
        })),
      );
      const configuracion = base.configuracionIrregular;
      if (!configuracion || demandas.length === 0) return null;
      try {
        const problema = crearProblemaNestingIrregular({
          demandas,
          anchoPlacaMm: base.sustrato.widthMm,
          altoPlacaMm: base.sustrato.heightMm,
          margenMm: Math.max(
            base.sustrato.margins.leftMm,
            base.sustrato.margins.rightMm,
            base.sustrato.margins.topMm,
            base.sustrato.margins.bottomMm,
          ),
          separacionMm: Math.max(base.separationHMm, base.separationVMm),
          permitirRotacion: base.allowRotation,
          permitirSegmentacion: configuracion.permitirSegmentacion,
          configuracionEncastres: configuracion.configuracionEncastres,
        });
        const solucion = resolverNestingIrregular
          ? await resolverNestingIrregular(problema)
          : resolverProblemaNestingIrregular(problema);
        const porId = new Map(
          demandas.map((demanda) => [demanda.id, demanda] as const),
        );
        const placements: NestingEjecutado['placements'] =
          solucion.resultado.placements.map((placement) => {
            const demanda = porId.get(
              placement.segmentacion?.piezaOrigenId ?? placement.pieceId,
            );
            return {
              pieceId: placement.pieceId,
              substrateIndex: placement.substrateIndex,
              xMm: placement.xMm,
              yMm: placement.yMm,
              widthMm: placement.anchoMm,
              heightMm: placement.altoMm,
              rotated: placement.rotacion !== 0,
              meta: {
                contornos: placement.contornos,
                cortesInternos: placement.cortesInternos,
                rotacionGrados: placement.rotacion,
                segmentacion: placement.segmentacion,
                demandaId: demanda?.id,
                propietario: demanda?.propietario,
                componenteCodigo: demanda?.propietario?.componenteCodigo,
                productoId: demanda?.propietario?.productoId,
                pasoClave: demanda?.propietario?.pasoClave,
                piezaOrigenId:
                  placement.segmentacion?.piezaOrigenId ?? placement.pieceId,
                copiaIndex: placement.copyIndex,
                label: demanda?.id ?? placement.pieceId,
              },
            };
          });
        const esperadas = demandas.reduce(
          (total, demanda) => total + Math.ceil(demanda.cantidad),
          0,
        );
        if (
          solucion.resultado.piezasOriginales !== esperadas ||
          placements.length === 0
        ) {
          return null;
        }
        return {
          superficie: 'sheet',
          algorithm: solucion.resultado.algorithm,
          substrates: Array.from({ length: solucion.resultado.placas }, () => ({
            kind: 'sheet' as const,
            count: 1,
            widthMm: solucion.resultado.anchoPlacaMm,
            heightMm: solucion.resultado.altoPlacaMm,
          })),
          placements,
          metrics: {
            aprovechamientoPct: solucion.resultado.aprovechamientoPct,
            areaUtilMm2: solucion.resultado.areaPiezasMm2,
            areaTotalMm2: solucion.resultado.areaCompradaMm2,
          },
          demandaNesting: demandas,
          solucionNesting: solucion,
        };
      } catch {
        return null;
      }
    }
    const piezas = participantesPliego.flatMap((participante) =>
      (participante.nesting.demandaRectangular ?? []).map((pieza, index) => ({
        id: `${participante.componente.codigo}:${participante.paso.configPasoId}:${pieza.pieceId}:${index}`,
        widthMm: pieza.anchoMm,
        heightMm: pieza.altoMm,
        quantity: Math.ceil(pieza.cantidad),
        meta: {
          componenteCodigo: participante.componente.codigo,
          productoId: participante.componente.productoId,
          pasoClave: participante.paso.configPasoId,
          piezaOrigenId: pieza.pieceId,
        },
      })),
    );
    const result = nestGrid2DMulti(piezas, base.sustrato, {
      separationHMm: base.separationHMm,
      separationVMm: base.separationVMm,
      allowRotation: base.allowRotation,
    });
    const esperadas = piezas.reduce(
      (total, pieza) => total + pieza.quantity,
      0,
    );
    if (
      result.placements.length !== esperadas ||
      result.substrates.length === 0
    ) {
      return null;
    }
    return {
      superficie: 'sheet',
      algorithm: 'grid-2d-multi',
      substrates: result.substrates,
      placements: result.placements,
      metrics: result.metrics,
    };
  }

  const participantesRollo = participantes as CandidatoRollo[];
  const demandas = participantesRollo.flatMap((participante) =>
    (participante.nesting.demandaRectangular ?? []).map((pieza) => ({
      participante,
      pieza,
    })),
  );
  const cantidadEsperada = demandas.reduce(
    (total, demanda) => total + Math.ceil(demanda.pieza.cantidad),
    0,
  );
  const opcionesComunes = participantesRollo[0].opcionesRollo.filter((opcion) =>
    participantesRollo.every((participante) =>
      participante.opcionesRollo.some(
        (otra) =>
          otra.materialVarianteId === opcion.materialVarianteId &&
          otra.anchoMm === opcion.anchoMm &&
          otra.unidad === opcion.unidad &&
          Math.abs(otra.precioUnitario - opcion.precioUnitario) < 0.000001,
      ),
    ),
  );
  const alternativas = opcionesComunes.flatMap((opcion) => {
    const printableWidthMm =
      opcion.anchoMm -
      base.sustrato.margins.leftMm -
      base.sustrato.margins.rightMm;
    if (printableWidthMm <= 0) return [];
    const evaluado = evaluateRollLayoutForConfiguredAlgorithm(
      {
        printableWidthMm,
        marginLeftMm: base.sustrato.margins.leftMm,
        marginStartMm: base.sustrato.margins.startMm,
        marginEndMm: base.sustrato.margins.endMm,
        separacionHorizontalMm: base.separationHMm,
        separacionVerticalMm: base.separationVMm,
        permitirRotacion: base.allowRotation,
        medidas: demandas.map(({ pieza }) => ({
          cantidad: Math.ceil(pieza.cantidad),
          anchoMm: pieza.anchoMm,
          altoMm: pieza.altoMm,
        })),
        panelizado: base.panelizado,
      },
      base.algorithmPolicy,
    );
    if (!evaluado) return [];
    const origenes = new Set(
      evaluado.result.placements
        .map((placement) => placement.sourcePieceId)
        .filter((pieceId): pieceId is string => Boolean(pieceId)),
    );
    if (origenes.size !== cantidadEsperada) return [];
    const placements: NestingEjecutado['placements'] =
      evaluado.result.placements.flatMap((placement) => {
        const match = placement.sourcePieceId?.match(/^piece-(\d+)-(\d+)$/);
        const demandaIndex = match ? Number(match[1]) : -1;
        const copiaIndex = match ? Number(match[2]) : -1;
        const demanda = demandas[demandaIndex];
        if (!demanda || copiaIndex < 0) return [];
        const idBase = `${demanda.participante.componente.codigo}:${demanda.participante.paso.configPasoId}:${demanda.pieza.pieceId}:${copiaIndex}`;
        return [
          {
            pieceId:
              placement.panelIndex != null
                ? `${idBase}:panel-${placement.panelIndex}`
                : idBase,
            substrateIndex: 0,
            xMm: placement.centerXMm - placement.widthMm / 2,
            yMm: placement.centerYMm - placement.heightMm / 2,
            widthMm: placement.widthMm,
            heightMm: placement.heightMm,
            rotated: placement.rotated,
            panelIndex: placement.panelIndex ?? undefined,
            panelCount: placement.panelCount ?? undefined,
            panelAxis: placement.panelAxis ?? undefined,
            usefulWidthMm: placement.usefulWidthMm,
            usefulHeightMm: placement.usefulHeightMm,
            overlapStartMm: placement.overlapStartMm,
            overlapEndMm: placement.overlapEndMm,
            meta: {
              componenteCodigo: demanda.participante.componente.codigo,
              productoId: demanda.participante.componente.productoId,
              pasoClave: demanda.participante.paso.configPasoId,
              piezaOrigenId: demanda.pieza.pieceId,
              copiaIndex,
              label: placement.label,
            },
          },
        ];
      });
    if (placements.length !== evaluado.result.placements.length) return [];
    const consumedLengthMm = evaluado.result.consumedLengthMm;
    const areaTotalMm2 = opcion.anchoMm * consumedLengthMm;
    const areaUtilMm2 = participantesRollo.reduce(
      (total, participante) => total + participante.areaPiezasMm2,
      0,
    );
    const cantidadCosteable =
      opcion.unidad === 'm2'
        ? areaTotalMm2 / 1_000_000
        : consumedLengthMm / 1000;
    return [
      {
        resultado: {
          superficie: 'roll' as const,
          algorithm: evaluado.algorithm,
          substrates: [
            {
              kind: 'roll' as const,
              lengthMm: consumedLengthMm,
              widthMm: opcion.anchoMm,
            },
          ],
          placements,
          metrics: {
            aprovechamientoPct:
              areaTotalMm2 > 0
                ? redondear((areaUtilMm2 / areaTotalMm2) * 100)
                : 0,
            areaUtilMm2,
            areaTotalMm2,
          },
          consumedLengthMm,
          opcionRollo: opcion,
          panelizado: {
            enabled: evaluado.result.panelizado,
            mode:
              evaluado.result.panelMode === 'manual' ? 'manual' : 'automatic',
            axis: evaluado.result.panelAxis,
            overlapMm: evaluado.result.panelOverlapMm,
            maxPanelWidthMm: evaluado.result.panelMaxWidthMm,
            distribution: evaluado.result.panelDistribution,
            widthInterpretation: evaluado.result.panelWidthInterpretation,
            panelCount: evaluado.result.panelCount,
          },
        } satisfies ResultadoConsolidado,
        costoBase: cantidadCosteable * opcion.precioUnitario,
      },
    ];
  });
  return (
    alternativas.sort(
      (a, b) =>
        a.costoBase - b.costoBase ||
        a.resultado.metrics.areaTotalMm2 - b.resultado.metrics.areaTotalMm2 ||
        (a.resultado.consumedLengthMm ?? 0) -
          (b.resultado.consumedLengthMm ?? 0) ||
        (a.resultado.opcionRollo?.anchoMm ?? 0) -
          (b.resultado.opcionRollo?.anchoMm ?? 0),
    )[0]?.resultado ?? null
  );
}

function aplicarGrupoConsolidado(args: {
  id: string;
  firma: string;
  participantes: Candidato[];
  consolidado: ResultadoConsolidado;
}): AplicacionGrupo {
  const costoMaterialIndependiente = redondear(
    args.participantes.reduce(
      (total, participante) => total + participante.material.costoTotal,
      0,
    ),
    6,
  );
  const costoPreparacionIndependiente = redondear(
    args.participantes.reduce(
      (total, participante) => total + costoPreparacion(participante),
      0,
    ),
    6,
  );
  const noAplicado = (
    motivoNoAplicado: string,
    comparacion?: {
      costoMaterialConsolidado: number;
      costoPreparacionConsolidado: number;
    },
  ): AplicacionGrupo => ({
    aplicacion: {
      aplicado: false,
      motivoNoAplicado,
      costoMaterialIndependiente,
      costoMaterialConsolidado:
        comparacion?.costoMaterialConsolidado ?? costoMaterialIndependiente,
      costoPreparacionIndependiente,
      costoPreparacionConsolidado:
        comparacion?.costoPreparacionConsolidado ??
        costoPreparacionIndependiente,
      ahorroCostoTotal: comparacion
        ? redondear(
            costoMaterialIndependiente +
              costoPreparacionIndependiente -
              comparacion.costoMaterialConsolidado -
              comparacion.costoPreparacionConsolidado,
            6,
          )
        : 0,
    },
  });

  if (
    args.participantes.some(
      (participante) =>
        participante.componente.politicaEjecucion !== 'INDEPENDIENTE',
    )
  ) {
    return noAplicado(
      'La consolidación operativa requiere componentes con ejecución independiente; se conserva el cálculo individual.',
    );
  }

  const piezasTotales = args.participantes.reduce(
    (total, participante) => total + cantidadDemandada(participante.nesting),
    0,
  );
  let costeoConsolidado: CostingResult;
  if (args.consolidado.superficie === 'roll') {
    const opcion = args.consolidado.opcionRollo;
    const largoMm = args.consolidado.consumedLengthMm ?? 0;
    if (!opcion || !(largoMm > 0)) {
      return noAplicado(
        'No existe un ancho de rollo materialmente compatible entre todos los componentes.',
      );
    }
    const cantidad =
      opcion.unidad === 'm2'
        ? (opcion.anchoMm * largoMm) / 1_000_000
        : largoMm / 1000;
    const costo = redondear(cantidad * opcion.precioUnitario, 6);
    const pricePerM2 =
      opcion.unidad === 'm2'
        ? opcion.precioUnitario
        : opcion.precioUnitario / (opcion.anchoMm / 1000);
    costeoConsolidado = {
      strategy: 'consumed-length',
      totalCost: costo,
      breakdown: {
        unitPrice: opcion.precioUnitario,
        pricePerM2: redondear(pricePerM2, 6),
        fullUnits: 0,
        fullUnitsCost: 0,
        lastUnit: {
          occupationPct: 100,
          segmentApplied: null,
          cost: costo,
        },
        units: [
          {
            index: 0,
            occupationPct: 100,
            segmentApplied: null,
            cost: costo,
          },
        ],
      },
    };
  } else {
    const detalles = args.participantes.map(
      (participante) => participante.material.detalleCosteoNesting,
    );
    if (detalles.some((detalle) => !detalle)) {
      return noAplicado(
        'El consumo no está costeado directamente por el nesting; se conserva el cálculo independiente.',
      );
    }
    const estrategia = detalles[0]!.strategy;
    if (
      !esEstrategiaCosteo(estrategia) ||
      detalles.some(
        (detalle) =>
          detalle!.strategy !== estrategia ||
          detalle!.unitPrice !== detalles[0]!.unitPrice,
      )
    ) {
      return noAplicado(
        'La estrategia o el precio efectivo del sustrato no coincide entre componentes.',
      );
    }
    try {
      costeoConsolidado = applyCostingStrategy({
        strategy: estrategia,
        nesting: {
          algorithm: args.consolidado.algorithm,
          substrates: args.consolidado.substrates,
          placements: args.consolidado.placements,
          metrics: args.consolidado.metrics,
        },
        unitPrice: detalles[0]!.unitPrice,
        totalPieces: piezasTotales,
        unitsNeeded: args.consolidado.substrates.length,
        segmentSteps: args.participantes[0].nesting.costingSegmentSteps,
      });
    } catch {
      return noAplicado(
        'No se pudo reproducir de forma segura el costeo sobre el nesting consolidado.',
      );
    }
  }

  const costoMaterialConsolidadoBase = redondear(
    costeoConsolidado.totalCost,
    6,
  );
  const mermaOperativaPct = Math.max(
    0,
    Number(args.participantes[0].material.mermaAdicional?.porcentaje ?? 0),
  );
  const factorMermaOperativa = 1 + mermaOperativaPct / 100;
  const costoMaterialConsolidado = redondear(
    costoMaterialConsolidadoBase * factorMermaOperativa,
    6,
  );
  const setupCompartido = Math.max(
    ...args.participantes.map(
      (participante) => participante.paso.tiempo?.setupMin ?? 0,
    ),
  );
  const cleanupCompartido = Math.max(
    ...args.participantes.map(
      (participante) => participante.paso.tiempo?.cleanupMin ?? 0,
    ),
  );
  const tarifaHora = Math.max(
    0,
    Number(args.participantes[0].paso.tiempo?.tarifaHora ?? 0),
  );
  const costoPreparacionConsolidado = redondear(
    ((setupCompartido + cleanupCompartido) / 60) * tarifaHora,
    6,
  );
  const empeoraConsumo =
    args.consolidado.superficie === 'roll'
      ? args.consolidado.metrics.areaTotalMm2 >
        (args.participantes as CandidatoRollo[]).reduce(
          (total, participante) =>
            total +
            participante.sustrato.widthMm * participante.largoIndependienteMm,
          0,
        )
      : args.consolidado.substrates.length >
        (args.participantes as CandidatoPliego[]).reduce(
          (total, participante) => total + participante.sustratosIndependientes,
          0,
        );
  const costoTotalIndependiente =
    costoMaterialIndependiente + costoPreparacionIndependiente;
  const costoTotalConsolidado =
    costoMaterialConsolidado + costoPreparacionConsolidado;
  if (
    empeoraConsumo ||
    costoTotalConsolidado > costoTotalIndependiente + 0.000001
  ) {
    return noAplicado(
      'La alternativa consolidada empeora el consumo o el costo; se conserva el cálculo independiente.',
      { costoMaterialConsolidado, costoPreparacionConsolidado },
    );
  }
  const pesos = args.participantes.map(
    (participante) => participante.areaPiezasMm2,
  );
  const areasTotal = pesos.reduce((total, area) => total + area, 0);
  const materialAsignado = asignarMonto(costoMaterialConsolidado, pesos, 6);
  const preparacionAsignada = asignarMonto(
    costoPreparacionConsolidado,
    pesos,
    6,
  );
  const setupAsignado = asignarMonto(setupCompartido, pesos, 6);
  const cleanupAsignado = asignarMonto(cleanupCompartido, pesos, 6);
  const participantesLote: LoteNestingCompuestoSnapshot['participantes'] = [];

  args.participantes.forEach((participante, index) => {
    const componente = participante.componente;
    const paso = participante.paso;
    const material = participante.material;
    const costoComponenteAnterior = componente.costoTotal;
    const costoMaterialAnterior = material.costoTotal;
    const costoPreparacionAnterior = costoPreparacion(participante);
    const porcentajeAsignacion = redondear(
      areasTotal > 0 ? (participante.areaPiezasMm2 / areasTotal) * 100 : 0,
      6,
    );

    if (
      args.consolidado.superficie === 'roll' &&
      args.consolidado.opcionRollo
    ) {
      const opcion = args.consolidado.opcionRollo;
      material.materialVarianteId = opcion.materialVarianteId;
      material.materialNombre = opcion.materialSku;
      material.materialSku = opcion.materialSku;
      material.materialDisplayName = opcion.materialDisplayName;
      material.materiaPrimaId = opcion.materiaPrimaId;
      material.materiaPrimaNombre = opcion.materiaPrimaNombre;
      material.materiaPrimaTemplateId = opcion.materiaPrimaTemplateId;
      material.materiaPrimaTipoTecnico = opcion.materiaPrimaTipoTecnico;
      material.atributosVarianteJson = opcion.atributosVarianteJson;
      material.unidad = opcion.unidad;
      material.precioUnitario = opcion.precioUnitario;
      material.estrategiaCosto = 'consumed-length';
      participante.nesting.sustrato = {
        materialVarianteId: opcion.materialVarianteId,
        nombre: opcion.materialDisplayName,
      };
    }

    material.costoTotal = materialAsignado[index];
    material.cantidad =
      material.precioUnitario > 0
        ? redondear(material.costoTotal / material.precioUnitario, 8)
        : material.cantidad;
    material.mermaAdicional =
      mermaOperativaPct > 0
        ? {
            porcentaje: mermaOperativaPct,
            cantidadTrabajo: redondear(
              material.cantidad / factorMermaOperativa,
              8,
            ),
            cantidadMerma: redondear(
              material.cantidad - material.cantidad / factorMermaOperativa,
              8,
            ),
          }
        : undefined;
    material.asignacionNestingCompuesto = {
      loteId: args.id,
      costoIndependiente: costoMaterialAnterior,
      costoAsignado: material.costoTotal,
      porcentajeAsignacion,
    };

    let diferenciaPreparacion = 0;
    if (paso.tiempo) {
      const preparacionMinAnterior =
        paso.tiempo.setupMin + paso.tiempo.cleanupMin;
      paso.tiempo.setupMin = setupAsignado[index];
      paso.tiempo.cleanupMin = cleanupAsignado[index];
      paso.tiempo.totalMin = redondear(
        Math.max(
          0,
          paso.tiempo.totalMin -
            preparacionMinAnterior +
            setupAsignado[index] +
            cleanupAsignado[index],
        ),
        6,
      );
      diferenciaPreparacion =
        preparacionAsignada[index] - costoPreparacionAnterior;
      paso.tiempo.costo = redondear(
        Math.max(0, paso.tiempo.costo + diferenciaPreparacion),
        6,
      );
    }

    const diferenciaMaterial = material.costoTotal - costoMaterialAnterior;
    const diferenciaTotal = diferenciaMaterial + diferenciaPreparacion;
    paso.costoTotal = redondear(
      Math.max(0, paso.costoTotal + diferenciaTotal),
      6,
    );
    componente.costoTotal = redondear(
      Math.max(0, componente.costoTotal + diferenciaTotal),
      6,
    );
    const cantidadBase =
      componente.costoUnitario > 0
        ? costoComponenteAnterior / componente.costoUnitario
        : 0;
    if (cantidadBase > 0) {
      componente.costoUnitario = redondear(
        componente.costoTotal / cantidadBase,
        8,
      );
    }
    participante.nesting.loteNestingCompuesto = {
      loteId: args.id,
      firmaCompatibilidad: args.firma,
      esPasoOperativo: index === 0,
    };

    participantesLote.push({
      componenteCodigo: componente.codigo,
      productoId: componente.productoId,
      pasoClave: paso.configPasoId,
      rutaPasoId: paso.rutaPasoId,
      piezas: idsDemandados(participante.nesting),
      areaUtilMm2: participante.areaPiezasMm2,
      porcentajeAsignacion,
      costoMaterialAsignado: materialAsignado[index],
      costoPreparacionAsignado: preparacionAsignada[index],
      esPasoOperativo: index === 0,
    });
  });

  const duracionEstimadaMin = redondear(
    setupCompartido +
      cleanupCompartido +
      args.participantes.reduce(
        (total, participante) =>
          total +
          (participante.paso.tiempo?.runMin ?? 0) +
          (participante.paso.tiempo?.tiempoFijoMin ?? 0),
        0,
      ),
    6,
  );
  const substratesConsolidados = args.consolidado.substrates.flatMap(
    (substrate) =>
      substrate.kind === 'sheet'
        ? [
            {
              kind: 'sheet' as const,
              count: substrate.count,
              widthMm: substrate.widthMm,
              heightMm: substrate.heightMm,
            },
          ]
        : [],
  );
  const nestingBase = args.participantes[0].nesting;
  const costingPreview: NestingCostingPreview | undefined =
    args.consolidado.superficie === 'roll'
      ? {
          strategy: 'consumed-length',
          label: 'largo consumido del sustrato',
          chargedRatio: 1,
          chargedLengthMm: args.consolidado.consumedLengthMm,
          chargedAreaMm2: args.consolidado.metrics.areaTotalMm2,
          chargedBounds: {
            xMm: 0,
            yMm: 0,
            widthMm: args.consolidado.opcionRollo?.anchoMm ?? 0,
            heightMm: args.consolidado.consumedLengthMm ?? 0,
          },
          wasteAreaMm2: Math.max(
            0,
            args.consolidado.metrics.areaTotalMm2 -
              args.consolidado.metrics.areaUtilMm2,
          ),
        }
      : previewCosteoConsolidado({
          costeo: costeoConsolidado,
          substrates: substratesConsolidados,
          placements: args.consolidado.placements,
        });
  const baseVisual = nestingBase.visualConfig;
  const rollBase = args.participantes[0] as CandidatoRollo;
  const visualConfig =
    args.consolidado.superficie === 'roll' &&
    baseVisual &&
    args.consolidado.opcionRollo
      ? {
          ...baseVisual,
          panelizado: args.consolidado.panelizado,
          usableArea: {
            xMm: rollBase.sustrato.margins.leftMm,
            yMm: rollBase.sustrato.margins.startMm,
            widthMm: Math.max(
              0,
              args.consolidado.opcionRollo.anchoMm -
                rollBase.sustrato.margins.leftMm -
                rollBase.sustrato.margins.rightMm,
            ),
            heightMm: Math.max(
              0,
              (args.consolidado.consumedLengthMm ?? 0) -
                rollBase.sustrato.margins.startMm -
                rollBase.sustrato.margins.endMm,
            ),
          },
          printableArea: baseVisual.printableArea
            ? {
                ...baseVisual.printableArea,
                widthMm: Math.max(
                  0,
                  args.consolidado.opcionRollo.anchoMm -
                    baseVisual.margins.leftMm -
                    baseVisual.margins.rightMm,
                ),
                heightMm: Math.max(
                  0,
                  (args.consolidado.consumedLengthMm ?? 0) -
                    baseVisual.margins.topMm -
                    baseVisual.margins.bottomMm,
                ),
              }
            : undefined,
        }
      : baseVisual;
  const lote: LoteNestingCompuestoSnapshot = {
    id: args.id,
    versionContrato: 1,
    estado: 'CONGELADO',
    firmaCompatibilidad: args.firma,
    materialVarianteId: args.participantes[0].material.materialVarianteId,
    materialNombre: args.participantes[0].material.materialDisplayName,
    participantes: participantesLote,
    nestingResult: {
      algorithm: args.consolidado.algorithm,
      algorithmPolicy:
        args.consolidado.superficie === 'roll'
          ? rollBase.algorithmPolicy
          : nestingBase.algorithmPolicy,
      cantidadCalculada:
        args.consolidado.superficie === 'roll'
          ? (args.consolidado.consumedLengthMm ?? 0) / 1000
          : substratesConsolidados.reduce(
              (total, substrate) => total + substrate.count,
              0,
            ),
      unidad: args.consolidado.superficie === 'roll' ? 'm_lineales' : 'pliegos',
      aprovechamientoPct: args.consolidado.metrics.aprovechamientoPct,
      maquina: nestingBase.maquina,
      perfil: nestingBase.perfil,
      sustrato: nestingBase.sustrato,
      substrates: args.consolidado.substrates,
      placements: args.consolidado.placements,
      demandaNesting: args.consolidado.demandaNesting,
      solucionNesting: args.consolidado.solucionNesting,
      consumedLengthMm: args.consolidado.consumedLengthMm,
      piezasAcomodadas: args.consolidado.placements.length,
      costingSegmentSteps: nestingBase.costingSegmentSteps,
      modoColor: nestingBase.modoColor,
      tecnologia: nestingBase.tecnologia,
      carasProcesadas: nestingBase.carasProcesadas,
      tintasAdicionales: nestingBase.tintasAdicionales,
      visualConfig,
      costingPreview,
    },
    costeoSustrato: {
      strategy: costeoConsolidado.strategy,
      totalCost: costeoConsolidado.totalCost,
      unitPrice: costeoConsolidado.breakdown.unitPrice,
      pricePerM2: costeoConsolidado.breakdown.pricePerM2,
      fullUnits: costeoConsolidado.breakdown.fullUnits,
      fullUnitsCost: costeoConsolidado.breakdown.fullUnitsCost,
      lastUnit: costeoConsolidado.breakdown.lastUnit,
      units: costeoConsolidado.breakdown.units,
      ...(mermaOperativaPct > 0
        ? {
            mermaOperativa: {
              porcentaje: mermaOperativaPct,
              costoBase: costoMaterialConsolidadoBase,
              costoMerma: redondear(
                costoMaterialConsolidado - costoMaterialConsolidadoBase,
                6,
              ),
              costoTotal: costoMaterialConsolidado,
            },
          }
        : {}),
    },
    costoMaterialTotal: costoMaterialConsolidado,
    costoPreparacionTotal: costoPreparacionConsolidado,
    costoTotalAsignado: redondear(
      costoMaterialConsolidado + costoPreparacionConsolidado,
      6,
    ),
    duracionEstimadaMin,
  };
  return {
    aplicacion: {
      aplicado: true,
      costoMaterialIndependiente,
      costoMaterialConsolidado,
      costoPreparacionIndependiente,
      costoPreparacionConsolidado,
      ahorroCostoTotal: redondear(
        costoMaterialIndependiente +
          costoPreparacionIndependiente -
          costoMaterialConsolidado -
          costoPreparacionConsolidado,
        6,
      ),
    },
    lote,
  };
}

export async function analizarNestingCompuestoShadow(args: {
  politica: PoliticaNestingCompuesto;
  tenantId: string;
  productoPadreId: string;
  recetaRevisionId: string;
  componentes: ComponenteFabricadoCosteado[];
  aplicarCostos?: boolean;
  resolverNestingIrregular?: (
    problema: ProblemaNesting,
  ) => Promise<SolucionNesting>;
}): Promise<AnalisisNestingCompuestoShadow | undefined> {
  if (args.politica !== 'CONSOLIDAR_COMPATIBLES') return undefined;

  const candidatos: Candidato[] = [];
  const exclusiones: Exclusion[] = [];
  for (const componente of args.componentes) {
    if (componente.nestingCompartido?.excluido) {
      exclusiones.push({
        componenteCodigo: componente.codigo,
        codigo: 'COMPONENTE_EXCLUIDO',
        motivo:
          componente.nestingCompartido.motivo ??
          'El componente fue excluido explícitamente en la BOM.',
      });
      continue;
    }
    const pasosConNesting = (componente.pasos ?? []).filter(
      (paso) => paso.nestingResult != null,
    );
    if (pasosConNesting.length === 0) {
      exclusiones.push({
        componenteCodigo: componente.codigo,
        codigo: 'SIN_NESTING_RECTANGULAR',
        motivo: 'El componente no tiene pasos con nesting para consolidar.',
      });
      continue;
    }
    for (const paso of pasosConNesting) {
      const resultado = candidatoDesdePaso({ ...args, componente, paso });
      if (resultado.candidato) candidatos.push(resultado.candidato);
      if (resultado.exclusion) exclusiones.push(resultado.exclusion);
    }
  }

  const porFirma = new Map<string, Candidato[]>();
  for (const candidato of candidatos) {
    const grupo = porFirma.get(candidato.firma) ?? [];
    grupo.push(candidato);
    porFirma.set(candidato.firma, grupo);
  }

  const grupos: AnalisisNestingCompuestoShadow['grupos'] = [];
  const gruposOrdenados = [...porFirma.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  // Las firmas son disjuntas: ningún candidato aparece en dos grupos. Se
  // pueden resolver simultáneamente y la cola decidirá cuánto paralelismo hay
  // según la capacidad real disponible.
  const consolidadosPorFirma = new Map(
    await Promise.all(
      gruposOrdenados
        .filter(([, participantes]) => participantes.length >= 2)
        .map(
          async ([firma, participantes]) =>
            [
              firma,
              await consolidarParticipantes(
                participantes,
                args.resolverNestingIrregular,
              ),
            ] as const,
        ),
    ),
  );
  for (const [firma, participantes] of gruposOrdenados) {
    if (participantes.length < 2) {
      const unico = participantes[0];
      exclusiones.push({
        componenteCodigo: unico.componente.codigo,
        pasoClave: unico.paso.configPasoId,
        codigo: 'SIN_PAR_COMPATIBLE',
        motivo:
          'No existe otro componente con la misma firma productiva estricta.',
      });
      continue;
    }

    const base = participantes[0];
    const consolidado = consolidadosPorFirma.get(firma);
    if (!consolidado) {
      for (const participante of participantes) {
        exclusiones.push({
          componenteCodigo: participante.componente.codigo,
          pasoClave: participante.paso.configPasoId,
          codigo: 'CONSOLIDACION_NO_RESOLUBLE',
          motivo:
            'El algoritmo compartido no pudo ubicar exactamente todas las piezas.',
        });
      }
      continue;
    }

    const areaPiezasMm2 = participantes.reduce(
      (total, participante) => total + participante.areaPiezasMm2,
      0,
    );
    const esRollo = base.superficie === 'roll';
    const sustratosIndependientes = esRollo
      ? participantes.length
      : (participantes as CandidatoPliego[]).reduce(
          (total, participante) => total + participante.sustratosIndependientes,
          0,
        );
    const sustratosConsolidados = consolidado.substrates.length;
    const diferenciaSustratos = sustratosIndependientes - sustratosConsolidados;
    const largoIndependienteMm = esRollo
      ? (participantes as CandidatoRollo[]).reduce(
          (total, participante) => total + participante.largoIndependienteMm,
          0,
        )
      : undefined;
    const largoConsolidadoMm = consolidado.consumedLengthMm;
    const diferenciaLargoMm =
      largoIndependienteMm != null && largoConsolidadoMm != null
        ? largoIndependienteMm - largoConsolidadoMm
        : undefined;
    const areaIndependienteMm2 = esRollo
      ? (participantes as CandidatoRollo[]).reduce(
          (total, participante) =>
            total +
            participante.sustrato.widthMm * participante.largoIndependienteMm,
          0,
        )
      : base.sustrato.widthMm *
        base.sustrato.heightMm *
        sustratosIndependientes;
    const areaConsolidadaMm2 = consolidado.metrics.areaTotalMm2;
    const diferenciaAreaMm2 = esRollo
      ? areaIndependienteMm2 - areaConsolidadaMm2
      : undefined;
    const ahorroBase = esRollo ? (diferenciaAreaMm2 ?? 0) : diferenciaSustratos;
    const consumoBase = esRollo
      ? areaIndependienteMm2
      : sustratosIndependientes;

    const id = `nesting-compuesto-${firma.slice(0, 16)}`;
    const aplicacion = args.aplicarCostos
      ? aplicarGrupoConsolidado({
          id,
          firma,
          participantes,
          consolidado,
        })
      : {};
    grupos.push({
      id,
      firmaVersion: 1,
      firmaCompatibilidad: firma,
      participantes: participantes.map((participante) => ({
        componenteCodigo: participante.componente.codigo,
        productoId: participante.componente.productoId,
        pasoClave: participante.paso.configPasoId,
        rutaPasoId: participante.paso.rutaPasoId,
        pasoNombre:
          participante.paso.nombreVisible ?? participante.paso.familiaCodigo,
        piezas: idsDemandados(participante.nesting),
      })),
      independiente: {
        sustratos: sustratosIndependientes,
        ...(largoIndependienteMm != null
          ? { largoMm: largoIndependienteMm }
          : {}),
        ...(esRollo ? { areaMm2: areaIndependienteMm2 } : {}),
        aprovechamientoPct:
          areaIndependienteMm2 > 0
            ? redondear((areaPiezasMm2 / areaIndependienteMm2) * 100)
            : 0,
      },
      consolidado: {
        algoritmo: consolidado.algorithm,
        sustratos: sustratosConsolidados,
        ...(largoConsolidadoMm != null ? { largoMm: largoConsolidadoMm } : {}),
        ...(esRollo ? { areaMm2: areaConsolidadaMm2 } : {}),
        aprovechamientoPct: consolidado.metrics.aprovechamientoPct,
        substrates: consolidado.substrates,
        placements: consolidado.placements,
      },
      diferencia: {
        sustratos: diferenciaSustratos,
        ...(diferenciaLargoMm != null ? { largoMm: diferenciaLargoMm } : {}),
        ...(diferenciaAreaMm2 != null ? { areaMm2: diferenciaAreaMm2 } : {}),
        ahorroPct:
          consumoBase > 0 ? redondear((ahorroBase / consumoBase) * 100) : 0,
        ahorroPotencial: ahorroBase > 0,
      },
      ...aplicacion,
    });
  }

  exclusiones.sort(
    (a, b) =>
      a.componenteCodigo.localeCompare(b.componenteCodigo) ||
      (a.pasoClave ?? '').localeCompare(b.pasoClave ?? '') ||
      a.codigo.localeCompare(b.codigo),
  );
  return {
    version: 1,
    modo: args.aplicarCostos ? 'APLICADO' : 'SOMBRA',
    politica: 'CONSOLIDAR_COMPATIBLES',
    aplicadoACostos: grupos.some(
      (grupo) => grupo.aplicacion?.aplicado === true,
    ),
    grupos,
    exclusiones,
  };
}

export async function aplicarNestingCompuesto(args: {
  politica: PoliticaNestingCompuesto;
  tenantId: string;
  productoPadreId: string;
  recetaRevisionId: string;
  componentes: ComponenteFabricadoCosteado[];
  resolverNestingIrregular?: (
    problema: ProblemaNesting,
  ) => Promise<SolucionNesting>;
}): Promise<AnalisisNestingCompuestoShadow | undefined> {
  return analizarNestingCompuestoShadow({ ...args, aplicarCostos: true });
}

/** @deprecated Alias conservado para consumidores y snapshots de F4.4.2. */
export const aplicarNestingCompuestoRectangular = aplicarNestingCompuesto;
