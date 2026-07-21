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
  type DiaSemana,
  type Estacion,
} from "@/lib/estaciones";

/** Índice Date.getDay() (0 = domingo) → clave del calendario. */
const JS_DIA: DiaSemana[] = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

/** Tope de días a proyectar en el eje. */
const MAX_DIAS = 180;

const VENTANA_FALLBACK = { desde: 8 * 60, hasta: 18 * 60 };

export type DiaEje = {
  /** Minuto laboral acumulado en que arranca el día. */
  x: number;
  /** "lun 20/07" */
  etiqueta: string;
  /** ISO "YYYY-MM-DD" */
  fecha: string;
};

export type EjeLaboral = {
  /** Minutos utilizables por jornada. */
  jornadaMin: number;
  ventana: { desde: number; hasta: number };
  dias: DiaEje[];
  /** Fecha → minuto laboral acumulado desde el arranque del eje. */
  aX: (fecha: Date) => number;
};

function minutosDe(hora: string) {
  const [hh, mm] = hora.split(":").map(Number);
  return hh * 60 + mm;
}

function claveFecha(fecha: Date) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DIA_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function etiquetaDe(fecha: Date) {
  const d = String(fecha.getDate()).padStart(2, "0");
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  return `${DIA_CORTO[fecha.getDay()]} ${d}/${m}`;
}

/** La franja más ancha que trabaja alguna estación activa. */
function ventanaUnion(estaciones: Estacion[]) {
  const calendarios: CalendarioEstacion[] = estaciones
    .filter((e) => e.activo)
    .map((e) => {
      const vacio =
        !e.calendario || DIAS_SEMANA.every((d) => e.calendario!.dias[d] === null);
      return vacio ? calendarioDefault() : (e.calendario as CalendarioEstacion);
    });

  let desde = Infinity;
  let hasta = -Infinity;
  for (const cal of calendarios) {
    for (const dia of DIAS_SEMANA) {
      const franja = cal.dias[dia];
      if (!franja) continue;
      desde = Math.min(desde, minutosDe(franja.desde));
      hasta = Math.max(hasta, minutosDe(franja.hasta));
    }
  }
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) {
    return { ...VENTANA_FALLBACK };
  }
  return { desde, hasta };
}

/** Un día cuenta si alguna estación trabaja y no es feriado del taller. */
function esLaborable(
  fecha: Date,
  estaciones: Estacion[],
  noLaborables: Set<string>,
) {
  if (noLaborables.has(claveFecha(fecha))) return false;
  const dia = JS_DIA[fecha.getDay()];
  return estaciones.some((e) => {
    if (!e.activo) return false;
    const vacio =
      !e.calendario || DIAS_SEMANA.every((d) => e.calendario!.dias[d] === null);
    const cal = vacio ? calendarioDefault() : (e.calendario as CalendarioEstacion);
    return cal.dias[dia] !== null;
  });
}

export function construirEje({
  estaciones,
  ahora,
  hasta,
  noLaborables = new Set<string>(),
}: {
  estaciones: Estacion[];
  ahora: Date;
  /** Último instante que el eje tiene que cubrir (el fin más lejano). */
  hasta: Date;
  noLaborables?: Set<string>;
}): EjeLaboral {
  const ventana = ventanaUnion(estaciones);
  const jornadaMin = ventana.hasta - ventana.desde;

  const cursor = new Date(ahora);
  cursor.setHours(0, 0, 0, 0);
  const limite = new Date(hasta);
  limite.setHours(23, 59, 59, 999);

  const dias: DiaEje[] = [];
  const indicePorFecha = new Map<string, number>();
  let acumulado = 0;
  for (let i = 0; i < MAX_DIAS; i += 1) {
    if (cursor > limite && dias.length > 0) break;
    if (esLaborable(cursor, estaciones, noLaborables)) {
      const fecha = claveFecha(cursor);
      indicePorFecha.set(fecha, acumulado);
      dias.push({ x: acumulado, etiqueta: etiquetaDe(cursor), fecha });
      acumulado += jornadaMin;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const aX = (fecha: Date) => {
    const base = indicePorFecha.get(claveFecha(fecha));
    if (base === undefined) {
      // Cae en un día que el eje no dibuja (feriado, o fuera del rango):
      // se ancla al borde del día laborable anterior para no inventar
      // posición ni empujarlo al origen.
      const previos = dias.filter((d) => d.fecha < claveFecha(fecha));
      const ultimo = previos.at(-1);
      return ultimo ? ultimo.x + jornadaMin : 0;
    }
    const min = fecha.getHours() * 60 + fecha.getMinutes();
    return base + Math.max(0, Math.min(jornadaMin, min - ventana.desde));
  };

  return { jornadaMin, ventana, dias, aX };
}
