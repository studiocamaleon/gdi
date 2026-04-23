"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeManualLayout = normalizeManualLayout;
exports.nestOnRoll = nestOnRoll;
function getNullableNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return null;
}
function buildPieceInstances(medidas) {
    return medidas
        .flatMap((medida, medidaIndex) => Array.from({ length: Math.max(1, medida.cantidad) }, (_, copyIndex) => ({
        id: `piece-${medidaIndex}-${copyIndex}`,
        sourcePieceId: `piece-${medidaIndex}-${copyIndex}`,
        originalWidthMm: medida.anchoMm,
        originalHeightMm: medida.altoMm,
        widthMm: medida.anchoMm,
        heightMm: medida.altoMm,
        usefulWidthMm: medida.anchoMm,
        usefulHeightMm: medida.altoMm,
        overlapStartMm: 0,
        overlapEndMm: 0,
        area: medida.anchoMm * medida.altoMm,
        longestSide: Math.max(medida.anchoMm, medida.altoMm),
        shortestSide: Math.min(medida.anchoMm, medida.altoMm),
        panelIndex: null,
        panelCount: null,
        panelAxis: null,
    })))
        .sort((a, b) => b.longestSide - a.longestSide ||
        b.area - a.area ||
        b.shortestSide - a.shortestSide);
}
function buildPanelizedPieces(input) {
    const pieces = [];
    const buildSplitSizes = (totalMm, panelCount, maxUsefulWidthMm) => {
        if (input.distribution === 'libre') {
            const sizes = [];
            let remaining = totalMm;
            for (let index = 0; index < panelCount; index += 1) {
                const segmentsLeft = panelCount - index;
                if (segmentsLeft === 1) {
                    sizes.push(remaining);
                    break;
                }
                const next = Math.min(maxUsefulWidthMm, remaining - (segmentsLeft - 1));
                sizes.push(next);
                remaining -= next;
            }
            return sizes;
        }
        const base = Math.floor(totalMm / panelCount);
        const remainder = totalMm % panelCount;
        return Array.from({ length: panelCount }, (_, index) => base + (index < remainder ? 1 : 0));
    };
    for (const [medidaIndex, medida] of input.medidas.entries()) {
        for (let copyIndex = 0; copyIndex < Math.max(1, medida.cantidad); copyIndex += 1) {
            const sourcePieceId = `piece-${medidaIndex}-${copyIndex}`;
            const splitDimension = input.panelAxis === 'vertical' ? medida.anchoMm : medida.altoMm;
            const effectivePhysicalLimitMm = Math.min(input.maxPanelWidthMm, input.printableWidthMm);
            const maxOverlapPerPanelMm = input.overlapMm * 2;
            const effectiveUsefulLimitMm = input.widthInterpretation === 'total'
                ? effectivePhysicalLimitMm - maxOverlapPerPanelMm
                : effectivePhysicalLimitMm;
            if (effectiveUsefulLimitMm <= 0)
                return null;
            if (splitDimension <= effectiveUsefulLimitMm)
                return null;
            const panelCountResolved = Math.max(2, Math.ceil(splitDimension / effectiveUsefulLimitMm));
            const panelSizes = buildSplitSizes(splitDimension, panelCountResolved, effectiveUsefulLimitMm);
            const fits = panelSizes.every((segment, index) => {
                const extraStart = index === 0 ? 0 : input.overlapMm;
                const extraEnd = index === panelCountResolved - 1 ? 0 : input.overlapMm;
                const physicalSize = segment + extraStart + extraEnd;
                const withinConfiguredLimit = input.widthInterpretation === 'total'
                    ? physicalSize <= effectivePhysicalLimitMm
                    : segment <= effectivePhysicalLimitMm;
                return withinConfiguredLimit && physicalSize <= input.printableWidthMm;
            });
            if (!fits)
                return null;
            panelSizes.forEach((segment, index) => {
                const extraStart = index === 0 ? 0 : input.overlapMm;
                const extraEnd = index === panelCountResolved - 1 ? 0 : input.overlapMm;
                const widthMm = input.panelAxis === 'vertical' ? segment + extraStart + extraEnd : medida.anchoMm;
                const heightMm = input.panelAxis === 'horizontal' ? segment + extraStart + extraEnd : medida.altoMm;
                pieces.push({
                    id: `${sourcePieceId}-panel-${index + 1}`,
                    sourcePieceId,
                    originalWidthMm: medida.anchoMm,
                    originalHeightMm: medida.altoMm,
                    widthMm,
                    heightMm,
                    usefulWidthMm: input.panelAxis === 'vertical' ? segment : medida.anchoMm,
                    usefulHeightMm: input.panelAxis === 'horizontal' ? segment : medida.altoMm,
                    overlapStartMm: extraStart,
                    overlapEndMm: extraEnd,
                    panelIndex: index + 1,
                    panelCount: panelCountResolved,
                    panelAxis: input.panelAxis,
                    area: medida.anchoMm * medida.altoMm,
                    longestSide: Math.max(widthMm, heightMm),
                    shortestSide: Math.min(widthMm, heightMm),
                });
            });
        }
    }
    return pieces.sort((a, b) => b.longestSide - a.longestSide ||
        b.area - a.area ||
        b.shortestSide - a.shortestSide);
}
function normalizeManualLayout(value) {
    const itemsRaw = Array.isArray(value?.items) ? value.items : null;
    if (!itemsRaw?.length)
        return null;
    const items = itemsRaw
        .map((item) => {
        const current = item;
        const panelsRaw = Array.isArray(current.panels) ? current.panels : [];
        const sourcePieceId = typeof current.sourcePieceId === 'string' ? current.sourcePieceId.trim() : '';
        const axis = current.axis === 'horizontal' ? 'horizontal' : current.axis === 'vertical' ? 'vertical' : null;
        const pieceWidthMm = getNullableNumber(current.pieceWidthMm);
        const pieceHeightMm = getNullableNumber(current.pieceHeightMm);
        const panels = panelsRaw
            .map((panel) => {
            const currentPanel = panel;
            return {
                panelIndex: Math.max(1, Number(currentPanel.panelIndex ?? 1)),
                usefulWidthMm: getNullableNumber(currentPanel.usefulWidthMm) ?? 0,
                usefulHeightMm: getNullableNumber(currentPanel.usefulHeightMm) ?? 0,
                overlapStartMm: getNullableNumber(currentPanel.overlapStartMm) ?? 0,
                overlapEndMm: getNullableNumber(currentPanel.overlapEndMm) ?? 0,
                finalWidthMm: getNullableNumber(currentPanel.finalWidthMm) ?? 0,
                finalHeightMm: getNullableNumber(currentPanel.finalHeightMm) ?? 0,
            };
        })
            .filter((panel) => panel.finalWidthMm > 0 && panel.finalHeightMm > 0)
            .sort((a, b) => a.panelIndex - b.panelIndex);
        if (!sourcePieceId || !axis || !pieceWidthMm || !pieceHeightMm || !panels.length) {
            return null;
        }
        return {
            sourcePieceId,
            pieceWidthMm,
            pieceHeightMm,
            axis: axis,
            panels,
        };
    })
        .filter((item) => item != null);
    return items.length ? { items } : null;
}
function buildManualPieces(input) {
    const expectedPieces = buildPieceInstances(input.medidas);
    if (expectedPieces.length !== input.manualLayout.items.length)
        return null;
    const byId = new Map(input.manualLayout.items.map((item) => [item.sourcePieceId, item]));
    const pieces = [];
    for (const sourcePiece of expectedPieces) {
        const layout = byId.get(sourcePiece.sourcePieceId);
        if (!layout)
            return null;
        const expectedTotal = layout.axis === 'vertical' ? sourcePiece.originalWidthMm : sourcePiece.originalHeightMm;
        const usefulTotal = layout.panels.reduce((acc, panel) => acc + (layout.axis === 'vertical' ? panel.usefulWidthMm : panel.usefulHeightMm), 0);
        if (Math.abs(usefulTotal - expectedTotal) > 1)
            return null;
        for (const panel of layout.panels) {
            const physicalLimitOk = input.widthInterpretation === 'total'
                ? (layout.axis === 'vertical' ? panel.finalWidthMm : panel.finalHeightMm) <= input.maxPanelWidthMm
                : (layout.axis === 'vertical' ? panel.usefulWidthMm : panel.usefulHeightMm) <= input.maxPanelWidthMm;
            const printableFit = (layout.axis === 'vertical' ? panel.finalWidthMm : panel.finalHeightMm) <= input.printableWidthMm;
            if (panel.usefulWidthMm <= 0 ||
                panel.usefulHeightMm <= 0 ||
                panel.finalWidthMm <= 0 ||
                panel.finalHeightMm <= 0 ||
                !physicalLimitOk ||
                !printableFit) {
                return null;
            }
            pieces.push({
                id: `${layout.sourcePieceId}-panel-${panel.panelIndex}`,
                sourcePieceId: layout.sourcePieceId,
                originalWidthMm: layout.pieceWidthMm,
                originalHeightMm: layout.pieceHeightMm,
                widthMm: panel.finalWidthMm,
                heightMm: panel.finalHeightMm,
                usefulWidthMm: panel.usefulWidthMm,
                usefulHeightMm: panel.usefulHeightMm,
                overlapStartMm: panel.overlapStartMm,
                overlapEndMm: panel.overlapEndMm,
                panelIndex: panel.panelIndex,
                panelCount: layout.panels.length,
                panelAxis: layout.axis,
                area: layout.pieceWidthMm * layout.pieceHeightMm,
                longestSide: Math.max(panel.finalWidthMm, panel.finalHeightMm),
                shortestSide: Math.min(panel.finalWidthMm, panel.finalHeightMm),
            });
        }
    }
    return pieces.sort((a, b) => b.longestSide - a.longestSide ||
        b.area - a.area ||
        b.shortestSide - a.shortestSide);
}
function buildOrientacion(placements) {
    if (!placements.length)
        return 'normal';
    const hasRotated = placements.some((item) => item.rotated);
    const hasNormal = placements.some((item) => !item.rotated);
    if (hasRotated && hasNormal)
        return 'mixta';
    return hasRotated ? 'rotada' : 'normal';
}
function countRowsAndPiecesPerRow(placements, toleranceMm) {
    if (!placements.length)
        return { rows: 0, piecesPerRow: 0 };
    const rows = [];
    const sorted = [...placements].sort((a, b) => {
        const topDiff = a.centerYMm - a.heightMm / 2 - (b.centerYMm - b.heightMm / 2);
        if (Math.abs(topDiff) > toleranceMm)
            return topDiff;
        return a.centerXMm - b.centerXMm;
    });
    for (const placement of sorted) {
        const topMm = placement.centerYMm - placement.heightMm / 2;
        const bottomMm = placement.centerYMm + placement.heightMm / 2;
        const existing = rows.find((row) => Math.abs(row.topMm - topMm) <= toleranceMm ||
            (topMm <= row.bottomMm - toleranceMm && bottomMm >= row.topMm + toleranceMm));
        if (existing) {
            existing.topMm = Math.min(existing.topMm, topMm);
            existing.bottomMm = Math.max(existing.bottomMm, bottomMm);
            existing.count += 1;
            continue;
        }
        rows.push({ topMm, bottomMm, count: 1 });
    }
    return {
        rows: rows.length,
        piecesPerRow: rows.reduce((max, row) => Math.max(max, row.count), 0),
    };
}
function nestOnRoll(input) {
    const manualLayout = normalizeManualLayout(input.panelizado?.manualLayout ?? null);
    const pieces = input.panelizado?.activo
        ? input.panelizado.mode === 'manual' && manualLayout
            ? buildManualPieces({
                medidas: input.medidas,
                printableWidthMm: input.printableWidthMm,
                maxPanelWidthMm: input.panelizado.maxPanelWidthMm,
                widthInterpretation: input.panelizado.widthInterpretation,
                manualLayout,
            })
            : buildPanelizedPieces({
                medidas: input.medidas,
                printableWidthMm: input.printableWidthMm,
                panelAxis: input.panelizado.axis,
                overlapMm: input.panelizado.overlapMm,
                maxPanelWidthMm: input.panelizado.maxPanelWidthMm,
                distribution: input.panelizado.distribution,
                widthInterpretation: input.panelizado.widthInterpretation,
            })
        : buildPieceInstances(input.medidas);
    if (!pieces || !pieces.length)
        return null;
    const resolveNextRowY = (rows) => {
        if (!rows.length)
            return input.marginStartMm;
        const last = rows[rows.length - 1];
        return last.yMm + last.heightMm + input.separacionVerticalMm;
    };
    const measureState = (state) => {
        const contentHeightMm = state.rows.reduce((acc, row) => acc + row.heightMm, 0);
        const verticalGapsMm = state.rows.length > 1 ? (state.rows.length - 1) * input.separacionVerticalMm : 0;
        const consumedContentLengthMm = contentHeightMm + verticalGapsMm;
        const placedAreaMm2 = state.placements.reduce((acc, placement) => acc + placement.originalWidthMm * placement.originalHeightMm, 0);
        const wasteProxyMm2 = input.printableWidthMm * consumedContentLengthMm - placedAreaMm2;
        return { consumedContentLengthMm, wasteProxyMm2 };
    };
    let states = [{ rows: [], placements: [] }];
    for (const piece of pieces) {
        const orientations = [
            { widthMm: piece.widthMm, heightMm: piece.heightMm, rotated: false },
            ...(input.permitirRotacion && piece.widthMm !== piece.heightMm
                ? [{ widthMm: piece.heightMm, heightMm: piece.widthMm, rotated: true }]
                : []),
        ];
        const nextStates = [];
        for (const state of states) {
            for (const option of orientations) {
                if (option.widthMm > input.printableWidthMm)
                    continue;
                for (const [rowIndex, row] of state.rows.entries()) {
                    const nextWidth = row.usedWidthMm === 0
                        ? option.widthMm
                        : row.usedWidthMm + input.separacionHorizontalMm + option.widthMm;
                    if (nextWidth > input.printableWidthMm)
                        continue;
                    const rows = state.rows.map((item) => ({ ...item }));
                    const targetRow = rows[rowIndex];
                    const xMm = targetRow.usedWidthMm === 0
                        ? input.marginLeftMm
                        : input.marginLeftMm + targetRow.usedWidthMm + input.separacionHorizontalMm;
                    targetRow.usedWidthMm = nextWidth;
                    targetRow.heightMm = Math.max(targetRow.heightMm, option.heightMm);
                    targetRow.count += 1;
                    nextStates.push({
                        rows,
                        placements: [
                            ...state.placements,
                            {
                                id: piece.id,
                                widthMm: option.widthMm,
                                heightMm: option.heightMm,
                                centerXMm: xMm + option.widthMm / 2,
                                centerYMm: targetRow.yMm + option.heightMm / 2,
                                label: `${Math.round(piece.originalWidthMm / 10)}x${Math.round(piece.originalHeightMm / 10)} cm`,
                                rotated: option.rotated,
                                originalWidthMm: piece.originalWidthMm,
                                originalHeightMm: piece.originalHeightMm,
                                panelIndex: piece.panelIndex,
                                panelCount: piece.panelCount,
                                panelAxis: piece.panelAxis,
                                sourcePieceId: piece.sourcePieceId,
                                usefulWidthMm: piece.usefulWidthMm ?? piece.widthMm,
                                usefulHeightMm: piece.usefulHeightMm ?? piece.heightMm,
                                overlapStartMm: piece.overlapStartMm ?? 0,
                                overlapEndMm: piece.overlapEndMm ?? 0,
                            },
                        ],
                    });
                }
                const rows = state.rows.map((item) => ({ ...item }));
                const newRow = {
                    yMm: resolveNextRowY(rows),
                    usedWidthMm: option.widthMm,
                    heightMm: option.heightMm,
                    count: 1,
                };
                rows.push(newRow);
                nextStates.push({
                    rows,
                    placements: [
                        ...state.placements,
                        {
                            id: piece.id,
                            widthMm: option.widthMm,
                            heightMm: option.heightMm,
                            centerXMm: input.marginLeftMm + option.widthMm / 2,
                            centerYMm: newRow.yMm + option.heightMm / 2,
                            label: `${Math.round(piece.originalWidthMm / 10)}x${Math.round(piece.originalHeightMm / 10)} cm`,
                            rotated: option.rotated,
                            originalWidthMm: piece.originalWidthMm,
                            originalHeightMm: piece.originalHeightMm,
                            panelIndex: piece.panelIndex,
                            panelCount: piece.panelCount,
                            panelAxis: piece.panelAxis,
                            sourcePieceId: piece.sourcePieceId,
                            usefulWidthMm: piece.usefulWidthMm ?? piece.widthMm,
                            usefulHeightMm: piece.usefulHeightMm ?? piece.heightMm,
                            overlapStartMm: piece.overlapStartMm ?? 0,
                            overlapEndMm: piece.overlapEndMm ?? 0,
                        },
                    ],
                });
            }
        }
        if (!nextStates.length)
            return null;
        states = nextStates
            .sort((a, b) => {
            const left = measureState(a);
            const right = measureState(b);
            return (left.consumedContentLengthMm - right.consumedContentLengthMm ||
                left.wasteProxyMm2 - right.wasteProxyMm2 ||
                a.rows.length - b.rows.length);
        })
            .slice(0, 12);
    }
    const bestState = [...states].sort((a, b) => {
        const left = measureState(a);
        const right = measureState(b);
        return (left.consumedContentLengthMm - right.consumedContentLengthMm ||
            left.wasteProxyMm2 - right.wasteProxyMm2 ||
            a.rows.length - b.rows.length);
    })[0];
    const contentHeightMm = bestState.rows.reduce((acc, row) => acc + row.heightMm, 0);
    const verticalGapsMm = bestState.rows.length > 1 ? (bestState.rows.length - 1) * input.separacionVerticalMm : 0;
    const consumedLengthMm = input.marginStartMm + input.marginEndMm + contentHeightMm + verticalGapsMm;
    const usefulAreaM2 = input.medidas.reduce((acc, item) => acc + ((item.anchoMm * item.altoMm) / 1_000_000) * item.cantidad, 0);
    const { rows: rowCount, piecesPerRow } = countRowsAndPiecesPerRow(bestState.placements, Math.max(1, input.separacionVerticalMm / 2));
    return {
        orientacion: buildOrientacion(bestState.placements),
        panelizado: input.panelizado?.activo === true,
        panelAxis: input.panelizado?.activo ? input.panelizado.axis : null,
        panelCount: bestState.placements.reduce((max, item) => Math.max(max, item.panelCount ?? 1), 1),
        panelOverlapMm: input.panelizado?.activo ? input.panelizado.overlapMm : null,
        panelMaxWidthMm: input.panelizado?.activo ? input.panelizado.maxPanelWidthMm : null,
        panelDistribution: input.panelizado?.activo ? input.panelizado.distribution : null,
        panelWidthInterpretation: input.panelizado?.activo ? input.panelizado.widthInterpretation : null,
        panelMode: input.panelizado?.activo ? input.panelizado.mode : null,
        piecesPerRow,
        rows: rowCount,
        consumedLengthMm,
        usefulAreaM2,
        placements: bestState.placements,
    };
}
//# sourceMappingURL=nesting-rollo.js.map