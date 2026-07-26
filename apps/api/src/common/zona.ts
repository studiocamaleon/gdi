/**
 * ESPEJO de `src/lib/zona.ts` (el front). Aritmética de zona horaria sin
 * librerías: las primitivas que separan "el instante" (Date, UTC adentro) de
 * "la hora de pared del taller" (calendario laboral, corte de jornada,
 * feriados). No hay paquete compartido; si se toca uno se tocan los dos.
 *
 * Ver docs/multi-moneda-zona-horaria-diseno.md (D9).
 */

export const ZONA_DEFAULT = 'America/Argentina/Buenos_Aires';

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

function formato(zona: string): Intl.DateTimeFormat {
  let f = FORMATOS.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    FORMATOS.set(zona, f);
  }
  return f;
}

/** Qué hora de pared es `instante` en `zona`. */
export function partesEnZona(instante: Date, zona: string): PartesZona {
  const p = Object.fromEntries(
    formato(zona)
      .formatToParts(instante)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    // Con hour12:false, la medianoche sale "24" en algunas versiones de ICU.
    hh: Number(p.hour) % 24,
    mm: Number(p.minute),
  };
}

/** "YYYY-MM-DD" del día de pared: la clave de feriados y snapshots. */
export function claveFechaEnZona(instante: Date, zona: string): string {
  const p = partesEnZona(instante, zona);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'] as const;
export type DiaSemanaClave = (typeof DIAS_SEMANA)[number];

/**
 * El día de semana de una FECHA calendario ("2026-07-27" → "lun"). No lleva
 * zona: una vez que la fecha de pared está resuelta, qué día de la semana es
 * es aritmética pura.
 */
export function diaSemanaDeClave(clave: string): DiaSemanaClave {
  const [y, m, d] = clave.split('-').map(Number);
  return DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "2026-07-27" + 5 → "2026-08-01". Aritmética de calendario, sin zona. */
export function sumarDiasAClave(clave: string, dias: number): string {
  const [y, m, d] = clave.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + dias));
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}-${String(f.getUTCDate()).padStart(2, '0')}`;
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
  const [y, m, d] = clave.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  const objetivo = Date.UTC(y, m - 1, d, hh, mm);

  let t = objetivo;
  for (let i = 0; i < 2; i += 1) {
    const p = partesEnZona(new Date(t), zona);
    const pared = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
    if (pared === objetivo) break;
    t -= pared - objetivo;
  }
  return new Date(t);
}
