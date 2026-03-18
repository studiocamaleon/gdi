"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasRequiredMachineDataByTemplate = hasRequiredMachineDataByTemplate;
exports.validateMachinePayloadByTemplate = validateMachinePayloadByTemplate;
const upsert_maquina_dto_1 = require("./dto/upsert-maquina.dto");
const DIRECT_MACHINE_FIELD_KEYS = new Set([
    'anchoUtil',
    'largoUtil',
    'altoUtil',
    'espesorMaximo',
    'pesoMaximo',
]);
const RULES = {
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.router_cnc]: {
        requiredMachineKeys: ['ejeXUtil', 'ejeYUtil', 'ejeZUtil'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.corte_laser]: {
        requiredMachineKeys: ['ejeXUtil', 'ejeYUtil', 'tipoLaser'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.guillotina]: {
        requiredMachineKeys: ['altoBocaMm'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.laminadora_bopp_rollo]: {
        requiredMachineKeys: ['anchoRolloMm', 'velocidadMMin', 'mermaArranqueMm', 'mermaCierreMm'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.redondeadora_puntas]: {
        requiredMachineKeys: ['golpesMinNominal', 'maxEspesorPilaMm'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.perforadora]: {
        requiredMachineKeys: ['pliegosMinNominal', 'lineasPorPasadaMax'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_3d]: {
        requiredMachineKeys: ['volumenX', 'volumenY', 'volumenZ', 'tecnologia'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_dtf]: {
        requiredMachineKeys: ['anchoUtil', 'configuracionCanales'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_dtf_uv]: {
        requiredMachineKeys: [
            'anchoUtil',
            'configuracionCanales',
            'sistemaLaminacionTransferencia',
        ],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_uv_mesa_extensora]: {
        requiredMachineKeys: [
            'anchoCama',
            'largoCama',
            'alturaMaximaObjeto',
            'tipoMesa',
            'configuracionCanales',
        ],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_uv_cilindrica]: {
        requiredMachineKeys: [
            'diametroMinimo',
            'diametroMaximo',
            'largoUtil',
            'configuracionCanales',
        ],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_uv_flatbed]: {
        requiredMachineKeys: [
            'anchoCama',
            'largoCama',
            'alturaMaximaObjeto',
            'tipoMesa',
            'configuracionCanales',
        ],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_uv_rollo]: {
        requiredMachineKeys: ['anchoUtil', 'configuracionCanales'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_solvente]: {
        requiredMachineKeys: ['anchoUtil'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_inyeccion_tinta]: {
        requiredMachineKeys: ['anchoUtil'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_latex]: {
        requiredMachineKeys: ['anchoUtil'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_sublimacion_gran_formato]: {
        requiredMachineKeys: ['anchoUtil'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_laser]: {
        requiredMachineKeys: [
            'anchoMinHoja',
            'anchoMaxHoja',
            'altoMinHoja',
            'altoMaxHoja',
            'configuracionColor',
        ],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.plotter_cad]: {
        requiredMachineKeys: ['anchoUtil'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.mesa_de_corte]: {
        requiredMachineKeys: ['anchoUtil', 'largoUtil'],
    },
    [upsert_maquina_dto_1.PlantillaMaquinariaDto.plotter_de_corte]: {
        requiredMachineKeys: ['anchoUtil', 'largoUtil'],
    },
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
function getMachineFieldValue(payload, key) {
    const directRecord = payload;
    const directValue = directRecord[key];
    if (DIRECT_MACHINE_FIELD_KEYS.has(key) && hasValue(directValue)) {
        return directValue;
    }
    return (payload.parametrosTecnicos ?? {})[key];
}
function hasRequiredMachineDataByTemplate(payload) {
    const rule = RULES[payload.plantilla];
    if (!rule) {
        return false;
    }
    return rule.requiredMachineKeys.every((key) => hasValue(getMachineFieldValue(payload, key)));
}
function validateMachinePayloadByTemplate(payload) {
    const rule = RULES[payload.plantilla];
    if (!rule) {
        return;
    }
    const missing = rule.requiredMachineKeys.filter((key) => !hasValue(getMachineFieldValue(payload, key)));
    if (missing.length > 0) {
        throw new Error(`La maquina debe completar los campos ${missing.join(', ')} para la plantilla ${payload.plantilla}.`);
    }
}
//# sourceMappingURL=maquinaria-template-machine-rules.js.map