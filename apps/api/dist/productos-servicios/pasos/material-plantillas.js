"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MATERIAL_PLANTILLAS = void 0;
exports.calcularMaterialesDelPaso = calcularMaterialesDelPaso;
const plantillaImpresionPorHoja = (ctx) => {
    const out = [];
    const layoutHoja = ctx.layout?.algoritmo === 'nesting-hoja' ? ctx.layout.result : null;
    const pliegos = layoutHoja?.pliegosNecesarios ?? 0;
    if (pliegos === 0)
        return out;
    const usaPliegoImpresion = layoutHoja?.sustratoElegido != null && layoutHoja?.sustratosNecesarios != null;
    const cantidadPapel = usaPliegoImpresion
        ? layoutHoja.sustratosNecesarios
        : pliegos;
    const formatoPapel = usaPliegoImpresion
        ? layoutHoja.sustratoElegido
        : layoutHoja.pliegoElegido;
    const unidadPapel = usaPliegoImpresion ? 'sustrato' : 'pliego';
    const papelPrecio = Number(ctx.variante.papelVariante?.precioReferencia ?? 0) > 0
        ? Number(ctx.variante.papelVariante.precioReferencia)
        : Number(ctx.configProducto.papelPrecioPorPliego ?? 40);
    if (papelPrecio > 0) {
        const fuente = Number(ctx.variante.papelVariante?.precioReferencia ?? 0) > 0
            ? 'papelVariante.precioReferencia'
            : 'config.papelPrecioPorPliego';
        out.push({
            nombre: usaPliegoImpresion
                ? `Papel ${ctx.variante.papelVariante?.sku ?? 'default'} (${formatoPapel.codigo} → ${layoutHoja.pliegoElegido.codigo} ×${layoutHoja.pliegosPorSustrato})`
                : `Papel ${ctx.variante.papelVariante?.sku ?? 'default'}`,
            cantidad: cantidadPapel,
            unidad: unidadPapel,
            precioUnitario: papelPrecio,
            costo: cantidadPapel * papelPrecio,
            fuente,
        });
    }
    const caras = (ctx.selecciones.get('caras') ?? 'simple_faz').toLowerCase();
    const multCaras = caras === 'doble_faz' ? 2 : 1;
    const tipoImpresion = (ctx.selecciones.get('tipo_impresion') ??
        ctx.selecciones.get('tipoImpresion') ??
        'cmyk').toUpperCase();
    const clicsPorPliego = Number(ctx.configProducto.impresionClicsPorPliego ?? 1);
    const costoClic = tipoImpresion === 'BN'
        ? Number(ctx.configProducto.impresionCostoClicBN ?? 10)
        : Number(ctx.configProducto.impresionCostoClic ?? 30);
    const clicsTotales = pliegos * clicsPorPliego * multCaras;
    if (clicsTotales > 0 && costoClic > 0) {
        out.push({
            nombre: `Clics ${tipoImpresion}`,
            cantidad: clicsTotales,
            unidad: 'clic',
            precioUnitario: costoClic,
            costo: clicsTotales * costoClic,
            fuente: 'config.impresionCostoClic' + (tipoImpresion === 'BN' ? 'BN' : ''),
        });
    }
    return out;
};
const plantillaImpresionPorArea = (ctx) => {
    const out = [];
    if (ctx.layout?.algoritmo !== 'nesting-rollo')
        return out;
    const result = ctx.layout.result;
    const metrosLineales = result.consumedLengthMm / 1000;
    const areaUtilM2 = result.usefulAreaM2;
    const precioMl = Number(ctx.configProducto.sustratoPrecioPorMl ?? 0);
    if (precioMl > 0 && metrosLineales > 0) {
        out.push({
            nombre: 'Sustrato (rollo)',
            cantidad: metrosLineales,
            unidad: 'metro lineal',
            precioUnitario: precioMl,
            costo: metrosLineales * precioMl,
            fuente: 'config.sustratoPrecioPorMl',
        });
    }
    const tintaMlPorM2 = Number(ctx.configProducto.tintaMlPorM2 ?? 15);
    const tintaPrecioMl = Number(ctx.configProducto.tintaPrecioMl ?? 2.5);
    const tintaMl = areaUtilM2 * tintaMlPorM2;
    if (tintaMl > 0 && tintaPrecioMl > 0) {
        out.push({
            nombre: 'Tinta',
            cantidad: Math.round(tintaMl * 100) / 100,
            unidad: 'ml',
            precioUnitario: tintaPrecioMl,
            costo: tintaMl * tintaPrecioMl,
            fuente: 'config.tintaMlPorM2 × tintaPrecioMl',
        });
    }
    return out;
};
const plantillaLaminado = (ctx) => {
    if (!ctx.layout)
        return [];
    let areaM2 = 0;
    if (ctx.layout.algoritmo === 'nesting-hoja') {
        const r = ctx.layout.result;
        areaM2 =
            (r.pliegoElegido.anchoMm * r.pliegoElegido.altoMm * r.pliegosNecesarios) / 1_000_000;
    }
    else if (ctx.layout.algoritmo === 'nesting-rollo') {
        areaM2 = ctx.layout.result.usefulAreaM2;
    }
    if (areaM2 === 0)
        return [];
    const mermaPct = Number(ctx.configProducto.laminadoMermaPct ?? 0.05);
    const precioM2 = Number(ctx.configProducto.laminadoFilmPrecioM2 ?? 1800);
    const filmM2 = areaM2 * (1 + mermaPct);
    return [
        {
            nombre: 'Film laminado BOPP',
            cantidad: Math.round(filmM2 * 100) / 100,
            unidad: 'm²',
            precioUnitario: precioM2,
            costo: filmM2 * precioM2,
            fuente: 'config.laminadoFilmPrecioM2 (+merma)',
        },
    ];
};
const plantillaOperacionManual = (ctx) => {
    const precioBolsa = Number(ctx.configProducto.embalajePrecioBolsa ?? 0);
    if (precioBolsa === 0)
        return [];
    return [
        {
            nombre: 'Bolsa / packaging',
            cantidad: ctx.cantidadPedida,
            unidad: 'bolsa',
            precioUnitario: precioBolsa,
            costo: ctx.cantidadPedida * precioBolsa,
            fuente: 'config.embalajePrecioBolsa',
        },
    ];
};
const plantillaEncuadernado = (ctx) => {
    const insumosPorTalonario = Number(ctx.configProducto.encuadernacionInsumosPorTalonario ?? 30);
    if (insumosPorTalonario === 0)
        return [];
    return [
        {
            nombre: 'Insumos encuadernación',
            cantidad: ctx.cantidadPedida,
            unidad: 'unidad',
            precioUnitario: insumosPorTalonario,
            costo: ctx.cantidadPedida * insumosPorTalonario,
            fuente: 'config.encuadernacionInsumosPorTalonario',
        },
    ];
};
exports.MATERIAL_PLANTILLAS = {
    impresion_por_hoja: plantillaImpresionPorHoja,
    impresion_por_area: plantillaImpresionPorArea,
    laminado: plantillaLaminado,
    operacion_manual: plantillaOperacionManual,
    encuadernado: plantillaEncuadernado,
};
function calcularMaterialesDelPaso(familiaCodigo, ctx) {
    const plantilla = exports.MATERIAL_PLANTILLAS[familiaCodigo];
    if (!plantilla)
        return [];
    return plantilla(ctx);
}
//# sourceMappingURL=material-plantillas.js.map