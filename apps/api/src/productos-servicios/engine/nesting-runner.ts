/**
 * Nesting Runner (C.2.6) — runtime produce→consume del modelo universal.
 *
 * Dada una lista ordenada de pasos (con su familia declarada), ejecuta el
 * algoritmo de nesting apropiado en cada paso `produce` y propaga el layout
 * a los pasos `consume` subsiguientes.
 *
 * Reglas:
 * - `modoNesting: 'produce'` → invoca el algoritmo declarado por la familia
 *   (nesting-hoja / nesting-rollo / nesting-placa-rigida), persiste el
 *   layout resultante. Marca este paso como "último produce".
 * - `modoNesting: 'consume'` → registra que este paso hereda el layout del
 *   "último produce" aguas arriba. Si no hay produce previo, no falla
 *   (validación de ruta es responsabilidad separada); simplemente queda sin
 *   layout heredado.
 * - `modoNesting: 'none'` → paso no tiene relación con nesting; se ignora.
 *
 * Esta es una función PURA: no hace I/O, no consulta DB. Los motores v2 la
 * invocan tras cargar los datos (producto, material, máquina) y antes de
 * calcular costos por paso.
 */
import type { FamiliaPaso, NestingAlgoritmo } from '../pasos/familias';
import {
  nestRectangularGrid,
  type NestingPlacaResult,
} from '../nesting/nesting-placa-rigida';
import {
  nestOnRoll,
  type NestingRolloResult,
  type NestingRolloPanelizadoConfig,
} from '../nesting/nesting-rollo';
import {
  nestOnSheet,
  type NestingHojaResult,
  type NestingHojaPliego,
  type NestingHojaCriterio,
} from '../nesting/nesting-hoja';

// ─── Tipos públicos ─────────────────────────────────────────────

/**
 * SM.1.d — Criterio para elegir el material/rollo ganador cuando hay
 * múltiples variantes habilitadas. Se lee desde `configNestingV2.criterioSeleccionMaterial`.
 */
export type CriterioSeleccionMaterial =
  | 'menor_costo_total'
  | 'menor_largo_consumido'
  | 'mayor_aprovechamiento';

/**
 * SM.1.d — Evaluación multi-material que produce el algoritmo cuando el paso
 * tiene un POM con `esSustratoNesting=true`. El motor itera todas las
 * variantes habilitadas, corre el algoritmo por cada una y elige el ganador.
 * Se incluye en `NestingResultUnion` como metadata adicional (no rompe
 * compat con consumidores que solo leen `result`).
 */
export type EvaluacionMultiMaterial = {
  criterio: CriterioSeleccionMaterial;
  materialElegido: {
    materialVarianteId: string;
    sku: string;
    nombre: string;
    rolloAnchoMm: number | null;
    /** Largo total del rollo en metros (de atributosVarianteJson.largo). */
    rolloLargoM: number | null;
    precioReferencia: number | null;
    /** Precio por m² calculado (precio rollo / area rollo). */
    precioPorM2: number | null;
    /** Área consumida del rollo (mm² → m²). */
    areaConsumidaM2: number;
    /** % aprovechamiento = areaUtil / areaConsumida. */
    aprovechamientoPct: number;
    /** Costo del sustrato aplicado al trabajo. */
    sustratoCosto: number | null;
  };
  materialesEvaluados: Array<{
    materialVarianteId: string;
    sku: string;
    nombre: string;
    rolloAnchoMm: number | null;
    aprovechamientoPct: number;
    largoConsumidoMm: number;
    sustratoCosto: number | null;
    esGanador: boolean;
  }>;
  materialesDescartados: Array<{
    sku: string;
    nombre: string;
    motivo: string;
    rolloAnchoMm: number | null;
  }>;
};

export type NestingResultUnion =
  | { algoritmo: 'nesting-placa-rigida'; result: NestingPlacaResult }
  | {
      algoritmo: 'nesting-rollo';
      result: NestingRolloResult;
      /** Márgenes efectivos aplicados al algoritmo (mm). El frontend los usa
       * para dibujar las zonas no-imprimibles del rollo en la visualización. */
      marginLeftMm?: number;
      marginRightMm?: number;
      marginStartMm?: number;
      marginEndMm?: number;
      /** Ancho del rollo total (sin descontar márgenes), usado por el frontend
       * para dibujar el material completo. En multi-variant es el del ganador. */
      rolloAnchoTotalMm?: number;
      /** SM.1.d — Presente solo cuando el paso evaluó múltiples materiales. */
      evaluacion?: EvaluacionMultiMaterial;
    }
  | { algoritmo: 'nesting-hoja'; result: NestingHojaResult };

/**
 * SM.1.d — Materiales declarados de un paso, vistos por el runner. Solo se
 * usa la info necesaria para la iteración multi-variante. El campo viene
 * pre-poblado por super-motor desde `ProcesoOperacionMaterial`.
 */
export type PasoMaterialRuntime = {
  id: string;
  nombre: string;
  esSustratoNesting: boolean;
  variantesHabilitadas: Array<{
    materiaPrimaVarianteId: string;
    sku: string;
    nombreVariante: string | null;
    /** atributosVarianteJson — para rollos: { ancho: m, largo: m } */
    atributosVariante: Record<string, unknown> | null;
    precioReferencia: number | null;
  }>;
};

export type PasoRuntime = {
  /** id único del paso dentro de la ruta (matchea ProcesoOperacion.id). */
  id: string;
  /** codigo de la familia en FAMILIAS_PASO. */
  familiaCodigo: string;
  /** Valor de ProcesoOperacion.configNestingV2 (Json? en el schema). */
  configNesting: Record<string, unknown> | null;
  /** SM.1.d — Materiales declarados del paso (opcional). Cuando hay un
   * material con esSustratoNesting=true, el runner itera sus variantes
   * habilitadas y elige el mejor por criterio. */
  materialesConsumidos?: PasoMaterialRuntime[];
};

export type TrabajoContext = {
  /** Medidas de las piezas pedidas. */
  medidas: Array<{ anchoMm: number; altoMm: number; cantidad: number }>;
  /** Cantidad total (informativa; las medidas ya tienen cantidad propia). */
  cantidadTotal?: number;
};

/**
 * Material + máquina ya resueltos por el motor v2.
 * Los algoritmos de nesting reciben estos valores como input pre-calculado.
 */
export type MaterialMaquinaContext = {
  /** Para nesting-rollo: ancho imprimible de la máquina (ya con márgenes aplicados). */
  maquinaPrintableWidthMm?: number;
  /** Ancho TOTAL del material/máquina sin descontar márgenes (mm). Necesario
   * para recomputar printable cuando el paso overridea márgenes individuales. */
  maquinaAnchoTotalMm?: number;
  maquinaMarginLeftMm?: number;
  maquinaMarginRightMm?: number;
  maquinaMarginStartMm?: number;
  maquinaMarginEndMm?: number;
  /** Para nesting-placa-rigida: dimensiones de la placa finita. */
  placaAnchoMm?: number;
  placaAltoMm?: number;
};

export type NestingRunnerInput = {
  /** Pasos en orden topológico (ya resueltos por el motor). */
  pasos: PasoRuntime[];
  /** Catálogo de familias (inyectado para facilitar testing con mocks). */
  familiasMap: Record<string, FamiliaPaso>;
  /** Inputs del trabajo (piezas). */
  trabajo: TrabajoContext;
  /** Material/máquina ya resueltos. Opcional según el algoritmo. */
  materialMaquina?: MaterialMaquinaContext;
};

export type NestingRunnerOutput = {
  /** Resultado del nesting para cada paso `produce` (id → layout). */
  layoutsPorPasoId: Map<string, NestingResultUnion>;
  /** Para cada paso `consume`, qué paso `produce` aguas arriba heredan. */
  consumeMap: Map<string, string>;
  /**
   * Pasos consume que no encontraron un produce previo. No es error bloqueante;
   * la validación de ruta (C.2.7) es quien debe prevenir esto al configurar
   * el producto.
   */
  consumersSinProduce: string[];
};

// ─── Función principal ──────────────────────────────────────────

export function runNestingPipeline(input: NestingRunnerInput): NestingRunnerOutput {
  const layoutsPorPasoId = new Map<string, NestingResultUnion>();
  const consumeMap = new Map<string, string>();
  const consumersSinProduce: string[] = [];
  let lastProduceId: string | null = null;

  for (const paso of input.pasos) {
    const familia = input.familiasMap[paso.familiaCodigo];
    if (!familia) {
      throw new Error(
        `nesting-runner: familia desconocida '${paso.familiaCodigo}' para paso ${paso.id}.`,
      );
    }

    if (familia.modoNesting === 'produce') {
      if (!familia.nestingAlgoritmo) {
        throw new Error(
          `nesting-runner: familia '${familia.codigo}' es 'produce' pero no declara nestingAlgoritmo.`,
        );
      }
      const result = ejecutarNestingAlgoritmo(
        familia.nestingAlgoritmo,
        input.trabajo.medidas,
        paso,
        input.materialMaquina,
      );
      if (result) {
        layoutsPorPasoId.set(paso.id, result);
        lastProduceId = paso.id;
      }
      // Si result es null, el algoritmo no pudo producir layout (ej. pieza no entra).
      // El motor v2 debe detectarlo vía layoutsPorPasoId.get(pasoId) === undefined.
      continue;
    }

    if (familia.modoNesting === 'consume') {
      if (lastProduceId) {
        consumeMap.set(paso.id, lastProduceId);
      } else {
        consumersSinProduce.push(paso.id);
      }
      continue;
    }

    // 'none': no hace nada con nesting
  }

  return { layoutsPorPasoId, consumeMap, consumersSinProduce };
}

// ─── Dispatch al algoritmo apropiado ────────────────────────────

function ejecutarNestingAlgoritmo(
  algoritmo: NestingAlgoritmo,
  medidas: TrabajoContext['medidas'],
  paso: PasoRuntime,
  materialMaquina: MaterialMaquinaContext | undefined,
): NestingResultUnion | null {
  const config = paso.configNesting ?? {};
  const pasoId = paso.id;
  const tag = `[nesting-runner:${algoritmo}:${pasoId}]`;

  switch (algoritmo) {
    case 'nesting-placa-rigida': {
      // Para placa rígida, tomamos la primera medida como pieza del cálculo.
      // Multi-medida en placa es nestMultiMedida, pero para el piloto single-medida alcanza.
      const m = medidas[0];
      if (!m) {
        console.warn(`${tag} sin medidas — devuelve null.`);
        return null;
      }
      const placaAnchoMm = Number(materialMaquina?.placaAnchoMm ?? config.placaAnchoMm ?? 0);
      const placaAltoMm = Number(materialMaquina?.placaAltoMm ?? config.placaAltoMm ?? 0);
      if (placaAnchoMm <= 0 || placaAltoMm <= 0) {
        console.warn(
          `${tag} placa sin dimensiones (placaAnchoMm=${placaAnchoMm}, placaAltoMm=${placaAltoMm}). ` +
            `Cargá las dimensiones en configNestingV2 del paso o asigná una máquina con material que las exponga.`,
        );
        return null;
      }

      const result = nestRectangularGrid({
        piezaAnchoMm: m.anchoMm,
        piezaAltoMm: m.altoMm,
        placaAnchoMm,
        placaAltoMm,
        separacionHMm: Number(config.separacionHMm ?? 0),
        separacionVMm: Number(config.separacionVMm ?? 0),
        margenMm: Number(config.margenMm ?? 0),
        permitirRotacion: Boolean(config.permitirRotacion ?? true),
      });
      if (result.piezasPorPlaca === 0) {
        console.warn(
          `${tag} la pieza ${m.anchoMm}×${m.altoMm}mm no entra en placa ${placaAnchoMm}×${placaAltoMm}mm — devuelve null.`,
        );
        return null;
      }
      return { algoritmo, result };
    }

    case 'nesting-rollo': {
      // Márgenes efectivos: config override del paso → default de máquina → 0
      const effMarginLeft = Number(
        config.marginLeftMm ?? materialMaquina?.maquinaMarginLeftMm ?? 0,
      );
      const effMarginRight = Number(
        config.marginRightMm ?? materialMaquina?.maquinaMarginRightMm ?? 0,
      );
      const effMarginStart = Number(
        config.marginStartMm ?? materialMaquina?.maquinaMarginStartMm ?? 0,
      );
      const effMarginEnd = Number(
        config.marginEndMm ?? materialMaquina?.maquinaMarginEndMm ?? 0,
      );
      const sepH = Number(config.separacionHorizontalMm ?? 0);
      const sepV = Number(config.separacionVerticalMm ?? 0);
      const permitirRotacion = Boolean(config.permitirRotacion ?? true);
      const panelizado = (config.panelizado as NestingRolloPanelizadoConfig | undefined) ?? undefined;

      // SM.1.d — Si el paso declara un material con esSustratoNesting=true,
      // iteramos las variantes habilitadas y elegimos la mejor por criterio.
      const sustrato = paso.materialesConsumidos?.find(
        (m) => m.esSustratoNesting && m.variantesHabilitadas.length > 0,
      );
      if (sustrato) {
        const criterio = ((config.criterioSeleccionMaterial as CriterioSeleccionMaterial) ??
          'mayor_aprovechamiento') as CriterioSeleccionMaterial;
        const evaluados: Array<{
          variante: PasoMaterialRuntime['variantesHabilitadas'][number];
          rolloAnchoMm: number;
          rolloLargoM: number | null;
          printableWidth: number;
          result: NestingRolloResult;
          areaConsumidaM2: number;
          aprovechamientoPct: number;
          precioPorM2: number | null;
          sustratoCosto: number | null;
        }> = [];
        const descartados: Array<{
          sku: string;
          nombre: string;
          motivo: string;
          rolloAnchoMm: number | null;
        }> = [];

        for (const variante of sustrato.variantesHabilitadas) {
          const attrs = variante.atributosVariante ?? {};
          // atributosVarianteJson.ancho está en METROS (convención de
          // catálogo de materias primas, ver maquinaria-templates.ts y
          // wide-format-v2.motor.ts archivado).
          const anchoM = Number((attrs as Record<string, unknown>).ancho);
          const largoM = Number((attrs as Record<string, unknown>).largo);
          if (!Number.isFinite(anchoM) || anchoM <= 0) {
            descartados.push({
              sku: variante.sku,
              nombre: variante.nombreVariante ?? variante.sku,
              motivo: `Variante sin atributo "ancho" válido en atributosVarianteJson.`,
              rolloAnchoMm: null,
            });
            continue;
          }
          const rolloAnchoMm = Math.round(anchoM * 1000);
          // El printable de esta variante = ancho del rollo − márgenes laterales
          // del paso/máquina. Si el paso overridea ancho imprimible directo,
          // ese override gana (caso edge — útil para pruebas).
          const printableWidth = config.printableWidthMm
            ? Number(config.printableWidthMm)
            : Math.max(0, rolloAnchoMm - effMarginLeft - effMarginRight);
          if (printableWidth <= 0) {
            descartados.push({
              sku: variante.sku,
              nombre: variante.nombreVariante ?? variante.sku,
              motivo: `Ancho imprimible <= 0 (rollo ${rolloAnchoMm}mm - márgenes ${effMarginLeft + effMarginRight}mm).`,
              rolloAnchoMm,
            });
            continue;
          }
          const result = nestOnRoll({
            medidas,
            printableWidthMm: printableWidth,
            marginLeftMm: effMarginLeft,
            marginStartMm: effMarginStart,
            marginEndMm: effMarginEnd,
            separacionHorizontalMm: sepH,
            separacionVerticalMm: sepV,
            permitirRotacion,
            panelizado,
          });
          if (!result) {
            descartados.push({
              sku: variante.sku,
              nombre: variante.nombreVariante ?? variante.sku,
              motivo: `Las piezas no entran en rollo de ${rolloAnchoMm}mm (printable ${printableWidth}mm).`,
              rolloAnchoMm,
            });
            continue;
          }
          const areaConsumidaM2 =
            (printableWidth * result.consumedLengthMm) / 1_000_000;
          const aprovechamientoPct =
            areaConsumidaM2 > 0
              ? Math.round((result.usefulAreaM2 / areaConsumidaM2) * 10000) / 100
              : 0;
          // Precio por m² = precio rollo / area total rollo.
          let precioPorM2: number | null = null;
          let sustratoCosto: number | null = null;
          if (
            variante.precioReferencia != null &&
            variante.precioReferencia > 0 &&
            Number.isFinite(largoM) &&
            largoM > 0
          ) {
            const areaRolloM2 = (rolloAnchoMm / 1000) * largoM;
            precioPorM2 = areaRolloM2 > 0
              ? Math.round((variante.precioReferencia / areaRolloM2) * 10000) / 10000
              : null;
            sustratoCosto = precioPorM2 != null
              ? Math.round(areaConsumidaM2 * precioPorM2 * 100) / 100
              : null;
          }
          evaluados.push({
            variante,
            rolloAnchoMm,
            rolloLargoM: Number.isFinite(largoM) ? largoM : null,
            printableWidth,
            result,
            areaConsumidaM2,
            aprovechamientoPct,
            precioPorM2,
            sustratoCosto,
          });
        }

        if (evaluados.length === 0) {
          const detalle = descartados
            .map((d) => `${d.sku}: ${d.motivo}`)
            .join(' | ');
          console.warn(
            `${tag} ninguna de las ${sustrato.variantesHabilitadas.length} variantes habilitadas pudo procesar el trabajo. ${detalle}`,
          );
          return null;
        }

        const ganador = elegirVarianteRollo(evaluados, criterio);
        return {
          algoritmo,
          result: ganador.result,
          marginLeftMm: effMarginLeft,
          marginRightMm: Math.max(
            0,
            ganador.rolloAnchoMm - ganador.printableWidth - effMarginLeft,
          ),
          marginStartMm: effMarginStart,
          marginEndMm: effMarginEnd,
          rolloAnchoTotalMm: ganador.rolloAnchoMm,
          evaluacion: {
            criterio,
            materialElegido: {
              materialVarianteId: ganador.variante.materiaPrimaVarianteId,
              sku: ganador.variante.sku,
              nombre: ganador.variante.nombreVariante ?? ganador.variante.sku,
              rolloAnchoMm: ganador.rolloAnchoMm,
              rolloLargoM: ganador.rolloLargoM,
              precioReferencia: ganador.variante.precioReferencia,
              precioPorM2: ganador.precioPorM2,
              areaConsumidaM2: ganador.areaConsumidaM2,
              aprovechamientoPct: ganador.aprovechamientoPct,
              sustratoCosto: ganador.sustratoCosto,
            },
            materialesEvaluados: evaluados.map((e) => ({
              materialVarianteId: e.variante.materiaPrimaVarianteId,
              sku: e.variante.sku,
              nombre: e.variante.nombreVariante ?? e.variante.sku,
              rolloAnchoMm: e.rolloAnchoMm,
              aprovechamientoPct: e.aprovechamientoPct,
              largoConsumidoMm: e.result.consumedLengthMm,
              sustratoCosto: e.sustratoCosto,
              esGanador:
                e.variante.materiaPrimaVarianteId ===
                ganador.variante.materiaPrimaVarianteId,
            })),
            materialesDescartados: descartados,
          },
        };
      }

      // ── Fallback (sin sustrato declarado) — comportamiento de hoy ──
      // Si el paso overridea algún margen lateral, recomputamos sobre el ancho
      // total — si no, usamos el printable pre-computado por la máquina (compat).
      const sobrescribeLateral =
        config.marginLeftMm !== undefined || config.marginRightMm !== undefined;
      const anchoTotalMm = Number(
        materialMaquina?.maquinaAnchoTotalMm ?? config.printableWidthMm ?? 0,
      );
      const printableWidth = sobrescribeLateral
        ? Math.max(0, anchoTotalMm - effMarginLeft - effMarginRight)
        : Number(
            materialMaquina?.maquinaPrintableWidthMm ?? config.printableWidthMm ?? 0,
          );

      if (printableWidth <= 0) {
        const hint = materialMaquina
          ? `máquina sin parámetros válidos (anchoBoca/anchoCama/anchoImprimibleMaximo) — verificá que estén cargados en cm.`
          : `sin máquina asignada al paso o sin parametrosTecnicos.`;
        console.warn(
          `${tag} printableWidthMm=0 (${hint}). Override: cargá 'Ancho imprimible' en la sección Nesting del paso, o declará un material con esSustratoNesting=true.`,
        );
        return null;
      }

      const result = nestOnRoll({
        medidas,
        printableWidthMm: printableWidth,
        marginLeftMm: effMarginLeft,
        marginStartMm: effMarginStart,
        marginEndMm: effMarginEnd,
        separacionHorizontalMm: sepH,
        separacionVerticalMm: sepV,
        permitirRotacion,
        panelizado,
      });
      if (!result) {
        console.warn(
          `${tag} nestOnRoll devolvió null (${medidas.length} medida(s), printableWidthMm=${printableWidth}). ` +
            `Posible causa: pieza más grande que el ancho imprimible y rotación no permitida/posible.`,
        );
        return null;
      }
      // Margen derecho derivado: anchoTotal - printable - marginLeft
      const marginRightDerivado = Math.max(
        0,
        anchoTotalMm - printableWidth - effMarginLeft,
      );
      return {
        algoritmo,
        result,
        marginLeftMm: effMarginLeft,
        marginRightMm: marginRightDerivado,
        marginStartMm: effMarginStart,
        marginEndMm: effMarginEnd,
        rolloAnchoTotalMm: anchoTotalMm > 0 ? anchoTotalMm : undefined,
      };
    }

    case 'nesting-hoja': {
      const m = medidas[0];
      if (!m) {
        console.warn(`${tag} sin medidas — devuelve null.`);
        return null;
      }
      // Fase A — pliego de impresión opcional. Cuando viene seteado, el
      // motor hace nesting de las piezas sobre ese formato útil y luego
      // calcula cuántos sustratos comprados son necesarios. El costeo del
      // material se deriva del sustrato (no del pliego de impresión).
      const pliegoImpresionRaw = config.pliegoImpresion as
        | NestingHojaPliego
        | null
        | undefined;
      const pliegoImpresion =
        pliegoImpresionRaw &&
        Number.isFinite(Number(pliegoImpresionRaw.anchoMm)) &&
        Number.isFinite(Number(pliegoImpresionRaw.altoMm)) &&
        Number(pliegoImpresionRaw.anchoMm) > 0 &&
        Number(pliegoImpresionRaw.altoMm) > 0
          ? {
              codigo: String(pliegoImpresionRaw.codigo ?? 'CUSTOM'),
              nombre: String(pliegoImpresionRaw.nombre ?? 'Custom'),
              anchoMm: Number(pliegoImpresionRaw.anchoMm),
              altoMm: Number(pliegoImpresionRaw.altoMm),
            }
          : null;
      const result = nestOnSheet({
        piezaAnchoMm: m.anchoMm,
        piezaAltoMm: m.altoMm,
        cantidadPiezas: m.cantidad,
        pliegos: (config.pliegos as NestingHojaPliego[] | undefined),
        separacionHMm: Number(config.separacionHMm ?? 0),
        separacionVMm: Number(config.separacionVMm ?? 0),
        margenMm: Number(config.margenMm ?? 0),
        permitirRotacion: Boolean(config.permitirRotacion ?? true),
        criterio: ((config.criterio ?? 'menor_cantidad_pliegos') as NestingHojaCriterio),
        pliegoImpresion,
      });
      if (!result) {
        const pliegosCfg = (config.pliegos as NestingHojaPliego[] | undefined) ?? [];
        console.warn(
          `${tag} nestOnSheet devolvió null. Pieza ${m.anchoMm}×${m.altoMm}mm, ` +
            `${pliegosCfg.length} pliego(s) candidatos. Posible causa: pieza no entra en ningún pliego o lista de pliegos vacía.`,
        );
        return null;
      }
      return { algoritmo, result };
    }
  }
}

// ─── Utility para consumers ─────────────────────────────────────

/**
 * Dado el output del runner y un id de paso `consume`, retorna el layout
 * heredado (o null si no hay).
 */
export function getLayoutHeredado(
  output: NestingRunnerOutput,
  pasoId: string,
): NestingResultUnion | null {
  const produceId = output.consumeMap.get(pasoId);
  if (!produceId) return null;
  return output.layoutsPorPasoId.get(produceId) ?? null;
}

// ─── Selección multi-material para nesting-rollo (SM.1.d) ───────

type EvaluadoRollo = {
  variante: PasoMaterialRuntime['variantesHabilitadas'][number];
  rolloAnchoMm: number;
  rolloLargoM: number | null;
  printableWidth: number;
  result: NestingRolloResult;
  areaConsumidaM2: number;
  aprovechamientoPct: number;
  precioPorM2: number | null;
  sustratoCosto: number | null;
};

/**
 * SM.1.d — Elige la variante ganadora entre las evaluadas según criterio.
 *   - menor_costo_total: requiere `sustratoCosto != null` en al menos uno;
 *     si ningún evaluado tiene costo, hace fallback a mayor_aprovechamiento.
 *   - menor_largo_consumido: minimiza consumedLengthMm.
 *   - mayor_aprovechamiento: maximiza aprovechamientoPct.
 */
function elegirVarianteRollo(
  evaluados: EvaluadoRollo[],
  criterio: CriterioSeleccionMaterial,
): EvaluadoRollo {
  if (criterio === 'menor_largo_consumido') {
    return [...evaluados].sort(
      (a, b) => a.result.consumedLengthMm - b.result.consumedLengthMm,
    )[0];
  }
  if (criterio === 'menor_costo_total') {
    const conCosto = evaluados.filter((e) => e.sustratoCosto != null);
    if (conCosto.length > 0) {
      return [...conCosto].sort(
        (a, b) => (a.sustratoCosto as number) - (b.sustratoCosto as number),
      )[0];
    }
    // Fallback: si ninguno tiene precio cargado, elegimos por aprovechamiento.
  }
  // mayor_aprovechamiento (default + fallback de menor_costo)
  return [...evaluados].sort(
    (a, b) => b.aprovechamientoPct - a.aprovechamientoPct,
  )[0];
}
