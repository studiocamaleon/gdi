/**
 * Resuelve el ancho que debe sintetizar el sheet al cotizar un rollo por
 * metro lineal. El sustrato real manda sobre la boca de la máquina y se le
 * descuentan exactamente los márgenes horizontales del nesting.
 */

function numberFrom(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed =
      typeof value === "string"
        ? Number(value.replace(",", "."))
        : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type AnchoRolloLinealResuelto = {
  materialWidthMm: number;
  usableWidthMm: number;
  margins: { leftMm: number; rightMm: number };
};

export function prioridadIdsVarianteRollo(input: {
  selectionMode: string;
  hardcodedId?: string | null;
  selectedId?: string | null;
  candidateDefaultIds?: Array<string | null | undefined>;
}) {
  const ids =
    input.selectionMode === "HARDCODED"
      ? [
          input.hardcodedId,
          input.selectedId,
          ...(input.candidateDefaultIds ?? []),
        ]
      : [
          input.selectedId,
          ...(input.candidateDefaultIds ?? []),
          input.hardcodedId,
        ];
  return Array.from(
    new Set(
      ids.filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
}

export function resolverAnchoRolloLineal(input: {
  materialWidthMm?: number | null;
  machineWidthMm?: number | string | null;
  machineParams?: Record<string, unknown> | null;
  stepParams?: Record<string, unknown> | null;
}): AnchoRolloLinealResuelto | null {
  const materialWidthMm = numberFrom(input.materialWidthMm);
  const machineWidthMm = numberFrom(input.machineWidthMm);
  const rollWidthMm =
    materialWidthMm && materialWidthMm > 0
      ? materialWidthMm
      : machineWidthMm && machineWidthMm > 0
        ? machineWidthMm
        : null;
  if (!rollWidthMm) return null;

  const machineParams = record(input.machineParams);
  const machineMargins = record(machineParams.margenesNoImprimiblesMm);
  const machineUniform = numberFrom(
    machineParams.margenNoImprimibleMm,
    machineParams.margenNoImprimible,
  );
  const stepParams = record(input.stepParams);
  const nestingConfig = record(stepParams.nestingConfig);
  const overrideMargins = record(nestingConfig.margins);
  const extraMargins = record(nestingConfig.extraMargins);
  const bleedMm = Math.max(0, numberFrom(nestingConfig.pieceBleedMm) ?? 0);

  const side = (
    overrideValues: unknown[],
    legacyValues: unknown[],
    machineValues: unknown[],
    extraValues: unknown[],
  ) =>
    Math.max(
      0,
      numberFrom(...overrideValues) ??
        numberFrom(...legacyValues) ??
        numberFrom(...machineValues, machineUniform) ??
        0,
    ) +
    Math.max(0, numberFrom(...extraValues) ?? 0) +
    bleedMm;

  const margins = {
    leftMm: side(
      [overrideMargins.leftMm, overrideMargins.izq, overrideMargins.izquierdo],
      [stepParams.leftMm, stepParams.izq, stepParams.izquierdo],
      [
        machineMargins.leftMm,
        machineMargins.izq,
        machineMargins.izquierdo,
        machineMargins.left,
      ],
      [extraMargins.leftMm, extraMargins.izq],
    ),
    rightMm: side(
      [overrideMargins.rightMm, overrideMargins.der, overrideMargins.derecho],
      [stepParams.rightMm, stepParams.der, stepParams.derecho],
      [
        machineMargins.rightMm,
        machineMargins.der,
        machineMargins.derecho,
        machineMargins.right,
      ],
      [extraMargins.rightMm, extraMargins.der],
    ),
  };
  const usableWidthMm = rollWidthMm - margins.leftMm - margins.rightMm;
  if (usableWidthMm <= 0) return null;

  return { materialWidthMm: rollWidthMm, usableWidthMm, margins };
}
