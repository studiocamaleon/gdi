import type {
  FamiliaMateriaPrima,
  SubfamiliaMateriaPrima,
  UnidadMateriaPrima,
} from "@/lib/materias-primas";

export type MaterialPresetInstallStatus =
  "not-installed" | "partial" | "installed";

export type MaterialPresetVariant = {
  id: string;
  skuSugerido: string;
  nombreVarianteSugerido: string | null;
  formato: string;
  espesor: number | null;
  gramaje?: number | null;
  color: string;
  recomendada: boolean;
  atributosVariante: Record<string, unknown>;
  unidadStock: UnidadMateriaPrima | null;
  unidadCompra: UnidadMateriaPrima | null;
  precioReferencia: number | null;
  moneda: string | null;
  instalada: boolean;
};

export type MaterialPresetListItem = {
  id: string;
  canonicalKey: string;
  nombreCanonico: string;
  descripcionCorta: string;
  familia: FamiliaMateriaPrima;
  subfamilia: SubfamiliaMateriaPrima;
  tipoTecnico: string;
  templateId: string;
  iconKind: string;
  aliasDisponibles: string[];
  usosRecomendados: string[];
  procesosCompatibles: string[];
  advertencias: string[];
  installState: {
    status: MaterialPresetInstallStatus;
    visibleName: string | null;
    materiaPrimaId: string | null;
    installedCount: number;
    totalSuggested: number;
  };
  variantes: MaterialPresetVariant[];
};

export type MaterialPresetDetail = MaterialPresetListItem;

export type InstallMaterialPresetPayload = {
  visibleName: string;
  codigo: string;
  descripcion?: string;
  aliasUsado?: string;
  variantPresetIds: string[];
  customVariants?: Array<{
    sku: string;
    nombreVariante?: string;
    atributosVariante: Record<string, unknown>;
    unidadStock?: UnidadMateriaPrima;
    unidadCompra?: UnidadMateriaPrima;
  }>;
  modoDuplicado: "agregar_faltantes" | "crear_separado";
};

export type InstallMaterialPresetResponse = {
  materiaPrimaId: string;
  preset: MaterialPresetDetail;
};

export const bibliotecaUses: Record<string, { nm: string; code: string }> = {
  impresion_offset: { nm: "Impresión offset", code: "Offset" },
  impresion_digital: { nm: "Impresión digital", code: "Digital" },
  impresion_por_hoja: { nm: "Impresión por hoja", code: "Hoja" },
  impresion_directa_uv: { nm: "Impresión UV", code: "UV" },
  ploteo_vinilo: { nm: "Aplicación de vinilo", code: "Vinilo" },
  router_cnc: { nm: "Router CNC", code: "CNC" },
  corte_laser: { nm: "Corte láser", code: "Láser" },
  corte_digital: { nm: "Corte digital", code: "Corte" },
  letras_corporeas: { nm: "Letras corpóreas", code: "Corpóreas" },
  pop_signage: { nm: "POP / Señalética", code: "Señalética" },
  cajas_luz: { nm: "Cajas de luz", code: "Cajas luz" },
  papeleria_comercial: { nm: "Papelería comercial", code: "Papelería" },
  editorial: { nm: "Editorial", code: "Editorial" },
  folleteria: { nm: "Folletería", code: "Folletería" },
  tarjeteria: { nm: "Tarjetería", code: "Tarjetas" },
  formularios: { nm: "Formularios", code: "Formularios" },
  talonarios: { nm: "Talonarios", code: "Talonarios" },
  etiquetas: { nm: "Etiquetas", code: "Etiquetas" },
  stickers: { nm: "Stickers", code: "Stickers" },
  packaging: { nm: "Packaging", code: "Packaging" },
  exhibidores_pop: { nm: "Exhibidores / POP", code: "Exhibidores" },
  via_publica: { nm: "Vía pública", code: "Vía pública" },
};

export const bibliotecaFamilias: Record<
  string,
  { nm: string; key: string; parent: string }
> = {
  sustrato_rigido: {
    nm: "Sustrato rígido",
    key: "sustrato_rigido",
    parent: "sustrato",
  },
  sustrato_hoja: {
    nm: "Sustrato hoja",
    key: "sustrato_hoja",
    parent: "sustrato",
  },
  sustrato_rollo_flexible: {
    nm: "Sustrato en rollo",
    key: "sustrato_rollo_flexible",
    parent: "sustrato",
  },
  vinilo_corte: {
    nm: "Vinilo de corte",
    key: "vinilo_corte",
    parent: "sustrato",
  },
  objeto_promocional_base: {
    nm: "Objetos promocionales",
    key: "objeto_promocional_base",
    parent: "sustrato",
  },
  textil_indumentaria: {
    nm: "Textil / indumentaria",
    key: "textil_indumentaria",
    parent: "sustrato",
  },
  tinta_impresion: {
    nm: "Tinta impresión",
    key: "tinta_impresion",
    parent: "tinta_colorante",
  },
  toner: {
    nm: "Tóner",
    key: "toner",
    parent: "tinta_colorante",
  },
  film_transferencia: {
    nm: "Film de transferencia",
    key: "film_transferencia",
    parent: "transferencia_laminacion",
  },
  laminado_film: {
    nm: "Laminado film",
    key: "laminado_film",
    parent: "transferencia_laminacion",
  },
  laminado_pouch: {
    nm: "Laminado pouch",
    key: "laminado_pouch",
    parent: "transferencia_laminacion",
  },
  iman_ceramico_flexible: {
    nm: "Imanes",
    key: "iman_ceramico_flexible",
    parent: "magnetico_fijacion",
  },
  fijacion_auxiliar: {
    nm: "Tornillos y fijaciones",
    key: "fijacion_auxiliar",
    parent: "magnetico_fijacion",
  },
  sellos_automaticos: {
    nm: "Sellos automáticos",
    key: "sellos_automaticos",
    parent: "sellos",
  },
  sellos_manuales: {
    nm: "Sellos manuales",
    key: "sellos_manuales",
    parent: "sellos",
  },
  goma_laserable: {
    nm: "Goma laserable",
    key: "goma_laserable",
    parent: "sellos",
  },
  almohadilla_tinta: {
    nm: "Almohadillas y tintas",
    key: "almohadilla_tinta",
    parent: "sellos",
  },
  portabanner_estructura: {
    nm: "Portabanners",
    key: "portabanner_estructura",
    parent: "pop_exhibidor",
  },
  ojal_ojalillo_remache: {
    nm: "Ojales y remaches",
    key: "ojal_ojalillo_remache",
    parent: "herraje_accesorio",
  },
};
