import {
  type MaquinaPerfilOperativoItemDto,
  PlantillaMaquinariaDto,
  TipoPerfilOperativoMaquinaDto,
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
  allowedProfileTypes: Set<TipoPerfilOperativoMaquinaDto>;
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
  allowedProfileTypes: TipoPerfilOperativoMaquinaDto[];
}): PerfilTemplateRule {
  return {
    allowedProfileKeys: new Set([
      ...COMMON_PROFILE_KEYS,
      ...params.detalleKeys,
    ]),
    requiredProfileKeys: new Set(params.requiredFieldKeys),
    modeSourceKeys: new Set(params.modeSourceKeys ?? []),
    allowedProfileTypes: new Set(params.allowedProfileTypes),
  };
}

const RULES: Record<PlantillaMaquinariaDto, PerfilTemplateRule> = {
  // ─── §5 IMPRESORA_LASER ─────────────────────────────────────────
  // Discriminantes (detalle): caras, colores.
  [PlantillaMaquinariaDto.impresora_laser]: buildRule({
    detalleKeys: ['caras', 'colores'],
    requiredFieldKeys: [
      'nombre',
      'productivityValue',
      'productivityUnit',
      'caras',
    ],
    modeSourceKeys: ['caras', 'colores'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.impresion],
  }),

  // ─── §6 IMPRESORA_GRAN_FORMATO_POR_AREA ─────────────────────────
  // Compatibilidad: numeroPasadas, modoCalidad y modoOperacion se toleran
  // en datos viejos, pero el modo funcional sale de colores/tipoCorte.
  [PlantillaMaquinariaDto.impresora_gran_formato_por_area]: buildRule({
    detalleKeys: [
      'numeroPasadas',
      'colores',
      'modoCalidad',
      'modoOperacion',
      'tipoCorte',
      'factorComplejidad',
    ],
    requiredFieldKeys: ['nombre', 'productivityValue', 'productivityUnit'],
    modeSourceKeys: ['colores', 'tipoCorte'],
    allowedProfileTypes: [
      TipoPerfilOperativoMaquinaDto.impresion,
      TipoPerfilOperativoMaquinaDto.corte,
    ],
  }),

  // ─── §7 GUILLOTINA ──────────────────────────────────────────────
  // Productividad NULL (fórmula no lineal).
  // paramsPerfilJson (detalle): pliegosMaxPorTanda.
  // gramajeMaxGr es el ESCALÓN del perfil ("hasta N g/m²"), sin mínimo:
  // el motor elige el escalón más chico que cubre el papel.
  [PlantillaMaquinariaDto.guillotina]: buildRule({
    detalleKeys: ['gramajeMaxGr', 'pliegosMaxPorTanda', 'tiempoPorCorteSeg'],
    requiredFieldKeys: [
      'nombre',
      'pliegosMaxPorTanda',
      'gramajeMaxGr',
      'tiempoPorCorteSeg',
    ],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.corte],
  }),

  // ─── §8 PLOTTER_DE_CORTE ────────────────────────────────────────
  // Discriminantes (detalle): tipoCorte (COMPLETO|KISS_CUT), modoOperacion (ROLLO|HOJAS).
  // paramsPerfilJson (detalle): factorComplejidad simple|intermedio|complejo|personalizado.
  [PlantillaMaquinariaDto.plotter_de_corte]: buildRule({
    detalleKeys: ['tipoCorte', 'modoOperacion', 'factorComplejidad'],
    requiredFieldKeys: [
      'nombre',
      'productivityValue',
      'productivityUnit',
      'tipoCorte',
    ],
    modeSourceKeys: ['tipoCorte', 'modoOperacion'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.corte],
  }),

  // ─── §10 PLOTTER_CAD ────────────────────────────────────────────
  // Discriminantes (detalle): tipoTrabajo (CAD|FOTO), calidad (DRAFT|NORMAL|ALTA).
  // `colores` (opcional): modos de color admitidos (B/N, CMYK) para habilitar
  // el selector de modo de color en las rutas.
  [PlantillaMaquinariaDto.plotter_cad]: buildRule({
    detalleKeys: ['tipoTrabajo', 'calidad', 'colores'],
    requiredFieldKeys: [
      'nombre',
      'productivityValue',
      'productivityUnit',
      'tipoTrabajo',
      'calidad',
    ],
    modeSourceKeys: ['tipoTrabajo', 'calidad'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.impresion],
  }),

  // ─── §9 LAMINADORA_BOPP_ROLLO ───────────────────────────────────
  // Perfil único "Estándar". Sin discriminantes.
  [PlantillaMaquinariaDto.laminadora_bopp_rollo]: buildRule({
    detalleKeys: [],
    requiredFieldKeys: ['nombre', 'productivityValue', 'productivityUnit'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.laminado],
  }),

  // ─── §11 CORTE_LASER ────────────────────────────────────────────
  // Perfil único "Estándar". T-4 input manual → productividad NULL.
  [PlantillaMaquinariaDto.corte_laser]: buildRule({
    detalleKeys: [],
    requiredFieldKeys: ['nombre'],
    allowedProfileTypes: [
      TipoPerfilOperativoMaquinaDto.corte,
      TipoPerfilOperativoMaquinaDto.grabado,
    ],
  }),

  // ─── §12 ROUTER_CNC ─────────────────────────────────────────────
  // Perfil único "Estándar". Productividad nominal m²/h para T-3.
  [PlantillaMaquinariaDto.router_cnc]: buildRule({
    detalleKeys: [],
    requiredFieldKeys: ['nombre', 'productivityValue', 'productivityUnit'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.mecanizado],
  }),

  // ─── §13 ANILLADORA ─────────────────────────────────────────────
  // Discriminantes (detalle): tipoAnillo (ESPIRAL_PLASTICO|WIRE_O).
  // paramsPerfilJson (detalle): diametrosSoportadosMm.
  [PlantillaMaquinariaDto.anilladora]: buildRule({
    detalleKeys: ['tipoAnillo', 'diametrosSoportadosMm'],
    requiredFieldKeys: [
      'nombre',
      'productivityValue',
      'productivityUnit',
      'tipoAnillo',
    ],
    modeSourceKeys: ['tipoAnillo'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.fabricacion],
  }),

  // ─── §15 SOLDADORA (pendiente, sin perfilado detallado todavía) ──
  [PlantillaMaquinariaDto.soldadora]: buildRule({
    detalleKeys: [],
    requiredFieldKeys: ['nombre'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.fabricacion],
  }),

  // ─── §15 CABINA_PINTURA (pendiente) ─────────────────────────────
  [PlantillaMaquinariaDto.cabina_pintura]: buildRule({
    detalleKeys: [],
    requiredFieldKeys: ['nombre'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.fabricacion],
  }),

  // ─── MESA_DE_CORTE (postergada — evaluar) ────────────────────────
  [PlantillaMaquinariaDto.mesa_de_corte]: buildRule({
    detalleKeys: ['tipoCorte', 'modoOperacion'],
    requiredFieldKeys: ['nombre'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.corte],
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

function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPerfilFieldValue(
  perfil: MaquinaPerfilOperativoItemDto,
  fieldKey: string,
) {
  const directRecord = perfil as unknown as Record<string, unknown>;
  if (
    DIRECT_PROFILE_FIELD_KEYS.has(fieldKey) &&
    directRecord[fieldKey] !== undefined
  ) {
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
  parametrosTecnicos?: Record<string, unknown>,
) {
  const rule = RULES[plantilla];
  const perfilName = perfil.nombre.trim() || 'sin nombre';
  const allowedProfileTypes = new Set(rule.allowedProfileTypes);

  if (
    plantilla === PlantillaMaquinariaDto.impresora_gran_formato_por_area &&
    parametrosTecnicos?.soportaCorteIntegrado !== true
  ) {
    allowedProfileTypes.delete(TipoPerfilOperativoMaquinaDto.corte);
  }

  if (!allowedProfileTypes.has(perfil.tipoPerfil)) {
    throw new Error(
      `El perfil operativo ${perfilName} usa tipo ${perfil.tipoPerfil}, que no corresponde a la plantilla ${plantilla}.`,
    );
  }

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

  if (
    plantilla === PlantillaMaquinariaDto.impresora_gran_formato_por_area &&
    perfil.tipoPerfil === TipoPerfilOperativoMaquinaDto.corte &&
    !hasValue(getPerfilFieldValue(perfil, 'tipoCorte'))
  ) {
    throw new Error(
      `El perfil operativo ${perfilName} debe completar el campo tipoCorte para usar corte integrado.`,
    );
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
