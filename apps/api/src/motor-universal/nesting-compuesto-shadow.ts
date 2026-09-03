import { createHash } from 'node:crypto';
import { nestGrid2DMulti } from '../productos-servicios/nesting/algorithms/grid-2d-multi';
import {
  chargedBoundsAlongPlateLongAxis,
  resolvePlateAxes,
} from '../productos-servicios/nesting/helpers/plate-axis';
import {
  applyCostingStrategy,
  type CostingResult,
  type CostingStrategyKind,
} from '../productos-servicios/nesting/costing';
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

type Candidato = {
  componente: ComponenteFabricadoCosteado;
  paso: PasoEjecutado;
  nesting: NestingEjecutado;
  material: MaterialEjecutado;
  firma: string;
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
  areaPiezasMm2: number;
};

type ResultadoConsolidado = ReturnType<typeof nestGrid2DMulti>;

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
    (total, placement) => total + placement.widthMm * placement.heightMm,
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
      .reduce(
        (total, placement) => total + placement.widthMm * placement.heightMm,
        0,
      );
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
  if (
    !nesting ||
    nesting.unidad !== 'pliegos' ||
    !['grid-2d-single', 'grid-2d-multi'].includes(nesting.algorithm) ||
    nesting.talonarioGrouping
  ) {
    return {
      exclusion: {
        ...baseExclusion,
        codigo: 'SIN_NESTING_RECTANGULAR',
        motivo:
          'El paso no produce un nesting rectangular simple sobre pliegos.',
      },
    };
  }
  const sheets = nesting.substrates.filter(
    (substrate): substrate is Extract<typeof substrate, { kind: 'sheet' }> =>
      substrate.kind === 'sheet',
  );
  const primero = sheets[0];
  const demanda = nesting.demandaRectangular ?? [];
  const visual = nesting.visualConfig;
  if (
    !primero ||
    sheets.length !== nesting.substrates.length ||
    sheets.some(
      (sheet) =>
        sheet.widthMm !== primero.widthMm ||
        sheet.heightMm !== primero.heightMm,
    ) ||
    !visual ||
    demanda.length === 0 ||
    !nesting.maquina?.id
  ) {
    return {
      exclusion: {
        ...baseExclusion,
        codigo: 'CONFIGURACION_INCOMPLETA',
        motivo:
          'Falta demanda, máquina, formato único o configuración geométrica para firmar el lote con seguridad.',
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

  const sustratosIndependientes = sheets.reduce(
    (total, sheet) => total + Math.max(1, Math.ceil(sheet.count)),
    0,
  );
  const areaPiezasMm2 = demanda.reduce(
    (total, pieza) =>
      total + pieza.anchoMm * pieza.altoMm * Math.ceil(pieza.cantidad),
    0,
  );
  const firmaBase = {
    version: 1,
    tenantId: args.tenantId,
    productoPadreId: args.productoPadreId,
    recetaRevisionId: args.recetaRevisionId,
    materialVarianteId: material.materialVarianteId,
    materialUnidad: material.unidad,
    materialPrecioUnitario: material.precioUnitario,
    formato: { anchoMm: primero.widthMm, altoMm: primero.heightMm },
    politicaEjecucion: componente.politicaEjecucion,
    familiaCodigo: paso.familiaCodigo,
    algoritmo: nesting.algorithm,
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
    },
  };
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

  const piezasTotales = args.participantes.reduce(
    (total, participante) =>
      total +
      (participante.nesting.demandaRectangular ?? []).reduce(
        (subtotal, pieza) => subtotal + Math.ceil(pieza.cantidad),
        0,
      ),
    0,
  );
  let costeoConsolidado: ReturnType<typeof applyCostingStrategy>;
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
  const sustratosIndependientes = args.participantes.reduce(
    (total, participante) => total + participante.sustratosIndependientes,
    0,
  );
  const costoTotalIndependiente =
    costoMaterialIndependiente + costoPreparacionIndependiente;
  const costoTotalConsolidado =
    costoMaterialConsolidado + costoPreparacionConsolidado;
  if (
    args.consolidado.substrates.length > sustratosIndependientes ||
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
      piezas: (participante.nesting.demandaRectangular ?? []).map(
        (pieza) => pieza.pieceId,
      ),
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
  const costingPreview = previewCosteoConsolidado({
    costeo: costeoConsolidado,
    substrates: substratesConsolidados,
    placements: args.consolidado.placements,
  });
  const lote: LoteNestingCompuestoSnapshot = {
    id: args.id,
    versionContrato: 1,
    estado: 'CONGELADO',
    firmaCompatibilidad: args.firma,
    materialVarianteId: args.participantes[0].material.materialVarianteId,
    materialNombre: args.participantes[0].material.materialDisplayName,
    participantes: participantesLote,
    nestingResult: {
      algorithm: 'grid-2d-multi',
      cantidadCalculada: substratesConsolidados.reduce(
        (total, substrate) => total + substrate.count,
        0,
      ),
      unidad: 'pliegos',
      aprovechamientoPct: args.consolidado.metrics.aprovechamientoPct,
      maquina: nestingBase.maquina,
      perfil: nestingBase.perfil,
      sustrato: nestingBase.sustrato,
      substrates: substratesConsolidados,
      placements: args.consolidado.placements,
      piezasAcomodadas: args.consolidado.placements.length,
      costingSegmentSteps: nestingBase.costingSegmentSteps,
      modoColor: nestingBase.modoColor,
      tecnologia: nestingBase.tecnologia,
      carasProcesadas: nestingBase.carasProcesadas,
      tintasAdicionales: nestingBase.tintasAdicionales,
      visualConfig: nestingBase.visualConfig,
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

export function analizarNestingCompuestoShadow(args: {
  politica: PoliticaNestingCompuesto;
  tenantId: string;
  productoPadreId: string;
  recetaRevisionId: string;
  componentes: ComponenteFabricadoCosteado[];
  aplicarCostos?: boolean;
}): AnalisisNestingCompuestoShadow | undefined {
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
  for (const [firma, participantes] of [...porFirma.entries()].sort(
    ([a], [b]) => a.localeCompare(b),
  )) {
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
    const piezas = participantes.flatMap((participante) =>
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
    const consolidado = nestGrid2DMulti(piezas, base.sustrato, {
      separationHMm: base.separationHMm,
      separationVMm: base.separationVMm,
      allowRotation: base.allowRotation,
    });
    const piezasEsperadas = piezas.reduce(
      (total, pieza) => total + pieza.quantity,
      0,
    );
    if (
      consolidado.placements.length !== piezasEsperadas ||
      consolidado.substrates.length === 0
    ) {
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

    const sustratosIndependientes = participantes.reduce(
      (total, participante) => total + participante.sustratosIndependientes,
      0,
    );
    const sustratosConsolidados = consolidado.substrates.length;
    const diferencia = sustratosIndependientes - sustratosConsolidados;
    const areaPiezasMm2 = participantes.reduce(
      (total, participante) => total + participante.areaPiezasMm2,
      0,
    );
    const areaIndependienteMm2 =
      base.sustrato.widthMm * base.sustrato.heightMm * sustratosIndependientes;

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
        piezas: (participante.nesting.demandaRectangular ?? []).map(
          (pieza) => pieza.pieceId,
        ),
      })),
      independiente: {
        sustratos: sustratosIndependientes,
        aprovechamientoPct:
          areaIndependienteMm2 > 0
            ? redondear((areaPiezasMm2 / areaIndependienteMm2) * 100)
            : 0,
      },
      consolidado: {
        algoritmo: 'grid-2d-multi',
        sustratos: sustratosConsolidados,
        aprovechamientoPct: consolidado.metrics.aprovechamientoPct,
        substrates: consolidado.substrates.flatMap((substrate) =>
          substrate.kind === 'sheet'
            ? [
                {
                  kind: 'sheet' as const,
                  count: 1,
                  widthMm: substrate.widthMm,
                  heightMm: substrate.heightMm,
                },
              ]
            : [],
        ),
        placements: consolidado.placements,
      },
      diferencia: {
        sustratos: diferencia,
        ahorroPct:
          sustratosIndependientes > 0
            ? redondear((diferencia / sustratosIndependientes) * 100)
            : 0,
        ahorroPotencial: diferencia > 0,
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

export function aplicarNestingCompuestoRectangular(args: {
  politica: PoliticaNestingCompuesto;
  tenantId: string;
  productoPadreId: string;
  recetaRevisionId: string;
  componentes: ComponenteFabricadoCosteado[];
}): AnalisisNestingCompuestoShadow | undefined {
  return analizarNestingCompuestoShadow({ ...args, aplicarCostos: true });
}
