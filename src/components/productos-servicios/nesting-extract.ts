/**
 * Helper compartido — extrae datos de nesting desde la trazabilidad de un
 * paso canónico y los normaliza al shape que consume <NestingPreview>.
 *
 * Usado por:
 *   - producto-simular-costo-tab (cotización con totales)
 *   - producto-imposicion-tab    (previsualización focalizada en la distribución)
 *
 * Soporta los 3 algoritmos del super motor:
 *   - nesting-rollo         → { type: "rollo", rolloAnchoTotalMm, consumedLengthMm }
 *   - nesting-hoja/pliego   → { type: "pliego", anchoMm, altoMm }
 *   - nesting-placa-rigida  → { type: "placa", anchoMm, altoMm, materialLabel }
 */
import type { CotizacionCanonica } from "@/lib/productos-servicios";
import type { NestingContainer, NestingPlacement } from "@/components/nesting-preview";

function normalizePlacement(raw: Record<string, unknown>): NestingPlacement | null {
  // Shape rollo
  if (
    typeof raw.centerXMm === "number" &&
    typeof raw.centerYMm === "number" &&
    typeof raw.widthMm === "number" &&
    typeof raw.heightMm === "number"
  ) {
    const w = Number(raw.widthMm);
    const h = Number(raw.heightMm);
    return {
      x: Number(raw.centerXMm) - w / 2,
      y: Number(raw.centerYMm) - h / 2,
      anchoMm: w,
      altoMm: h,
      rotada: Boolean(raw.rotated),
      label: typeof raw.label === "string" ? raw.label : undefined,
      colorKey: typeof raw.sourcePieceId === "string" ? raw.sourcePieceId : undefined,
    };
  }
  // Shape canónico (hoja/placa-rigida)
  if (
    typeof raw.x === "number" &&
    typeof raw.y === "number" &&
    typeof raw.anchoMm === "number" &&
    typeof raw.altoMm === "number"
  ) {
    return {
      x: Number(raw.x),
      y: Number(raw.y),
      anchoMm: Number(raw.anchoMm),
      altoMm: Number(raw.altoMm),
      rotada: Boolean(raw.rotada),
      label: typeof raw.label === "string" ? raw.label : undefined,
      colorKey: typeof raw.colorKey === "string" ? raw.colorKey : undefined,
    };
  }
  return null;
}

export type NestingExtractResult = {
  container: NestingContainer;
  placements: NestingPlacement[];
  /** Resumen estadístico del algoritmo (piezas, consumo, desperdicio). */
  stats: Record<string, unknown>;
};

export function extractNestingPreview(
  paso: CotizacionCanonica["pasos"][number],
): NestingExtractResult | null {
  const traza = (paso.trazabilidad ?? {}) as Record<string, unknown>;
  const nesting = traza.nesting as Record<string, unknown> | undefined;
  if (!nesting) return null;

  const placementsRaw = nesting.placements as unknown;
  if (!Array.isArray(placementsRaw) || placementsRaw.length === 0) return null;

  const placements = placementsRaw
    .map((p) => normalizePlacement(p as Record<string, unknown>))
    .filter((p): p is NestingPlacement => p !== null);
  if (placements.length === 0) return null;

  const stats: Record<string, unknown> = {};
  for (const key of [
    "piezasPorPliego",
    "piezasPorPlaca",
    "pliegosNecesarios",
    "placasNecesarias",
    "largoConsumidoMm",
    "areaUtilizadaM2",
    "porcentajeAprovechamiento",
    "desperdicio",
  ]) {
    if (nesting[key] !== undefined) stats[key] = nesting[key];
  }

  // 1) Rollo
  const materialElegido = traza.materialElegido as Record<string, unknown> | undefined;
  if (materialElegido?.rolloAnchoMm && nesting.largoConsumidoMm) {
    const rolloAnchoMm = Number(materialElegido.rolloAnchoMm);
    const consumed = Number(nesting.largoConsumidoMm);
    return {
      container: {
        type: "rollo",
        rolloAnchoTotalMm: rolloAnchoMm,
        printableWidthMm: rolloAnchoMm,
        consumedLengthMm: consumed,
      },
      placements,
      stats,
    };
  }

  // 2) Pliego
  const pliegoElegido = nesting.pliegoElegido as Record<string, unknown> | undefined;
  if (pliegoElegido) {
    return {
      container: {
        type: "pliego",
        anchoMm: Number(pliegoElegido.anchoMm),
        altoMm: Number(pliegoElegido.altoMm),
      },
      placements,
      stats,
    };
  }

  // 3) Placa rígida
  const placaElegida = traza.placaElegida as Record<string, unknown> | undefined;
  const dims = placaElegida?.dimensionesMm as Record<string, unknown> | undefined;
  if (placaElegida && dims?.anchoMm && dims?.altoMm) {
    return {
      container: {
        type: "placa",
        anchoMm: Number(dims.anchoMm),
        altoMm: Number(dims.altoMm),
        materialLabel: (placaElegida.nombre as string) ?? undefined,
      },
      placements,
      stats,
    };
  }

  return null;
}
