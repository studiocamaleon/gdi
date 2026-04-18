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

export type NestingResultUnion =
  | { algoritmo: 'nesting-placa-rigida'; result: NestingPlacaResult }
  | { algoritmo: 'nesting-rollo'; result: NestingRolloResult }
  | { algoritmo: 'nesting-hoja'; result: NestingHojaResult };

export type PasoRuntime = {
  /** id único del paso dentro de la ruta (matchea ProcesoOperacion.id). */
  id: string;
  /** codigo de la familia en FAMILIAS_PASO. */
  familiaCodigo: string;
  /** Valor de ProcesoOperacion.configNestingV2 (Json? en el schema). */
  configNesting: Record<string, unknown> | null;
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
  maquinaMarginLeftMm?: number;
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
        paso.configNesting,
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
  configNesting: Record<string, unknown> | null,
  materialMaquina: MaterialMaquinaContext | undefined,
): NestingResultUnion | null {
  const config = configNesting ?? {};

  switch (algoritmo) {
    case 'nesting-placa-rigida': {
      // Para placa rígida, tomamos la primera medida como pieza del cálculo.
      // Multi-medida en placa es nestMultiMedida, pero para el piloto single-medida alcanza.
      const m = medidas[0];
      if (!m) return null;
      const placaAnchoMm = Number(materialMaquina?.placaAnchoMm ?? config.placaAnchoMm ?? 0);
      const placaAltoMm = Number(materialMaquina?.placaAltoMm ?? config.placaAltoMm ?? 0);
      if (placaAnchoMm <= 0 || placaAltoMm <= 0) return null;

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
      if (result.piezasPorPlaca === 0) return null;
      return { algoritmo, result };
    }

    case 'nesting-rollo': {
      const printableWidth = Number(
        materialMaquina?.maquinaPrintableWidthMm ?? config.printableWidthMm ?? 0,
      );
      if (printableWidth <= 0) return null;

      const panelizado = (config.panelizado as NestingRolloPanelizadoConfig | undefined) ?? undefined;

      const result = nestOnRoll({
        medidas,
        printableWidthMm: printableWidth,
        marginLeftMm: Number(materialMaquina?.maquinaMarginLeftMm ?? config.marginLeftMm ?? 0),
        marginStartMm: Number(materialMaquina?.maquinaMarginStartMm ?? config.marginStartMm ?? 0),
        marginEndMm: Number(materialMaquina?.maquinaMarginEndMm ?? config.marginEndMm ?? 0),
        separacionHorizontalMm: Number(config.separacionHorizontalMm ?? 0),
        separacionVerticalMm: Number(config.separacionVerticalMm ?? 0),
        permitirRotacion: Boolean(config.permitirRotacion ?? true),
        panelizado,
      });
      if (!result) return null;
      return { algoritmo, result };
    }

    case 'nesting-hoja': {
      const m = medidas[0];
      if (!m) return null;
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
      });
      if (!result) return null;
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
