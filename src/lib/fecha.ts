/**
 * Fechas y horas para mostrar, iguales en el servidor y en el navegador.
 *
 * `toLocaleString("es-AR", …)` parece determinístico y no lo es: el separador
 * antes de "p. m." es un espacio normal en una versión de ICU y un espacio
 * angosto que no rompe línea (U+202F) en otra. Node y el navegador traen
 * versiones distintas, así que el mismo instante salía con dos strings que se
 * ven idénticos y no lo son — y React tiraba un error de hidratación señalando
 * dos líneas de texto aparentemente iguales.
 *
 * Además `toLocaleString` sin `timeZone` usa la del proceso: en el servidor de
 * producción (UTC) las horas saldrían tres horas corridas.
 *
 * Acá se piden las PARTES numéricas —que sí son estables entre versiones— en
 * la zona de Argentina, y el string se arma a mano.
 */

/** Toda la operación es argentina; el servidor puede estar en UTC. */
const ZONA = "America/Argentina/Buenos_Aires";

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

type Partes = {
  dia: string;
  /** Índice 0-11, para el array de nombres. */
  mes: number;
  /** "07", para los formatos numéricos. */
  mesNum: string;
  anio: string;
  hora24: number;
  minuto: string;
};

const FORMATO = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  year: "numeric",
  month: "numeric",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function partes(iso: string): Partes | null {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return null;

  const p = Object.fromEntries(
    FORMATO.formatToParts(f).map((x) => [x.type, x.value]),
  ) as Record<string, string>;

  return {
    dia: p.day,
    mes: Number(p.month) - 1,
    mesNum: String(p.month).padStart(2, "0"),
    anio: p.year,
    // Con hour12:false, la medianoche sale "24" en algunas versiones de ICU.
    hora24: Number(p.hour) % 24,
    minuto: p.minute,
  };
}

/** "25-jul-2026". Vacío si la fecha no sirve. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = partes(iso);
  return p ? `${p.dia}-${MESES[p.mes]}-${p.anio}` : "";
}

/** "25-jul, 06:38 p. m." — el formato que ya se mostraba, ahora estable. */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = partes(iso);
  if (!p) return "";
  const sufijo = p.hora24 >= 12 ? "p. m." : "a. m.";
  const h12 = p.hora24 % 12 === 0 ? 12 : p.hora24 % 12;
  return `${p.dia}-${MESES[p.mes]}, ${String(h12).padStart(2, "0")}:${p.minuto} ${sufijo}`;
}

/** "18:38", en 24 h. Para tablas donde el a. m./p. m. sólo ocupa lugar. */
export function hora(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = partes(iso);
  return p ? `${String(p.hora24).padStart(2, "0")}:${p.minuto}` : "";
}

/** "25/07/2026". El formato numérico de las tablas. */
export function fechaNumerica(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = partes(iso);
  return p ? `${p.dia}/${p.mesNum}/${p.anio}` : "";
}

/** "25/07 18:38" — día y hora sin el año, para listados densos. */
export function fechaHoraCorta(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = partes(iso);
  return p ? `${p.dia}/${p.mesNum} ${String(p.hora24).padStart(2, "0")}:${p.minuto}` : "";
}

/**
 * ¿Es hoy, en hora de Argentina?
 *
 * Comparar con `getDate()` usa la zona del proceso: a las 22 de Argentina el
 * servidor en UTC ya está en el día siguiente y diría que no es hoy.
 */
export function esHoy(iso: string | null | undefined, ahora = new Date()): boolean {
  if (!iso) return false;
  const a = partes(iso);
  const b = partes(ahora.toISOString());
  if (!a || !b) return false;
  return a.dia === b.dia && a.mesNum === b.mesNum && a.anio === b.anio;
}

