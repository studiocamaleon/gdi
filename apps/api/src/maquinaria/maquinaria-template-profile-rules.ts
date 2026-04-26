import {
  type MaquinaPerfilOperativoItemDto,
  PlantillaMaquinariaDto,
} from './dto/upsert-maquina.dto';

/**
 * Reglas de validación de perfiles operativos por plantilla — v3.0 (2026-04-26).
 *
 * Doc: `docs/motor-por-pasos-analisis/06-maquinas-y-perfiles.md` §5–§13.
 *
 * - `allowedProfileKeys`: claves permitidas en `perfil.detalle` para esta plantilla.
 *   Si el modelador envía una clave fuera de la lista, el upsert falla.
 * - `requiredProfileKeys`: claves obligatorias para que el perfil sea válido.
 *   Pueden ser columnas universales (productivityValue, etc.) o claves del
 *   `detalle` (gramajeMinGr, pliegosMaxPorTanda, etc.).
 * - `modeSourceKeys`: campos del `detalle` cuya combinación define un "modo de
 *   trabajo" del perfil (caras, tipoCorte, etc.).
 */
type PerfilTemplateRule = {
  allowedProfileKeys: Set<string>;
  requiredProfileKeys: Set<string>;
  modeSourceKeys: Set<string>;
};

/**
 * Columnas universales del PerfilOperativo (todas las plantillas las soportan).
 * Estas SIEMPRE son válidas como required keys.
 */
const COMMON_PROFILE_KEYS = [
  'nombre',
  'tipoPerfil',
  'activo',
  'productivityValue',
  'productivityUnit',
  'setupMin',
  'cleanupMin',
  'feedReloadMin',
] as const;

/**
 * Claves que viven en columnas universales (no en `detalle`).
 * Para `getPerfilFieldValue`: priorizar lectura directa antes que detalle.
 */
const DIRECT_PROFILE_FIELD_KEYS = new Set([
  'nombre',
  'tipoPerfil',
  'activo',
  'productivityValue',
  'productivityUnit',
  'setupMin',
  'cleanupMin',
  'feedReloadMin',
]);

function buildRule(params: {
  /** Claves específicas de esta plantilla, permitidas en `detalle`. */
  detalleKeys: string[];
  /** Claves obligatorias (universales o detalle). */
  requiredFieldKeys: string[];
  modeSourceKeys?: string[];
}): PerfilTemplateRule {
  return {
    allowedProfileKeys: new Set([...COMMON_PROFILE_KEYS, ...params.detalleKeys]),
    requiredProfileKeys: new Set(params.requiredFieldKeys),
    modeSourceKeys: new Set(params.modeSourceKeys ?? []),
  };
}

const RULES: Record<PlantillaMaquinariaDto, PerfilTemplateRule> = {
  // ─── §5 IMPRESORA_LASER ─────────────────────────────────────────
  // Discriminantes (detalle): caras, colores, formatoSoportado, gramajeMinGr,
  // gramajeMaxGr.
  [PlantillaMaquinariaDto.impresora_laser]: buildRule({
    detalleKeys: ['caras', 'colores', 'formatoSoportado', 'gramajeMinGr', 'gramajeMaxGr'],
    requiredFieldKeys: ['nombre', 'productivityValue', 'productivityUnit', 'caras'],
    modeSourceKeys: ['caras', 'colores'],
  }),

  // ─── §6 IMPRESORA_GRAN_FORMATO_POR_AREA ─────────────────────────
  // Discriminantes (detalle): numeroPasadas, colores, modoCalidad, modoOperacion
  // (solo si plantilla geometria=MESA_EXTENSORA).
  [PlantillaMaquinariaDto.impresora_gran_formato_por_area]: buildRule({
    detalleKeys: ['numeroPasadas', 'colores', 'modoCalidad', 'modoOperacion'],
    requiredFieldKeys: ['nombre', 'productivityValue', 'productivityUnit'],
    modeSourceKeys: ['modoCalidad', 'colores'],
  }),

  // ─── §7 GUILLOTINA ──────────────────────────────────────────────
  // Productividad NULL (fórmula no lineal).
  // Discriminantes (detalle): gramajeMinGr, gramajeMaxGr.
  // paramsPerfilJson (detalle): pliegosMaxPorTanda.
  [PlantillaMaquinariaDto.guillotina]: buildRule({
    detalleKeys: ['gramajeMinGr', 'gramajeMaxGr', 'pliegosMaxPorTanda'],
    requiredFieldKeys: ['nombre', 'pliegosMaxPorTanda', 'gramajeMaxGr'],
  }),

  // ─── §8 PLOTTER_DE_CORTE ────────────────────────────────────────
  // Discriminantes (detalle): tipoCorte (COMPLETO|KISS_CUT), modoOperacion (ROLLO|HOJAS).
  // paramsPerfilJson (detalle): factorComplejidad {SIMPLE,INTERMEDIO,COMPLEJO}.
  [PlantillaMaquinariaDto.plotter_de_corte]: buildRule({
    detalleKeys: ['tipoCorte', 'modoOperacion', 'factorComplejidad'],
    requiredFieldKeys: ['nombre', 'productivityValue', 'productivityUnit', 'tipoCorte'],
    modeSourceKeys: ['tipoCorte', 'modoOperacion'],
  }),

  // ─── §10 PLOTTER_CAD ────────────────────────────────────────────
  // Discriminantes (detalle): tipoTrabajo (CAD|FOTO), calidad (DRAFT|NORMAL|ALTA).
  [PlantillaMaquinariaDto.plotter_cad]: buildRule({
    detalleKeys: ['tipoTrabajo', 'calidad'],
    requiredFieldKeys: ['nombre', 'productivityValue', 'productivityUnit', 'tipoTrabajo', 'calidad'],
    modeSourceKeys: ['tipoTrabajo', 'calidad'],
  }),

  // ─── §9 LAMINADORA_BOPP_ROLLO ───────────────────────────────────
  // Perfil único "Estándar". Sin discriminantes.
  [PlantillaMaquinariaDto.laminadora_bopp_rollo]: buildRule({
    detalleKeys: [],
    requiredFieldKeys: ['nombre', 'productivityValue', 'productivityUnit'],
  }),

  // ─── §11 CORTE_LASER ────────────────────────────────────────────
  // Perfil único "Estándar". T-4 input manual → productividad NULL.
  [PlantillaMaquinariaDto.corte_laser]: buildRule({
    detalleKeys: [],
    requiredFieldKeys: ['nombre'],
  }),

  // ─── §12 ROUTER_CNC ─────────────────────────────────────────────
  // Perfil único "Estándar". Productividad nominal m²/h para T-3.
  [PlantillaMaquinariaDto.router_cnc]: buildRule({
    detalleKeys: [],
    requiredFieldKeys: ['nombre', 'productivityValue', 'productivityUnit'],
  }),

  // ─── §13 ANILLADORA ─────────────────────────────────────────────
  // Discriminantes (detalle): tipoAnillo (ESPIRAL_PLASTICO|WIRE_O).
  // paramsPerfilJson (detalle): diametrosSoportadosMm.
  [PlantillaMaquinariaDto.anilladora]: buildRule({
    detalleKeys: ['tipoAnillo', 'diametrosSoportadosMm'],
    requiredFieldKeys: ['nombre', 'productivityValue', 'productivityUnit', 'tipoAnillo'],
    modeSourceKeys: ['tipoAnillo'],
  }),

  // ─── §15 SOLDADORA (pendiente, sin perfilado detallado todavía) ──
  [PlantillaMaquinariaDto.soldadora]: buildRule({
    detalleKeys: [],
    requiredFieldKeys: ['nombre'],
  }),

  // ─── §15 CABINA_PINTURA (pendiente) ─────────────────────────────
  [PlantillaMaquinariaDto.cabina_pintura]: buildRule({
    detalleKeys: [],
    requiredFieldKeys: ['nombre'],
  }),

  // ─── MESA_DE_CORTE (postergada — evaluar) ────────────────────────
  [PlantillaMaquinariaDto.mesa_de_corte]: buildRule({
    detalleKeys: ['tipoCorte', 'modoOperacion'],
    requiredFieldKeys: ['nombre'],
  }),
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

function getPerfilFieldValue(
  perfil: MaquinaPerfilOperativoItemDto,
  fieldKey: string,
) {
  const directRecord = perfil as unknown as Record<string, unknown>;
  if (DIRECT_PROFILE_FIELD_KEYS.has(fieldKey) && directRecord[fieldKey] !== undefined) {
    return directRecord[fieldKey];
  }

  const detailValue = (perfil.detalle ?? {})[fieldKey];
  if (detailValue !== undefined) {
    return detailValue;
  }

  return directRecord[fieldKey];
}

export function validatePerfilOperativoByTemplate(
  plantilla: PlantillaMaquinariaDto,
  perfil: MaquinaPerfilOperativoItemDto,
) {
  const rule = RULES[plantilla];
  const perfilName = perfil.nombre.trim() || 'sin nombre';

  for (const detailKey of Object.keys(perfil.detalle ?? {})) {
    if (!rule.allowedProfileKeys.has(detailKey)) {
      throw new Error(
        `El perfil operativo ${perfilName} incluye el campo ${detailKey}, que no corresponde a la plantilla ${plantilla}.`,
      );
    }
  }

  for (const requiredKey of rule.requiredProfileKeys) {
    const value = getPerfilFieldValue(perfil, requiredKey);
    if (!hasValue(value)) {
      throw new Error(
        `El perfil operativo ${perfilName} debe completar el campo ${requiredKey} para la plantilla ${plantilla}.`,
      );
    }
  }

  if (rule.modeSourceKeys.size > 0) {
    const hasAnyModeSource = Array.from(rule.modeSourceKeys).some((key) =>
      hasValue(getPerfilFieldValue(perfil, key)),
    );

    if (!hasAnyModeSource) {
      throw new Error(
        `El perfil operativo ${perfilName} debe completar un campo de modo de trabajo definido por la plantilla ${plantilla}.`,
      );
    }
  }
}
