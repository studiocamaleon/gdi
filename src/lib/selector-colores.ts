import { getMateriaPrimaTemplate } from "./materia-prima-templates";
import { crearGruposRigidos, type GrupoRigido } from "./selector-rigidos";
import { convertUnitValue, getUnitDefinition } from "./unidades";
import { type CandidatoMaterialVisual, medidaMaterial, normalizarBusquedaMaterial, textoMaterial } from "./selectores-materiales";

/** Registro semántico: un acabado de esmerilado sí es color; el de BOPP no. */
const EJES_COLOR: Record<string, { claves: readonly string[]; etiqueta: string }> = {
  sustrato_hoja_v1: { claves: ["color"], etiqueta: "Color del papel" },
  sustrato_rigido_v1: { claves: ["colorBase", "color", "colorMaterial"], etiqueta: "Color del material" },
  vinilo_de_corte_rollo_v1: { claves: ["color"], etiqueta: "Color del vinilo" },
  vinilo_esmerilado_rollo_v1: { claves: ["acabado"], etiqueta: "Color del vinilo" },
  textil_indumentaria_v1: { claves: ["color"], etiqueta: "Color de la prenda" },
  objeto_promocional_base_v1: { claves: ["color"], etiqueta: "Color del objeto" },
  anillado_encuadernacion_v1: { claves: ["color"], etiqueta: "Color del anillo" },
  componente_carpeta_v1: { claves: ["color"], etiqueta: "Color del componente" },
  pegatina_raspadita_v1: { claves: ["color"], etiqueta: "Color de la pegatina" },
  goma_laserable_v1: { claves: ["color"], etiqueta: "Color de la goma" },
  sello_automatico_v1: { claves: ["colorCarcasa"], etiqueta: "Color de la carcasa" },
  almohadilla_sello_v1: { claves: ["colorTinta"], etiqueta: "Color de tinta" },
  tinta_sello_v1: { claves: ["colorTinta"], etiqueta: "Color de tinta" },
  almohadilla_escritorio_v1: { claves: ["colorTinta"], etiqueta: "Color de tinta" },
  tinta_impresion_v1: { claves: ["color"], etiqueta: "Color de tinta" },
  toner_v1: { claves: ["color"], etiqueta: "Color del tóner" },
  neon_flex_led_v1: { claves: ["colorLuz"], etiqueta: "Color de luz" },
  modulo_led_carteleria_v1: { claves: ["temperaturaColor"], etiqueta: "Temperatura de luz" },
};

export type MuestraColor =
  | { tipo: "solido"; hex: string }
  | { tipo: "transparente" | "multicolor" | "desconocido" }
  | { tipo: "metalizado"; hex: string };

// Muestras orientativas, no equivalencias Pantone/RAL ni colores de impresión.
const COLORES: Record<string, string> = {
  blanco: "#ffffff", negro: "#181a1b", gris: "#92979b", rojo: "#cf3537",
  verde: "#378251", azul: "#326dc1", amarillo: "#f3d34b", naranja: "#ed8b39",
  violeta: "#8058a5", rosa: "#e596b4", celeste: "#85c9e6", marron: "#815b44",
  beige: "#dcc9a0", crema: "#f3ebd5", cian: "#20b5d2", magenta: "#ce3d89",
};

export function muestraColorMaterial(valor: string): MuestraColor {
  const key = normalizarBusquedaMaterial(valor);
  if (/^#[0-9a-f]{6}$/.test(key) || /^#[0-9a-f]{3}$/.test(key)) return { tipo: "solido", hex: key };
  if (COLORES[key]) return { tipo: "solido", hex: COLORES[key] };
  if (["transparente", "cristal", "incoloro"].includes(key)) return { tipo: "transparente" };
  if (["color", "colores", "multicolor", "rgb", "bicolor", "mci"].includes(key)) return { tipo: "multicolor" };
  if (["dorado", "oro", "plateado", "plata"].includes(key)) return { tipo: "metalizado", hex: ["dorado", "oro"].includes(key) ? "#b4934d" : "#a5abb1" };
  return { tipo: "desconocido" };
}

export type OpcionColor = {
  id: string;
  ordenTalle?: number;
  titulo: string;
  descripcion: string;
  detalles: { clave: string; valor: string }[];
  referencia: string;
  predeterminada: boolean;
  sinPrecio: boolean;
  busqueda: string;
};
export type GrupoColor = {
  id: string;
  materialId: string;
  material: string;
  color: string;
  etiqueta: string;
  detalleComun: string;
  opciones: OpcionColor[];
  /** El color filtra las variantes; conserva la presentación propia del espesor. */
  rigido?: GrupoRigido;
};

export function esSelectorColor(candidatos: readonly CandidatoMaterialVisual[]): boolean {
  return candidatos.length > 0 && candidatos.every((c) => EJES_COLOR[getMateriaPrimaTemplate(c.templateId)?.id ?? ""]);
}

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 });

/** Toda opción final sigue siendo un variantId; color sólo reduce las opciones. */
export function crearGruposColores(candidatos: readonly CandidatoMaterialVisual[]): GrupoColor[] | null {
  if (!esSelectorColor(candidatos)) return null;
  const grupos: GrupoColor[] = [];
  for (const candidato of candidatos) {
    const template = getMateriaPrimaTemplate(candidato.templateId)!;
    const eje = EJES_COLOR[template.id];
    const rigidos = crearGruposRigidos([candidato]);
    const gruposMaterial = new Map<string, GrupoColor>();
    for (const variante of candidato.variantes) {
      const originales = variante.atributosVarianteJson ?? {};
      const attrs = template.id === "sustrato_rigido_v1" ? {
        ...originales,
        espesor: medidaMaterial(originales, [["espesor", 1], ["espesorMm", 1], ["espesor_mm", 1], ["espesorMicrones", 0.001]]),
        ancho: medidaMaterial(originales, [["ancho", 1], ["anchoMm", 0.001], ["ancho_mm", 0.001]]),
        alto: medidaMaterial(originales, [["alto", 1], ["altoMm", 0.001], ["alto_mm", 0.001]]),
      } : originales;
      const color = eje.claves.map((key) => textoMaterial(attrs[key])).find(Boolean) || "Color sin informar";
      const id = JSON.stringify([candidato.materiaPrimaId, normalizarBusquedaMaterial(color)]);
      let grupo = gruposMaterial.get(id);
      if (!grupo) {
        grupo = { id, materialId: candidato.materiaPrimaId, material: candidato.label, color, etiqueta: eje.etiqueta, detalleComun: "", opciones: [], rigido: rigidos?.find((g) => g.id === id) };
        gruposMaterial.set(id, grupo);
      }
      // Campos declarados, con unidad de su plantilla. No se infiere por nombre
      // comercial ni se trasladan las unidades de otro tipo de material.
      const detalles = template.camposTecnicos.filter((c) => !eje.claves.includes(c.key)).flatMap((campo) => {
        const raw = attrs[campo.key];
        if (raw === null || raw === undefined || raw === "") return campo.required ? [{ clave: campo.key, valor: `${campo.label}: sin informar` }] : [];
        if (campo.type === "number") {
          const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+(?:[.,]\d+)?$/.test(raw.trim()) ? Number(raw.replace(",", ".")) : NaN;
          if (!Number.isFinite(n)) return [{ clave: campo.key, valor: `${campo.label}: sin confirmar` }];
          const unidad = campo.preferredDisplayUnit ?? campo.unit;
          const convertido = campo.unit && unidad ? convertUnitValue(n, campo.unit, unidad) : n;
          return [{ clave: campo.key, valor: `${campo.label}: ${numero.format(convertido)}${unidad ? ` ${getUnitDefinition(unidad)!.symbol.replace("m2", "m²")}` : ""}` }];
        }
        if (campo.type === "boolean") return [{ clave: campo.key, valor: `${campo.label}: ${raw === true ? "Sí" : raw === false ? "No" : "sin confirmar"}` }];
        const value = textoMaterial(raw);
        return value ? [{ clave: campo.key, valor: `${campo.label}: ${value}` }] : [];
      });
      grupo.opciones.push({
        id: variante.variantId, titulo: "", descripcion: "", detalles,
        ordenTalle: template.id === "textil_indumentaria_v1"
          ? ["UNICO", "XS", "S", "M", "L", "XL", "XXL", "XXXL"].indexOf(normalizarBusquedaMaterial(textoMaterial(attrs.talle)).toUpperCase())
          : undefined,
        referencia: [textoMaterial(variante.nombreVariante), variante.sku].filter(Boolean).join(" · ") || variante.variantId,
        predeterminada: candidato.defaultVarianteId === variante.variantId, sinPrecio: variante.missingPrice,
        busqueda: normalizarBusquedaMaterial([candidato.label, color, ...detalles.map((d) => d.valor), variante.nombreVariante, variante.sku].join(" ")),
      });
    }
    for (const grupo of gruposMaterial.values()) {
      const comunes = (grupo.opciones[0]?.detalles ?? []).filter((d) => grupo.opciones.every((o) => o.detalles.some((t) => t.clave === d.clave && t.valor === d.valor)));
      grupo.detalleComun = comunes.map((d) => d.valor).join(" · ");
      const firmas = grupo.opciones.map((o) => JSON.stringify(o.detalles));
      const referencias = grupo.opciones.map((o) => o.referencia);
      for (const [i, opcion] of grupo.opciones.entries()) {
        const diferentes = opcion.detalles.filter((d) => !comunes.some((c) => c.clave === d.clave));
        const principal = diferentes.find((d) => ["espesor", "gramaje", "talle", "diametro"].includes(d.clave)) ?? diferentes[0];
        const duplicada = firmas.filter((f) => f === firmas[i]).length > 1;
        if (!duplicada) opcion.referencia = "";
        if (duplicada && referencias.filter((r) => r === referencias[i]).length > 1) opcion.referencia += ` · ${opcion.id}`;
        opcion.titulo = principal?.valor ?? (opcion.referencia || grupo.color);
        opcion.descripcion = [...diferentes.filter((d) => d !== principal).map((d) => d.valor), principal ? opcion.referencia : ""].filter(Boolean).join(" · ");
      }
      grupo.opciones.sort((a, b) => {
        const orden = (o: OpcionColor) => o.ordenTalle !== undefined && o.ordenTalle >= 0 ? o.ordenTalle : Infinity;
        return orden(a) - orden(b) || a.titulo.localeCompare(b.titulo, "es", { numeric: true });
      });
      grupos.push(grupo);
    }
  }
  return grupos;
}

export function varianteInicialColor(grupo: GrupoColor): string {
  return grupo.opciones.find((o) => o.predeterminada)?.id ?? (grupo.opciones.length === 1 ? grupo.opciones[0].id : "");
}
