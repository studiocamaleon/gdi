import type { UpsertMaquinaDto } from './dto/upsert-maquina.dto';
import { PlantillaMaquinariaDto } from './dto/upsert-maquina.dto';

type MachineTemplateRule = {
  requiredMachineKeys: string[];
};

const DIRECT_MACHINE_FIELD_KEYS = new Set([
  'anchoUtil',
  'largoUtil',
  'altoUtil',
  'espesorMaximo',
  'pesoMaximo',
]);

const RULES: Record<PlantillaMaquinariaDto, MachineTemplateRule> = {
  [PlantillaMaquinariaDto.router_cnc]: {
    requiredMachineKeys: ['ejeXUtil', 'ejeYUtil', 'ejeZUtil'],
  },
  [PlantillaMaquinariaDto.corte_laser]: {
    requiredMachineKeys: ['ejeXUtil', 'ejeYUtil', 'tipoLaser'],
  },
  [PlantillaMaquinariaDto.guillotina]: {
    requiredMachineKeys: ['altoBocaMm'],
  },
  [PlantillaMaquinariaDto.laminadora_bopp_rollo]: {
    requiredMachineKeys: ['anchoRolloMm', 'velocidadMmSeg', 'mermaArranqueMm', 'mermaCierreMm'],
  },
  [PlantillaMaquinariaDto.redondeadora_puntas]: {
    requiredMachineKeys: ['golpesMinNominal', 'maxEspesorPilaMm'],
  },
  [PlantillaMaquinariaDto.perforadora]: {
    requiredMachineKeys: ['pliegosMinNominal', 'lineasPorPasadaMax'],
  },
  [PlantillaMaquinariaDto.impresora_3d]: {
    requiredMachineKeys: ['volumenX', 'volumenY', 'volumenZ', 'tecnologia'],
  },
  [PlantillaMaquinariaDto.impresora_dtf]: {
    requiredMachineKeys: ['anchoUtil', 'configuracionCanales'],
  },
  [PlantillaMaquinariaDto.impresora_dtf_uv]: {
    requiredMachineKeys: [
      'anchoUtil',
      'configuracionCanales',
      'sistemaLaminacionTransferencia',
    ],
  },
  [PlantillaMaquinariaDto.impresora_uv_mesa_extensora]: {
    requiredMachineKeys: [
      'anchoCama',
      'largoCama',
      'alturaMaximaObjeto',
      'tipoMesa',
      'configuracionCanales',
    ],
  },
  [PlantillaMaquinariaDto.impresora_uv_cilindrica]: {
    requiredMachineKeys: [
      'diametroMinimo',
      'diametroMaximo',
      'largoUtil',
      'configuracionCanales',
    ],
  },
  [PlantillaMaquinariaDto.impresora_uv_flatbed]: {
    requiredMachineKeys: [
      'anchoCama',
      'largoCama',
      'alturaMaximaObjeto',
      'tipoMesa',
      'configuracionCanales',
    ],
  },
  [PlantillaMaquinariaDto.impresora_uv_rollo]: {
    requiredMachineKeys: ['anchoUtil', 'configuracionCanales'],
  },
  [PlantillaMaquinariaDto.impresora_solvente]: {
    requiredMachineKeys: ['anchoUtil'],
  },
  [PlantillaMaquinariaDto.impresora_inyeccion_tinta]: {
    requiredMachineKeys: ['anchoUtil'],
  },
  [PlantillaMaquinariaDto.impresora_latex]: {
    requiredMachineKeys: ['anchoUtil'],
  },
  [PlantillaMaquinariaDto.impresora_sublimacion_gran_formato]: {
    requiredMachineKeys: ['anchoUtil'],
  },
  [PlantillaMaquinariaDto.impresora_laser]: {
    requiredMachineKeys: [
      'anchoMinHoja',
      'anchoMaxHoja',
      'altoMinHoja',
      'altoMaxHoja',
      'configuracionColor',
    ],
  },
  [PlantillaMaquinariaDto.plotter_cad]: {
    requiredMachineKeys: ['anchoUtil'],
  },
  [PlantillaMaquinariaDto.mesa_de_corte]: {
    requiredMachineKeys: ['anchoUtil', 'largoUtil'],
  },
  [PlantillaMaquinariaDto.plotter_de_corte]: {
    requiredMachineKeys: ['anchoUtil', 'largoUtil'],
  },
};

function hasValue(value: unknown) {
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

function getMachineFieldValue(payload: UpsertMaquinaDto, key: string) {
  const directRecord = payload as unknown as Record<string, unknown>;
  const directValue = directRecord[key];

  if (DIRECT_MACHINE_FIELD_KEYS.has(key) && hasValue(directValue)) {
    return directValue;
  }

  return (payload.parametrosTecnicos ?? {})[key];
}

export function hasRequiredMachineDataByTemplate(payload: UpsertMaquinaDto) {
  const rule = RULES[payload.plantilla];
  if (!rule) {
    return false;
  }

  return rule.requiredMachineKeys.every((key) =>
    hasValue(getMachineFieldValue(payload, key)),
  );
}

export function validateMachinePayloadByTemplate(payload: UpsertMaquinaDto) {
  const rule = RULES[payload.plantilla];
  if (!rule) {
    return;
  }

  const missing = rule.requiredMachineKeys.filter(
    (key) => !hasValue(getMachineFieldValue(payload, key)),
  );

  if (missing.length > 0) {
    throw new Error(
      `La maquina debe completar los campos ${missing.join(', ')} para la plantilla ${payload.plantilla}.`,
    );
  }
}
