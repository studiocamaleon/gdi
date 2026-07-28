import type { UpsertMaquinaDto } from './dto/upsert-maquina.dto';
import { PlantillaMaquinariaDto } from './dto/upsert-maquina.dto';

/**
 * Reglas de validación de la entidad Maquina por plantilla — v3.0 (2026-04-26).
 * Doc: `docs/motor-por-pasos-analisis/06-maquinas-y-perfiles.md` §5–§13.
 *
 * Cada plantilla declara qué campos son OBLIGATORIOS para que la máquina
 * sea válida. Los campos pueden ser:
 * - Columnas universales: `anchoUtil`, `largoUtil`, `altoUtil`, `espesorMaximo`,
 *   `pesoMaximo`, `gramajeMaxGr`.
 * - Claves dentro de `parametrosTecnicos` (JSON libre por plantilla).
 */
type MachineTemplateRule = {
  requiredMachineKeys: string[];
};

const DIRECT_MACHINE_FIELD_KEYS = new Set([
  'anchoUtil',
  'largoUtil',
  'altoUtil',
  'espesorMaximo',
  'pesoMaximo',
  'gramajeMaxGr',
]);

const RULES: Record<PlantillaMaquinariaDto, MachineTemplateRule> = {
  // ─── §5 IMPRESORA_LASER ─────────────────────────────────────────
  // paramsTecnicos: margenesNoImprimiblesMm{sup,inf,izq,der}, soporteDobleFaz,
  //   coloresSoportados[].
  [PlantillaMaquinariaDto.impresora_laser]: {
    // Sin largoUtil ni gramajeMaxGr (2026-07-28): se retiraron de la
    // plantilla, así que exigirlos dejaba a la máquina "incompleta" para
    // siempre.
    requiredMachineKeys: ['anchoUtil', 'margenesNoImprimiblesMm'],
  },

  // ─── §6 IMPRESORA_GRAN_FORMATO_POR_AREA ─────────────────────────
  // paramsTecnicos: tecnologia, geometria, margenesNoImprimiblesMm,
  //   coloresSoportados[].
  // Si geometria=ROLLO: anchoMinRolloMm, anchoMaxRolloMm.
  // Si geometria=MESA_EXTENSORA: anchoMesaMm, largoMesaMm, alturaMaxCabezalMm.
  [PlantillaMaquinariaDto.impresora_gran_formato_por_area]: {
    requiredMachineKeys: ['tecnologia', 'geometria', 'margenesNoImprimiblesMm'],
  },

  // ─── §7 GUILLOTINA ──────────────────────────────────────────────
  // anchoUtil = largo cuchilla. paramsTecnicos: tiempoPorCorteSeg.
  [PlantillaMaquinariaDto.guillotina]: {
    // tiempoPorCorteSeg se mudó al perfil (2026-07-28): puede variar con la
    // dureza del papel, igual que los pliegos por tanda.
    requiredMachineKeys: ['anchoUtil', 'altoUtil'],
  },

  // ─── §8 PLOTTER_DE_CORTE ────────────────────────────────────────
  // paramsTecnicos: anchoMinRolloMm, anchoMaxRolloMm, modosOperacionSoportados[].
  [PlantillaMaquinariaDto.plotter_de_corte]: {
    requiredMachineKeys: ['anchoUtil', 'modosOperacionSoportados'],
  },

  // ─── §10 PLOTTER_CAD ────────────────────────────────────────────
  // paramsTecnicos: anchoMinRolloMm, anchoMaxRolloMm, margenesNoImprimiblesMm,
  //   coloresSoportados[].
  [PlantillaMaquinariaDto.plotter_cad]: {
    requiredMachineKeys: ['anchoUtil', 'margenesNoImprimiblesMm'],
  },

  // ─── §9 LAMINADORA_BOPP_ROLLO ───────────────────────────────────
  // paramsTecnicos: modosOperacionSoportados[], margenesDesperdicioMm,
  //   margenEntrePliegosMm.
  [PlantillaMaquinariaDto.laminadora_bopp_rollo]: {
    requiredMachineKeys: [
      'anchoUtil',
      'modosOperacionSoportados',
      'margenesDesperdicioMm',
      'margenEntrePliegosMm',
    ],
  },

  // ─── §11 CORTE_LASER ────────────────────────────────────────────
  // paramsTecnicos: tipoLaser{CO2|FIBRA}, potenciaWatts, operacionesSoportadas[].
  [PlantillaMaquinariaDto.corte_laser]: {
    requiredMachineKeys: [
      'anchoUtil',
      'largoUtil',
      'tipoLaser',
      'operacionesSoportadas',
    ],
  },

  // ─── §12 ROUTER_CNC ─────────────────────────────────────────────
  // paramsTecnicos: potenciaHusilloKw, velocidadMaxRPM, operacionesSoportadas[],
  //   tieneAspiracionViruta.
  [PlantillaMaquinariaDto.router_cnc]: {
    requiredMachineKeys: [
      'anchoUtil',
      'largoUtil',
      'altoUtil',
      'potenciaHusilloKw',
      'operacionesSoportadas',
    ],
  },

  // ─── §13 ANILLADORA ─────────────────────────────────────────────
  // paramsTecnicos: tiposAnilloSoportados[], pasosOrificiosSoportados[].
  [PlantillaMaquinariaDto.anilladora]: {
    requiredMachineKeys: ['anchoUtil', 'altoUtil', 'tiposAnilloSoportados'],
  },

  // ─── §15 SOLDADORA (pendiente — sin schema definido todavía) ────
  [PlantillaMaquinariaDto.soldadora]: {
    requiredMachineKeys: [],
  },

  // ─── §15 CABINA_PINTURA (pendiente) ─────────────────────────────
  [PlantillaMaquinariaDto.cabina_pintura]: {
    requiredMachineKeys: [],
  },

  // ─── MESA_DE_CORTE (postergada — evaluar) ────────────────────────
  [PlantillaMaquinariaDto.mesa_de_corte]: {
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

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
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
