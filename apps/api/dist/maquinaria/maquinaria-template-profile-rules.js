"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePerfilOperativoByTemplate = validatePerfilOperativoByTemplate;
const upsert_maquina_dto_1 = require("./dto/upsert-maquina.dto");
const COMMON_PROFILE_KEYS = [
    'nombre',
    'tipoPerfil',
    'activo',
    'anchoAplicable',
    'altoAplicable',
    'modoTrabajo',
    'productividad',
    'unidadProductividad',
    'tiempoPreparacionMin',
    'tiempoRipMin',
    'cantidadPasadas',
    'dobleFaz',
];
const DIRECT_PROFILE_FIELD_KEYS = new Set([
    'nombre',
    'productividad',
    'tiempoPreparacionMin',
    'tiempoRipMin',
    'cantidadPasadas',
    'dobleFaz',
    'anchoAplicable',
    'altoAplicable',
    'modoTrabajo',
]);
function buildRule(params) {
    return {
        allowedProfileKeys: new Set([
            ...COMMON_PROFILE_KEYS,
            ...params.profileFieldKeys,
        ]),
        requiredProfileKeys: new Set(params.requiredFieldKeys),
        modeSourceKeys: new Set(params.modeSourceKeys ?? []),
    };
}
const RULES = {
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_laser]: buildRule({
        profileFieldKeys: ['formatoObjetivo', 'modoImpresion'],
        requiredFieldKeys: [
            'nombre',
            'formatoObjetivo',
            'modoImpresion',
            'productividad',
        ],
        modeSourceKeys: ['modoImpresion'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_uv_flatbed]: buildRule({
        profileFieldKeys: ['modoImpresion'],
        requiredFieldKeys: ['nombre', 'modoImpresion', 'productividad'],
        modeSourceKeys: ['modoImpresion'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_uv_mesa_extensora]: buildRule({
        profileFieldKeys: ['modoImpresion'],
        requiredFieldKeys: ['nombre', 'modoImpresion', 'productividad'],
        modeSourceKeys: ['modoImpresion'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_uv_rollo]: buildRule({
        profileFieldKeys: ['modoImpresion'],
        requiredFieldKeys: ['nombre', 'modoImpresion', 'productividad'],
        modeSourceKeys: ['modoImpresion'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_uv_cilindrica]: buildRule({
        profileFieldKeys: ['modoImpresion'],
        requiredFieldKeys: ['nombre', 'modoImpresion', 'productividad'],
        modeSourceKeys: ['modoImpresion'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_solvente]: buildRule({
        profileFieldKeys: [],
        requiredFieldKeys: ['nombre', 'productividad'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_inyeccion_tinta]: buildRule({
        profileFieldKeys: [],
        requiredFieldKeys: ['nombre', 'productividad'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_latex]: buildRule({
        profileFieldKeys: [],
        requiredFieldKeys: ['nombre', 'productividad'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_sublimacion_gran_formato]: buildRule({
        profileFieldKeys: [],
        requiredFieldKeys: ['nombre', 'productividad'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.plotter_cad]: buildRule({
        profileFieldKeys: [],
        requiredFieldKeys: ['nombre', 'productividad'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_dtf]: buildRule({
        profileFieldKeys: [],
        requiredFieldKeys: ['nombre', 'productividad'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_dtf_uv]: buildRule({
        profileFieldKeys: [],
        requiredFieldKeys: ['nombre', 'productividad'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_3d]: buildRule({
        profileFieldKeys: ['materialObjetivo', 'alturaCapa'],
        requiredFieldKeys: ['nombre'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.router_cnc]: buildRule({
        profileFieldKeys: [
            'tipoOperacion',
            'materialObjetivo',
            'herramienta',
            'profundidadMaximaPorPasada',
            'velocidadAvance',
            'rpmSpindle',
        ],
        requiredFieldKeys: ['nombre', 'tipoOperacion'],
        modeSourceKeys: ['tipoOperacion'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.corte_laser]: buildRule({
        profileFieldKeys: [
            'tipoOperacion',
            'materialObjetivo',
            'potenciaAplicada',
            'velocidadTrabajo',
        ],
        requiredFieldKeys: ['nombre', 'tipoOperacion'],
        modeSourceKeys: ['tipoOperacion'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.mesa_de_corte]: buildRule({
        profileFieldKeys: ['materialObjetivo', 'herramienta'],
        requiredFieldKeys: ['nombre'],
    }),
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.plotter_de_corte]: buildRule({
        profileFieldKeys: ['materialObjetivo', 'herramienta'],
        requiredFieldKeys: ['nombre'],
    }),
};
function hasValue(value) {
    if (value === null || value === undefined) {
        return false;
    }
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    return true;
}
function getPerfilFieldValue(perfil, fieldKey) {
    const directRecord = perfil;
    const directValue = directRecord[fieldKey];
    if (DIRECT_PROFILE_FIELD_KEYS.has(fieldKey) && directValue !== undefined) {
        return directValue;
    }
    const detailValue = (perfil.detalle ?? {})[fieldKey];
    if (detailValue !== undefined) {
        return detailValue;
    }
    return directValue;
}
function validatePerfilOperativoByTemplate(plantilla, perfil) {
    const rule = RULES[plantilla];
    const perfilName = perfil.nombre.trim() || 'sin nombre';
    for (const detailKey of Object.keys(perfil.detalle ?? {})) {
        if (!rule.allowedProfileKeys.has(detailKey)) {
            throw new Error(`El perfil operativo ${perfilName} incluye el campo ${detailKey}, que no corresponde a la plantilla ${plantilla}.`);
        }
    }
    for (const requiredKey of rule.requiredProfileKeys) {
        const value = getPerfilFieldValue(perfil, requiredKey);
        if (!hasValue(value)) {
            throw new Error(`El perfil operativo ${perfilName} debe completar el campo ${requiredKey} para la plantilla ${plantilla}.`);
        }
    }
    if (rule.modeSourceKeys.size > 0) {
        const hasAnyModeSource = Array.from(rule.modeSourceKeys).some((key) => hasValue(getPerfilFieldValue(perfil, key)));
        if (!hasAnyModeSource) {
            throw new Error(`El perfil operativo ${perfilName} debe completar un campo de modo de trabajo definido por la plantilla ${plantilla}.`);
        }
    }
}
//# sourceMappingURL=maquinaria-template-profile-rules.js.map