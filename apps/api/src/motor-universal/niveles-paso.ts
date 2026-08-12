/**
 * NIVELES DEL PASO — un paso, varias variantes que elige el comercial.
 *
 * "Colocación a domicilio" no son tres pasos (taller / zona 1 / zona 2): es UN
 * paso con tres niveles que cambian el tiempo. Lo mismo "Diseño gráfico"
 * (básico / intermedio / profesional). Es el cuarto eje excluyente del sistema
 * —después de modo de color, máquinas candidatas y material del slot— y el
 * primero que declara el modelador en vez de estar cableado.
 *
 * El nivel es un DELTA sobre la base del paso: sólo pisa lo que declara. En v1
 * puede pisar el reloj del trabajo (ritmo o tiempo fijo), la dotación y los
 * minutos de los bloques de tiempo extra (por id). No toca materiales, máquina
 * ni el centro del paso — eso se puede abrir después; al revés no se vuelve.
 *
 * Ver docs/cargos-por-paso-analisis-y-plan.md §8.
 */

/** Prefijo de la clave del JobContext donde viaja lo que eligió el comercial. */
export const NIVEL_PASO_KEY_PREFIX = 'nivelPaso_';

export function nivelPasoKey(configPasoId: string): string {
  return `${NIVEL_PASO_KEY_PREFIX}${configPasoId}`;
}

export interface NivelPasoOverrides {
  /** Ritmo propio del paso (unidades/hora) para este nivel. */
  productividadHora?: number;
  /** Reloj fijo del trabajo, en minutos. */
  tiempoFijoMin?: number;
  /** Personas que ocupa el paso en este nivel. */
  dotacion?: number;
  /** Minutos de cada bloque de tiempo extra, por id del bloque. */
  tiemposExtraMin?: Record<string, number>;
}

export interface NivelPasoOpcion {
  codigo: string;
  nombre: string;
  esDefault: boolean;
  overrides: NivelPasoOverrides;
}

export interface NivelesPasoConfig {
  /** Cómo se le pregunta al comercial: "¿Dónde se coloca?". */
  etiqueta: string;
  opciones: NivelPasoOpcion[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numeroNoNegativo(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function leerOverrides(raw: unknown): NivelPasoOverrides {
  const bruto = asRecord(raw);
  const overrides: NivelPasoOverrides = {};
  const productividad = numeroNoNegativo(bruto.productividadHora);
  if (productividad != null && productividad > 0) {
    overrides.productividadHora = productividad;
  }
  const tiempoFijo = numeroNoNegativo(bruto.tiempoFijoMin);
  if (tiempoFijo != null) overrides.tiempoFijoMin = tiempoFijo;
  const dotacion = numeroNoNegativo(bruto.dotacion);
  if (dotacion != null && dotacion > 0) {
    overrides.dotacion = Math.max(1, Math.round(dotacion));
  }
  const minutos = asRecord(bruto.tiemposExtraMin);
  const porBloque: Record<string, number> = {};
  for (const [id, valor] of Object.entries(minutos)) {
    // 0 es un override legítimo: "en taller no hay traslado".
    const min = numeroNoNegativo(valor);
    if (min != null) porBloque[id] = min;
  }
  if (Object.keys(porBloque).length > 0) overrides.tiemposExtraMin = porBloque;
  return overrides;
}

/**
 * Lee la declaración de niveles del paso. Devuelve null si no hay al menos dos
 * opciones: un solo nivel no es una decisión, es la config del paso.
 */
export function leerNivelesPaso(
  paramsPasoJson: unknown,
): NivelesPasoConfig | null {
  const params = asRecord(paramsPasoJson);
  const bruto = asRecord(params.niveles);
  const rawOpciones = Array.isArray(bruto.opciones) ? bruto.opciones : [];
  const opciones: NivelPasoOpcion[] = [];
  rawOpciones.forEach((item, indice) => {
    const opcion = asRecord(item);
    const codigo =
      typeof opcion.codigo === 'string' && opcion.codigo.trim()
        ? opcion.codigo.trim()
        : `nivel_${indice}`;
    const nombre =
      typeof opcion.nombre === 'string' && opcion.nombre.trim()
        ? opcion.nombre.trim()
        : codigo;
    if (opciones.some((previa) => previa.codigo === codigo)) return;
    opciones.push({
      codigo,
      nombre,
      esDefault: opcion.esDefault === true,
      overrides: leerOverrides(opcion.overrides),
    });
  });
  if (opciones.length < 2) return null;
  const etiqueta =
    typeof bruto.etiqueta === 'string' && bruto.etiqueta.trim()
      ? bruto.etiqueta.trim()
      : '¿Qué nivel?';
  return { etiqueta, opciones };
}

/**
 * Qué nivel corre: el que eligió el comercial, el marcado por defecto, o el
 * primero. Nunca null cuando hay niveles — una cotización sin nivel elegido
 * tiene que costar algo, no fallar.
 */
export function resolverNivelPaso(
  paramsPasoJson: unknown,
  configPasoId: string,
  jobContext: Record<string, unknown> | null | undefined,
): NivelPasoOpcion | null {
  const config = leerNivelesPaso(paramsPasoJson);
  if (!config) return null;
  const elegido = jobContext?.[nivelPasoKey(configPasoId)];
  if (typeof elegido === 'string' && elegido.trim()) {
    const match = config.opciones.find(
      (opcion) => opcion.codigo === elegido.trim(),
    );
    if (match) return match;
  }
  return (
    config.opciones.find((opcion) => opcion.esDefault) ?? config.opciones[0]
  );
}

/**
 * Devuelve una copia del paso con el nivel ya aplicado, para que todo el motor
 * aguas abajo vea un solo origen de verdad (mismo criterio que
 * `aplicarCentroDefault`). No muta el paso cargado.
 */
export function aplicarNivelAlPaso<
  T extends {
    configPasoId: string;
    paramsPasoJson: unknown;
    dotacionOperarios?: number | null;
    tiempoFijoOverrideMin?: number | null;
  },
>(paso: T, jobContext: Record<string, unknown> | null | undefined): T {
  const nivel = resolverNivelPaso(
    paso.paramsPasoJson,
    paso.configPasoId,
    jobContext,
  );
  if (!nivel) return paso;
  const { overrides } = nivel;
  const params = { ...asRecord(paso.paramsPasoJson) };

  if (overrides.productividadHora != null) {
    params.productivityValue = overrides.productividadHora;
  }
  if (overrides.tiemposExtraMin) {
    const bloques = Array.isArray(params.tiemposExtra)
      ? params.tiemposExtra
      : [];
    params.tiemposExtra = bloques.map((item, indice) => {
      const bloque = asRecord(item);
      const id =
        typeof bloque.id === 'string' && bloque.id.trim()
          ? bloque.id.trim()
          : `extra_${indice}`;
      const minutos = overrides.tiemposExtraMin?.[id];
      return minutos == null ? bloque : { ...bloque, minutos };
    });
  }

  return {
    ...paso,
    paramsPasoJson: params,
    ...(overrides.dotacion != null
      ? { dotacionOperarios: overrides.dotacion }
      : {}),
    ...(overrides.tiempoFijoMin != null
      ? { tiempoFijoOverrideMin: overrides.tiempoFijoMin }
      : {}),
  };
}
