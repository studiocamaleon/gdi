import type {
  FamiliaMateriaPrima,
  SubfamiliaMateriaPrima,
  UnidadMateriaPrima,
} from "@/lib/materias-primas";

export type MaterialPresetInstallStatus = "not-installed" | "partial" | "installed";

export type MaterialPresetVariant = {
  id: string;
  skuSugerido: string;
  nombreVarianteSugerido: string | null;
  formato: string;
  espesor: number | null;
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
  impresion_directa_uv: { nm: "Impresión UV", code: "UV" },
  ploteo_vinilo: { nm: "Aplicación de vinilo", code: "Vinilo" },
  router_cnc: { nm: "Router CNC", code: "CNC" },
  corte_laser: { nm: "Corte láser", code: "Láser" },
  corte_digital: { nm: "Corte digital", code: "Corte" },
  letras_corporeas: { nm: "Letras corpóreas", code: "Corpóreas" },
  pop_signage: { nm: "POP / Señalética", code: "Señalética" },
  cajas_luz: { nm: "Cajas de luz", code: "Cajas luz" },
};

export const bibliotecaFamilias: Record<string, { nm: string; key: string; parent: string }> = {
  sustrato_rigido: {
    nm: "Sustrato rígido",
    key: "sustrato_rigido",
    parent: "sustrato",
  },
};
