"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CANONICAL_PLIEGOS_MM = void 0;
exports.nestOnSheet = nestOnSheet;
const nesting_placa_rigida_1 = require("./nesting-placa-rigida");
exports.CANONICAL_PLIEGOS_MM = [
    { codigo: 'A6', nombre: 'A6', anchoMm: 105, altoMm: 148 },
    { codigo: 'A5', nombre: 'A5', anchoMm: 148, altoMm: 210 },
    { codigo: 'A4', nombre: 'A4', anchoMm: 210, altoMm: 297 },
    { codigo: 'A3', nombre: 'A3', anchoMm: 297, altoMm: 420 },
    { codigo: 'SRA3', nombre: 'SRA3', anchoMm: 320, altoMm: 450 },
    { codigo: 'SRA3+', nombre: 'SRA3+', anchoMm: 330, altoMm: 480 },
    { codigo: 'SRA3++', nombre: 'SRA3++', anchoMm: 325, altoMm: 500 },
    { codigo: '22x34', nombre: '22x34', anchoMm: 220, altoMm: 340 },
    { codigo: 'CARTA', nombre: 'Carta', anchoMm: 216, altoMm: 279 },
    { codigo: 'OFICIO', nombre: 'Oficio', anchoMm: 216, altoMm: 356 },
];
function nestOnSheet(input) {
    const sustratosCandidatos = input.pliegos && input.pliegos.length > 0
        ? input.pliegos
        : exports.CANONICAL_PLIEGOS_MM;
    const lienzosNesting = input.pliegoImpresion
        ? [input.pliegoImpresion]
        : sustratosCandidatos;
    const candidatos = [];
    for (const pliego of lienzosNesting) {
        const nesting = (0, nesting_placa_rigida_1.nestRectangularGrid)({
            piezaAnchoMm: input.piezaAnchoMm,
            piezaAltoMm: input.piezaAltoMm,
            placaAnchoMm: pliego.anchoMm,
            placaAltoMm: pliego.altoMm,
            separacionHMm: input.separacionHMm,
            separacionVMm: input.separacionVMm,
            margenMm: input.margenMm,
            permitirRotacion: input.permitirRotacion,
        });
        if (nesting.piezasPorPlaca === 0)
            continue;
        const pliegosNecesarios = Math.ceil(input.cantidadPiezas / nesting.piezasPorPlaca);
        candidatos.push({
            pliego,
            piezasPorPliego: nesting.piezasPorPlaca,
            pliegosNecesarios,
            aprovechamientoPct: nesting.aprovechamientoPct,
            columnas: nesting.columnas,
            filas: nesting.filas,
            rotada: nesting.rotada,
            placements: nesting.placements,
        });
    }
    if (candidatos.length === 0)
        return null;
    const ganador = candidatos.reduce((best, current) => {
        if (input.criterio === 'menor_cantidad_pliegos') {
            if (current.pliegosNecesarios < best.pliegosNecesarios)
                return current;
            if (current.pliegosNecesarios === best.pliegosNecesarios &&
                current.aprovechamientoPct > best.aprovechamientoPct) {
                return current;
            }
            return best;
        }
        if (input.criterio === 'mayor_aprovechamiento') {
            if (current.aprovechamientoPct > best.aprovechamientoPct)
                return current;
            return best;
        }
        if (input.criterio === 'mayor_piezas_por_pliego') {
            if (current.piezasPorPliego > best.piezasPorPliego)
                return current;
            return best;
        }
        return best;
    });
    const alternativas = candidatos.map((c) => ({
        pliego: c.pliego,
        piezasPorPliego: c.piezasPorPliego,
        pliegosNecesarios: c.pliegosNecesarios,
        aprovechamientoPct: c.aprovechamientoPct,
        rotada: c.rotada,
    }));
    let sustratoElegido;
    let pliegosPorSustratoElegido;
    let sustratosNecesarios;
    let orientacionConversion;
    if (input.pliegoImpresion) {
        const convCandidatos = [];
        const pi = input.pliegoImpresion;
        for (const sustrato of sustratosCandidatos) {
            const calc = (anchoPliego, altoPliego) => {
                const cols = Math.floor(sustrato.anchoMm / anchoPliego);
                const filas = Math.floor(sustrato.altoMm / altoPliego);
                return cols > 0 && filas > 0 ? cols * filas : 0;
            };
            const normal = calc(pi.anchoMm, pi.altoMm);
            const rotada = input.permitirRotacion ? calc(pi.altoMm, pi.anchoMm) : 0;
            const pliegosPorSustrato = Math.max(normal, rotada);
            if (pliegosPorSustrato === 0)
                continue;
            const sustratosNec = Math.ceil(ganador.pliegosNecesarios / pliegosPorSustrato);
            convCandidatos.push({
                sustrato,
                pliegosPorSustrato,
                sustratosNecesarios: sustratosNec,
                rotada: rotada > normal,
            });
        }
        if (convCandidatos.length > 0) {
            const ganadorSustrato = convCandidatos.reduce((best, current) => {
                if (current.sustratosNecesarios < best.sustratosNecesarios)
                    return current;
                if (current.sustratosNecesarios === best.sustratosNecesarios &&
                    current.pliegosPorSustrato > best.pliegosPorSustrato) {
                    return current;
                }
                return best;
            });
            sustratoElegido = ganadorSustrato.sustrato;
            pliegosPorSustratoElegido = ganadorSustrato.pliegosPorSustrato;
            sustratosNecesarios = ganadorSustrato.sustratosNecesarios;
            orientacionConversion = ganadorSustrato.rotada ? 'rotada' : 'normal';
        }
    }
    return {
        pliegoElegido: ganador.pliego,
        piezasPorPliego: ganador.piezasPorPliego,
        pliegosNecesarios: ganador.pliegosNecesarios,
        aprovechamientoPct: ganador.aprovechamientoPct,
        columnas: ganador.columnas,
        filas: ganador.filas,
        rotada: ganador.rotada,
        placements: ganador.placements,
        alternativas,
        criterioAplicado: input.criterio,
        sustratoElegido,
        pliegosPorSustrato: pliegosPorSustratoElegido,
        sustratosNecesarios,
        orientacionConversion,
    };
}
//# sourceMappingURL=nesting-hoja.js.map