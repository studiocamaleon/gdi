/**
 * NIVELES DEL PASO — un paso, varias variantes que elige el comercial.
 *
 * Espejo de `apps/api/src/motor-universal/niveles-paso.ts`: el editor los
 * declara, el cotizador los ofrece y el motor los aplica. La forma del dato es
 * la misma en las tres alturas donde puede vivir (paso del producto, paso del
 * tenant, defaults de familia).
 *
 * Ver docs/cargos-por-paso-analisis-y-plan.md §8.
 */

export interface NivelPasoOverrides {
  /** Perfil por máquina candidata. Ausente = conserva el perfil del paso. */
  perfilesPorMaquina?: Record<string, string>;
  productividadHora?: number;
  tiempoFijoMin?: number;
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
  etiqueta: string;
  opciones: NivelPasoOpcion[];
}

export function nivelPasoKey(configPasoId: string): string {
  return `nivelPaso_${configPasoId}`;
}

/**
 * Nivel SINTÉTICO: "el comercial pone el tiempo a mano".
 *
 * No se declara ni se guarda en el paso — lo agrega el cotizador cuando el
 * paso tiene niveles Y además deja que el comercial ajuste el tiempo. Sin él,
 * la pantalla ofrecía los dos caminos a la vez (elegí un nivel / escribí un
 * tiempo) sin decir cuál gana; y gana siempre el tiempo escrito, porque en el
 * motor el tiempo manual pisa cualquier reloj. Elegirlo significa: sin
 * overrides de nivel, el tiempo lo dice el comercial.
 */
export const NIVEL_PERSONALIZADO = "__personalizado__";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
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
  const perfiles = Object.entries(asRecord(bruto.perfilesPorMaquina)).filter(
    ([maquinaId, perfilId]) =>
      maquinaId.trim() && typeof perfilId === "string" && perfilId.trim(),
  );
  if (perfiles.length)
    overrides.perfilesPorMaquina = Object.fromEntries(
      perfiles.map(([id, perfil]) => [id.trim(), (perfil as string).trim()]),
    );
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
    const min = numeroNoNegativo(valor);
    if (min != null) porBloque[id] = min;
  }
  if (Object.keys(porBloque).length > 0) overrides.tiemposExtraMin = porBloque;
  return overrides;
}

/**
 * null si no hay al menos dos opciones: un solo nivel no es una decisión.
 *
 * **Los textos salen tal cual están guardados.** Este lector alimenta los
 * inputs del editor en cada tecla: si acá se hiciera `trim()`, escribir un
 * espacio sería imposible (se borra antes de que llegue la letra siguiente:
 * "Profesional a" → "Profesionala"), y vaciar el campo lo repoblaría con el
 * código ("nivel_1"). Normalizar es tarea de quien MUESTRA —el cotizador cae
 * al código si el nombre quedó vacío— y del motor, que sí es tolerante.
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
      typeof opcion.codigo === "string" && opcion.codigo.trim()
        ? opcion.codigo.trim()
        : `nivel_${indice}`;
    if (opciones.some((previa) => previa.codigo === codigo)) return;
    opciones.push({
      codigo,
      nombre: typeof opcion.nombre === "string" ? opcion.nombre : codigo,
      esDefault: opcion.esDefault === true,
      overrides: leerOverrides(opcion.overrides),
    });
  });
  if (opciones.length < 2) return null;
  return {
    etiqueta:
      typeof bruto.etiqueta === "string" ? bruto.etiqueta : "¿Qué nivel?",
    opciones,
  };
}

/** Cómo se muestra un nivel: su nombre, o el código si quedó sin nombre. */
export function nombreNivel(nivel: NivelPasoOpcion): string {
  return nivel.nombre.trim() || nivel.codigo;
}

/** El nivel que corre: el elegido, el marcado por defecto, o el primero. */
export function nivelEfectivo(
  config: NivelesPasoConfig,
  elegido: string | null | undefined,
  perfilAnterior?: string | null,
): NivelPasoOpcion {
  const match = elegido
    ? config.opciones.find((opcion) => opcion.codigo === elegido)
    : perfilAnterior
      ? config.opciones.find(
          (opcion) =>
            opcion.codigo === `perfil_${perfilAnterior}` &&
            Object.values(opcion.overrides.perfilesPorMaquina ?? {}).includes(
              perfilAnterior,
            ),
        )
      : null;
  return (
    match ??
    config.opciones.find((opcion) => opcion.esDefault) ??
    config.opciones[0]
  );
}

/** Lo que el paso vale cuando el nivel no pisa nada. */
export interface BaseDelPaso {
  usaTiempoDeMaquina?: boolean;
  perfilesPorOperacion?: boolean;
  maquina?: MaquinaParaNiveles | null;
  productividadHora?: number | null;
  unidadProductividad?: string | null;
  /** Minutos de trabajo declarados por el paso (T-1 / horas estimadas). */
  tiempoFijoMin?: number | null;
  /**
   * Los bloques de tiempo extra que el paso declara HOY, con sus minutos base.
   * Va la lista y no el total porque el nivel pisa bloque por bloque: sumar el
   * mapa de overrides contaba de más los huérfanos —overrides de bloques ya
   * borrados, que el motor ignora— y de menos los bloques que el nivel no pisa.
   */
  bloques?: Array<{ id: string; minutos: number }>;
}

/** La unidad pertenece al perfil/paso; nunca inferir m²/h sólo por ser corte. */
export function describirProductividad(
  valor: number | string | null | undefined,
  unidad: string | null | undefined,
): string | null {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0 || !unidad?.trim()) return null;
  const unidades: Record<string, string> = {
    hora: "trabajos/h", hoja: "hojas/h", copia: "copias/h",
    ppm: "pág. A4-eq/min", a4_equiv: "A4-eq/h",
    m2: "m²/h", m2_h: "m²/h", metro_lineal: "m/h", ml_h: "m/h",
    piezas_h: "piezas/h", pieza: "piezas/h", unidades_h: "unid./h",
    pliegos_h: "pliegos/h", ciclo: "ciclos/h", cortes_min: "cortes/min",
    golpes_min: "golpes/min", pliegos_min: "pliegos/min", m_min: "m/min",
    mm_s: "mm/s", mm_min: "mm/min", g_h: "g/h",
  };
  const etiqueta = unidades[unidad.trim().toLowerCase()] ??
    (unidad.includes("/") ? unidad.trim() : null);
  return etiqueta
    ? `${numero.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${etiqueta}`
    : null;
}

/**
 * Resumen de una línea para el pie de la card: cuánto cuesta ESTE nivel.
 *
 * Muestra el valor EFECTIVO, no el override: un nivel que no pisa nada —"lo
 * mismo que el paso"— igual tiene que decir cuánto lleva, o al lado de uno que
 * sí declara ("60 min de trabajo") parece que no cuesta nada.
 */
export function describirNivel(
  nivel: NivelPasoOpcion,
  base: BaseDelPaso = {},
): string | null {
  const partes: string[] = [];
  const { overrides } = nivel;

  // Efectivo BLOQUE POR BLOQUE, como lo hace el motor: el override si el nivel
  // lo declara, si no los minutos del bloque. Un override de un bloque que ya
  // no existe no suma nada, porque no hay bloque que ejecutar.
  const extraMin = (base.bloques ?? []).reduce(
    (acc, bloque) =>
      acc + (overrides.tiemposExtraMin?.[bloque.id] ?? bloque.minutos),
    0,
  );
  if (extraMin > 0) {
    const horas = extraMin / 60;
    partes.push(
      horas >= 1
        ? `+${horas.toFixed(horas % 1 === 0 ? 0 : 1)} h de tiempo extra`
        : `+${extraMin} min de tiempo extra`,
    );
  }

  const trabajoMin = overrides.tiempoFijoMin ?? base.tiempoFijoMin ?? null;
  if (trabajoMin != null && trabajoMin > 0) {
    partes.push(`${trabajoMin} min de trabajo`);
  }
  if (base.usaTiempoDeMaquina) {
    const maquina = base.maquina;
    const perfilId = maquina
      ? overrides.perfilesPorMaquina?.[maquina.id] ?? maquina.perfilDefaultId
      : null;
    const perfil = maquina?.perfiles.find((p) => p.id === perfilId);
    // T-3 usa el perfil, no un override manual de productividad que haya
    // quedado guardado antes de elegir este modo de tiempo.
    partes.push(base.perfilesPorOperacion
      ? "Ritmo según la operación"
      : describirProductividad(perfil?.productivityValue, perfil?.productivityUnit) ??
        (perfil ? `Perfil: ${perfil.nombre}` : "Perfil del paso"));
  } else {
    const ritmo = describirProductividad(
      overrides.productividadHora ?? base.productividadHora,
      base.unidadProductividad,
    );
    if (ritmo) partes.push(ritmo);
  }
  if (overrides.dotacion != null) {
    partes.push(
      overrides.dotacion === 1 ? "1 persona" : `${overrides.dotacion} personas`,
    );
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}

export interface MaquinaParaNiveles {
  id: string;
  nombre: string;
  perfilDefaultId?: string | null;
  perfiles: Array<{
    id: string;
    nombre: string;
    productivityValue?: number | string | null;
    productivityUnit?: string | null;
  }>;
}

/** Adaptación en memoria de la complejidad antigua. Se persiste al editar,
 * sin cambiar rutas ni órdenes existentes durante la lectura. */
export function nivelesDesdePerfiles(
  maquina: MaquinaParaNiveles,
  expuestos?: unknown,
  etiqueta = "¿Qué nivel?",
): NivelesPasoConfig | null {
  const perfiles = maquina.perfiles.filter(
    (p) =>
      !Array.isArray(expuestos) ||
      expuestos.includes(p.id) ||
      p.id === maquina.perfilDefaultId,
  );
  if (perfiles.length < 2) return null;
  const ordenados = [...perfiles].sort(
    (a, b) =>
      Number(b.productivityValue ?? 0) - Number(a.productivityValue ?? 0),
  );
  return {
    etiqueta,
    opciones: ordenados.map((p, index) => ({
      codigo: `perfil_${p.id}`,
      nombre: p.nombre,
      esDefault: maquina.perfilDefaultId
        ? p.id === maquina.perfilDefaultId
        : index === 0,
      overrides: { perfilesPorMaquina: { [maquina.id]: p.id } },
    })),
  };
}
