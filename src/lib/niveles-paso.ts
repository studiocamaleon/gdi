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

/** null si no hay al menos dos opciones: un solo nivel no es una decisión. */
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
    const nombre =
      typeof opcion.nombre === "string" && opcion.nombre.trim()
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
    typeof bruto.etiqueta === "string" && bruto.etiqueta.trim()
      ? bruto.etiqueta.trim()
      : "¿Qué nivel?";
  return { etiqueta, opciones };
}

/** El nivel que corre: el elegido, el marcado por defecto, o el primero. */
export function nivelEfectivo(
  config: NivelesPasoConfig,
  elegido: string | null | undefined,
): NivelPasoOpcion {
  const match = elegido
    ? config.opciones.find((opcion) => opcion.codigo === elegido)
    : null;
  return (
    match ?? config.opciones.find((opcion) => opcion.esDefault) ?? config.opciones[0]
  );
}

/**
 * Resumen de una línea para el pie de la card: qué cambia este nivel. Sin esto
 * el comercial elige a ciegas entre tres nombres.
 */
export function describirNivel(nivel: NivelPasoOpcion): string | null {
  const partes: string[] = [];
  const { overrides } = nivel;
  if (overrides.tiemposExtraMin) {
    const totalMin = Object.values(overrides.tiemposExtraMin).reduce(
      (acc, min) => acc + min,
      0,
    );
    if (totalMin > 0) {
      const horas = totalMin / 60;
      partes.push(
        horas >= 1
          ? `+${horas.toFixed(horas % 1 === 0 ? 0 : 1)} h de tiempo extra`
          : `+${totalMin} min de tiempo extra`,
      );
    }
  }
  if (overrides.tiempoFijoMin != null) {
    partes.push(`${overrides.tiempoFijoMin} min de trabajo`);
  }
  if (overrides.productividadHora != null) {
    partes.push(`${overrides.productividadHora}/h`);
  }
  if (overrides.dotacion != null) {
    partes.push(
      overrides.dotacion === 1 ? "1 persona" : `${overrides.dotacion} personas`,
    );
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}
