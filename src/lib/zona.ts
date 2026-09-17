/**
 * Aritmética de zona horaria sin librerías: las cuatro primitivas que
 * separan "el instante" (Date, UTC adentro) de "la hora de pared del taller"
 * (lo que dice el calendario laboral, el corte de jornada, el feriado).
 *
 * La técnica es la misma que ya usaba la ventana de cortesía de WhatsApp
 * (`despacho.service.ts`): pedirle a `Intl` las PARTES numéricas del instante
 * en la zona pedida — es la única forma portable de leer una zona IANA sin
 * arrastrar una librería de fechas, y la base de datos de zonas (con su DST)
 * la pone ICU.
 *
 * Hay un ESPEJO en `apps/api/src/common/zona.ts`; si se toca uno se tocan
 * los dos, igual que `flujo-produccion.ts`.
 *
 * Ver docs/multi-moneda-zona-horaria-diseno.md (D9).
 */

export const ZONA_DEFAULT = "America/Argentina/Buenos_Aires";

export type PartesZona = {
  y: number;
  /** 1-12, humano — no el 0-11 de Date. */
  m: number;
  d: number;
  hh: number;
  mm: number;
};

/** Un formatter por zona: crearlos es caro y el motor llama esto en loops. */
const FORMATOS = new Map<string, Intl.DateTimeFormat>();

// Sólo funciones puras de fecha/zona: no contiene calendarios ni datos de tenant.
// Límite global para que procesos largos no acumulen fechas indefinidamente.
const MAX_FECHAS_CACHE = 16_384;
const PARTES_CACHE = new Map<string, PartesZona>();
const INSTANTES_CACHE = new Map<string, number>();
function recordar<K, V>(cache: Map<K, V>, clave: K, valor: V): void {
  if (cache.size >= MAX_FECHAS_CACHE) cache.clear();
  cache.set(clave, valor);
}

function formato(zona: string): Intl.DateTimeFormat {
  let f = FORMATOS.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    FORMATOS.set(zona, f);
  }
  return f;
}

/** Qué hora de pared es `instante` en `zona`. */
export function partesEnZona(instante: Date, zona: string): PartesZona {
  const clave = `${zona}|${instante.getTime()}`;
  const existente = PARTES_CACHE.get(clave);
  if (existente) return { ...existente };
  const p = Object.fromEntries(
    formato(zona)
      .formatToParts(instante)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const resultado = {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    // Con hour12:false, la medianoche sale "24" en algunas versiones de ICU.
    hh: Number(p.hour) % 24,
    mm: Number(p.minute),
  };
  recordar(PARTES_CACHE, clave, resultado);
  return { ...resultado };
}

/** "YYYY-MM-DD" del día de pared: la clave de feriados y snapshots. */
export function claveFechaEnZona(instante: Date, zona: string): string {
  const p = partesEnZona(instante, zona);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

const DIAS_SEMANA = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"] as const;
export type DiaSemanaClave = (typeof DIAS_SEMANA)[number];

/**
 * El día de semana de una FECHA calendario ("2026-07-27" → "lun"). No lleva
 * zona: una vez que la fecha de pared está resuelta, qué día de la semana es
 * es aritmética pura.
 */
export function diaSemanaDeClave(clave: string): DiaSemanaClave {
  const [y, m, d] = clave.split("-").map(Number);
  return DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "2026-07-27" + 5 → "2026-08-01". Aritmética de calendario, sin zona. */
export function sumarDiasAClave(clave: string, dias: number): string {
  const [y, m, d] = clave.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + dias));
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, "0")}-${String(f.getUTCDate()).padStart(2, "0")}`;
}

/**
 * La inversa: el INSTANTE en que el reloj de pared de `zona` marca
 * `hora` del día `clave` ("2026-07-27" + "08:00" + America/Santiago → Date).
 *
 * Doble pasada para el DST: la primera adivina con el offset del instante
 * estimado, la segunda corrige si la adivinanza cruzó un cambio de hora.
 * En una hora que NO existe (el salto de primavera) devuelve el instante
 * corrido al offset nuevo — el taller "abre" cuando el reloj llega.
 */
export function instanteDe(clave: string, hora: string, zona: string): Date {
  const claveCache = `${zona}|${clave}|${hora}`;
  const existente = INSTANTES_CACHE.get(claveCache);
  if (existente !== undefined) return new Date(existente);
  const [y, m, d] = clave.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const objetivo = Date.UTC(y, m - 1, d, hh, mm);

  let t = objetivo;
  for (let i = 0; i < 2; i += 1) {
    const p = partesEnZona(new Date(t), zona);
    const pared = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
    if (pared === objetivo) break;
    t -= pared - objetivo;
  }
  if (Number.isFinite(t)) recordar(INSTANTES_CACHE, claveCache, t);
  return new Date(t);
}

/** Valida una fecha de calendario sin convertirla a un instante local. */
export function esFechaCalendario(clave: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clave)) return false;
  const fecha = new Date(`${clave}T00:00:00.000Z`);
  return (
    Number.isFinite(fecha.getTime()) &&
    fecha.toISOString().slice(0, 10) === clave
  );
}

/** Diferencia de días de calendario; no cambia con el DST ni la zona del proceso. */
export function diasEntreClaves(desde: string, hasta: string): number | null {
  if (!esFechaCalendario(desde) || !esFechaCalendario(hasta)) return null;
  return (
    (Date.parse(`${hasta}T00:00:00.000Z`) -
      Date.parse(`${desde}T00:00:00.000Z`)) /
    86400000
  );
}
