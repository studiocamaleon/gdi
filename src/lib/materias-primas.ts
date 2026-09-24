import type { MaterialEquivalence } from "./material-units";
export type FamiliaMateriaPrima =
  | "sustrato"
  | "tinta_colorante"
  | "transferencia_laminacion"
  | "quimico_auxiliar"
  | "aditiva_3d"
  | "electronica_carteleria"
  | "neon_luminaria"
  | "metal_estructura"
  | "pintura_recubrimiento"
  | "terminacion_editorial"
  | "magnetico_fijacion"
  | "pop_exhibidor"
  | "herraje_accesorio"
  | "adhesivo_tecnico"
  | "packing_instalacion"
  | "sellos";

export type SubfamiliaMateriaPrima =
  | "sustrato_hoja"
  | "sustrato_rollo_flexible"
  | "vinilo_corte"
  | "sustrato_rigido"
  | "objeto_promocional_base"
  | "tinta_impresion"
  | "toner"
  | "film_transferencia"
  | "papel_transferencia"
  | "laminado_film"
  | "laminado_pouch"
  | "quimico_acabado"
  | "auxiliar_proceso"
  | "polvo_dtf"
  | "filamento_3d"
  | "resina_3d"
  | "modulo_led_carteleria"
  | "fuente_alimentacion_led"
  | "cableado_conectica"
  | "controlador_led"
  | "neon_flex_led"
  | "accesorio_neon_led"
  | "chapa_metalica"
  | "perfil_estructural"
  | "pintura_carteleria"
  | "primer_sellador"
  | "anillado_encuadernacion"
  | "tapa_encuadernacion"
  | "componente_editorial"
  | "pegatina_raspadita"
  | "iman_ceramico_flexible"
  | "fijacion_auxiliar"
  | "accesorio_exhibidor_carton"
  | "accesorio_montaje_pop"
  | "semielaborado_pop"
  | "argolla_llavero_accesorio"
  | "ojal_ojalillo_remache"
  | "portabanner_estructura"
  | "sistema_colgado_montaje"
  | "perfil_bastidor_textil"
  | "textil_indumentaria"
  | "cinta_doble_faz_tecnica"
  | "adhesivo_liquido_estructural"
  | "velcro_cierre_tecnico"
  | "embalaje_proteccion"
  | "etiquetado_identificacion"
  | "consumible_instalacion"
  | "sellos_automaticos"
  | "sellos_manuales"
  | "goma_laserable"
  | "almohadilla_tinta";

export type UnidadMateriaPrima =
  | "unidad"
  | "pack"
  | "caja"
  | "pallet"
  | "botella"
  | "kit"
  | "hoja"
  | "placa"
  /** Alias legado aceptado desde datos antiguos; las altas nuevas usan "hoja". */
  | "pliego"
  | "resma"
  | "rollo"
  | "metro_lineal"
  | "m2"
  | "m3"
  | "mm"
  | "cm"
  | "litro"
  | "ml"
  | "kg"
  | "gramo"
  | "pieza"
  | "par";

// v3.0: re-export del type canónico para no duplicar (modelo doc §4).
export type { PlantillaMaquinaria } from "./maquinaria";

export type MateriaPrimaVariante = {
  id: string;
  sku: string;
  nombreVariante: string;
  materialPresetVarianteId?: string | null;
  activo: boolean;
  atributosVariante: Record<string, unknown>;
  unidadStock: UnidadMateriaPrima | null;
  unidadCompra: UnidadMateriaPrima | null;
  unidadUso?: UnidadMateriaPrima | null;
  precioReferencia: number | null;
  unidadPrecio?: UnidadMateriaPrima | null;
  equivalenciaCompra?: number | null;
  equivalencias?: MaterialEquivalence[];
  moneda: string;
  proveedorReferenciaId: string | null;
  proveedorReferenciaNombre: string;
};

export type MateriaPrima = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  materialPresetId?: string | null;
  canonicalMaterialKey?: string | null;
  canonicalMaterialName?: string | null;
  canonicalAliasUsado?: string | null;
  familia: FamiliaMateriaPrima;
  subfamilia: SubfamiliaMateriaPrima;
  tipoTecnico: string;
  templateId: string;
  unidadStock: UnidadMateriaPrima;
  unidadCompra: UnidadMateriaPrima;
  unidadUso?: UnidadMateriaPrima | null;
  esConsumible: boolean;
  esRepuesto: boolean;
  /** true = blank comprado para reventa/decoración (taza, remera), no insumo. */
  esProductoBase?: boolean;
  activo: boolean;
  atributosTecnicos: Record<string, unknown>;
  variantes: MateriaPrimaVariante[];
  createdAt: string;
  updatedAt: string;
};

export type MateriaPrimaPayload = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  familia: FamiliaMateriaPrima;
  subfamilia: SubfamiliaMateriaPrima;
  tipoTecnico: string;
  templateId: string;
  unidadStock: UnidadMateriaPrima;
  unidadCompra: UnidadMateriaPrima;
  unidadUso?: UnidadMateriaPrima | null;
  esConsumible: boolean;
  esRepuesto: boolean;
  esProductoBase?: boolean;
  activo: boolean;
  atributosTecnicos: Record<string, unknown>;
  variantes: Array<{
    sku: string;
    nombreVariante?: string;
    activo: boolean;
    atributosVariante: Record<string, unknown>;
    unidadStock?: UnidadMateriaPrima;
    unidadCompra?: UnidadMateriaPrima;
    unidadUso?: UnidadMateriaPrima;
    precioReferencia?: number;
    unidadPrecio?: UnidadMateriaPrima | null;
    equivalenciaCompra?: number | null;
    equivalencias?: MaterialEquivalence[];
    moneda?: string;
    proveedorReferenciaId?: string;
  }>;
};

export type UpdateVariantePrecioReferenciaPayload = {
  precioReferencia: number;
  moneda?: string;
};

export const familiaMateriaPrimaItems: Array<{
  value: FamiliaMateriaPrima;
  label: string;
}> = [
  { value: "sustrato", label: "Sustrato" },
  { value: "tinta_colorante", label: "Tinta y colorante" },
  { value: "transferencia_laminacion", label: "Transferencia y laminacion" },
  { value: "quimico_auxiliar", label: "Quimico y auxiliar" },
  { value: "aditiva_3d", label: "Aditiva 3D" },
  { value: "electronica_carteleria", label: "Electronica carteleria" },
  { value: "neon_luminaria", label: "Neon y luminaria" },
  // Material-agnóstico a propósito: los listones de madera de un bastidor
  // entelado viven acá (misma plantilla de perfil, mismo motor de barras);
  // separar MADERA_ESTRUCTURA exige migración de enum — pendiente declarado.
  { value: "metal_estructura", label: "Estructura (metal y madera)" },
  { value: "pintura_recubrimiento", label: "Pintura y recubrimiento" },
  { value: "terminacion_editorial", label: "Terminacion editorial" },
  { value: "magnetico_fijacion", label: "Magnetico y fijacion" },
  { value: "pop_exhibidor", label: "POP y exhibidor" },
  { value: "herraje_accesorio", label: "Herraje y accesorio" },
  { value: "adhesivo_tecnico", label: "Adhesivo tecnico" },
  { value: "packing_instalacion", label: "Packing e instalacion" },
  { value: "sellos", label: "Sellos" },
];

/** Catálogo compartido: listado y ficha deben reconocer las mismas subfamilias. */
export const subfamiliaMateriaPrimaLabels: Record<SubfamiliaMateriaPrima, string> = {
  sustrato_hoja: "Sustrato hoja",
  sustrato_rollo_flexible: "Sustrato rollo flexible",
  vinilo_corte: "Vinilo de corte",
  sustrato_rigido: "Sustrato rígido",
  objeto_promocional_base: "Objeto promocional base",
  tinta_impresion: "Tinta impresión",
  toner: "Tóner",
  film_transferencia: "Film transferencia",
  papel_transferencia: "Papel transferencia",
  laminado_film: "Laminado film",
  laminado_pouch: "Laminado pouch",
  quimico_acabado: "Químico acabado",
  auxiliar_proceso: "Auxiliar proceso",
  polvo_dtf: "Polvo DTF",
  filamento_3d: "Filamento 3D",
  resina_3d: "Resina 3D",
  modulo_led_carteleria: "Módulo LED cartelería",
  fuente_alimentacion_led: "Fuente alimentación LED",
  cableado_conectica: "Cableado y conectica",
  controlador_led: "Controlador LED",
  neon_flex_led: "Neón flex LED",
  accesorio_neon_led: "Accesorio neón LED",
  chapa_metalica: "Chapa metálica",
  perfil_estructural: "Perfil estructural",
  pintura_carteleria: "Pintura cartelería",
  primer_sellador: "Primer sellador",
  anillado_encuadernacion: "Anillado encuadernación",
  tapa_encuadernacion: "Tapa encuadernación",
  componente_editorial: "Componente editorial / carpeta",
  pegatina_raspadita: "Pegatina raspadita",
  iman_ceramico_flexible: "Imán cerámico/flexible",
  fijacion_auxiliar: "Fijación auxiliar",
  accesorio_exhibidor_carton: "Accesorio exhibidor cartón",
  accesorio_montaje_pop: "Accesorio montaje POP",
  semielaborado_pop: "Semielaborado POP",
  argolla_llavero_accesorio: "Argolla llavero accesorio",
  ojal_ojalillo_remache: "Ojal/ojalillo/remache",
  portabanner_estructura: "Portabanner estructura",
  sistema_colgado_montaje: "Sistema colgado/montaje",
  perfil_bastidor_textil: "Perfil bastidor textil",
  textil_indumentaria: "Textil / indumentaria",
  cinta_doble_faz_tecnica: "Cinta doble faz técnica",
  adhesivo_liquido_estructural: "Adhesivo líquido estructural",
  velcro_cierre_tecnico: "Velcro/cierre técnico",
  embalaje_proteccion: "Embalaje/protección",
  etiquetado_identificacion: "Etiquetado/identificación",
  consumible_instalacion: "Consumible instalación",
  sellos_automaticos: "Sellos automáticos",
  sellos_manuales: "Sellos manuales",
  goma_laserable: "Goma laserable",
  almohadilla_tinta: "Almohadillas y tintas",
};

export const subfamiliaMateriaPrimaItems = (
  Object.keys(subfamiliaMateriaPrimaLabels) as SubfamiliaMateriaPrima[]
).map((value) => ({ value, label: subfamiliaMateriaPrimaLabels[value] }));

export const unidadMateriaPrimaItems: Array<{
  value: UnidadMateriaPrima;
  label: string;
}> = [
  { value: "unidad", label: "Unidad" },
  { value: "pack", label: "Pack" },
  { value: "caja", label: "Caja" },
  { value: "pallet", label: "Pallet" },
  { value: "botella", label: "Botella" },
  { value: "kit", label: "Kit" },
  { value: "hoja", label: "Hoja" },
  { value: "placa", label: "Placa" },
  { value: "resma", label: "Resma" },
  { value: "rollo", label: "Rollo" },
  { value: "metro_lineal", label: "Metro lineal" },
  { value: "m2", label: "M2" },
  { value: "m3", label: "M3" },
  { value: "mm", label: "MM" },
  { value: "cm", label: "CM" },
  { value: "litro", label: "Litro" },
  { value: "ml", label: "ML" },
  { value: "kg", label: "KG" },
  { value: "gramo", label: "Gramo" },
  { value: "pieza", label: "Pieza" },
  { value: "par", label: "Par" },
];
