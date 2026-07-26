/**
 * El eje de tiempo de la vista de simulación.
 *
 * NO es tiempo lineal: son minutos laborales. Noches y fines de semana se
 * colapsan. Sin esto la vista es ilegible y no es una preferencia estética:
 * el horizonte real ronda las 15 jornadas con bloques de mediana 10 min, así
 * que en tiempo lineal ~340 h de nada aplastan todo el detalle intradiario.
 *
 * La ventana diaria sale de la UNIÓN de los calendarios de las estaciones
 * activas: cualquier bloque que el motor programe cae dentro de la franja de
 * alguna estación, así que la unión los cubre a todos.
 */
import {
  calendarioDefault,
  DIAS_SEMANA,
  type CalendarioEstacion,
  type Estacion,
} from "@/lib/estaciones";
import {
  claveFechaEnZona,
  diaSemanaDeClave,
  partesEnZona,
  sumarDiasAClave,
  ZONA_DEFAULT,
} from "@/lib/zona";

/** Tope de días a proyectar en el eje. */
const MAX_DIAS = 180;

const VENTANA_FALLBACK = { desde: 8 * 60, hasta: 18 * 60 };

export type DiaEje = {
  /** Minuto laboral acumulado en que arranca el día. */
  x: number;
  /** Minutos utilizables de ESTE día. El primero puede ser parcial. */
  ancho: number;
  /** Minuto del día en que empieza el tramo dibujado (08:00 → 480). */
  desdeMin: number;
  /** "lun 20/07" */
  etiqueta: string;
  /** ISO "YYYY-MM-DD" */
  fecha: string;
};

export type EjeLaboral = {
  /** Minutos utilizables por jornada COMPLETA. */
  jornadaMin: number;
  /** Ancho total del eje en minutos (la primera jornada puede ser parcial). */
  totalMin: number;
  ventana: { desde: number; hasta: number };
  dias: DiaEje[];
  /** Fecha → minuto laboral acumulado desde el arranque del eje. */
  aX: (fecha: Date) => number;
};

function minutosDe(hora: string) {
  const [hh, mm] = hora.split(":").map(Number);
  return hh * 60 + mm;
}

const DIA_CORTO: Record<string, string> = {
  dom: "dom",
  lun: "lun",
  mar: "mar",
  mie: "mié",
  jue: "jue",
  vie: "vie",
  sab: "sáb",
};

/** "lun 20/07", desde la clave "2026-07-20". */
function etiquetaDe(clave: string) {
  const [, m, d] = clave.split("-");
  return `${DIA_CORTO[diaSemanaDeClave(clave)]} ${d}/${m}`;
}

/** La franja más ancha que trabaja alguna estación activa. */
function ventanaUnion(estaciones: Estacion[]) {
  const calendarios: CalendarioEstacion[] = estaciones
    .filter((e) => e.activo)
    .map((e) => {
      const vacio =
        !e.calendario ||
        DIAS_SEMANA.every((d) => (e.calendario!.dias[d] ?? []).length === 0);
      return vacio ? calendarioDefault() : (e.calendario as CalendarioEstacion);
    });

  let desde = Infinity;
  let hasta = -Infinity;
  for (const cal of calendarios) {
    for (const dia of DIAS_SEMANA) {
      // La envolvente cubre TODAS las franjas del día: con jornada cortada
      // el eje dibuja también el corte del mediodía (queda como aire, nada
      // se programa ahí).
      for (const franja of cal.dias[dia] ?? []) {
        desde = Math.min(desde, minutosDe(franja.desde));
        hasta = Math.max(hasta, minutosDe(franja.hasta));
      }
    }
  }
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) {
    return { ...VENTANA_FALLBACK };
  }
  return { desde, hasta };
}

/** Un día cuenta si alguna estación trabaja y no es feriado del taller. */
function esLaborable(
  clave: string,
  estaciones: Estacion[],
  noLaborables: Set<string>,
) {
  if (noLaborables.has(clave)) return false;
  const dia = diaSemanaDeClave(clave);
  return estaciones.some((e) => {
    if (!e.activo) return false;
    const vacio =
      !e.calendario ||
      DIAS_SEMANA.every((d) => (e.calendario!.dias[d] ?? []).length === 0);
    const cal = vacio ? calendarioDefault() : (e.calendario as CalendarioEstacion);
    return (cal.dias[dia] ?? []).length > 0;
  });
}

export function construirEje({
  estaciones,
  ahora,
  hasta,
  noLaborables = new Set<string>(),
  zona = ZONA_DEFAULT,
}: {
  estaciones: Estacion[];
  ahora: Date;
  /** Último instante que el eje tiene que cubrir (el fin más lejano). */
  hasta: Date;
  noLaborables?: Set<string>;
  /** Zona IANA del taller: los días y las horas del eje son de pared AHÍ. */
  zona?: string;
}): EjeLaboral {
  const ventana = ventanaUnion(estaciones);
  const jornadaMin = ventana.hasta - ventana.desde;

  /* El eje arranca EN `ahora`, no en la apertura del día: en el pasado
     nunca se dibuja nada (el plan es hacia adelante), así que esas horas
     serían píxeles muertos garantizados. La primera jornada queda parcial;
     si `ahora` ya pasó el cierre, ese día no entra. */
  const ahoraPared = partesEnZona(ahora, zona);
  const minutoDeAhora = ahoraPared.hh * 60 + ahoraPared.mm;
  const claveHoy = claveFechaEnZona(ahora, zona);
  const claveLimite = claveFechaEnZona(hasta, zona);

  const dias: DiaEje[] = [];
  const porFecha = new Map<string, DiaEje>();
  let acumulado = 0;
  for (let i = 0; i < MAX_DIAS; i += 1) {
    const fecha = i === 0 ? claveHoy : sumarDiasAClave(claveHoy, i);
    // Las claves ISO ordenan lexicográficamente: comparar strings es comparar días.
    if (fecha > claveLimite && dias.length > 0) break;
    if (esLaborable(fecha, estaciones, noLaborables)) {
      const esHoy = fecha === claveHoy;
      const desdeMin = esHoy
        ? Math.max(ventana.desde, minutoDeAhora)
        : ventana.desde;
      const ancho = ventana.hasta - desdeMin;
      if (ancho > 0) {
        const dia: DiaEje = {
          x: acumulado,
          ancho,
          desdeMin,
          etiqueta: etiquetaDe(fecha),
          fecha,
        };
        dias.push(dia);
        porFecha.set(fecha, dia);
        acumulado += ancho;
      }
    }
  }

  const aX = (fecha: Date) => {
    const clave = claveFechaEnZona(fecha, zona);
    const dia = porFecha.get(clave);
    if (!dia) {
      // Cae en un día que el eje no dibuja (feriado, fin de semana, o antes
      // del arranque): se ancla al borde del día laborable anterior para no
      // inventar posición ni empujarlo al origen.
      const previos = dias.filter((d) => d.fecha < clave);
      const ultimo = previos.at(-1);
      return ultimo ? ultimo.x + ultimo.ancho : 0;
    }
    const p = partesEnZona(fecha, zona);
    const min = p.hh * 60 + p.mm;
    return dia.x + Math.max(0, Math.min(dia.ancho, min - dia.desdeMin));
  };

  return { jornadaMin, totalMin: acumulado, ventana, dias, aX };
}

/* ── Zoom ────────────────────────────────────────────────────────────── */

/** px por minuto laboral. El techo deja leer un paso de 10 min (60 px). */
export const Z_MIN = 0.02;
export const Z_MAX = 6;

/**
 * NaN cae al piso (puede salir de dividir por un ancho todavía sin medir:
 * mostrar todo es recuperable). Infinity clampea normal al techo.
 */
export const acotarZoom = (v: number) =>
  Number.isNaN(v) ? Z_MIN : Math.min(Z_MAX, Math.max(Z_MIN, v));

/** Pasos del deslizador de zoom. Más pasos = movimiento más fino. */
export const ZOOM_PASOS = 1000;

/**
 * El deslizador es LOGARÍTMICO: el rango útil va de 0,02 a 6 px/min, o sea
 * 300×. En escala lineal, la mitad izquierda de la barra no se distinguiría
 * y todo el detalle quedaría amontonado contra el extremo derecho.
 */
export const zoomDeSlider = (v: number) =>
  acotarZoom(Z_MIN * Math.pow(Z_MAX / Z_MIN, v / ZOOM_PASOS));

export const sliderDeZoom = (z: number) =>
  Math.round(
    (ZOOM_PASOS * Math.log(acotarZoom(z) / Z_MIN)) / Math.log(Z_MAX / Z_MIN),
  );

/**
 * Scroll que deja QUIETO el punto que el usuario estaba mirando al cambiar
 * el zoom. Sin esto, acercarse tira el contenido fuera de la ventana y hay
 * que volver a buscar dónde estaba uno.
 *
 * @param scrollLeft scroll actual del contenedor
 * @param offsetX    posición del cursor dentro del contenedor
 * @param zAnterior  px/min antes del zoom
 * @param zNuevo     px/min después
 */
export function anclarZoom({
  scrollLeft,
  offsetX,
  zAnterior,
  zNuevo,
}: {
  scrollLeft: number;
  offsetX: number;
  zAnterior: number;
  zNuevo: number;
}): number {
  const minutoBajoElCursor = (scrollLeft + offsetX) / zAnterior;
  return Math.max(0, minutoBajoElCursor * zNuevo - offsetX);
}
