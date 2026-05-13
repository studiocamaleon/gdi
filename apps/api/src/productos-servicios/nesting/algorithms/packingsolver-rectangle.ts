import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  NestingOptions,
  Piece,
  Placement,
  SheetSubstrate,
  SubstrateUsage,
} from '../types';
import type { Grid2DMultiResult } from './grid-2d-multi';

export interface PackingSolverRectangleOptions extends NestingOptions {
  /**
   * Ruta explícita al binario. Si no se informa, se usa
   * PACKINGSOLVER_RECTANGLE_BIN o `packingsolver_rectangle` del PATH.
   */
  binaryPath?: string | null;
  /** Tiempo máximo de búsqueda del solver en segundos. */
  timeLimitSec?: number;
  /** Segmentos candidatos de altura de placa para optimizar largo/costo. */
  binHeightSegmentsPct?: number[];
}

interface ExpandedPiece<T> {
  pieceId: string;
  originalWidthMm: number;
  originalHeightMm: number;
  solverWidthMm: number;
  solverHeightMm: number;
  meta?: T;
}

interface CertificateRow {
  TYPE?: string;
  ID?: string;
  COPIES?: string;
  BIN?: string;
  X?: string;
  Y?: string;
  LX?: string;
  LY?: string;
}

/**
 * Adapter del solver externo PackingSolver Rectangle.
 *
 * Importante: lo usamos sólo para placas rígidas. Para representar separación
 * entre piezas, cada item viaja al solver "inflado" con sepH/sepV; al volver,
 * reconstruimos el tamaño real de la pieza y mantenemos la separación como
 * espacio vacío entre placements.
 */
export function nestPackingSolverRectangle<T = unknown>(
  pieces: Piece<T>[],
  substrate: SheetSubstrate,
  options: PackingSolverRectangleOptions = {},
): Grid2DMultiResult<T> | null {
  const binaryPath = resolveBinaryPath(options.binaryPath);
  if (!binaryPath) return null;

  const sepHMm = options.separationHMm ?? 0;
  const sepVMm = options.separationVMm ?? 0;
  const allowRotation = options.allowRotation ?? true;
  const m = substrate.margins ?? {};
  const marginLeftMm = m.leftMm ?? 0;
  const marginRightMm = m.rightMm ?? marginLeftMm;
  const marginTopMm = m.topMm ?? 0;
  const marginBottomMm = m.bottomMm ?? marginTopMm;
  const usableWidthMm = substrate.widthMm - marginLeftMm - marginRightMm;
  const usableHeightMm = substrate.heightMm - marginTopMm - marginBottomMm;
  if (usableWidthMm <= 0 || usableHeightMm <= 0) return null;

  const expanded: ExpandedPiece<T>[] = [];
  for (const piece of pieces) {
    if (piece.widthMm <= 0 || piece.heightMm <= 0 || piece.quantity <= 0)
      continue;
    for (let i = 0; i < piece.quantity; i++) {
      expanded.push({
        pieceId: piece.id,
        originalWidthMm: piece.widthMm,
        originalHeightMm: piece.heightMm,
        solverWidthMm: piece.widthMm + sepHMm,
        solverHeightMm: piece.heightMm + sepVMm,
        meta: piece.meta,
      });
    }
  }
  if (expanded.length === 0) return null;

  const workdir = mkdtempSync(join(tmpdir(), 'gdi-packingsolver-'));
  const itemsPath = join(workdir, 'items.csv');
  const binsPath = join(workdir, 'bins.csv');
  const parametersPath = join(workdir, 'parameters.csv');
  const certificatePath = join(workdir, 'solution.csv');

  try {
    writeFileSync(
      itemsPath,
      [
        'WIDTH,HEIGHT,COPIES,ORIENTED,PROFIT',
        ...expanded.map((piece) =>
          [
            toSolverInt(piece.solverWidthMm),
            toSolverInt(piece.solverHeightMm),
            1,
            allowRotation ? 0 : 1,
            toSolverInt(piece.originalWidthMm * piece.originalHeightMm),
          ].join(','),
        ),
      ].join('\n'),
    );
    const binHeightSegmentsPct = normalizeSegments(options.binHeightSegmentsPct);
    writeFileSync(
      binsPath,
      [
        'WIDTH,HEIGHT,COPIES,COST',
        ...binHeightSegmentsPct.map((pct) => {
          const heightMm = usableHeightMm * (pct / 100);
          const proportionalCost =
            substrate.widthMm * substrate.heightMm * (pct / 100);
          const fixedBinPenalty = substrate.widthMm * substrate.heightMm * 0.001;
          return [
            toSolverInt(usableWidthMm + sepHMm),
            toSolverInt(heightMm + sepVMm),
            expanded.length,
            toSolverInt(proportionalCost + fixedBinPenalty),
          ].join(',');
        }),
      ].join('\n'),
    );
    writeFileSync(
      parametersPath,
      [
        'NAME,VALUE',
        binHeightSegmentsPct.length > 1
          ? 'objective,variable-sized-bin-packing'
          : 'objective,bin-packing-with-leftovers',
      ].join('\n'),
    );

    execFileSync(
      binaryPath,
      [
        '--verbosity-level',
        '0',
        '--items',
        itemsPath,
        '--bins',
        binsPath,
        '--parameters',
        parametersPath,
        '--certificate',
        certificatePath,
        '--time-limit',
        String(options.timeLimitSec ?? 2),
        '--only-write-at-the-end',
      ],
      { stdio: 'pipe', timeout: Math.max(1, options.timeLimitSec ?? 2) * 1500 },
    );

    const rows = parseCsv(readFileSync(certificatePath, 'utf8'));
    const placements: Placement<T>[] = [];
    const binCopies = new Map<number, number>();
    let substrateOffset = 0;
    for (const row of rows) {
      if (row.TYPE !== 'BIN') continue;
      const binIndex = Number(row.BIN ?? 0);
      const copies = Math.max(1, Number(row.COPIES ?? 1));
      binCopies.set(binIndex, copies);
      substrateOffset += copies;
    }

    const perSubstrateMap = new Map<
      number,
      { areaUtilMm2: number; consumedLengthMm: number }
    >();
    let totalAreaUtilMm2 = 0;
    const binBaseIndex = new Map<number, number>();
    let nextBaseIndex = 0;
    for (const [binIndex, copies] of Array.from(binCopies.entries()).sort(
      ([a], [b]) => a - b,
    )) {
      binBaseIndex.set(binIndex, nextBaseIndex);
      nextBaseIndex += copies;
    }

    for (const row of rows) {
      if (row.TYPE !== 'ITEM') continue;
      const itemIndex = Number(row.ID);
      const item = expanded[itemIndex];
      if (!item) continue;
      const binIndex = Number(row.BIN ?? 0);
      const copies = Math.max(1, Number(row.COPIES ?? 1));
      const lx = Number(row.LX ?? 0);
      const ly = Number(row.LY ?? 0);
      const rotated =
        allowRotation &&
        roughlyEqual(lx, item.solverHeightMm) &&
        roughlyEqual(ly, item.solverWidthMm);
      const widthMm = rotated ? item.originalHeightMm : item.originalWidthMm;
      const heightMm = rotated ? item.originalWidthMm : item.originalHeightMm;
      const xMm = marginLeftMm + Number(row.X ?? 0);
      const yMm = marginTopMm + Number(row.Y ?? 0);
      const areaMm2 = item.originalWidthMm * item.originalHeightMm;

      const baseIndex = binBaseIndex.get(binIndex) ?? binIndex;
      for (let copy = 0; copy < copies; copy++) {
        const substrateIndex = baseIndex + copy;
        placements.push({
          pieceId: item.pieceId,
          substrateIndex,
          xMm,
          yMm,
          widthMm,
          heightMm,
          rotated,
          meta: item.meta,
        });
        totalAreaUtilMm2 += areaMm2;

        const current = perSubstrateMap.get(substrateIndex) ?? {
          areaUtilMm2: 0,
          consumedLengthMm: 0,
        };
        current.areaUtilMm2 += areaMm2;
        current.consumedLengthMm = Math.max(
          current.consumedLengthMm,
          yMm + heightMm + marginBottomMm,
        );
        perSubstrateMap.set(substrateIndex, current);
      }
    }

    if (placements.length !== expanded.length) return null;

    const substrateCount = Math.max(substrateOffset, perSubstrateMap.size);
    const substrates: SubstrateUsage[] = Array.from({ length: substrateCount }).map(() => ({
      kind: 'sheet',
      count: 1,
      widthMm: substrate.widthMm,
      heightMm: substrate.heightMm,
    }));
    const perSubstrate = substrates.map(
      (_, idx) =>
        perSubstrateMap.get(idx) ?? { areaUtilMm2: 0, consumedLengthMm: 0 },
    );
    const areaTotalMm2 = substrate.widthMm * substrate.heightMm * substrates.length;
    const aprovechamientoPct =
      areaTotalMm2 > 0
        ? Math.round((totalAreaUtilMm2 / areaTotalMm2) * 10000) / 100
        : 0;

    const initialResult: Grid2DMultiResult<T> = {
      algorithm: 'packingsolver-rectangle',
      substrates,
      placements,
      metrics: {
        aprovechamientoPct,
        areaUtilMm2: totalAreaUtilMm2,
        areaTotalMm2,
      },
      perSubstrate,
    };
    return compactResultWithOpenDimensionY({
      binaryPath,
      result: initialResult,
      substrate,
      segmentSteps: binHeightSegmentsPct,
      marginLeftMm,
      marginRightMm,
      marginTopMm,
      marginBottomMm,
      sepHMm,
      sepVMm,
      allowRotation,
      timeLimitSec: Math.min(1, options.timeLimitSec ?? 2),
    });
  } catch {
    return null;
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

function compactResultWithOpenDimensionY<T>(input: {
  binaryPath: string;
  result: Grid2DMultiResult<T>;
  substrate: SheetSubstrate;
  segmentSteps: number[];
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  sepHMm: number;
  sepVMm: number;
  allowRotation: boolean;
  timeLimitSec: number;
}): Grid2DMultiResult<T> {
  if (input.result.substrates.length === 0) return input.result;

  const compactedPlacements: Placement<T>[] = [];
  const compactedPerSubstrate: Grid2DMultiResult<T>['perSubstrate'] = [];

  for (let substrateIndex = 0; substrateIndex < input.result.substrates.length; substrateIndex++) {
    const placements = input.result.placements.filter(
      (placement) => (placement.substrateIndex ?? 0) === substrateIndex,
    );
    const compacted = solveOpenDimensionYForPlacements({
      ...input,
      placements,
      substrateIndex,
    });
    if (!compacted) return input.result;
    compactedPlacements.push(...compacted.placements);
    compactedPerSubstrate.push(compacted.perSubstrate);
  }

  const initialScore = totalConsumedLength(input.result.perSubstrate);
  const compactedScore = totalConsumedLength(compactedPerSubstrate);
  const meaningfulImprovementMm = Math.max(25, input.sepVMm * 2);
  const compactedResult =
    compactedScore > 0 &&
    initialScore - compactedScore >= meaningfulImprovementMm
      ? {
          ...input.result,
          placements: compactedPlacements,
          perSubstrate: compactedPerSubstrate,
        }
      : input.result;

  return rebalanceAcrossSubstrates({
    ...input,
    result: compactedResult,
  });
}

function rebalanceAcrossSubstrates<T>(input: {
  binaryPath: string;
  result: Grid2DMultiResult<T>;
  substrate: SheetSubstrate;
  segmentSteps: number[];
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  sepHMm: number;
  sepVMm: number;
  allowRotation: boolean;
  timeLimitSec: number;
}): Grid2DMultiResult<T> {
  if (input.result.substrates.length <= 1) return input.result;

  let groups = groupPlacementsBySubstrate(input.result);
  let currentScore = scorePlacementGroups(
    groups,
    input.substrate.heightMm,
    input.segmentSteps,
  );
  let changed = true;

  while (changed) {
    changed = false;
    for (let sourceIndex = groups.length - 1; sourceIndex > 0; sourceIndex--) {
      const source = groups[sourceIndex] ?? [];
      const candidates = [...source].sort(
        (a, b) => a.widthMm * a.heightMm - b.widthMm * b.heightMm,
      );

      for (const candidate of candidates) {
        const candidatePos = source.indexOf(candidate);
        if (candidatePos < 0) continue;

        for (let targetIndex = 0; targetIndex < sourceIndex; targetIndex++) {
          const target = groups[targetIndex] ?? [];
          const nextTargetInput = [...target, { ...candidate, substrateIndex: targetIndex }];
          const nextSourceInput = source
            .filter((item) => item !== candidate)
            .map((item) => ({ ...item, substrateIndex: sourceIndex }));

          const packedTarget = solveOpenDimensionYForPlacements({
            ...input,
            placements: nextTargetInput,
            substrateIndex: targetIndex,
          });
          if (!packedTarget) continue;

          const packedSource = solveOpenDimensionYForPlacements({
            ...input,
            placements: nextSourceInput,
            substrateIndex: sourceIndex,
          });
          if (!packedSource) continue;

          const nextGroups = groups.map((group) => [...group]);
          nextGroups[targetIndex] = packedTarget.placements;
          nextGroups[sourceIndex] = packedSource.placements;
          const normalizedGroups = trimTrailingEmptyGroups(nextGroups);
          const nextScore = scorePlacementGroups(
            normalizedGroups,
            input.substrate.heightMm,
            input.segmentSteps,
          );

          if (isBetterDistribution(nextScore, currentScore)) {
            groups = normalizedGroups;
            currentScore = nextScore;
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
      if (changed) break;
    }
  }

  const placements = groups.flatMap((group, substrateIndex) =>
    group.map((placement) => ({ ...placement, substrateIndex })),
  );
  const perSubstrate = groups.map((group) => summarizePlacements(group));
  return {
    ...input.result,
    substrates: groups.map(() => ({
      kind: 'sheet' as const,
      count: 1,
      widthMm: input.substrate.widthMm,
      heightMm: input.substrate.heightMm,
    })),
    placements,
    perSubstrate,
    metrics: {
      ...input.result.metrics,
      areaTotalMm2: input.substrate.widthMm * input.substrate.heightMm * groups.length,
      aprovechamientoPct:
        groups.length > 0
          ? Math.round(
              (input.result.metrics.areaUtilMm2 /
                (input.substrate.widthMm * input.substrate.heightMm * groups.length)) *
                10000,
            ) / 100
          : 0,
    },
  };
}

function solveOpenDimensionYForPlacements<T>(input: {
  binaryPath: string;
  substrate: SheetSubstrate;
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  sepHMm: number;
  sepVMm: number;
  allowRotation: boolean;
  timeLimitSec: number;
  placements: Placement<T>[];
  substrateIndex: number;
}): {
  placements: Placement<T>[];
  perSubstrate: { areaUtilMm2: number; consumedLengthMm: number };
} | null {
  if (input.placements.length === 0) {
    return { placements: [], perSubstrate: { areaUtilMm2: 0, consumedLengthMm: 0 } };
  }

  const usableWidthMm =
    input.substrate.widthMm - input.marginLeftMm - input.marginRightMm;
  const usableHeightMm =
    input.substrate.heightMm - input.marginTopMm - input.marginBottomMm;
  if (usableWidthMm <= 0 || usableHeightMm <= 0) return null;

  const expanded = input.placements.map((placement) => ({
    pieceId: placement.pieceId,
    originalWidthMm: placement.rotated ? placement.heightMm : placement.widthMm,
    originalHeightMm: placement.rotated ? placement.widthMm : placement.heightMm,
    solverWidthMm:
      (placement.rotated ? placement.heightMm : placement.widthMm) + input.sepHMm,
    solverHeightMm:
      (placement.rotated ? placement.widthMm : placement.heightMm) + input.sepVMm,
    meta: placement.meta,
  }));

  const workdir = mkdtempSync(join(tmpdir(), 'gdi-packingsolver-compact-'));
  const itemsPath = join(workdir, 'items.csv');
  const binsPath = join(workdir, 'bins.csv');
  const parametersPath = join(workdir, 'parameters.csv');
  const certificatePath = join(workdir, 'solution.csv');

  try {
    writeFileSync(
      itemsPath,
      [
        'WIDTH,HEIGHT,COPIES,ORIENTED,PROFIT',
        ...expanded.map((piece) =>
          [
            toSolverInt(piece.solverWidthMm),
            toSolverInt(piece.solverHeightMm),
            1,
            input.allowRotation ? 0 : 1,
            toSolverInt(piece.originalWidthMm * piece.originalHeightMm),
          ].join(','),
        ),
      ].join('\n'),
    );
    writeFileSync(
      binsPath,
      [
        'WIDTH,HEIGHT,COPIES',
        [
          toSolverInt(usableWidthMm + input.sepHMm),
          toSolverInt(usableHeightMm + input.sepVMm),
          1,
        ].join(','),
      ].join('\n'),
    );
    writeFileSync(
      parametersPath,
      ['NAME,VALUE', 'objective,open-dimension-y'].join('\n'),
    );
    execFileSync(
      input.binaryPath,
      [
        '--verbosity-level',
        '0',
        '--items',
        itemsPath,
        '--bins',
        binsPath,
        '--parameters',
        parametersPath,
        '--certificate',
        certificatePath,
        '--time-limit',
        String(input.timeLimitSec),
        '--only-write-at-the-end',
      ],
      {
        stdio: 'pipe',
        timeout: Math.max(1, input.timeLimitSec) * 1500,
      },
    );

    const rows = parseCsv(readFileSync(certificatePath, 'utf8')).filter(
      (row) => row.TYPE === 'ITEM',
    );
    const compactedPlacements: Placement<T>[] = [];
    let areaUtilMm2 = 0;
    let consumedLengthMm = 0;

    for (const row of rows) {
      const itemIndex = Number(row.ID);
      const item = expanded[itemIndex];
      if (!item) continue;
      const copies = Math.max(1, Number(row.COPIES ?? 1));
      const lx = Number(row.LX ?? 0);
      const ly = Number(row.LY ?? 0);
      const rotated =
        input.allowRotation &&
        roughlyEqual(lx, item.solverHeightMm) &&
        roughlyEqual(ly, item.solverWidthMm);
      const widthMm = rotated ? item.originalHeightMm : item.originalWidthMm;
      const heightMm = rotated ? item.originalWidthMm : item.originalHeightMm;
      const xMm = input.marginLeftMm + Number(row.X ?? 0);
      const yMm = input.marginTopMm + Number(row.Y ?? 0);

      for (let copy = 0; copy < copies; copy++) {
        compactedPlacements.push({
          pieceId: item.pieceId,
          substrateIndex: input.substrateIndex,
          xMm,
          yMm,
          widthMm,
          heightMm,
          rotated,
          meta: item.meta,
        });
        areaUtilMm2 += item.originalWidthMm * item.originalHeightMm;
        consumedLengthMm = Math.max(
          consumedLengthMm,
          yMm + heightMm + input.marginBottomMm,
        );
      }
    }

    if (compactedPlacements.length !== input.placements.length) return null;
    return {
      placements: compactedPlacements,
      perSubstrate: { areaUtilMm2, consumedLengthMm },
    };
  } catch {
    return null;
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

function totalConsumedLength(
  perSubstrate: Grid2DMultiResult['perSubstrate'],
): number {
  return perSubstrate.reduce((acc, item) => acc + item.consumedLengthMm, 0);
}

function groupPlacementsBySubstrate<T>(
  result: Grid2DMultiResult<T>,
): Placement<T>[][] {
  const groups = Array.from({ length: result.substrates.length }, () => [] as Placement<T>[]);
  for (const placement of result.placements) {
    const substrateIndex = placement.substrateIndex ?? 0;
    if (!groups[substrateIndex]) groups[substrateIndex] = [];
    groups[substrateIndex].push(placement);
  }
  return trimTrailingEmptyGroups(groups);
}

function trimTrailingEmptyGroups<T>(groups: Placement<T>[][]): Placement<T>[][] {
  let end = groups.length;
  while (end > 1 && (groups[end - 1]?.length ?? 0) === 0) end--;
  return groups.slice(0, end);
}

function summarizePlacements<T>(
  placements: Placement<T>[],
): { areaUtilMm2: number; consumedLengthMm: number } {
  return placements.reduce(
    (summary, placement) => ({
      areaUtilMm2: summary.areaUtilMm2 + placement.widthMm * placement.heightMm,
      consumedLengthMm: Math.max(
        summary.consumedLengthMm,
        placement.yMm + placement.heightMm,
      ),
    }),
    { areaUtilMm2: 0, consumedLengthMm: 0 },
  );
}

function scorePlacementGroups<T>(
  groups: Placement<T>[][],
  substrateHeightMm: number,
  segmentSteps: number[],
) {
  const summaries = groups.map((group) => summarizePlacements(group));
  return {
    substrateCount: groups.filter((group) => group.length > 0).length,
    // Menor es mejor: concentra área en placas anteriores y deja el sobrante
    // en las últimas placas. Esta es la lógica operativa deseada para rígidos.
    areaMass: groups.reduce(
      (acc, group, substrateIndex) =>
        acc +
        group.reduce(
          (groupAcc, placement) =>
            groupAcc + placement.widthMm * placement.heightMm * substrateIndex,
          0,
        ),
      0,
    ),
    segmentCost: summaries.reduce(
      (acc, summary) =>
        acc + segmentForConsumedLength(summary.consumedLengthMm, substrateHeightMm, segmentSteps),
      0,
    ),
    totalConsumedLengthMm: summaries.reduce(
      (acc, summary) => acc + summary.consumedLengthMm,
      0,
    ),
    distributionMass: groups.reduce(
      (acc, group, substrateIndex) => acc + group.length * substrateIndex,
      0,
    ),
  };
}

function segmentForConsumedLength(
  consumedLengthMm: number,
  substrateHeightMm: number,
  segmentSteps: number[],
): number {
  if (consumedLengthMm <= 0 || substrateHeightMm <= 0) return 0;
  const occupationPct = (consumedLengthMm / substrateHeightMm) * 100;
  return segmentSteps.find((step) => step >= occupationPct) ?? 100;
}

function isBetterDistribution(
  next: ReturnType<typeof scorePlacementGroups>,
  current: ReturnType<typeof scorePlacementGroups>,
): boolean {
  if (next.substrateCount < current.substrateCount) return true;
  if (next.substrateCount > current.substrateCount) return false;
  if (next.areaMass < current.areaMass) return true;
  if (next.areaMass > current.areaMass) return false;
  if (next.totalConsumedLengthMm + 25 < current.totalConsumedLengthMm) return true;
  if (next.totalConsumedLengthMm > current.totalConsumedLengthMm + 25) return false;
  if (next.segmentCost < current.segmentCost) return true;
  if (next.segmentCost > current.segmentCost) return false;
  return next.distributionMass < current.distributionMass;
}

function resolveBinaryPath(explicitPath?: string | null): string | null {
  const configured =
    explicitPath ??
    process.env.PACKINGSOLVER_RECTANGLE_BIN ??
    process.env.PACKINGSOLVER_BIN;
  if (configured) return existsSync(configured) ? configured : null;

  const localBuildCandidates = [
    join(
      process.cwd(),
      '.tmp/packingsolver-src/build/src/rectangle/packingsolver_rectangle',
    ),
    join(
      process.cwd(),
      '../..',
      '.tmp/packingsolver-src/build/src/rectangle/packingsolver_rectangle',
    ),
  ];
  const localBuild = localBuildCandidates.find((candidate) =>
    existsSync(candidate),
  );
  if (localBuild) return localBuild;

  try {
    return execFileSync('/usr/bin/which', ['packingsolver_rectangle'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function toSolverInt(value: number): number {
  return Math.max(1, Math.round(value));
}

function roughlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1;
}

function parseCsv(text: string): CertificateRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [headerLine, ...body] = lines;
  if (!headerLine) return [];
  const headers = headerLine.split(',');
  return body.map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(
      headers.map((header, idx) => [header, cells[idx] ?? '']),
    ) as CertificateRow;
  });
}

function normalizeSegments(value: number[] | undefined): number[] {
  const source = value && value.length > 0 ? value : [100];
  return Array.from(
    new Set(
      source
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0 && item <= 100)
        .map((item) => Math.round(item * 100) / 100),
    ),
  ).sort((a, b) => a - b);
}
