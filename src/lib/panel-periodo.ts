/**
 * El período de los Reportes: la traducción entre el `?periodo=` de la URL y
 * el rango de fechas que viaja al API.
 *
 * Vive fuera de los componentes porque lo usan los dos lados: las páginas
 * (server) para pedir los datos y el shell (cliente) para armar los links del
 * selector. Sin "use client" a propósito.
 *
 * El rango son CLAVES calendario ("YYYY-MM-DD") y "hoy" se resuelve en la
 * ZONA del tenant (`zona`), no en la del proceso: el API interpreta esas
 * claves en esa misma zona (`apps/api/src/reportes/periodo.ts`), así que
 * "mes pasado" significa lo mismo de los dos lados aunque el server corra
 * en UTC. Las páginas server la sacan de `tenantActual.regional`; los
 * componentes de cliente, de `useConfigRegional()`. Sin zona → Argentina,
 * que es lo que el sistema asumía siempre.
 */

import type { RangoPanel } from "@/lib/panel-api";
import { claveFechaEnZona, ZONA_DEFAULT } from "@/lib/zona";

export type PeriodoKey = "mes" | "mesPasado" | "trimestre" | "anio";

export const PERIODOS: Array<{ key: PeriodoKey; label: string }> = [
  { key: "mes", label: "Este mes" },
  { key: "mesPasado", label: "Mes pasado" },
  { key: "trimestre", label: "Trimestre" },
  { key: "anio", label: "Año" },
];

export const PERIODO_POR_DEFECTO: PeriodoKey = "mes";

/** Lo que venga en la URL, saneado. Basura o vacío → el mes en curso. */
export function leerPeriodo(valor: string | string[] | undefined): PeriodoKey {
  const clave = Array.isArray(valor) ? valor[0] : valor;
  return PERIODOS.some((p) => p.key === clave)
    ? (clave as PeriodoKey)
    : PERIODO_POR_DEFECTO;
}

/** Clave "YYYY-MM-DD" por aritmética UTC pura (mes 0-11; día 0 = fin del anterior). */
function clave(y: number, m0: number, d: number): string {
  const f = new Date(Date.UTC(y, m0, d));
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, "0")}-${String(f.getUTCDate()).padStart(2, "0")}`;
}

/**
 * El rango que le corresponde al período, contado desde el HOY de la zona
 * del tenant. "Este mes" va VACÍO: el API ya define el mes en curso (en esa
 * misma zona) como su default, y mandárselo calculado sería repetir la misma
 * cuenta en dos lugares para que un día dejen de coincidir.
 */
export function rangoDe(
  p: PeriodoKey,
  zona: string = ZONA_DEFAULT,
): RangoPanel {
  if (p === "mes") return {};
  const [y, m] = claveFechaEnZona(new Date(), zona).split("-").map(Number);
  const m0 = m - 1; // a mes 0-11, como Date
  if (p === "mesPasado") {
    return { desde: clave(y, m0 - 1, 1), hasta: clave(y, m0, 0) };
  }
  if (p === "trimestre") {
    const q = Math.floor(m0 / 3) * 3;
    return { desde: clave(y, q, 1), hasta: clave(y, q + 3, 0) };
  }
  return { desde: clave(y, 0, 1), hasta: clave(y, 11, 31) };
}
