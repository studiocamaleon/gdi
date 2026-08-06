/**
 * Registro de Capacidades — el vocabulario CERRADO de lo que un paso puede
 * dejarle a los siguientes (Etapa B, diseño en
 * docs/pasos-componibles-plan-tecnico.md §B.2).
 *
 * Idea de fondo: la magnitud de conteo es UNA sola — lo que cambia es el
 * objeto contado — y un mismo trabajo lleva varios conteos simultáneos
 * vinculados por ratios (500 tarjetas = 10 pliegos, poses de por medio).
 * Los ~52 nombres históricos de `outputsCanonicos` colapsan acá en 8
 * capacidades; los nombres viejos quedan como ALIAS (etiqueta de display),
 * nunca se migran físicamente.
 *
 * Este archivo es DATOS + helpers puros, igual que `familias.ts`:
 *   - agregar una capacidad requiere deploy (la lista la gobierna Grafo,
 *     nunca el tenant — es lo que la vuelve controlable);
 *   - acá no vive lógica de negocio: el motor calcula los valores, este
 *     registro solo dice qué existe y cómo se llama.
 */

export type CapacidadKey =
  | 'unidades_procesadas'
  | 'pliegos'
  | 'grupos'
  | 'm2_consumidos'
  | 'metros_lineales'
  | 'minutos_reales'
  | 'imposicion'
  | 'aprovechamiento_pct';

export type TipoCapacidad = 'conteo' | 'continua' | 'traza';

export interface DefinicionCapacidad {
  key: CapacidadKey;
  nombre: string;
  tipo: TipoCapacidad;
  /** Si un paso puede heredarla como su cantidad (mecanismo HEREDAR). */
  heredable: boolean;
  descripcion: string;
}

export const CAPACIDADES: Record<CapacidadKey, DefinicionCapacidad> = {
  unidades_procesadas: {
    key: 'unidades_procesadas',
    nombre: 'Unidades procesadas',
    tipo: 'conteo',
    heredable: true,
    descripcion:
      'La unidad final que compra el cliente (tarjetas, lonas, libros). ' +
      'La emite TODO paso; cada paso la re-etiqueta en display.',
  },
  pliegos: {
    key: 'pliegos',
    nombre: 'Pliegos',
    tipo: 'conteo',
    heredable: true,
    descripcion:
      'El soporte de impresión: la hoja que pasa por la máquina. Nunca ' +
      'viaja solo — carga su identidad (medida ancho×alto y qué papel es). ' +
      'UN emisor por ruta: el paso que corre el acomodo.',
  },
  grupos: {
    key: 'grupos',
    nombre: 'Grupos armados',
    tipo: 'conteo',
    heredable: true,
    descripcion:
      'Agrupaciones intermedias — pilas de talonario, cajas de embalaje, ' +
      'atados. N unidades por grupo; el paso emisor la etiqueta.',
  },
  m2_consumidos: {
    key: 'm2_consumidos',
    nombre: 'm² consumidos',
    tipo: 'continua',
    heredable: true,
    descripcion:
      'Área REAL de material consumida, con desperdicio (largo consumido × ' +
      'ancho del rollo, o suma de pliegos usados).',
  },
  metros_lineales: {
    key: 'metros_lineales',
    nombre: 'Metros lineales',
    tipo: 'continua',
    heredable: true,
    descripcion:
      'Consumo o recorrido lineal; el paso emisor la etiqueta (metros de ' +
      'rollo, de costura, de film).',
  },
  minutos_reales: {
    key: 'minutos_reales',
    nombre: 'Minutos de trabajo',
    tipo: 'continua',
    heredable: false,
    descripcion:
      'El tiempo total calculado del paso. La emite todo paso con tiempo; ' +
      'lector futuro: métricas/ETA.',
  },
  imposicion: {
    key: 'imposicion',
    nombre: 'Imposición',
    tipo: 'traza',
    heredable: false,
    descripcion:
      'El detalle del acomodo: poses por pliego (el ratio piezas↔pliegos), ' +
      'posiciones, y los cortes de guillotina derivados.',
  },
  aprovechamiento_pct: {
    key: 'aprovechamiento_pct',
    nombre: 'Aprovechamiento',
    tipo: 'traza',
    heredable: false,
    descripcion: 'Porcentaje del material aprovechado por el acomodo.',
  },
};

/**
 * Alias de una key histórica de `outputsCanonicos` hacia el registro.
 * `atributo: true` marca keys que son DATOS DE IDENTIDAD que acompañan a la
 * capacidad (la medida/papel del pliego, las poses), no su valor principal —
 * no se listan como "lo que el paso deja", viajan pegadas.
 */
export interface AliasLegacy {
  capacidad: CapacidadKey;
  etiqueta: string;
  atributo?: boolean;
}

/**
 * TODAS las keys que las familias del sistema declaran hoy. Ninguna se
 * renombra físicamente: los 4 canales de consumo (herencia runtime,
 * snapshot trazabilidadJson, config del producto por nombre, camelCase del
 * nesting) siguen leyendo las keys planas; el registro se superpone.
 */
export const ALIAS_LEGACY: Record<string, AliasLegacy> = {
  // ── pre-prensa / imposición ─────────────────────────────────────────
  pliegos_calculados: { capacidad: 'pliegos', etiqueta: 'pliegos calculados' },
  imposicion_calculada: { capacidad: 'imposicion', etiqueta: 'detalle del acomodo' },
  poses_por_pliego: { capacidad: 'imposicion', etiqueta: 'poses por pliego', atributo: true },
  cortes_calculados: { capacidad: 'imposicion', etiqueta: 'cortes de guillotina', atributo: true },
  pliego_impresion_ancho_mm: { capacidad: 'pliegos', etiqueta: 'ancho del pliego (mm)', atributo: true },
  pliego_impresion_alto_mm: { capacidad: 'pliegos', etiqueta: 'alto del pliego (mm)', atributo: true },
  pliego_impresion_area_m2: { capacidad: 'pliegos', etiqueta: 'área del pliego (m²)', atributo: true },
  pliego_impresion_mp_variante_id: { capacidad: 'pliegos', etiqueta: 'papel del pliego', atributo: true },
  talonario_pilas: { capacidad: 'grupos', etiqueta: 'pilas de talonario' },
  // Imposición de cuadernillo a caballete (2026-08-04):
  hojas_por_libro: { capacidad: 'imposicion', etiqueta: 'hojas por libro', atributo: true },
  paginas_blancas: { capacidad: 'imposicion', etiqueta: 'páginas en blanco', atributo: true },
  libros_por_juego: { capacidad: 'imposicion', etiqueta: 'libros por juego', atributo: true },
  plan_imposicion: { capacidad: 'imposicion', etiqueta: 'plan de imposición', atributo: true },
  libros_abrochados: { capacidad: 'unidades_procesadas', etiqueta: 'libros abrochados' },
  // F1 cartelería (2026-08-04):
  ml_estructura: { capacidad: 'metros_lineales', etiqueta: 'metros de perfil' },
  puntos_soldadura: { capacidad: 'unidades_procesadas', etiqueta: 'puntos de soldadura', atributo: true },
  cenefa_m2: { capacidad: 'm2_consumidos', etiqueta: 'm² de cenefa', atributo: true },
  pintura_m2: { capacidad: 'm2_consumidos', etiqueta: 'm² a pintar', atributo: true },
  fondo_m2: { capacidad: 'm2_consumidos', etiqueta: 'm² de chapa trasera', atributo: true },
  modulos_led: { capacidad: 'unidades_procesadas', etiqueta: 'módulos LED' },
  watts_led: { capacidad: 'unidades_procesadas', etiqueta: 'watts cargados', atributo: true },

  // ── impresión ───────────────────────────────────────────────────────
  pliegos_impresos: { capacidad: 'pliegos', etiqueta: 'pliegos impresos' },
  m2_calculados: { capacidad: 'm2_consumidos', etiqueta: 'm² consumidos' },
  aprovechamiento_pct: { capacidad: 'aprovechamiento_pct', etiqueta: 'aprovechamiento' },
  tiempo_real_impresion: { capacidad: 'minutos_reales', etiqueta: 'minutos de impresión' },
  piezas_impresas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas impresas' },
  piezas_aplicadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas aplicadas' },
  piezas_grabadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas grabadas' },

  // ── corte ───────────────────────────────────────────────────────────
  piezas_cortadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas cortadas' },
  piezas_troqueladas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas troqueladas' },
  metros_lineales_corte: { capacidad: 'metros_lineales', etiqueta: 'metros de corte' },
  tiempo_real_corte: { capacidad: 'minutos_reales', etiqueta: 'minutos de corte' },

  // ── acabados ────────────────────────────────────────────────────────
  pliegos_plegados: { capacidad: 'unidades_procesadas', etiqueta: 'pliegos plegados' },
  piezas_perforadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas perforadas' },
  piezas_laminadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas laminadas' },
  metros_lineales_film: { capacidad: 'metros_lineales', etiqueta: 'metros de film' },
  piezas_barnizadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas barnizadas' },
  piezas_decoradas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas decoradas' },
  piezas_pintadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas pintadas' },
  piezas_lijadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas lijadas' },

  // ── encuadernado / armado ───────────────────────────────────────────
  libros_engrapados: { capacidad: 'unidades_procesadas', etiqueta: 'libros engrapados' },
  libros_anillados: { capacidad: 'unidades_procesadas', etiqueta: 'libros anillados' },
  blocks_emblocados: { capacidad: 'unidades_procesadas', etiqueta: 'blocks emblocados' },
  cajas_armadas: { capacidad: 'unidades_procesadas', etiqueta: 'cajas armadas' },
  piezas_soldadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas soldadas' },
  piezas_ensambladas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas ensambladas' },
  piezas_montadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas montadas' },
  luminosos_instalados: { capacidad: 'unidades_procesadas', etiqueta: 'luminosos instalados' },

  // ── terminación / logística ─────────────────────────────────────────
  // cajas_embaladas y atados_completados son GRUPOS (N unidades por caja/
  // atado, algo se cobra por grupo), no la unidad final.
  cajas_embaladas: { capacidad: 'grupos', etiqueta: 'cajas de embalaje' },
  atados_completados: { capacidad: 'grupos', etiqueta: 'atados' },
  piezas_contadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas contadas' },
  piezas_etiquetadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas etiquetadas' },
  piezas_verificadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas verificadas' },
  trabajos_manuales_realizados: { capacidad: 'unidades_procesadas', etiqueta: 'trabajos realizados' },
  envios_realizados: { capacidad: 'unidades_procesadas', etiqueta: 'envíos realizados' },
  m2_instalados_realizados: { capacidad: 'm2_consumidos', etiqueta: 'm² instalados' },
  visitas_realizadas: { capacidad: 'unidades_procesadas', etiqueta: 'visitas realizadas' },

  // ── modificaciones físicas (lona) ───────────────────────────────────
  metros_lineales_union: { capacidad: 'metros_lineales', etiqueta: 'metros de unión' },
  piezas_modificadas: { capacidad: 'unidades_procesadas', etiqueta: 'piezas modificadas' },
  ojales_colocados: { capacidad: 'unidades_procesadas', etiqueta: 'ojales colocados' },
};

/**
 * Traza interna de primitivas: se publica al jobContext pero NO es una
 * capacidad de usuario (no aparece en "este paso deja" ni en herencia).
 */
export const KEYS_INTERNAS: ReadonlySet<string> = new Set(['mutacion_aplicada']);

/**
 * Podadas por decisión de diseño (§B.2): "no se usa y no se va a usar".
 * Siguen declaradas en familias del sistema hasta que B.3.2 las retire de
 * la emisión; el registro ya no las reconoce como capacidad.
 */
export const KEYS_PODADAS: ReadonlySet<string> = new Set([
  'proof_aprobado',
  'diseno_aprobado',
]);

/**
 * Resuelve una key histórica (o inventada por datos viejos de tenant) al
 * registro. Fallback: cualquier key desconocida es un conteo de la unidad
 * final con la key humanizada como etiqueta — el mismo mejor-esfuerzo que
 * `outputs-canonicos.ts` aplica al calcular valores.
 */
export function resolverAliasLegacy(key: string): AliasLegacy {
  // Una key del registro se representa a sí misma (las familias tenant
  // declaran directamente capacidades — no son legacy ni fallback).
  if (key in CAPACIDADES) {
    const def = CAPACIDADES[key as CapacidadKey];
    return { capacidad: def.key, etiqueta: def.nombre.toLowerCase() };
  }
  return (
    ALIAS_LEGACY[key] ?? {
      capacidad: 'unidades_procesadas',
      etiqueta: key.replace(/_/g, ' '),
    }
  );
}

/**
 * La forma de un paso, reducida a lo que decide su emisión. En B.3.4 la
 * `superficie` sale de `nestingConfigJson`; `agrupa` de un mecanismo
 * CONVERSION con capacidad por grupo; `consumeMaterialLineal` de un slot
 * de material lineal (film).
 */
export interface FormaEmision {
  superficie?: 'pliego' | 'pliegos_multiples' | 'rollo' | null;
  agrupa?: boolean;
  consumeMaterialLineal?: boolean;
}

/**
 * Qué capacidades emite un paso según su forma — derivado, NUNCA elegido a
 * mano (el wizard no pregunta outputs; los informa).
 */
export function capacidadesDeForma(forma: FormaEmision): CapacidadKey[] {
  const out: CapacidadKey[] = ['unidades_procesadas', 'minutos_reales'];
  if (forma.superficie === 'pliego' || forma.superficie === 'pliegos_multiples') {
    out.push('pliegos', 'imposicion', 'aprovechamiento_pct');
  } else if (forma.superficie === 'rollo') {
    out.push('m2_consumidos', 'metros_lineales', 'aprovechamiento_pct');
  }
  if (forma.agrupa) out.push('grupos');
  if (forma.consumeMaterialLineal && !out.includes('metros_lineales')) {
    out.push('metros_lineales');
  }
  return out;
}

/**
 * Las capacidades detrás de una lista declarada de outputs históricos
 * (familias del sistema): alias-mapea, deduplica y excluye internas y
 * podadas. Los `atributo: true` no suman capacidad propia (acompañan a la
 * suya, que ya entra por su key principal… o no: un atributo suelto también
 * enciende su capacidad — la identidad del pliego implica pliegos).
 */
export function capacidadesDeclaradas(
  outputsCanonicos: readonly string[] | undefined,
): CapacidadKey[] {
  const set = new Set<CapacidadKey>();
  for (const key of outputsCanonicos ?? []) {
    if (KEYS_INTERNAS.has(key) || KEYS_PODADAS.has(key)) continue;
    set.add(resolverAliasLegacy(key).capacidad);
  }
  return [...set];
}


/** Resumen por familia para selectores de UI (B.3.3, "hereda de"). */
export interface CapacidadResumen {
  key: CapacidadKey;
  nombre: string;
  heredable: boolean;
}

/**
 * Qué capacidades ofrece una familia, para UI: las declaradas (vía alias)
 * MÁS las universales (unidades + minutos), que todo paso emite aunque su
 * declaración histórica no las nombre — espeja `capacidadesEmitidas`.
 */
export function resumenCapacidades(
  outputsCanonicos: readonly string[] | undefined,
): CapacidadResumen[] {
  const set = new Set<CapacidadKey>(['unidades_procesadas', 'minutos_reales']);
  for (const key of capacidadesDeclaradas(outputsCanonicos)) set.add(key);
  return [...set].map((key) => ({
    key,
    nombre: CAPACIDADES[key].nombre,
    heredable: CAPACIDADES[key].heredable,
  }));
}

/** Una capacidad emitida por un paso ejecutado, para la trazabilidad. */
export interface CapacidadEmitida {
  capacidad: CapacidadKey;
  etiqueta: string;
  valor: number;
}

/**
 * Clave reservada del jobContext mutado donde el motor indexa las
 * capacidades emitidas por rutaPasoId (no es un output canónico).
 */
export const KEY_CAPACIDADES_POR_PASO = '__capacidadesPorPaso';

/**
 * B.3.3 — Herencia EXPLÍCITA: si la config del paso señala un origen
 * (`origen: { rutaPasoId, capacidad }`), devuelve el valor que ese paso
 * publicó para esa capacidad. `null` = sin origen señalado o sin valor
 * (paso salteado / aún no ejecutado): el motor cae al camino legacy.
 */
export function resolverHerenciaExplicita(
  config: Record<string, unknown>,
  jobContext: Record<string, unknown>,
): number | null {
  const origen = config.origen as
    | { rutaPasoId?: unknown; capacidad?: unknown }
    | undefined;
  if (!origen || typeof origen.rutaPasoId !== 'string') return null;
  const porPaso = jobContext[KEY_CAPACIDADES_POR_PASO] as
    | Record<string, CapacidadEmitida[]>
    | undefined;
  const capacidad =
    typeof origen.capacidad === 'string'
      ? origen.capacidad
      : 'unidades_procesadas';
  const hit = porPaso?.[origen.rutaPasoId]?.find(
    (c) => c.capacidad === capacidad,
  );
  return hit && Number.isFinite(hit.valor) && hit.valor > 0 ? hit.valor : null;
}

/**
 * B.3.2 — Proyecta los outputs de un paso ejecutado al registro. Aditivo:
 * las keys planas del jobContext no se tocan; esto es la vista
 * estandarizada que viaja en la trazabilidad.
 *
 * Reglas: internas/podadas/atributos no emiten entrada propia; solo
 * valores numéricos positivos (la imposición-objeto sigue viajando por su
 * key plana). Las universales (unidades, minutos) se agregan si ninguna
 * key declarada ya cubrió esa capacidad — así "piezas cortadas: 500" no
 * duplica con "unidades procesadas: 500".
 */
export function capacidadesEmitidas(params: {
  outputsCanonicos?: Record<string, unknown>;
  cantidadEfectiva?: number;
  totalMin?: number;
}): CapacidadEmitida[] {
  const out: CapacidadEmitida[] = [];
  const presentes = new Set<CapacidadKey>();

  for (const [key, valor] of Object.entries(params.outputsCanonicos ?? {})) {
    if (KEYS_INTERNAS.has(key) || KEYS_PODADAS.has(key)) continue;
    const alias = resolverAliasLegacy(key);
    if (alias.atributo) continue;
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
      continue;
    }
    out.push({ capacidad: alias.capacidad, etiqueta: alias.etiqueta, valor });
    presentes.add(alias.capacidad);
  }

  const { cantidadEfectiva, totalMin } = params;
  if (
    !presentes.has('unidades_procesadas') &&
    typeof cantidadEfectiva === 'number' &&
    Number.isFinite(cantidadEfectiva) &&
    cantidadEfectiva > 0
  ) {
    out.push({
      capacidad: 'unidades_procesadas',
      etiqueta: 'unidades procesadas',
      valor: cantidadEfectiva,
    });
  }
  if (
    !presentes.has('minutos_reales') &&
    typeof totalMin === 'number' &&
    Number.isFinite(totalMin) &&
    totalMin > 0
  ) {
    out.push({
      capacidad: 'minutos_reales',
      etiqueta: 'minutos de trabajo',
      valor: totalMin,
    });
  }
  return out;
}
