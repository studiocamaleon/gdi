"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.construirConsumiblesDelPerfil = construirConsumiblesDelPerfil;
exports.construirDesgasteDelPaso = construirDesgasteDelPaso;
const TIPOS_SENSIBLES_CARAS = new Set([
    'TONER',
    'TINTA',
    'BARNIZ',
    'PRIMER',
    'RESINA',
    'POLVO',
]);
function areaUtilM2(layout) {
    if (!layout)
        return 0;
    if (layout.algoritmo === 'nesting-rollo')
        return layout.result.usefulAreaM2;
    if (layout.algoritmo === 'nesting-hoja') {
        const r = layout.result;
        return ((r.pliegoElegido.anchoMm * r.pliegoElegido.altoMm * r.pliegosNecesarios) /
            1_000_000);
    }
    if (layout.algoritmo === 'nesting-placa-rigida') {
        const r = layout.result;
        const placas = Math.ceil(1 / Math.max(1, r.piezasPorPlaca));
        return placas;
    }
    return 0;
}
function metrosLineales(layout) {
    if (layout?.algoritmo === 'nesting-rollo') {
        return layout.result.consumedLengthMm / 1000;
    }
    return 0;
}
function unidadesProductivasDelLayout(layout, cantidadPedida) {
    if (!layout)
        return cantidadPedida;
    if (layout.algoritmo === 'nesting-hoja')
        return layout.result.pliegosNecesarios;
    if (layout.algoritmo === 'nesting-placa-rigida') {
        return Math.ceil(cantidadPedida / Math.max(1, layout.result.piezasPorPlaca));
    }
    return cantidadPedida;
}
function unidadesBaseParaConsumible(unidadConsumible, ctx) {
    switch (unidadConsumible.toUpperCase()) {
        case 'ML':
        case 'LITRO':
        case 'GRAMO':
        case 'KG':
        case 'M2':
            return areaUtilM2(ctx.layout);
        case 'METRO_LINEAL':
            return metrosLineales(ctx.layout);
        case 'PAGINA':
        case 'A4_EQUIV':
        case 'UNIDAD':
            return unidadesProductivasDelLayout(ctx.layout, ctx.cantidadPedida);
        default:
            return ctx.cantidadPedida;
    }
}
function unidadesBaseParaDesgaste(unidadDesgaste, ctx) {
    switch (unidadDesgaste.toUpperCase()) {
        case 'M2':
            return areaUtilM2(ctx.layout);
        case 'METROS_LINEALES':
            return metrosLineales(ctx.layout);
        case 'COPIAS_A4_EQUIV':
        case 'PIEZAS':
        case 'CICLOS':
            return unidadesProductivasDelLayout(ctx.layout, ctx.cantidadPedida);
        case 'HORAS':
            return 0;
        default:
            return 0;
    }
}
function decimalToNumber(v) {
    if (v == null)
        return 0;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
}
function nombreLegible(base, variante) {
    return variante.nombreVariante?.trim() || base || variante.sku;
}
function construirConsumiblesDelPerfil(consumibles, ctx) {
    if (!consumibles || consumibles.length === 0)
        return [];
    const perfilId = ctx.perfil?.id ?? null;
    const dobleFaz = Boolean(ctx.perfil?.dobleFaz);
    return consumibles
        .filter((c) => c.activo &&
        (c.perfilOperativoId === null || c.perfilOperativoId === perfilId))
        .map((c) => {
        const consumoBase = decimalToNumber(c.consumoBase);
        if (consumoBase <= 0)
            return null;
        const unidadesBase = unidadesBaseParaConsumible(c.unidad, ctx);
        if (unidadesBase <= 0)
            return null;
        const aplicaCaras = TIPOS_SENSIBLES_CARAS.has(c.tipo.toUpperCase());
        const factorCaras = aplicaCaras && dobleFaz ? 2 : 1;
        const cantidad = unidadesBase * consumoBase * factorCaras;
        if (cantidad <= 0)
            return null;
        const precioUnitario = decimalToNumber(c.materiaPrimaVariante.precioReferencia);
        return {
            nombre: nombreLegible(c.nombre, c.materiaPrimaVariante),
            cantidad: Math.round(cantidad * 10000) / 10000,
            unidad: c.unidad.toLowerCase(),
            precioUnitario,
            costo: cantidad * precioUnitario,
            fuente: 'MaquinaConsumible',
        };
    })
        .filter((m) => m !== null);
}
function construirDesgasteDelPaso(componentesDesgaste, ctx) {
    if (!componentesDesgaste || componentesDesgaste.length === 0)
        return [];
    return componentesDesgaste
        .filter((c) => c.activo)
        .map((c) => {
        const vidaUtil = decimalToNumber(c.vidaUtilEstimada);
        if (vidaUtil <= 0)
            return null;
        const usoPaso = unidadesBaseParaDesgaste(c.unidadDesgaste, ctx);
        if (usoPaso <= 0)
            return null;
        const precioComponente = decimalToNumber(c.materiaPrimaVariante.precioReferencia);
        if (precioComponente <= 0)
            return null;
        const costoProrrateado = (usoPaso / vidaUtil) * precioComponente;
        return {
            nombre: `${nombreLegible(c.nombre, c.materiaPrimaVariante)} (desgaste)`,
            cantidad: Math.round((usoPaso / vidaUtil) * 1000000) / 1000000,
            unidad: c.unidadDesgaste.toLowerCase(),
            precioUnitario: precioComponente,
            costo: costoProrrateado,
            fuente: 'MaquinaDesgaste',
        };
    })
        .filter((m) => m !== null);
}
//# sourceMappingURL=maquina-consumibles.js.map