"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nestRectangularGrid = nestRectangularGrid;
exports.calculatePlatesNeeded = calculatePlatesNeeded;
exports.nestMultiMedida = nestMultiMedida;
const maxrects_packer_1 = require("maxrects-packer");
function calcGrid(piezaW, piezaH, areaW, areaH, sepH, sepV) {
    if (areaW < piezaW || areaH < piezaH)
        return { columnas: 0, filas: 0 };
    return {
        columnas: Math.max(0, Math.floor((areaW + sepH) / (piezaW + sepH))),
        filas: Math.max(0, Math.floor((areaH + sepV) / (piezaH + sepV))),
    };
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
function nestRectangularGrid(input) {
    const { piezaAnchoMm, piezaAltoMm, placaAnchoMm, placaAltoMm, separacionHMm, separacionVMm, margenMm, permitirRotacion, } = input;
    const areaW = placaAnchoMm - 2 * margenMm;
    const areaH = placaAltoMm - 2 * margenMm;
    const orig = calcGrid(piezaAnchoMm, piezaAltoMm, areaW, areaH, separacionHMm, separacionVMm);
    const origCount = orig.columnas * orig.filas;
    let rot = { columnas: 0, filas: 0 };
    let rotCount = 0;
    if (permitirRotacion && piezaAnchoMm !== piezaAltoMm) {
        rot = calcGrid(piezaAltoMm, piezaAnchoMm, areaW, areaH, separacionHMm, separacionVMm);
        rotCount = rot.columnas * rot.filas;
    }
    const useRot = rotCount > origCount;
    const best = useRot ? rot : orig;
    const pW = useRot ? piezaAltoMm : piezaAnchoMm;
    const pH = useRot ? piezaAnchoMm : piezaAltoMm;
    const count = best.columnas * best.filas;
    const placements = [];
    for (let row = 0; row < best.filas; row++) {
        for (let col = 0; col < best.columnas; col++) {
            placements.push({
                x: margenMm + col * (pW + separacionHMm),
                y: margenMm + row * (pH + separacionVMm),
                anchoMm: pW,
                altoMm: pH,
                rotada: useRot,
            });
        }
    }
    const areaTotalMm2 = placaAnchoMm * placaAltoMm;
    const areaUtilMm2 = count * piezaAnchoMm * piezaAltoMm;
    const aprovechamientoPct = areaTotalMm2 > 0
        ? Math.round((areaUtilMm2 / areaTotalMm2) * 10000) / 100
        : 0;
    const largoConsumidoMm = best.filas > 0
        ? margenMm + best.filas * pH + (best.filas - 1) * separacionVMm + margenMm
        : 0;
    return {
        piezasPorPlaca: count,
        columnas: best.columnas,
        filas: best.filas,
        rotada: useRot,
        placements,
        aprovechamientoPct,
        largoConsumidoMm,
        areaUtilMm2,
        areaTotalMm2,
    };
}
function calculatePlatesNeeded(totalPiezas, piezasPorPlaca) {
    if (piezasPorPlaca <= 0)
        return { placas: 0, sobrantes: 0 };
    const placas = Math.ceil(totalPiezas / piezasPorPlaca);
    return { placas, sobrantes: placas * piezasPorPlaca - totalPiezas };
}
function nestMultiMedida(medidas, placaAnchoMm, placaAltoMm, sepH, sepV, margen, permitirRotacion, _orientacionPlaca = 'usar_lado_corto') {
    const areaW = placaAnchoMm - 2 * margen;
    const areaH = placaAltoMm - 2 * margen;
    const pendientes = [];
    for (const m of medidas) {
        if (m.anchoMm <= 0 || m.altoMm <= 0 || m.cantidad <= 0)
            continue;
        for (let i = 0; i < m.cantidad; i++) {
            pendientes.push({ w: m.anchoMm, h: m.altoMm });
        }
    }
    pendientes.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    if (pendientes.length === 0) {
        return {
            placas: 0,
            totalPiezas: 0,
            areaUtilMm2: 0,
            areaTotalMm2: 0,
            aprovechamientoPct: 0,
            placaLayouts: [],
        };
    }
    const packer = new maxrects_packer_1.MaxRectsPacker(areaW + sepH, areaH + sepV, 0, {
        smart: false,
        pot: false,
        square: false,
        allowRotation: permitirRotacion,
    });
    for (const p of pendientes) {
        packer.add(p.w + sepH, p.h + sepV, { origW: p.w, origH: p.h });
    }
    const placaLayouts = [];
    let totalPiezas = 0;
    let totalAreaUtil = 0;
    for (const bin of packer.bins) {
        let maxY = 0;
        let areaUtil = 0;
        const placements = [];
        for (const rect of bin.rects) {
            const d = rect.data;
            const rotada = rect.rot ?? false;
            const pieceW = rotada ? d.origH : d.origW;
            const pieceH = rotada ? d.origW : d.origH;
            const bottom = rect.y + pieceH + margen;
            if (bottom > maxY)
                maxY = bottom;
            areaUtil += d.origW * d.origH;
            placements.push({
                x: rect.x + margen,
                y: rect.y + margen,
                anchoMm: pieceW,
                altoMm: pieceH,
                rotada,
            });
        }
        placaLayouts.push({
            areaUtilMm2: areaUtil,
            largoConsumidoMm: maxY > 0 ? margen + maxY : 0,
            placements,
        });
        totalPiezas += bin.rects.length;
        totalAreaUtil += areaUtil;
    }
    const areaTotalMm2 = placaAnchoMm * placaAltoMm * placaLayouts.length;
    return {
        placas: placaLayouts.length,
        totalPiezas,
        areaUtilMm2: totalAreaUtil,
        areaTotalMm2,
        aprovechamientoPct: areaTotalMm2 > 0 ? round2((totalAreaUtil / areaTotalMm2) * 100) : 0,
        placaLayouts,
    };
}
//# sourceMappingURL=nesting-placa-rigida.js.map