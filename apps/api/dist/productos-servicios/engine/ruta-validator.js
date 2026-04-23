"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRuta = validateRuta;
function validateRuta(pasos, familiasMap) {
    const errors = [];
    const warnings = [];
    const pasosOrdenados = [...pasos].sort((a, b) => a.orden - b.orden);
    let lastProduce = null;
    let lastProduceFamilia = null;
    for (const paso of pasosOrdenados) {
        const familia = familiasMap[paso.familiaCodigo];
        if (!familia) {
            errors.push({
                codigo: 'R1_familia_desconocida',
                pasoId: paso.id,
                mensaje: `El paso ${paso.id} referencia familia '${paso.familiaCodigo}' que no existe en el catálogo.`,
            });
            continue;
        }
        if (familia.modoNesting === 'produce' && !familia.nestingAlgoritmo) {
            errors.push({
                codigo: 'R2_produce_sin_algoritmo',
                pasoId: paso.id,
                mensaje: `La familia '${familia.codigo}' es 'produce' pero no declara nestingAlgoritmo.`,
            });
        }
        if (familia.modoNesting === 'produce') {
            const configErrors = validateConfigNesting(paso.id, familia.nestingAlgoritmo, paso.configNesting ?? null);
            errors.push(...configErrors);
            lastProduce = paso;
            lastProduceFamilia = familia;
            continue;
        }
        if (familia.modoNesting === 'consume') {
            if (!lastProduce) {
                errors.push({
                    codigo: 'R3_consume_sin_produce',
                    pasoId: paso.id,
                    mensaje: `El paso ${paso.id} (familia '${familia.codigo}') consume layout pero ` +
                        `no hay ningún paso 'produce' aguas arriba en la ruta.`,
                });
                continue;
            }
            if (lastProduce.maquinaPrintableWidthMm != null &&
                paso.maquinaPrintableWidthMm != null &&
                paso.maquinaPrintableWidthMm < lastProduce.maquinaPrintableWidthMm) {
                const producePorNombre = lastProduceFamilia?.nombre ?? lastProduce.familiaCodigo;
                warnings.push(`Paso ${paso.id} (${familia.nombre}) tiene máquina de ${paso.maquinaPrintableWidthMm}mm ` +
                    `pero el paso produce ${lastProduce.id} (${producePorNombre}) puede generar layouts ` +
                    `hasta ${lastProduce.maquinaPrintableWidthMm}mm. El nesting del paso produce ` +
                    `debería limitarse al mínimo común (${paso.maquinaPrintableWidthMm}mm) para evitar ` +
                    `piezas que no entren en la máquina posterior.`);
            }
        }
    }
    return {
        ok: errors.length === 0,
        errors,
        warnings,
    };
}
function validateConfigNesting(pasoId, algoritmo, config) {
    if (!config)
        return [];
    const errors = [];
    const numericFields = [
        'separacionMm',
        'separacionHMm',
        'separacionVMm',
        'separacionHorizontalMm',
        'separacionVerticalMm',
        'margenMm',
        'margenLateralMm',
        'marginLeftMm',
        'marginStartMm',
        'marginEndMm',
    ];
    for (const field of numericFields) {
        if (field in config) {
            const value = Number(config[field]);
            if (Number.isFinite(value) && value < 0) {
                errors.push({
                    codigo: 'R5_config_invalida',
                    pasoId,
                    mensaje: `configNesting.${field} no puede ser negativo (paso ${pasoId}).`,
                });
            }
        }
    }
    if (algoritmo === 'nesting-rollo' && config.panelizado && typeof config.panelizado === 'object') {
        const panel = config.panelizado;
        if (panel.activo === true) {
            if (typeof panel.maxPanelWidthMm !== 'number' || panel.maxPanelWidthMm <= 0) {
                errors.push({
                    codigo: 'R5_config_invalida',
                    pasoId,
                    mensaje: `Panelizado activo requiere maxPanelWidthMm > 0 (paso ${pasoId}).`,
                });
            }
            if (panel.axis !== 'vertical' && panel.axis !== 'horizontal') {
                errors.push({
                    codigo: 'R5_config_invalida',
                    pasoId,
                    mensaje: `Panelizado activo requiere axis 'vertical' o 'horizontal' (paso ${pasoId}).`,
                });
            }
        }
    }
    if (algoritmo === 'nesting-hoja' && config.criterio !== undefined) {
        const criteriosValidos = ['menor_cantidad_pliegos', 'mayor_aprovechamiento', 'mayor_piezas_por_pliego'];
        if (typeof config.criterio !== 'string' || !criteriosValidos.includes(config.criterio)) {
            errors.push({
                codigo: 'R5_config_invalida',
                pasoId,
                mensaje: `Criterio inválido '${config.criterio}'. Válidos: ${criteriosValidos.join(', ')}.`,
            });
        }
    }
    return errors;
}
//# sourceMappingURL=ruta-validator.js.map