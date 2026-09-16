/** Biblioteca visual del catálogo comercial. Los códigos son los de la
 * clasificación, no IDs de productos ni coincidencias con nombres editables. */
export type IlustracionCatalogo =
  | "piezas" | "superficie" | "rollo" | "compuesto"
  | "tarjetas" | "folleto" | "papeleria" | "stickers" | "invitacion"
  | "talonario" | "revista" | "anillado" | "vinilo_corte" | "lona"
  | "mesh" | "rollup" | "senal" | "letra" | "cuadro" | "troquel"
  | "caja" | "exhibidor" | "etiqueta" | "remera" | "transfer"
  | "objeto" | "regalo" | "laser" | "acabado" | "laminado"
  | "estructura" | "luminoso" | "instalacion" | "diseno" | "muestras"
  | "medicion" | "envio" | "sello" | "sello_manual";

export const ILUSTRACIONES_SUBCATEGORIA: Readonly<Record<string, IlustracionCatalogo>> = {
  tarjetas: "tarjetas",
  volantes_folletos: "folleto",
  papeleria_comercial: "papeleria",
  stickers_hoja: "stickers",
  postales_invitaciones: "invitacion",
  talonarios: "talonario",
  blocks_formularios: "talonario",
  revistas_cuadernillos: "revista",
  anillados_wire_o: "anillado",
  engrapados: "revista",
  vinilos_impresos: "rollo",
  vinilos_corte: "vinilo_corte",
  lonas_banners: "lona",
  mesh_microperforado: "mesh",
  rollups_displays: "rollup",
  rigidos_impresos: "superficie",
  senaletica_placas: "senal",
  letras_corporeas: "letra",
  cuadros_decorativos: "cuadro",
  carteles_con_forma: "troquel",
  cajas_packaging: "caja",
  troquelados_digitales: "troquel",
  exhibidores_pop: "exhibidor",
  etiquetas_packaging: "etiqueta",
  remeras_indumentaria: "remera",
  dtf_transfer: "transfer",
  objetos_personalizados: "objeto",
  merchandising: "regalo",
  grabado_laser: "laser",
  corte_laser: "laser",
  corte_cnc: "laser",
  hotstamping_dorado_gofrado: "acabado",
  laminados_plastificados: "laminado",
  barnices: "acabado",
  plegados: "folleto",
  perforados_puntillados: "troquel",
  numerado_redondeado_modificaciones: "talonario",
  estructuras_metalicas: "estructura",
  luminosos_led: "luminoso",
  montaje_carteleria: "instalacion",
  instalacion_en_sitio: "instalacion",
  diseno_grafico: "diseno",
  proof_muestras: "muestras",
  toma_medidas: "medicion",
  envio_despacho: "envio",
  sellos_automaticos: "sello",
  sellos_manuales: "sello_manual",
};

const ILUSTRACIONES_CATEGORIA: Readonly<Record<string, IlustracionCatalogo>> = {
  impresion_hoja: "papeleria",
  editorial_encuadernacion: "revista",
  gran_formato_flexible: "rollo",
  senalectica_rigidos: "senal",
  packaging_pop: "caja",
  textil_personalizacion: "remera",
  grabado_corte_decorativo: "laser",
  terminaciones_postproduccion: "acabado",
  carteleria_montaje: "luminoso",
  servicios_logistica: "diseno",
  sellos: "sello",
};

export type ClasificacionIlustracion = {
  subcategoriaCodigo?: string | null;
  categoriaCodigo?: string | null;
  compuesto?: boolean;
  cobro: string;
};

export function resolverIlustracionCatalogo({
  subcategoriaCodigo,
  categoriaCodigo,
  compuesto = false,
  cobro,
}: ClasificacionIlustracion): IlustracionCatalogo {
  // Custom es intencionalmente neutro: puede ser cualquier tipo de producto.
  if (subcategoriaCodigo !== "producto_a_medida") {
    const especifica = subcategoriaCodigo && Object.hasOwn(ILUSTRACIONES_SUBCATEGORIA, subcategoriaCodigo)
      ? ILUSTRACIONES_SUBCATEGORIA[subcategoriaCodigo]
      : undefined;
    if (especifica) return especifica;
    const general = categoriaCodigo && Object.hasOwn(ILUSTRACIONES_CATEGORIA, categoriaCodigo)
      ? ILUSTRACIONES_CATEGORIA[categoriaCodigo]
      : undefined;
    if (general) return general;
  }
  // Familias nuevas y datos sin clasificación siguen teniendo una ilustración.
  if (compuesto) return "compuesto";
  if (cobro === "Por metro lineal") return "rollo";
  if (cobro === "Por m²") return "superficie";
  return "piezas";
}
