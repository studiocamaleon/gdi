import type { MaterialUsoPanel, PuntoMixPanel } from "./panel-api";

/** Las claves son internas: un nombre de producto nunca se usa como propiedad. */
export function prepararMixProducto(puntos: PuntoMixPanel[], limite = 6) {
  const totales = new Map<string, number>();
  for (const p of puntos)
    totales.set(p.nombre, (totales.get(p.nombre) ?? 0) + p.monto);
  const ranking = [...totales.keys()].sort(
    (a, b) => totales.get(b)! - totales.get(a)! || a.localeCompare(b, "es"),
  );
  const principales = ranking.slice(0, limite);
  const resto = ranking.slice(limite);
  const series = principales.map((nombre, i) => ({
    key: `serie${i}`,
    nombre,
    total: totales.get(nombre)!,
  }));
  if (resto.length)
    series.push({
      key: "resto",
      nombre: "Resto (agrupado)",
      total: resto.reduce((s, n) => s + totales.get(n)!, 0),
    });
  const claves = new Map(principales.map((n, i) => [n, `serie${i}`]));
  const fechas = [...new Set(puntos.map((p) => p.fecha))].sort();
  const porFecha = new Map(
    fechas.map((fecha) => [
      fecha,
      { fecha, ...Object.fromEntries(series.map((s) => [s.key, 0])) } as {
        fecha: string;
        [key: string]: string | number;
      },
    ]),
  );
  for (const p of puntos) {
    const row = porFecha.get(p.fecha)!;
    const key = claves.get(p.nombre) ?? "resto";
    row[key] = Number(row[key]) + p.monto;
  }
  return { data: [...porFecha.values()], series, agrupadas: resto.length };
}

const UNIDADES: Record<string, [string, string]> = {
  unidad: ["unidad", "unidades"],
  hoja: ["hoja", "hojas"],
  pliego: ["pliego", "pliegos"],
  m2: ["m²", "m²"],
  metro_lineal: ["m lineal", "m lineales"],
  ml: ["ml", "ml"],
  gramo: ["g", "g"],
};
/** Conserva los centésimos del consumo teórico entregado por la API. */
export function cantidadMaterialProducto(
  m: Pick<MaterialUsoPanel, "cantidad" | "unidad" | "formato">,
) {
  const kg = m.unidad === "gramo" && m.cantidad >= 1000;
  const cantidad = (kg ? m.cantidad / 1000 : m.cantidad).toLocaleString(
    "es-AR",
    { maximumFractionDigits: kg ? 5 : 2 },
  );
  const unidad = kg
    ? "kg"
    : (UNIDADES[m.unidad]?.[m.cantidad === 1 ? 0 : 1] ?? m.unidad);
  return `${cantidad} ${unidad}${m.formato ? ` · ${m.formato}` : ""}`;
}
