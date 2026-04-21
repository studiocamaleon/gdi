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

/**
 * SM.1.d — Evaluación multi-material que el motor emite cuando el paso tiene
 * un POM con esSustratoNesting=true. El frontend usa esto para mostrar el
 * panel "Materiales evaluados" en el tab Imposición (alternativas evaluadas
 * + ganador + descartados).
 */
export type EvaluacionMultiMaterial = {
  criterio: string;
  materialElegido: {
    materialVarianteId: string;
    sku: string;
    nombre: string;
    rolloAnchoMm: number | null;
    rolloLargoM: number | null;
    precioReferencia: number | null;
    precioPorM2: number | null;
    areaConsumidaM2: number;
    aprovechamientoPct: number;
    sustratoCosto: number | null;
  } | null;
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

export type NestingExtractResult = {
  container: NestingContainer;
  placements: NestingPlacement[];
  /** Resumen estadístico del algoritmo (piezas, consumo, desperdicio). */
  stats: Record<string, unknown>;
  /** SM.1.d — Presente solo cuando el paso evaluó múltiples variantes. */
  evaluacion: EvaluacionMultiMaterial | null;
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
  // Aceptamos las dos convenciones de naming (en/es) que conviven en el motor
  // y mapeamos todo a las keys en español que consume la UI.
  for (const [keyOut, keyIn] of [
    ["piezasPorPliego", "piezasPorPliego"],
    ["piezasPorPlaca", "piezasPorPlaca"],
    ["pliegosNecesarios", "pliegosNecesarios"],
    ["placasNecesarias", "placasNecesarias"],
    ["largoConsumidoMm", "largoConsumidoMm"],
    ["largoConsumidoMm", "consumedLengthMm"],
    ["areaUtilizadaM2", "areaUtilizadaM2"],
    ["areaUtilizadaM2", "usefulAreaM2"],
    ["porcentajeAprovechamiento", "porcentajeAprovechamiento"],
    ["porcentajeAprovechamiento", "aprovechamientoPct"],
    ["desperdicio", "desperdicio"],
  ] as const) {
    if (stats[keyOut] === undefined && nesting[keyIn] !== undefined) {
      stats[keyOut] = nesting[keyIn];
    }
  }

  // Discriminamos por algoritmo si está presente — más robusto que adivinar
  // por presencia de campos.
  const algoritmo = typeof nesting.algoritmo === "string" ? nesting.algoritmo : null;
  const materialElegido = traza.materialElegido as Record<string, unknown> | undefined;
  const consumedLengthMm = Number(
    nesting.consumedLengthMm ?? nesting.largoConsumidoMm ?? 0,
  );

  // SM.1.d — Extracción de evaluacion multi-material si el motor la emitió.
  const evaluacion: EvaluacionMultiMaterial | null = (() => {
    const matsEval = nesting.materialesEvaluados;
    if (!Array.isArray(matsEval) || matsEval.length === 0) return null;
    const ganador = nesting.materialElegido as Record<string, unknown> | null;
    const descartados = Array.isArray(nesting.materialesDescartados)
      ? (nesting.materialesDescartados as Array<Record<string, unknown>>)
      : [];
    return {
      criterio: typeof nesting.criterioAplicado === "string"
        ? nesting.criterioAplicado
        : "mayor_aprovechamiento",
      materialElegido: ganador
        ? {
            materialVarianteId: String(ganador.materialVarianteId ?? ""),
            sku: String(ganador.sku ?? ""),
            nombre: String(ganador.nombre ?? ""),
            rolloAnchoMm: ganador.rolloAnchoMm != null ? Number(ganador.rolloAnchoMm) : null,
            rolloLargoM: ganador.rolloLargoM != null ? Number(ganador.rolloLargoM) : null,
            precioReferencia:
              ganador.precioReferencia != null ? Number(ganador.precioReferencia) : null,
            precioPorM2: ganador.precioPorM2 != null ? Number(ganador.precioPorM2) : null,
            areaConsumidaM2: Number(ganador.areaConsumidaM2 ?? 0),
            aprovechamientoPct: Number(ganador.aprovechamientoPct ?? 0),
            sustratoCosto:
              ganador.sustratoCosto != null ? Number(ganador.sustratoCosto) : null,
          }
        : null,
      materialesEvaluados: matsEval.map((e) => {
        const r = e as Record<string, unknown>;
        return {
          materialVarianteId: String(r.materialVarianteId ?? ""),
          sku: String(r.sku ?? ""),
          nombre: String(r.nombre ?? ""),
          rolloAnchoMm: r.rolloAnchoMm != null ? Number(r.rolloAnchoMm) : null,
          aprovechamientoPct: Number(r.aprovechamientoPct ?? 0),
          largoConsumidoMm: Number(r.largoConsumidoMm ?? 0),
          sustratoCosto: r.sustratoCosto != null ? Number(r.sustratoCosto) : null,
          esGanador: Boolean(r.esGanador),
        };
      }),
      materialesDescartados: descartados.map((d) => ({
        sku: String(d.sku ?? ""),
        nombre: String(d.nombre ?? d.sku ?? ""),
        motivo: String(d.motivo ?? ""),
        rolloAnchoMm: d.rolloAnchoMm != null ? Number(d.rolloAnchoMm) : null,
      })),
    };
  })();

  // 1) Rollo
  if (
    algoritmo === "nesting-rollo" ||
    (algoritmo === null && consumedLengthMm > 0)
  ) {
    const rolloAnchoMm = Number(
      nesting.rolloAnchoMm ??
        nesting.printableWidthMm ??
        materialElegido?.rolloAnchoMm ??
        0,
    );
    // Printable real (puede ser < rolloAncho cuando hay márgenes laterales).
    // Si el backend no lo expone, asumimos = rolloAncho (sin márgenes).
    const printableWidthMm = Number(
      nesting.printableWidthMm ?? rolloAnchoMm,
    );
    const marginLeftMm = Number(nesting.marginLeftMm ?? 0);
    const marginStartMm = Number(nesting.marginStartMm ?? 0);
    const marginEndMm = Number(nesting.marginEndMm ?? 0);
    if (rolloAnchoMm > 0 && consumedLengthMm > 0) {
      return {
        container: {
          type: "rollo",
          rolloAnchoTotalMm: rolloAnchoMm,
          printableWidthMm,
          consumedLengthMm,
          marginLeftMm,
          marginStartMm,
          marginEndMm,
        },
        placements,
        stats,
        evaluacion,
      };
    }
  }

  // 2) Pliego
  const pliegoElegido = nesting.pliegoElegido as Record<string, unknown> | undefined;
  if ((algoritmo === "nesting-hoja" || algoritmo === null) && pliegoElegido) {
    return {
      container: {
        type: "pliego",
        anchoMm: Number(pliegoElegido.anchoMm),
        altoMm: Number(pliegoElegido.altoMm),
      },
      placements,
      stats,
      evaluacion,
    };
  }

  // 3) Placa rígida
  const placaElegida = traza.placaElegida as Record<string, unknown> | undefined;
  const dims = placaElegida?.dimensionesMm as Record<string, unknown> | undefined;
  if (
    (algoritmo === "nesting-placa-rigida" || algoritmo === null) &&
    placaElegida &&
    dims?.anchoMm &&
    dims?.altoMm
  ) {
    return {
      container: {
        type: "placa",
        anchoMm: Number(dims.anchoMm),
        altoMm: Number(dims.altoMm),
        materialLabel: (placaElegida.nombre as string) ?? undefined,
      },
      placements,
      stats,
      evaluacion,
    };
  }

  return null;
}
