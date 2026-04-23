"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNestingPipeline = runNestingPipeline;
exports.getLayoutHeredado = getLayoutHeredado;
const nesting_placa_rigida_1 = require("../nesting/nesting-placa-rigida");
const nesting_rollo_1 = require("../nesting/nesting-rollo");
const nesting_hoja_1 = require("../nesting/nesting-hoja");
function runNestingPipeline(input) {
    const layoutsPorPasoId = new Map();
    const consumeMap = new Map();
    const consumersSinProduce = [];
    let lastProduceId = null;
    for (const paso of input.pasos) {
        const familia = input.familiasMap[paso.familiaCodigo];
        if (!familia) {
            throw new Error(`nesting-runner: familia desconocida '${paso.familiaCodigo}' para paso ${paso.id}.`);
        }
        if (familia.modoNesting === 'produce') {
            if (!familia.nestingAlgoritmo) {
                throw new Error(`nesting-runner: familia '${familia.codigo}' es 'produce' pero no declara nestingAlgoritmo.`);
            }
            const result = ejecutarNestingAlgoritmo(familia.nestingAlgoritmo, input.trabajo.medidas, paso, input.materialMaquina);
            if (result) {
                layoutsPorPasoId.set(paso.id, result);
                lastProduceId = paso.id;
            }
            continue;
        }
        if (familia.modoNesting === 'consume') {
            if (lastProduceId) {
                consumeMap.set(paso.id, lastProduceId);
            }
            else {
                consumersSinProduce.push(paso.id);
            }
            continue;
        }
    }
    return { layoutsPorPasoId, consumeMap, consumersSinProduce };
}
function ejecutarNestingAlgoritmo(algoritmo, medidas, paso, materialMaquina) {
    const config = paso.configNesting ?? {};
    const pasoId = paso.id;
    const tag = `[nesting-runner:${algoritmo}:${pasoId}]`;
    switch (algoritmo) {
        case 'nesting-placa-rigida': {
            const m = medidas[0];
            if (!m) {
                console.warn(`${tag} sin medidas — devuelve null.`);
                return null;
            }
            const placaAnchoMm = Number(materialMaquina?.placaAnchoMm ?? config.placaAnchoMm ?? 0);
            const placaAltoMm = Number(materialMaquina?.placaAltoMm ?? config.placaAltoMm ?? 0);
            if (placaAnchoMm <= 0 || placaAltoMm <= 0) {
                console.warn(`${tag} placa sin dimensiones (placaAnchoMm=${placaAnchoMm}, placaAltoMm=${placaAltoMm}). ` +
                    `Cargá las dimensiones en configNestingV2 del paso o asigná una máquina con material que las exponga.`);
                return null;
            }
            const result = (0, nesting_placa_rigida_1.nestRectangularGrid)({
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
                console.warn(`${tag} la pieza ${m.anchoMm}×${m.altoMm}mm no entra en placa ${placaAnchoMm}×${placaAltoMm}mm — devuelve null.`);
                return null;
            }
            return { algoritmo, result };
        }
        case 'nesting-rollo': {
            const effMarginLeft = Number(config.marginLeftMm ?? materialMaquina?.maquinaMarginLeftMm ?? 0);
            const effMarginRight = Number(config.marginRightMm ?? materialMaquina?.maquinaMarginRightMm ?? 0);
            const effMarginStart = Number(config.marginStartMm ?? materialMaquina?.maquinaMarginStartMm ?? 0);
            const effMarginEnd = Number(config.marginEndMm ?? materialMaquina?.maquinaMarginEndMm ?? 0);
            const sepH = Number(config.separacionHorizontalMm ?? 0);
            const sepV = Number(config.separacionVerticalMm ?? 0);
            const permitirRotacion = Boolean(config.permitirRotacion ?? true);
            const panelizado = config.panelizado ?? undefined;
            const sustrato = paso.materialesConsumidos?.find((m) => m.esSustratoNesting && m.variantesHabilitadas.length > 0);
            if (sustrato) {
                const criterio = (config.criterioSeleccionMaterial ??
                    'mayor_aprovechamiento');
                const evaluados = [];
                const descartados = [];
                for (const variante of sustrato.variantesHabilitadas) {
                    const attrs = variante.atributosVariante ?? {};
                    const anchoM = Number(attrs.ancho);
                    const largoM = Number(attrs.largo);
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
                    const result = (0, nesting_rollo_1.nestOnRoll)({
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
                    const areaConsumidaM2 = (printableWidth * result.consumedLengthMm) / 1_000_000;
                    const aprovechamientoPct = areaConsumidaM2 > 0
                        ? Math.round((result.usefulAreaM2 / areaConsumidaM2) * 10000) / 100
                        : 0;
                    let precioPorM2 = null;
                    let sustratoCosto = null;
                    if (variante.precioReferencia != null &&
                        variante.precioReferencia > 0 &&
                        Number.isFinite(largoM) &&
                        largoM > 0) {
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
                    console.warn(`${tag} ninguna de las ${sustrato.variantesHabilitadas.length} variantes habilitadas pudo procesar el trabajo. ${detalle}`);
                    return null;
                }
                const ganador = elegirVarianteRollo(evaluados, criterio);
                return {
                    algoritmo,
                    result: ganador.result,
                    marginLeftMm: effMarginLeft,
                    marginRightMm: Math.max(0, ganador.rolloAnchoMm - ganador.printableWidth - effMarginLeft),
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
                            esGanador: e.variante.materiaPrimaVarianteId ===
                                ganador.variante.materiaPrimaVarianteId,
                        })),
                        materialesDescartados: descartados,
                    },
                };
            }
            const sobrescribeLateral = config.marginLeftMm !== undefined || config.marginRightMm !== undefined;
            const anchoTotalMm = Number(materialMaquina?.maquinaAnchoTotalMm ?? config.printableWidthMm ?? 0);
            const printableWidth = sobrescribeLateral
                ? Math.max(0, anchoTotalMm - effMarginLeft - effMarginRight)
                : Number(materialMaquina?.maquinaPrintableWidthMm ?? config.printableWidthMm ?? 0);
            if (printableWidth <= 0) {
                const hint = materialMaquina
                    ? `máquina sin parámetros válidos (anchoBoca/anchoCama/anchoImprimibleMaximo) — verificá que estén cargados en cm.`
                    : `sin máquina asignada al paso o sin parametrosTecnicos.`;
                console.warn(`${tag} printableWidthMm=0 (${hint}). Override: cargá 'Ancho imprimible' en la sección Nesting del paso, o declará un material con esSustratoNesting=true.`);
                return null;
            }
            const result = (0, nesting_rollo_1.nestOnRoll)({
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
                console.warn(`${tag} nestOnRoll devolvió null (${medidas.length} medida(s), printableWidthMm=${printableWidth}). ` +
                    `Posible causa: pieza más grande que el ancho imprimible y rotación no permitida/posible.`);
                return null;
            }
            const marginRightDerivado = Math.max(0, anchoTotalMm - printableWidth - effMarginLeft);
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
            const pliegoImpresionRaw = config.pliegoImpresion;
            const pliegoImpresion = pliegoImpresionRaw &&
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
            const result = (0, nesting_hoja_1.nestOnSheet)({
                piezaAnchoMm: m.anchoMm,
                piezaAltoMm: m.altoMm,
                cantidadPiezas: m.cantidad,
                pliegos: config.pliegos,
                separacionHMm: Number(config.separacionHMm ?? 0),
                separacionVMm: Number(config.separacionVMm ?? 0),
                margenMm: Number(config.margenMm ?? 0),
                permitirRotacion: Boolean(config.permitirRotacion ?? true),
                criterio: (config.criterio ?? 'menor_cantidad_pliegos'),
                pliegoImpresion,
            });
            if (!result) {
                const pliegosCfg = config.pliegos ?? [];
                console.warn(`${tag} nestOnSheet devolvió null. Pieza ${m.anchoMm}×${m.altoMm}mm, ` +
                    `${pliegosCfg.length} pliego(s) candidatos. Posible causa: pieza no entra en ningún pliego o lista de pliegos vacía.`);
                return null;
            }
            return { algoritmo, result };
        }
    }
}
function getLayoutHeredado(output, pasoId) {
    const produceId = output.consumeMap.get(pasoId);
    if (!produceId)
        return null;
    return output.layoutsPorPasoId.get(produceId) ?? null;
}
function elegirVarianteRollo(evaluados, criterio) {
    if (criterio === 'menor_largo_consumido') {
        return [...evaluados].sort((a, b) => a.result.consumedLengthMm - b.result.consumedLengthMm)[0];
    }
    if (criterio === 'menor_costo_total') {
        const conCosto = evaluados.filter((e) => e.sustratoCosto != null);
        if (conCosto.length > 0) {
            return [...conCosto].sort((a, b) => a.sustratoCosto - b.sustratoCosto)[0];
        }
    }
    return [...evaluados].sort((a, b) => b.aprovechamientoPct - a.aprovechamientoPct)[0];
}
//# sourceMappingURL=nesting-runner.js.map