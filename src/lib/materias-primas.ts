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
  | "packing_instalacion";

export type SubfamiliaMateriaPrima =
  | "sustrato_hoja"
  | "sustrato_rollo_flexible"
  | "sustrato_rigido"
  | "objeto_promocional_base"
  | "tinta_impresion"
  | "toner"
  | "film_transferencia"
  | "papel_transferencia"
  | "laminado_film"
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
  | "cinta_doble_faz_tecnica"
  | "adhesivo_liquido_estructural"
  | "velcro_cierre_tecnico"
  | "embalaje_proteccion"
  | "etiquetado_identificacion"
  | "consumible_instalacion";

export type UnidadMateriaPrima =
  | "unidad"
  | "pack"
  | "caja"
  | "kit"
  | "hoja"
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

export type PlantillaMaquinaria =
  | "router_cnc"
  | "corte_laser"
  | "impresora_3d"
  | "impresora_dtf"
  | "impresora_dtf_uv"
  | "impresora_uv_mesa_extensora"
  | "impresora_uv_cilindrica"
  | "impresora_uv_flatbed"
  | "impresora_uv_rollo"
  | "impresora_solvente"
  | "impresora_inyeccion_tinta"
  | "impresora_latex"
  | "impresora_sublimacion_gran_formato"
  | "impresora_laser"
  | "plotter_cad"
  | "mesa_de_corte"
  | "plotter_de_corte";

export type MateriaPrimaVariante = {
  id: string;
  sku: string;
  nombreVariante: string;
  activo: boolean;
  atributosVariante: Record<string, unknown>;
  unidadStock: UnidadMateriaPrima | null;
  unidadCompra: UnidadMateriaPrima | null;
  precioReferencia: number | null;
  moneda: string;
  proveedorReferenciaId: string | null;
  proveedorReferenciaNombre: string;
};

export type MateriaPrima = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  familia: FamiliaMateriaPrima;
  subfamilia: SubfamiliaMateriaPrima;
  tipoTecnico: string;
  templateId: string;
  unidadStock: UnidadMateriaPrima;
  unidadCompra: UnidadMateriaPrima;
  esConsumible: boolean;
  esRepuesto: boolean;
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
  esConsumible: boolean;
  esRepuesto: boolean;
  activo: boolean;
  atributosTecnicos: Record<string, unknown>;
  variantes: Array<{
    sku: string;
    nombreVariante?: string;
    activo: boolean;
    atributosVariante: Record<string, unknown>;
    unidadStock?: UnidadMateriaPrima;
    unidadCompra?: UnidadMateriaPrima;
    precioReferencia?: number;
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
  { value: "metal_estructura", label: "Metal y estructura" },
  { value: "pintura_recubrimiento", label: "Pintura y recubrimiento" },
  { value: "terminacion_editorial", label: "Terminacion editorial" },
  { value: "magnetico_fijacion", label: "Magnetico y fijacion" },
  { value: "pop_exhibidor", label: "POP y exhibidor" },
  { value: "herraje_accesorio", label: "Herraje y accesorio" },
  { value: "adhesivo_tecnico", label: "Adhesivo tecnico" },
  { value: "packing_instalacion", label: "Packing e instalacion" },
];

export const unidadMateriaPrimaItems: Array<{
  value: UnidadMateriaPrima;
  label: string;
}> = [
  { value: "unidad", label: "Unidad" },
  { value: "pack", label: "Pack" },
  { value: "caja", label: "Caja" },
  { value: "kit", label: "Kit" },
  { value: "hoja", label: "Hoja" },
  { value: "pliego", label: "Pliego" },
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
