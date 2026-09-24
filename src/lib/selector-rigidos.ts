import { getMateriaPrimaTemplate } from "./materia-prima-templates";
import {
  type CandidatoMaterialVisual,
  medidaMaterial as medida,
  textoMaterial as texto,
  normalizarBusquedaMaterial,
} from "./selectores-materiales";

export type CandidatoRigido = CandidatoMaterialVisual;

export type OpcionRigido = {
  id: string;
  espesorMm: number | null;
  titulo: string;
  formato: string;
  referencia: string;
  predeterminada: boolean;
  sinPrecio: boolean;
  busqueda: string;
};

export type GrupoRigido = {
  id: string;
  material: string;
  color: string;
  formatoComun: string | null;
  opciones: OpcionRigido[];
};

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 });

/** null delega en el selector existente para plantillas fuera de esta etapa. */
export function crearGruposRigidos(candidatos: readonly CandidatoRigido[]): GrupoRigido[] | null {
  if (!candidatos.length || candidatos.some((c) =>
    getMateriaPrimaTemplate(c.templateId)?.id !== "sustrato_rigido_v1"
  )) return null;

  const grupos = new Map<string, GrupoRigido>();
  for (const candidato of candidatos) {
    for (const variante of candidato.variantes) {
      const attrs = variante.atributosVarianteJson ?? {};
      const color = texto(attrs.colorBase) || texto(attrs.color) || texto(attrs.colorMaterial) || "Color sin informar";
      const id = JSON.stringify([candidato.materiaPrimaId, normalizarBusquedaMaterial(color)]);
      let grupo = grupos.get(id);
      if (!grupo) {
        grupo = { id, material: candidato.label, color, formatoComun: null, opciones: [] };
        grupos.set(id, grupo);
      }
      const espesorMm = medida(attrs, [["espesor", 1], ["espesorMm", 1], ["espesor_mm", 1], ["espesorMicrones", 0.001]]);
      const anchoCm = medida(attrs, [["ancho", 100], ["anchoMm", 0.1], ["ancho_mm", 0.1]]);
      const altoCm = medida(attrs, [["alto", 100], ["altoMm", 0.1], ["alto_mm", 0.1]]);
      const formato = anchoCm !== null && altoCm !== null
        ? `${numero.format(anchoCm)} × ${numero.format(altoCm)} cm`
        : "Formato sin informar";
      const titulo = espesorMm === null ? "Espesor sin informar" : `${numero.format(espesorMm)} mm`;
      grupo.opciones.push({
        id: variante.variantId,
        espesorMm,
        titulo,
        formato,
        referencia: [texto(variante.nombreVariante), variante.sku].filter(Boolean).join(" · ") || variante.variantId,
        predeterminada: variante.variantId === candidato.defaultVarianteId,
        sinPrecio: variante.missingPrice,
        busqueda: normalizarBusquedaMaterial([candidato.label, color, titulo, formato, variante.nombreVariante, variante.sku].join(" ")),
      });
    }
  }
  for (const grupo of grupos.values()) {
    grupo.opciones.sort((a, b) => (a.espesorMm ?? Infinity) - (b.espesorMm ?? Infinity) || a.formato.localeCompare(b.formato, "es", { numeric: true }));
    const formatos = new Set(grupo.opciones.map((opcion) => opcion.formato));
    grupo.formatoComun = formatos.size === 1 ? grupo.opciones[0].formato : null;
    // Conservar la referencia sólo cuando espesor y formato no alcanzan.
    const referencias = new Map(grupo.opciones.map((opcion) => [opcion.id, opcion.referencia]));
    for (const opcion of grupo.opciones) {
      const duplicados = grupo.opciones.filter((otra) => otra.titulo === opcion.titulo && otra.formato === opcion.formato);
      if (duplicados.length === 1) opcion.referencia = "";
      else if (duplicados.some((otra) => otra.id !== opcion.id && referencias.get(otra.id) === referencias.get(opcion.id))) {
        opcion.referencia = `${opcion.referencia} · ${opcion.id}`;
      }
    }
  }
  return [...grupos.values()];
}
