"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTPUTS_CANONICOS = void 0;
exports.isOutputCanonico = isOutputCanonico;
exports.OUTPUTS_CANONICOS = {
    piezasPorPlaca: 'piezasPorPlaca',
    pliegos: 'pliegos',
    hojasImpresas: 'hojasImpresas',
    planchasNecesarias: 'planchasNecesarias',
    impresiones: 'impresiones',
    m2Impresos: 'm2Impresos',
    metrosLinealesConsumidos: 'metrosLinealesConsumidos',
    panelesGenerados: 'panelesGenerados',
    areaDesperdicioM2: 'areaDesperdicioM2',
    piezasImpresas: 'piezasImpresas',
    placasUsadas: 'placasUsadas',
    aprovechamientoPct: 'aprovechamientoPct',
    filmImpresoM2: 'filmImpresoM2',
    prendasTermofijadas: 'prendasTermofijadas',
    cortesRealizados: 'cortesRealizados',
    piezasCortadas: 'piezasCortadas',
    metrosLinealesCortados: 'metrosLinealesCortados',
    piezasVolumetricas: 'piezasVolumetricas',
    plieguesRealizados: 'plieguesRealizados',
    perforacionesRealizadas: 'perforacionesRealizadas',
    troquelesUsados: 'troquelesUsados',
    areaGrabadaM2: 'areaGrabadaM2',
    piezasGrabadas: 'piezasGrabadas',
    peliculaLaminadaM2: 'peliculaLaminadaM2',
    piezasLaminadas: 'piezasLaminadas',
    areaDecoradaM2: 'areaDecoradaM2',
    areaPintadaM2: 'areaPintadaM2',
    cuadernosTerminados: 'cuadernosTerminados',
    espiralesConsumidas: 'espiralesConsumidas',
    grapasUsadas: 'grapasUsadas',
    metrosCosido: 'metrosCosido',
    metrosSoldados: 'metrosSoldados',
    piezasEnsambladas: 'piezasEnsambladas',
    modulosLEDInstalados: 'modulosLEDInstalados',
    metrosCableado: 'metrosCableado',
    horasDiseno: 'horasDiseno',
    horasPrePrensa: 'horasPrePrensa',
    visitaMedidasRealizada: 'visitaMedidasRealizada',
    horasInstalacionInSitu: 'horasInstalacionInSitu',
    kmTraslado: 'kmTraslado',
    piezasEmbaladas: 'piezasEmbaladas',
    piezasArmadas: 'piezasArmadas',
    insumosGestionados: 'insumosGestionados',
    subProductoCotizado: 'subProductoCotizado',
};
function isOutputCanonico(name) {
    return name in exports.OUTPUTS_CANONICOS;
}
//# sourceMappingURL=outputs-canonicos.js.map