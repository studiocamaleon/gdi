/**
 * El período de los Reportes: la traducción entre el `?periodo=` de la URL y
 * el rango de fechas que viaja al API.
 *
 * Vive fuera de los componentes porque lo usan los dos lados: las páginas
 * (server) para pedir los datos y el shell (cliente) para armar los links del
 * selector. Sin "use client" a propósito.
 *
 * El rango se calcula con `new Date()` del proceso que lo llama —hoy siempre el
 * server de Next—, igual que `apps/api/src/reportes/periodo.ts` hace con el
 * suyo: los dos corren en la misma máquina y con la misma hora local, así que
 * "este mes" significa lo mismo de los dos lados.
 */

import type { RangoPanel } from "@/lib/panel-api";

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

function iso(f: Date) {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

/**
 * El rango que le corresponde al período. "Este mes" va VACÍO: el API ya
 * define el mes en curso como su default, y mandárselo calculado sería repetir
 * la misma cuenta en dos lugares para que un día dejen de coincidir.
 */
export function rangoDe(p: PeriodoKey): RangoPanel {
  const hoy = new Date(),
    y = hoy.getFullYear(),
    m = hoy.getMonth();
  if (p === "mes") return {};
  if (p === "mesPasado") {
    return { desde: iso(new Date(y, m - 1, 1)), hasta: iso(new Date(y, m, 0)) };
  }
  if (p === "trimestre") {
    const q = Math.floor(m / 3) * 3;
    return { desde: iso(new Date(y, q, 1)), hasta: iso(new Date(y, q + 3, 0)) };
  }
  return { desde: iso(new Date(y, 0, 1)), hasta: iso(new Date(y, 11, 31)) };
}
