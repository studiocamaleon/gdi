import { getMateriaPrimaTemplate } from "./materia-prima-templates";
import {
  type CandidatoMaterialVisual,
  medidaMaterial,
  numeroPositivoMaterial,
  textoMaterial,
  normalizarBusquedaMaterial,
} from "./selectores-materiales";

export type AcabadoLaminadoVisual = "mate" | "brillante" | "soft-touch" | "satinado" | "otro";
type Detalle = { clave: string; valor: string };
export type OpcionLaminado = {
  id: string;
  titulo: string;
  visual: AcabadoLaminadoVisual;
  detalles: Detalle[];
  descripcion: string;
  referencia: string;
  predeterminada: boolean;
  sinPrecio: boolean;
  busqueda: string;
  aviso: string;
};
export type GrupoLaminado = {
  id: string;
  material: string;
  detalleComun: string;
  opciones: OpcionLaminado[];
};

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 });

/** Los aliases cambian sólo el esquema ilustrativo, nunca el texto ni el ID. */
export function acabadoLaminadoVisual(acabado: string): AcabadoLaminadoVisual {
  const key = normalizarBusquedaMaterial(acabado).replace(/[-_]/g, " ").replace(/\s+/g, " ");
  if (["brillo", "brillante", "gloss", "glossy"].includes(key)) return "brillante";
  if (["mate", "matte", "matt"].includes(key)) return "mate";
  if (["soft touch", "softtouch"].includes(key)) return "soft-touch";
  if (["satinado", "satin"].includes(key)) return "satinado";
  return "otro";
}

function detallesFilm(attrs: Record<string, unknown>): { detalles: Detalle[]; aviso: string } {
  const ancho = medidaMaterial(attrs, [["ancho", 1], ["anchoMm", 1], ["ancho_mm", 1]]);
  const largo = medidaMaterial(attrs, [["largo", 1], ["largoMm", 0.001], ["largoRolloMm", 0.001]]);
  const formato = ancho !== null && largo !== null
    ? `Rollo ${numero.format(ancho)} mm × ${numero.format(largo)} m`
    : [ancho !== null ? `Ancho ${numero.format(ancho)} mm` : "Ancho sin informar", largo !== null ? `Largo ${numero.format(largo)} m` : "Largo sin informar"].join(" · ");
  const detalles: Detalle[] = [{ clave: "formato", valor: formato }];
  const avisos: string[] = [];
  // Los presets guardan micrones; algunos registros antiguos usan espesor
  // con un contrato de unidad inconsistente. No reinterpretar esos valores.
  const micrajes = [
    ["micrones", 1], ["espesorMicrones", 1], ["espesorMm", 1000], ["espesor_mm", 1000],
  ] as const;
  const valoresMicraje = micrajes.flatMap(([key, factor]) => {
    const value = numeroPositivoMaterial(attrs[key]);
    return value === null ? [] : [value * factor];
  });
  const valoresUnicos = [...new Set(valoresMicraje.map((v) => numero.format(v)))];
  if (valoresUnicos.length === 1) detalles.push({ clave: "micraje", valor: `${valoresUnicos[0]} µm` });
  if (valoresUnicos.length > 1) {
    detalles.push({ clave: "micraje", valor: `Micraje: ${valoresUnicos.join(" / ")} µm` });
    avisos.push("El material tiene valores de micraje distintos. Revisá su ficha.");
  }
  if (attrs.espesor !== undefined && attrs.espesor !== null && attrs.espesor !== "") {
    const valor = numeroPositivoMaterial(attrs.espesor);
    detalles.push({ clave: "espesorRegistrado", valor: valor === null ? "Espesor sin confirmar" : `Espesor registrado: ${numero.format(valor)} (unidad por confirmar)` });
    avisos.push("La unidad del espesor registrado necesita confirmación en la ficha del material.");
  }
  const adhesivo = textoMaterial(attrs.adhesivoTipo);
  if (adhesivo) detalles.push({ clave: "adhesivo", valor: `Adhesivo: ${adhesivo}` });
  const color = textoMaterial(attrs.colorBase) || textoMaterial(attrs.color);
  if (color) detalles.push({ clave: "color", valor: `Color: ${color}` });
  return { detalles, aviso: avisos.join(" ") };
}

/** Sólo film en rollo. Pouch se mantiene en su selector de formato/espesor. */
export function crearGruposLaminados(candidatos: readonly CandidatoMaterialVisual[]): GrupoLaminado[] | null {
  if (!candidatos.length || candidatos.some((c) => getMateriaPrimaTemplate(c.templateId)?.id !== "laminado_film_v1")) return null;
  return candidatos.map((candidato) => {
    const opciones: OpcionLaminado[] = candidato.variantes.map((variante) => {
      const attrs = variante.atributosVarianteJson ?? {};
      const acabado = textoMaterial(attrs.acabado);
      const titulo = acabado || "Acabado sin informar";
      const { detalles, aviso } = detallesFilm(attrs);
      return {
        id: variante.variantId,
        titulo,
        visual: acabadoLaminadoVisual(acabado),
        detalles,
        descripcion: "",
        referencia: [textoMaterial(variante.nombreVariante), variante.sku].filter(Boolean).join(" · ") || variante.variantId,
        predeterminada: variante.variantId === candidato.defaultVarianteId,
        sinPrecio: variante.missingPrice,
        busqueda: normalizarBusquedaMaterial([candidato.label, titulo, ...detalles.map((d) => d.valor), variante.nombreVariante, variante.sku].join(" ")),
        aviso,
      };
    });
    opciones.sort((a, b) => a.titulo.localeCompare(b.titulo, "es", { numeric: true }) || a.detalles.map((d) => d.valor).join(" ").localeCompare(b.detalles.map((d) => d.valor).join(" "), "es", { numeric: true }));
    const comunes = (opciones[0]?.detalles ?? []).filter((detalle) => opciones.every((o) => o.detalles.some((d) => d.clave === detalle.clave && d.valor === detalle.valor)));
    const firmas = opciones.map((o) => JSON.stringify([normalizarBusquedaMaterial(o.titulo), o.detalles]));
    const referencias = opciones.map((o) => o.referencia);
    for (let i = 0; i < opciones.length; i++) {
      const opcion = opciones[i];
      const duplicadas = firmas.filter((f) => f === firmas[i]).length > 1;
      if (!duplicadas && opcion.titulo !== "Acabado sin informar") opcion.referencia = "";
      if (duplicadas && referencias.filter((r) => r === referencias[i]).length > 1) opcion.referencia += ` · ${opcion.id}`;
      opcion.descripcion = [
        ...opcion.detalles.filter((d) => !comunes.some((c) => c.clave === d.clave)).map((d) => d.valor),
        opcion.referencia,
      ].filter(Boolean).join(" · ");
    }
    return { id: candidato.materiaPrimaId, material: candidato.label, detalleComun: comunes.map((d) => d.valor).join(" · "), opciones };
  });
}
