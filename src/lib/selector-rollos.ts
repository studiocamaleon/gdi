import { getMateriaPrimaTemplate } from "./materia-prima-templates";
import { medidaMaterial, normalizarBusquedaMaterial, textoMaterial, type CandidatoMaterialVisual } from "./selectores-materiales";

export type GrupoRollo = {
  id: string;
  material: string;
  detalleComun: string;
  opciones: {
    id: string;
    anchoMm: number | null;
    titulo: string;
    descripcion: string;
    resumen: string;
    predeterminada: boolean;
    sinPrecio: boolean;
    busqueda: string;
  }[];
};

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 });
const factorMm: Record<string, number> = { m: 1000, cm: 10, mm: 1 };

/** Las unidades salen de la plantilla, nunca de la magnitud del valor. */
export function crearGruposRollos(candidatos: readonly CandidatoMaterialVisual[]): GrupoRollo[] | null {
  if (!candidatos.length || candidatos.some((c) => {
    const plantilla = getMateriaPrimaTemplate(c.templateId);
    return plantilla?.unidadCompra !== "rollo" || !factorMm[plantilla.camposTecnicos.find((f) => f.key === "ancho")?.unit ?? ""];
  })) return null;

  return candidatos.map((candidato) => {
    const plantilla = getMateriaPrimaTemplate(candidato.templateId)!;
    const factor = factorMm[plantilla.camposTecnicos.find((f) => f.key === "ancho")!.unit!];
    const datos = candidato.variantes.map((v) => {
      const attrs = v.atributosVarianteJson ?? {};
      const anchoMm = medidaMaterial(attrs, [["ancho", factor], ["anchoMm", 1], ["ancho_mm", 1], ["anchoRolloMm", 1]]);
      const titulo = anchoMm === null ? "Ancho sin informar" : `${numero.format(anchoMm / 1000)} m`;
      const detalles = plantilla.camposTecnicos.filter((f) => f.key !== "ancho").flatMap((f) => {
        const raw = attrs[f.key];
        if (raw == null || raw === "") return [];
        const valor = typeof raw === "number" ? numero.format(raw) : textoMaterial(raw);
        return valor ? [{ clave: f.key, valor: `${f.label}: ${valor}${f.unit ? ` ${f.unit}` : ""}` }] : [];
      });
      // Alias históricos con unidad explícita también conservan el largo.
      if (!detalles.some((d) => d.clave === "largo")) {
        const largoM = medidaMaterial(attrs, [["largoRolloMm", .001], ["largoMm", .001]]);
        if (largoM !== null) detalles.push({ clave: "largo", valor: `Largo de rollo: ${numero.format(largoM)} m` });
      }
      return { v, anchoMm, titulo, detalles, referencia: [textoMaterial(v.nombreVariante), v.sku].filter(Boolean).join(" · ") || v.variantId };
    });
    const comunes = (datos[0]?.detalles ?? []).filter((d) => datos.every((o) => o.detalles.some((otro) => otro.clave === d.clave && otro.valor === d.valor)));
    const opciones = datos.map(({ v, anchoMm, titulo, detalles, referencia }) => {
      const duplicados = datos.filter((o) => o.titulo === titulo && JSON.stringify(o.detalles) === JSON.stringify(detalles));
      const ref = duplicados.length > 1 || anchoMm === null
        ? `${referencia}${duplicados.filter((o) => o.referencia === referencia).length > 1 ? ` · ${v.variantId}` : ""}` : "";
      const descripcion = [...detalles.filter((d) => !comunes.some((c) => c.clave === d.clave)).map((d) => d.valor), ref].filter(Boolean).join(" · ");
      const resumen = [candidato.label, titulo, ...detalles.map((d) => d.valor), ref].filter(Boolean).join(" · ");
      return {
        id: v.variantId, anchoMm, titulo, descripcion, resumen,
        predeterminada: v.variantId === candidato.defaultVarianteId,
        sinPrecio: v.missingPrice,
        busqueda: normalizarBusquedaMaterial(`${resumen} ${referencia}`),
      };
    }).sort((a, b) => (a.anchoMm ?? Infinity) - (b.anchoMm ?? Infinity) || a.descripcion.localeCompare(b.descripcion, "es", { numeric: true }));
    return { id: candidato.materiaPrimaId, material: candidato.label, detalleComun: comunes.map((d) => d.valor).join(" · "), opciones };
  });
}
