"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLANTILLAS_FLEXIBLE_MONTADO = exports.PLANTILLAS_IMPRESION_DIRECTA = exports.DEFAULT_RIGID_PRINTED_CONFIG = exports.DEFAULT_IMPRESION_TIPO_CONFIG = exports.DEFAULT_IMPOSICION_CONFIG = void 0;
exports.DEFAULT_IMPOSICION_CONFIG = {
    estrategiaCosteo: 'segmentos_placa',
    segmentosPlaca: [25, 50, 75, 100],
    separacionHorizontalMm: 3,
    separacionVerticalMm: 3,
    permitirRotacion: true,
    prioridadNesting: 'rigido_manda',
    orientacionPlaca: 'usar_lado_corto',
    margenMaquina: { arriba: 0, abajo: 0, izquierda: 0, derecha: 0 },
};
exports.DEFAULT_IMPRESION_TIPO_CONFIG = {
    maquinasCompatibles: [],
    perfilesCompatibles: [],
    maquinaDefaultId: null,
    perfilDefaultId: null,
    carasDisponibles: ['simple_faz'],
    carasDefault: 'simple_faz',
};
exports.DEFAULT_RIGID_PRINTED_CONFIG = {
    tipoPlantilla: 'rigidos_impresos',
    tiposImpresion: [],
    impresionDirecta: { ...exports.DEFAULT_IMPRESION_TIPO_CONFIG },
    flexibleMontado: { ...exports.DEFAULT_IMPRESION_TIPO_CONFIG },
    rutaImpresionDirectaId: null,
    rutaFlexibleMontadoId: null,
    materialRigidoId: null,
    variantesCompatibles: [],
    placaVarianteIdDefault: null,
    materialFlexibleId: null,
    variantesFlexiblesCompatibles: [],
    varianteFlexibleDefaultId: null,
    carasDisponibles: ['simple_faz'],
    carasDefault: 'simple_faz',
    modoMedidas: 'estandar',
    imposicion: { ...exports.DEFAULT_IMPOSICION_CONFIG },
};
exports.PLANTILLAS_IMPRESION_DIRECTA = [
    'IMPRESORA_UV_MESA_EXTENSORA',
    'IMPRESORA_UV_FLATBED',
];
exports.PLANTILLAS_FLEXIBLE_MONTADO = [
    'IMPRESORA_UV_ROLLO',
    'IMPRESORA_SOLVENTE',
    'IMPRESORA_LATEX',
    'IMPRESORA_INYECCION_TINTA',
    'IMPRESORA_SUBLIMACION_GRAN_FORMATO',
    'PLOTTER_DE_CORTE',
];
//# sourceMappingURL=rigid-printed.types.js.map