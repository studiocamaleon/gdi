import { getMateriaPrimaTemplate } from "./materia-prima-templates";
import { type CandidatoMaterialVisual, medidaMaterial, textoMaterial, normalizarBusquedaMaterial } from "./selectores-materiales";
import { crearGruposColores, type GrupoColor } from "./selector-colores";

type Detalle = { clave: string; valor: string };
export type OpcionPapel = {
  id: string;
  gramaje: number | null;
  color: string;
  titulo: string;
  detalles: Detalle[];
  descripcion: string;
  referencia: string;
  predeterminada: boolean;
  sinPrecio: boolean;
  busqueda: string;
};
export type GrupoPapel = {
  id: string;
  material: string;
  detalleComun: string;
  opciones: OpcionPapel[];
  colores: GrupoColor[];
};

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 });

export function esSelectorPapel(candidatos: readonly CandidatoMaterialVisual[]): boolean {
  return candidatos.length > 0 && candidatos.every((c) => getMateriaPrimaTemplate(c.templateId)?.id === "sustrato_hoja_v1");
}

/** Papel comercial → variantes reales. Nunca combina un gramaje con otro pliego. */
export function crearGruposPapeles(candidatos: readonly CandidatoMaterialVisual[]): GrupoPapel[] | null {
  if (!esSelectorPapel(candidatos)) return null;
  return candidatos.map((candidato) => {
    const opciones: OpcionPapel[] = candidato.variantes.map((v) => {
      const attrs = v.atributosVarianteJson ?? {};
      const gramaje = medidaMaterial(attrs, [["gramaje", 1]]);
      // La plantilla sustrato_hoja declara centímetros, a diferencia de rígidos.
      const ancho = medidaMaterial(attrs, [["ancho", 1], ["anchoMm", 0.1]]);
      const alto = medidaMaterial(attrs, [["alto", 1], ["altoMm", 0.1]]);
      const dimensiones = ancho !== null && alto !== null
        ? `${numero.format(ancho)} × ${numero.format(alto)} cm`
        : [ancho !== null ? `Ancho ${numero.format(ancho)} cm` : "Ancho sin informar", alto !== null ? `Alto ${numero.format(alto)} cm` : "Alto sin informar"].join(" · ");
      const detalles: Detalle[] = [{ clave: "formato", valor: [textoMaterial(attrs.formatoComercial), dimensiones].filter(Boolean).join(" · ") }];
      for (const [clave, etiqueta] of [["material", "Material"], ["acabado", "Acabado"], ["color", "Color"]]) {
        const valor = textoMaterial(attrs[clave]);
        if (valor) detalles.push({ clave, valor: `${etiqueta}: ${valor}` });
      }
      const titulo = gramaje === null ? "Gramaje sin informar" : `${numero.format(gramaje)} g/m²`;
      return {
        id: v.variantId, gramaje, color: textoMaterial(attrs.color), titulo, detalles, descripcion: "",
        referencia: [textoMaterial(v.nombreVariante), v.sku].filter(Boolean).join(" · ") || v.variantId,
        predeterminada: v.variantId === candidato.defaultVarianteId,
        sinPrecio: v.missingPrice,
        busqueda: normalizarBusquedaMaterial([candidato.label, titulo, ...detalles.map((d) => d.valor), v.nombreVariante, v.sku].join(" ")),
      };
    });
    opciones.sort((a, b) => (a.gramaje ?? Infinity) - (b.gramaje ?? Infinity) || a.detalles.map((d) => d.valor).join(" ").localeCompare(b.detalles.map((d) => d.valor).join(" "), "es", { numeric: true }));
    const comunes = (opciones[0]?.detalles ?? []).filter((d) => opciones.every((o) => o.detalles.some((t) => t.clave === d.clave && t.valor === d.valor)));
    const firmas = opciones.map((o) => JSON.stringify([o.titulo, o.detalles]));
    const referencias = opciones.map((o) => o.referencia);
    for (let i = 0; i < opciones.length; i++) {
      const o = opciones[i];
      const duplicada = firmas.filter((f) => f === firmas[i]).length > 1;
      if (!duplicada && o.gramaje !== null) o.referencia = "";
      if (duplicada && referencias.filter((r) => r === referencias[i]).length > 1) o.referencia += ` · ${o.id}`;
      o.descripcion = [...o.detalles.filter((d) => !comunes.some((c) => c.clave === d.clave)).map((d) => d.valor), o.referencia].filter(Boolean).join(" · ");
    }
    return { id: candidato.materiaPrimaId, material: candidato.label, detalleComun: comunes.map((d) => d.valor).join(" · "), opciones, colores: crearGruposColores([candidato]) ?? [] };
  });
}

/** Al cambiar papel sólo resuelve una opción única o su default explícito. */
export function varianteInicialPapel(grupo: GrupoPapel): string {
  return grupo.opciones.find((o) => o.predeterminada)?.id ?? (grupo.opciones.length === 1 ? grupo.opciones[0].id : "");
}
