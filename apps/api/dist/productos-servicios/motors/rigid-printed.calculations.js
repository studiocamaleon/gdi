"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nestRectangularGrid = nestRectangularGrid;
exports.calculatePlatesNeeded = calculatePlatesNeeded;
exports.nestMultiMedida = nestMultiMedida;
exports.calcularCosteoMaterial = calcularCosteoMaterial;
const maxrects_packer_1 = require("maxrects-packer");
function calcGrid(piezaW, piezaH, areaW, areaH, sepH, sepV) {
    if (areaW < piezaW || areaH < piezaH)
        return { columnas: 0, filas: 0 };
    return {
        columnas: Math.max(0, Math.floor((areaW + sepH) / (piezaW + sepH))),
        filas: Math.max(0, Math.floor((areaH + sepV) / (piezaH + sepV))),
    };
}
function nestRectangularGrid(input) {
    const { piezaAnchoMm, piezaAltoMm, placaAnchoMm, placaAltoMm, separacionHMm, separacionVMm, margenMm, permitirRotacion } = input;
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
    const posiciones = [];
    for (let row = 0; row < best.filas; row++) {
        for (let col = 0; col < best.columnas; col++) {
            posiciones.push({
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
        posiciones,
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
function nestMultiMedida(medidas, placaAnchoMm, placaAltoMm, sepH, sepV, margen, permitirRotacion, orientacionPlaca = 'usar_lado_corto') {
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
        return { placas: 0, totalPiezas: 0, areaUtilMm2: 0, areaTotalMm2: 0, aprovechamientoPct: 0, placaLayouts: [] };
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
        for (const rect of bin.rects) {
            const d = rect.data;
            const rotada = rect.rot ?? false;
            const pieceH = rotada ? d.origW : d.origH;
            const bottom = rect.y + pieceH + margen;
            if (bottom > maxY)
                maxY = bottom;
            areaUtil += d.origW * d.origH;
        }
        placaLayouts.push({ areaUtilMm2: areaUtil, largoConsumidoMm: maxY > 0 ? margen + maxY : 0 });
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
function precioM2(precioPlaca, anchoMm, altoMm) {
    const areaM2 = (anchoMm * altoMm) / 1_000_000;
    return areaM2 > 0 ? precioPlaca / areaM2 : 0;
}
function costeoM2Exacto(input) {
    const pm2 = precioM2(input.precioPlaca, input.placaAnchoMm, input.placaAltoMm);
    const areaPiezasM2 = (input.piezaAnchoMm * input.piezaAltoMm * input.cantidadTotal) / 1_000_000;
    const costoTotal = round2(areaPiezasM2 * pm2);
    return {
        estrategia: 'm2_exacto',
        costoTotal,
        detalle: {
            precioPlaca: input.precioPlaca,
            precioM2: round2(pm2),
            placasCompletas: input.placasNecesarias,
            costoPlacasCompletas: costoTotal,
            ultimaPlaca: null,
        },
    };
}
function costeoLargoConsumido(input) {
    const pm2 = precioM2(input.precioPlaca, input.placaAnchoMm, input.placaAltoMm);
    const { nesting, placasNecesarias, cantidadTotal } = input;
    const piezasPorPlaca = nesting.piezasPorPlaca;
    const placasLlenas = piezasPorPlaca > 0 ? Math.floor(cantidadTotal / piezasPorPlaca) : 0;
    const costoPlacasLlenas = placasLlenas * input.precioPlaca;
    const piezasRestantes = cantidadTotal - placasLlenas * piezasPorPlaca;
    let costoUltimaPlaca = 0;
    let ocupacionPct = 0;
    if (piezasRestantes > 0 && nesting.columnas > 0) {
        const pH = nesting.rotada ? input.piezaAnchoMm : input.piezaAltoMm;
        const filasNecesarias = Math.ceil(piezasRestantes / nesting.columnas);
        const largoConsumido = nesting.largoConsumidoMm > 0
            ? (filasNecesarias / nesting.filas) * nesting.largoConsumidoMm
            : filasNecesarias * pH;
        costoUltimaPlaca = round2(input.precioPlaca * (largoConsumido / input.placaAltoMm));
        ocupacionPct = round2((largoConsumido / input.placaAltoMm) * 100);
    }
    return {
        estrategia: 'largo_consumido',
        costoTotal: round2(costoPlacasLlenas + costoUltimaPlaca),
        detalle: {
            precioPlaca: input.precioPlaca,
            precioM2: round2(pm2),
            placasCompletas: placasLlenas,
            costoPlacasCompletas: round2(costoPlacasLlenas),
            ultimaPlaca: piezasRestantes > 0
                ? { ocupacionPct, segmentoAplicado: null, costo: costoUltimaPlaca }
                : null,
        },
    };
}
function costeoSegmentosPlaca(input) {
    const { placasNecesarias, cantidadTotal, segmentosPlaca, precioPlaca } = input;
    const piezasPorPlaca = input.nesting.piezasPorPlaca;
    const escalones = segmentosPlaca.length > 0
        ? [...segmentosPlaca].sort((a, b) => a - b)
        : [25, 50, 75, 100];
    if (piezasPorPlaca <= 0) {
        return {
            estrategia: 'segmentos_placa',
            costoTotal: 0,
            detalle: {
                precioPlaca, precioM2: 0, placasCompletas: 0, costoPlacasCompletas: 0, ultimaPlaca: null,
            },
        };
    }
    let costoTotal = 0;
    let placasCompletas = 0;
    let costoPlacasCompletas = 0;
    let ultimaOcupacion = 0;
    let ultimoSegmento = 100;
    let costoUltimaPlaca = 0;
    let piezasRestantes = cantidadTotal;
    for (let i = 0; i < placasNecesarias; i++) {
        const piezasEnEstaPlaca = Math.min(piezasRestantes, piezasPorPlaca);
        piezasRestantes -= piezasEnEstaPlaca;
        const ocupacion = (piezasEnEstaPlaca / piezasPorPlaca) * 100;
        const segmento = escalones.find((s) => s >= ocupacion) ?? 100;
        const costoPlaca = round2(precioPlaca * (segmento / 100));
        costoTotal += costoPlaca;
        if (piezasEnEstaPlaca === piezasPorPlaca) {
            placasCompletas++;
            costoPlacasCompletas += costoPlaca;
        }
        else {
            ultimaOcupacion = round2(ocupacion);
            ultimoSegmento = segmento;
            costoUltimaPlaca = costoPlaca;
        }
    }
    return {
        estrategia: 'segmentos_placa',
        costoTotal: round2(costoTotal),
        detalle: {
            precioPlaca,
            precioM2: round2(precioM2(precioPlaca, input.placaAnchoMm, input.placaAltoMm)),
            placasCompletas,
            costoPlacasCompletas: round2(costoPlacasCompletas),
            ultimaPlaca: placasNecesarias > placasCompletas
                ? { ocupacionPct: ultimaOcupacion, segmentoAplicado: ultimoSegmento, costo: costoUltimaPlaca }
                : null,
        },
    };
}
function calcularCosteoMaterial(input) {
    switch (input.estrategia) {
        case 'm2_exacto':
            return costeoM2Exacto(input);
        case 'largo_consumido':
            return costeoLargoConsumido(input);
        case 'segmentos_placa':
            return costeoSegmentosPlaca(input);
        default:
            return costeoSegmentosPlaca(input);
    }
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=rigid-printed.calculations.js.map