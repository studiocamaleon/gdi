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
  // Discriminantes (detalle): caras, modo dúplex, colores y gramajeMaxGr.
  [PlantillaMaquinariaDto.impresora_laser]: buildRule({
    detalleKeys: [
      'caras',
      'modoDobleFaz',
      'origenProductividad',
      'colores',
      'gramajeMaxGr',
    ],
    requiredFieldKeys: [
      'nombre',
      'productivityValue',
      'productivityUnit',
      'caras',
      'gramajeMaxGr',
    ],
    modeSourceKeys: ['caras', 'colores'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.impresion],
  }),

  [PlantillaMaquinariaDto.duplicadora_digital]: buildRule({
    detalleKeys: ['caras', 'colores', 'gramajeMaxGr'],
    requiredFieldKeys: [
      'nombre',
      'productivityValue',
      'productivityUnit',
      'caras',
      'gramajeMaxGr',
    ],
    modeSourceKeys: ['caras'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.impresion],
  }),

  // ─── §6 IMPRESORA_GRAN_FORMATO_POR_AREA ─────────────────────────
  // Compatibilidad: numeroPasadas, modoCalidad y tipoCorte se toleran en datos
  // viejos, pero el modo funcional sale de colores (impresión) / modoOperacion
  // (corte integrado). `tipoCorte` era un discriminante inerte — el motor nunca
  // lo leyó — retirado 2026-08-15; se conserva como clave tolerada.
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
    modeSourceKeys: ['colores', 'modoOperacion'],
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
  // El perfil se discrimina por NIVEL DE COMPLEJIDAD (un perfil por nivel, con
  // su ritmo m²/h). El formato rollo vs hoja lo dice el material cargado (su
  // subfamilia), no el perfil. `tipoCorte`, `modoOperacion` y `factorComplejidad`
  // ya no se usan — retirados de la UI 2026-08-15; se conservan como claves
  // toleradas para no rechazar perfiles viejos. Sin modeSourceKeys: la
  // complejidad no es un "modo", la elige el comercial al cotizar (Fase 2).
  [PlantillaMaquinariaDto.plotter_de_corte]: buildRule({
    detalleKeys: ['tipoCorte', 'modoOperacion', 'factorComplejidad'],
    requiredFieldKeys: ['nombre', 'productivityValue', 'productivityUnit'],
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
  // Perfil único "Estándar". Las pasadas de doble faz afectan el tiempo de
  // máquina, no el consumo: ambas caras siempre consumen dos largos de film.
  [PlantillaMaquinariaDto.laminadora_bopp_rollo]: buildRule({
    detalleKeys: ['pasadasDobleFaz'],
    requiredFieldKeys: [
      'nombre',
      'productivityValue',
      'productivityUnit',
      'pasadasDobleFaz',
    ],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.laminado],
  }),

  // ─── §11 CORTE_LASER ────────────────────────────────────────────
  // Perfil único "Estándar". T-4 input manual → productividad NULL.
  // Láser/CNC: tabla de perfiles por operación × material × espesor. La velocidad
  // (productivityValue) va en la unidad nativa (mm/s láser, mm/min CNC) y el motor
  // la aplica al recorrido de las piezas.
  [PlantillaMaquinariaDto.corte_laser]: buildRule({
    detalleKeys: ['tipoOperacion', 'material', 'espesorMinMm', 'espesorMaxMm'],
    requiredFieldKeys: [
      'nombre',
      'tipoOperacion',
      'productivityValue',
      'productivityUnit',
    ],
    modeSourceKeys: ['tipoOperacion', 'material'],
    allowedProfileTypes: [
      TipoPerfilOperativoMaquinaDto.corte,
      TipoPerfilOperativoMaquinaDto.grabado,
    ],
  }),

  // ─── §12 ROUTER_CNC ─────────────────────────────────────────────
  // Perfil único "Estándar". Productividad nominal m²/h para T-3.
  [PlantillaMaquinariaDto.router_cnc]: buildRule({
    detalleKeys: ['tipoOperacion', 'material', 'espesorMinMm', 'espesorMaxMm'],
    requiredFieldKeys: [
      'nombre',
      'tipoOperacion',
      'productivityValue',
      'productivityUnit',
    ],
    modeSourceKeys: ['tipoOperacion', 'material'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.mecanizado],
  }),

  [PlantillaMaquinariaDto.corte_hilo_caliente]: buildRule({
    detalleKeys: ['material', 'espesorMinMm', 'espesorMaxMm'],
    requiredFieldKeys: ['nombre', 'productivityValue', 'productivityUnit'],
    modeSourceKeys: ['material'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.corte],
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

  // ─── MESA_DE_CORTE (postergada — evaluar) ────────────────────────
  [PlantillaMaquinariaDto.mesa_de_corte]: buildRule({
    detalleKeys: ['tipoCorte', 'modoOperacion'],
    requiredFieldKeys: ['nombre'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.corte],
  }),
  // ─── PLANCHA_TERMICA (aplicación de transfer textil) ────────────
  // Perfil "por ciclo": el modelador carga los segundos (pre + planchado + post)
  // y el service (buildPerfilData) DERIVA productivityValue (piezas/h). Por eso
  // el detalle trae los tiempos y productivityValue NO es required en el payload.
  [PlantillaMaquinariaDto.plancha_termica]: buildRule({
    detalleKeys: [
      'tiempoPreplanchadoSeg',
      'tiempoPrensadoSeg',
      'tiempoPostplanchadoSeg',
    ],
    requiredFieldKeys: ['nombre', 'tiempoPrensadoSeg'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.fabricacion],
  }),

  // ─── IMPRESORA_3D ───────────────────────────────────────────────
  // Perfil = material × calidad → caudal (g/h). El material es multi-valor:
  // un mismo perfil suele cubrir PLA y PETG al mismo caudal.
  [PlantillaMaquinariaDto.impresora_3d]: buildRule({
    detalleKeys: ['material', 'calidad', 'alturaCapaMm'],
    requiredFieldKeys: ['nombre', 'productivityValue', 'productivityUnit'],
    allowedProfileTypes: [TipoPerfilOperativoMaquinaDto.fabricacion],
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

function operacionLaserCoincideConTipo(
  perfil: MaquinaPerfilOperativoItemDto,
): boolean {
  const operacion = String(getPerfilFieldValue(perfil, 'tipoOperacion') ?? '')
    .trim()
    .toUpperCase();
  if (perfil.tipoPerfil === TipoPerfilOperativoMaquinaDto.corte) {
    return operacion === 'CORTE';
  }
  if (perfil.tipoPerfil === TipoPerfilOperativoMaquinaDto.grabado) {
    return operacion === 'GRABADO';
  }
  return false;
}

function esPerfilCorteLaser(
  plantilla: PlantillaMaquinariaDto,
  perfil: MaquinaPerfilOperativoItemDto,
) {
  return (
    plantilla === PlantillaMaquinariaDto.corte_laser &&
    perfil.tipoPerfil === TipoPerfilOperativoMaquinaDto.corte
  );
}

const CAMPOS_REQUERIDOS_CORTE_LASER = [
  'material',
  'espesorMinMm',
  'espesorMaxMm',
] as const;

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

  if (
    plantilla === PlantillaMaquinariaDto.corte_laser &&
    !operacionLaserCoincideConTipo(perfil)
  ) {
    throw new Error(
      `El perfil operativo ${perfilName} debe ser Corte o Grabado y su operación debe coincidir.`,
    );
  }

  if (esPerfilCorteLaser(plantilla, perfil)) {
    for (const fieldKey of CAMPOS_REQUERIDOS_CORTE_LASER) {
      if (!hasValue(getPerfilFieldValue(perfil, fieldKey))) {
        throw new Error(
          `El perfil operativo ${perfilName} debe completar el campo ${fieldKey} para seleccionar automáticamente por material y espesor.`,
        );
      }
    }
    const min = Number(getPerfilFieldValue(perfil, 'espesorMinMm'));
    const max = Number(getPerfilFieldValue(perfil, 'espesorMaxMm'));
    if (
      !Number.isFinite(min) ||
      min <= 0 ||
      !Number.isFinite(max) ||
      max <= 0
    ) {
      throw new Error(
        `El perfil operativo ${perfilName} debe indicar espesores mínimo y máximo mayores a 0.`,
      );
    }
    if (max < min) {
      throw new Error(
        `El perfil operativo ${perfilName} tiene un espesor máximo menor que el mínimo.`,
      );
    }
  }

  if (plantilla === PlantillaMaquinariaDto.laminadora_bopp_rollo) {
    const pasadas = Number(getPerfilFieldValue(perfil, 'pasadasDobleFaz'));
    if (pasadas !== 1 && pasadas !== 2) {
      throw new Error(
        `El perfil operativo ${perfilName} debe indicar 1 o 2 pasadas para doble faz.`,
      );
    }
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

export function getPerfilOperativoConfigurationIssues(
  plantilla: PlantillaMaquinariaDto,
  perfil: MaquinaPerfilOperativoItemDto,
  parametrosTecnicos?: Record<string, unknown>,
) {
  const rule = RULES[plantilla];
  if (!rule) return [{ tipo: 'plantilla' as const }];

  const allowedProfileTypes = new Set(rule.allowedProfileTypes);
  if (
    plantilla === PlantillaMaquinariaDto.impresora_gran_formato_por_area &&
    parametrosTecnicos?.soportaCorteIntegrado !== true
  ) {
    allowedProfileTypes.delete(TipoPerfilOperativoMaquinaDto.corte);
  }

  const issues: Array<
    | { tipo: 'tipo_perfil' }
    | { tipo: 'campo'; fieldKey: string }
    | { tipo: 'modo' }
    | { tipo: 'plantilla' }
  > = [];
  if (!allowedProfileTypes.has(perfil.tipoPerfil)) {
    issues.push({ tipo: 'tipo_perfil' });
  }

  for (const requiredKey of rule.requiredProfileKeys) {
    if (!hasValue(getPerfilFieldValue(perfil, requiredKey))) {
      issues.push({ tipo: 'campo', fieldKey: requiredKey });
    }
  }

  if (
    plantilla === PlantillaMaquinariaDto.corte_laser &&
    !operacionLaserCoincideConTipo(perfil) &&
    !issues.some(
      (issue) => issue.tipo === 'campo' && issue.fieldKey === 'tipoOperacion',
    )
  ) {
    issues.push({ tipo: 'campo', fieldKey: 'tipoOperacion' });
  }

  if (esPerfilCorteLaser(plantilla, perfil)) {
    for (const fieldKey of CAMPOS_REQUERIDOS_CORTE_LASER) {
      const value = getPerfilFieldValue(perfil, fieldKey);
      const numero = fieldKey === 'material' ? null : Number(value);
      if (
        !hasValue(value) ||
        (fieldKey !== 'material' &&
          (!Number.isFinite(numero) || Number(numero) <= 0))
      ) {
        if (
          !issues.some(
            (issue) => issue.tipo === 'campo' && issue.fieldKey === fieldKey,
          )
        ) {
          issues.push({ tipo: 'campo', fieldKey });
        }
      }
    }
    const min = Number(getPerfilFieldValue(perfil, 'espesorMinMm'));
    const max = Number(getPerfilFieldValue(perfil, 'espesorMaxMm'));
    if (Number.isFinite(min) && Number.isFinite(max) && max < min) {
      if (
        !issues.some(
          (issue) =>
            issue.tipo === 'campo' && issue.fieldKey === 'espesorMaxMm',
        )
      ) {
        issues.push({ tipo: 'campo', fieldKey: 'espesorMaxMm' });
      }
    }
  }

  if (plantilla === PlantillaMaquinariaDto.laminadora_bopp_rollo) {
    const pasadas = Number(getPerfilFieldValue(perfil, 'pasadasDobleFaz'));
    if (
      pasadas !== 1 &&
      pasadas !== 2 &&
      !issues.some(
        (issue) =>
          issue.tipo === 'campo' && issue.fieldKey === 'pasadasDobleFaz',
      )
    ) {
      issues.push({ tipo: 'campo', fieldKey: 'pasadasDobleFaz' });
    }
  }

  if (
    rule.modeSourceKeys.size > 0 &&
    !Array.from(rule.modeSourceKeys).some((key) =>
      hasValue(getPerfilFieldValue(perfil, key)),
    ) &&
    !issues.some(
      (issue) =>
        issue.tipo === 'campo' && rule.modeSourceKeys.has(issue.fieldKey),
    )
  ) {
    issues.push({ tipo: 'modo' });
  }

  return issues;
}
