"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyTalonarioImposicionConstraints = applyTalonarioImposicionConstraints;
exports.calculateTalonarioGrouping = calculateTalonarioGrouping;
exports.calculateTalonarioPaperCosts = calculateTalonarioPaperCosts;
exports.calculateTalonarioExtraMaterials = calculateTalonarioExtraMaterials;
exports.calculateTalonarioGuillotinado = calculateTalonarioGuillotinado;
exports.parseTalonarioMotorConfig = parseTalonarioMotorConfig;
exports.resolveTipoCopia = resolveTipoCopia;
const ROTATED_BORDE_MAP = {
    superior: 'derecho',
    inferior: 'izquierdo',
    izquierdo: 'superior',
    derecho: 'inferior',
};
function applyTalonarioImposicionConstraints(base, config) {
    const teteBeche = config.encuadernacion.tipo === 'emblocado';
    const bordeOriginal = config.puntillado.borde ?? null;
    const bordeRender = base.orientacion === 'rotada' && bordeOriginal
        ? (ROTATED_BORDE_MAP[bordeOriginal] ?? bordeOriginal)
        : bordeOriginal;
    return {
        ...base,
        teteBeche,
        puntilladoLineMm: config.puntillado.habilitado
            ? Number(config.puntillado.distanciaBordeMm ?? 0)
            : null,
        puntilladoBorde: config.puntillado.habilitado ? bordeRender : null,
        encuadernacionTipo: config.encuadernacion.tipo,
    };
}
function calculateTalonarioGrouping(input) {
    const { cantidadTalonarios, posesXPliego, numerosXTalonario, modoTalonarioIncompleto } = input;
    if (posesXPliego <= 0 || numerosXTalonario <= 0) {
        return {
            talonariosEfectivos: 0,
            talonariosPedidos: cantidadTalonarios,
            posesXPliego,
            talonariosPorGrupo: posesXPliego,
            gruposCompletos: 0,
            talonariosResiduo: 0,
            pliegosXCapa: 0,
            pliegosDesperdicio: 0,
            numerosXTalonario,
            modoIncompleto: modoTalonarioIncompleto,
        };
    }
    const talonariosPorGrupo = posesXPliego;
    const gruposCompletos = Math.floor(cantidadTalonarios / talonariosPorGrupo);
    const talonariosResiduo = cantidadTalonarios % talonariosPorGrupo;
    let pliegosXCapa;
    let pliegosDesperdicio;
    let talonariosEfectivos;
    if (talonariosResiduo === 0) {
        pliegosXCapa = gruposCompletos * numerosXTalonario;
        pliegosDesperdicio = 0;
        talonariosEfectivos = cantidadTalonarios;
    }
    else if (modoTalonarioIncompleto === 'pose_completa') {
        const gruposTotales = gruposCompletos + 1;
        pliegosXCapa = gruposTotales * numerosXTalonario;
        const posesVacias = talonariosPorGrupo - talonariosResiduo;
        pliegosDesperdicio = posesVacias * numerosXTalonario;
        talonariosEfectivos = gruposTotales * talonariosPorGrupo;
    }
    else {
        pliegosXCapa = gruposCompletos * numerosXTalonario + numerosXTalonario;
        const posesVacias = talonariosPorGrupo - talonariosResiduo;
        pliegosDesperdicio = posesVacias * numerosXTalonario;
        talonariosEfectivos = cantidadTalonarios;
    }
    return {
        talonariosEfectivos,
        talonariosPedidos: cantidadTalonarios,
        posesXPliego,
        talonariosPorGrupo,
        gruposCompletos,
        talonariosResiduo,
        pliegosXCapa,
        pliegosDesperdicio,
        numerosXTalonario,
        modoIncompleto: modoTalonarioIncompleto,
    };
}
function calculateTalonarioPaperCosts(input) {
    const layers = [];
    let totalPapel = 0;
    for (const papel of input.tipoCopiaDefinicion.papeles) {
        const precioBase = papel.papelVarianteId
            ? (input.papelPrecioByVarianteId.get(papel.papelVarianteId) ?? 0)
            : 0;
        const pliegosPorSustrato = papel.papelVarianteId
            ? (input.pliegosPorSustratoByVarianteId.get(papel.papelVarianteId) ?? 1)
            : 1;
        const costoUnitario = pliegosPorSustrato > 0 ? precioBase / pliegosPorSustrato : 0;
        const costoTotal = costoUnitario * input.pliegosXCapa;
        layers.push({
            capaIndex: papel.capaIndex,
            capaLabel: papel.capaLabel,
            colorPapel: papel.colorPapel,
            papelVarianteId: papel.papelVarianteId,
            pliegos: input.pliegosXCapa,
            costoUnitario: round6(costoUnitario),
            costoTotal: round6(costoTotal),
        });
        totalPapel += costoTotal;
    }
    return { layers, totalPapel: round6(totalPapel) };
}
function calculateTalonarioExtraMaterials(input) {
    const items = [];
    let total = 0;
    if (input.config.materialesExtra.cartonBase.habilitado) {
        const varianteId = input.config.materialesExtra.cartonBase.materiaPrimaVarianteId;
        const precio = varianteId ? (input.materialPrecioByVarianteId.get(varianteId) ?? 0) : 0;
        const gruposTotales = input.grouping.gruposCompletos + (input.grouping.talonariosResiduo > 0 ? 1 : 0);
        const cant = gruposTotales;
        const costo = cant * precio;
        items.push({
            tipo: 'carton_base',
            nombre: 'Cartón base',
            cantidad: cant,
            costoUnitario: round6(precio),
            costoTotal: round6(costo),
        });
        total += costo;
    }
    if (input.config.materialesExtra.hojaBlancaSuperior.habilitado) {
        const varianteId = input.config.materialesExtra.hojaBlancaSuperior.materiaPrimaVarianteId;
        const precio = varianteId ? (input.materialPrecioByVarianteId.get(varianteId) ?? 0) : 0;
        const gruposTotales = input.grouping.gruposCompletos + (input.grouping.talonariosResiduo > 0 ? 1 : 0);
        const cant = gruposTotales;
        const costo = cant * precio;
        items.push({
            tipo: 'hoja_blanca_superior',
            nombre: 'Hoja blanca superior',
            cantidad: cant,
            costoUnitario: round6(precio),
            costoTotal: round6(costo),
        });
        total += costo;
    }
    return { items, total: round6(total) };
}
function calculateTalonarioGuillotinado(input) {
    const espesorTalonarioHojas = input.numerosXTalonario * input.capas +
        (input.tieneCarton ? 1 : 0) +
        (input.tieneHojaBlanca ? 1 : 0);
    if (input.capacidadMaxHojas <= 0 || espesorTalonarioHojas <= 0) {
        return { espesorTalonarioHojas, talonariosXTanda: 1, tandas: input.cantidadTalonarios };
    }
    const talonariosXTanda = Math.max(1, Math.floor(input.capacidadMaxHojas / espesorTalonarioHojas));
    const tandas = Math.ceil(input.cantidadTalonarios / talonariosXTanda);
    return { espesorTalonarioHojas, talonariosXTanda, tandas };
}
function parseTalonarioMotorConfig(raw) {
    return raw;
}
function resolveTipoCopia(config, tipoCopiaSeleccionado) {
    if (!config.tipoCopiaDefiniciones?.length)
        return null;
    if (tipoCopiaSeleccionado) {
        const normalized = tipoCopiaSeleccionado.toUpperCase();
        const found = config.tipoCopiaDefiniciones.find((d) => d.valor.toUpperCase() === normalized);
        if (found)
            return found;
    }
    return config.tipoCopiaDefiniciones[0];
}
function round6(n) {
    return Math.round(n * 1000000) / 1000000;
}
//# sourceMappingURL=talonario.calculations.js.map