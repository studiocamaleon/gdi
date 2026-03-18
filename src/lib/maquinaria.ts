export type PlantillaMaquinaria =
  | "router_cnc"
  | "corte_laser"
  | "guillotina"
  | "laminadora_bopp_rollo"
  | "redondeadora_puntas"
  | "perforadora"
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

export type FamiliaPlantillaMaquinaria =
  | "corte_mecanizado"
  | "terminacion"
  | "fabricacion_aditiva"
  | "impresion_transferencia"
  | "impresion_uv"
  | "impresion_inkjet"
  | "impresion_digital";

export type EstadoMaquina = "activa" | "inactiva" | "mantenimiento" | "baja";

export type EstadoConfiguracionMaquina = "borrador" | "incompleta" | "lista";

export type GeometriaTrabajoMaquina =
  | "pliego"
  | "rollo"
  | "plano"
  | "cilindrico"
  | "volumen";

export type UnidadProduccionMaquina =
  | "hora"
  | "hoja"
  | "copia"
  | "ppm"
  | "a4_equiv"
  | "m2"
  | "m2_h"
  | "metro_lineal"
  | "piezas_h"
  | "pieza"
  | "ciclo"
  | "cortes_min"
  | "golpes_min"
  | "pliegos_min"
  | "m_min";

export type TipoPerfilOperativoMaquina =
  | "impresion"
  | "corte"
  | "mecanizado"
  | "grabado"
  | "fabricacion"
  | "mixto";

export type ModoImpresionPerfil = "cmyk" | "k";
export type CarasPerfil = "simple_faz" | "doble_faz";

export type TipoConsumibleMaquina =
  | "toner"
  | "tinta"
  | "barniz"
  | "primer"
  | "film"
  | "polvo"
  | "adhesivo"
  | "resina"
  | "lubricante"
  | "otro";

export type UnidadConsumoMaquina =
  | "ml"
  | "litro"
  | "gramo"
  | "kg"
  | "unidad"
  | "m2"
  | "metro_lineal"
  | "pagina"
  | "a4_equiv";

export type TipoComponenteDesgasteMaquina =
  | "fusor"
  | "drum"
  | "drum_opc"
  | "developer"
  | "developer_unit"
  | "charge_unit"
  | "drum_cleaning_blade"
  | "correa_transferencia"
  | "transfer_belt_itb"
  | "transfer_roller"
  | "fuser_belt"
  | "pressure_roller"
  | "fuser_cleaning_web"
  | "wax_lubricant_bar"
  | "fuser_stripper_finger"
  | "waste_toner_subsystem"
  | "cabezal"
  | "lampara_uv"
  | "fresa"
  | "cuchilla"
  | "filtro"
  | "kit_mantenimiento"
  | "otro";

export type UnidadDesgasteMaquina =
  | "copias_a4_equiv"
  | "m2"
  | "metros_lineales"
  | "horas"
  | "ciclos"
  | "piezas";

export type MaquinariaTemplateSectionId =
  | "datos_generales"
  | "ubicacion_organizacion"
  | "capacidades_fisicas"
  | "parametros_tecnicos"
  | "perfiles_operativos"
  | "consumibles"
  | "desgaste_repuestos"
  | "vinculacion_economica"
  | "documentacion_observaciones";

export type MaquinariaTemplateFieldScope =
  | "maquina"
  | "perfil_operativo"
  | "consumible"
  | "desgaste";

export type MaquinariaTemplateFieldKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "multiselect"
  | "boolean";

export type MaquinariaTemplateFieldUnit =
  | "cm"
  | "mm"
  | "m2"
  | "m2_h"
  | "metro_lineal"
  | "unidades_min"
  | "piezas_h"
  | "copias_min"
  | "ppm"
  | "rpm"
  | "kw"
  | "g_m2"
  | "kg"
  | "litros"
  | "mm_s"
  | "min"
  | "horas"
  | "porcentaje"
  | "dpi"
  | "micrones";

export type MaquinariaTemplateOption = {
  value: string;
  label: string;
  description?: string;
};

export type MaquinariaTemplateField = {
  key: string;
  label: string;
  scope: MaquinariaTemplateFieldScope;
  kind: MaquinariaTemplateFieldKind;
  description: string;
  tooltip?: string;
  placeholder?: string;
  required?: boolean;
  unit?: MaquinariaTemplateFieldUnit;
  options?: MaquinariaTemplateOption[];
};

export type MaquinariaTemplateSection = {
  id: MaquinariaTemplateSectionId;
  title: string;
  description: string;
  tooltip?: string;
  fields: MaquinariaTemplateField[];
};

export type MaquinariaTemplateHelp = {
  summary: string;
  tips: string[];
  warnings?: string[];
  examples?: string[];
};

export type MaquinariaTemplateDefinition = {
  id: PlantillaMaquinaria;
  label: string;
  family: FamiliaPlantillaMaquinaria;
  description: string;
  geometry: GeometriaTrabajoMaquina;
  defaultProductionUnit: UnidadProduccionMaquina;
  allowedProductionUnits?: UnidadProduccionMaquina[];
  visibleSections: MaquinariaTemplateSectionId[];
  sections: MaquinariaTemplateSection[];
  help: MaquinariaTemplateHelp;
};

export const familiaPlantillaMaquinariaItems: Array<{
  label: string;
  value: FamiliaPlantillaMaquinaria;
}> = [
  { label: "Corte y mecanizado", value: "corte_mecanizado" },
  { label: "Terminacion", value: "terminacion" },
  { label: "Fabricacion aditiva", value: "fabricacion_aditiva" },
  { label: "Impresion por transferencia", value: "impresion_transferencia" },
  { label: "Impresion UV", value: "impresion_uv" },
  { label: "Impresion inkjet", value: "impresion_inkjet" },
  { label: "Impresion digital", value: "impresion_digital" },
];

export const estadoMaquinaItems: Array<{ label: string; value: EstadoMaquina }> = [
  { label: "Activa", value: "activa" },
  { label: "Inactiva", value: "inactiva" },
  { label: "Mantenimiento", value: "mantenimiento" },
  { label: "Baja", value: "baja" },
];

export const estadoConfiguracionMaquinaItems: Array<{
  label: string;
  value: EstadoConfiguracionMaquina;
}> = [
  { label: "Borrador", value: "borrador" },
  { label: "Incompleta", value: "incompleta" },
  { label: "Lista", value: "lista" },
];

export const geometriaTrabajoMaquinaItems: Array<{
  label: string;
  value: GeometriaTrabajoMaquina;
}> = [
  { label: "Pliego", value: "pliego" },
  { label: "Rollo", value: "rollo" },
  { label: "Plano", value: "plano" },
  { label: "Cilindrico", value: "cilindrico" },
  { label: "Volumen", value: "volumen" },
];

export const unidadProduccionMaquinaItems: Array<{
  label: string;
  value: UnidadProduccionMaquina;
}> = [
  { label: "Hora", value: "hora" },
  { label: "Hoja", value: "hoja" },
  { label: "Copia", value: "copia" },
  { label: "PPM (pag/min)", value: "ppm" },
  { label: "A4 equivalente", value: "a4_equiv" },
  { label: "Metro cuadrado", value: "m2" },
  { label: "Metro cuadrado por hora", value: "m2_h" },
  { label: "Metro lineal", value: "metro_lineal" },
  { label: "Piezas por hora", value: "piezas_h" },
  { label: "Pieza", value: "pieza" },
  { label: "Ciclo", value: "ciclo" },
  { label: "Cortes por minuto", value: "cortes_min" },
  { label: "Golpes por minuto", value: "golpes_min" },
  { label: "Pliegos por minuto", value: "pliegos_min" },
  { label: "Metros por minuto", value: "m_min" },
];

export const tipoPerfilOperativoMaquinaItems: Array<{
  label: string;
  value: TipoPerfilOperativoMaquina;
}> = [
  { label: "Impresion", value: "impresion" },
  { label: "Corte", value: "corte" },
  { label: "Mecanizado", value: "mecanizado" },
  { label: "Grabado", value: "grabado" },
  { label: "Fabricacion", value: "fabricacion" },
  { label: "Mixto", value: "mixto" },
];

export const tipoConsumibleMaquinaItems: Array<{
  label: string;
  value: TipoConsumibleMaquina;
}> = [
  { label: "Toner", value: "toner" },
  { label: "Tinta", value: "tinta" },
  { label: "Barniz", value: "barniz" },
  { label: "Primer", value: "primer" },
  { label: "Film", value: "film" },
  { label: "Polvo", value: "polvo" },
  { label: "Adhesivo", value: "adhesivo" },
  { label: "Resina", value: "resina" },
  { label: "Lubricante", value: "lubricante" },
  { label: "Otro", value: "otro" },
];

export const unidadConsumoMaquinaItems: Array<{
  label: string;
  value: UnidadConsumoMaquina;
}> = [
  { label: "Mililitro", value: "ml" },
  { label: "Litro", value: "litro" },
  { label: "Gramo", value: "gramo" },
  { label: "Kilogramo", value: "kg" },
  { label: "Unidad", value: "unidad" },
  { label: "Metro cuadrado", value: "m2" },
  { label: "Metro lineal", value: "metro_lineal" },
  { label: "Pagina", value: "pagina" },
  { label: "A4 equivalente", value: "a4_equiv" },
];

export const tipoComponenteDesgasteMaquinaItems: Array<{
  label: string;
  value: TipoComponenteDesgasteMaquina;
}> = [
  { label: "Fusor", value: "fusor" },
  { label: "Tambor (drum) genérico", value: "drum" },
  { label: "Tambor OPC", value: "drum_opc" },
  { label: "Revelador", value: "developer" },
  { label: "Unidad reveladora (developer unit)", value: "developer_unit" },
  { label: "Unidad de carga (PCR/corona)", value: "charge_unit" },
  { label: "Cuchilla de limpieza de tambor", value: "drum_cleaning_blade" },
  { label: "Correa transferencia", value: "correa_transferencia" },
  { label: "Banda/correa de transferencia ITB", value: "transfer_belt_itb" },
  { label: "Rodillo de transferencia", value: "transfer_roller" },
  { label: "Banda de fusor", value: "fuser_belt" },
  { label: "Rodillo de presión", value: "pressure_roller" },
  { label: "Web de limpieza del fusor", value: "fuser_cleaning_web" },
  { label: "Barra de cera/lubricación", value: "wax_lubricant_bar" },
  { label: "Uña separadora del fusor", value: "fuser_stripper_finger" },
  { label: "Subsistema de residual de tóner", value: "waste_toner_subsystem" },
  { label: "Cabezal", value: "cabezal" },
  { label: "Lampara UV", value: "lampara_uv" },
  { label: "Fresa", value: "fresa" },
  { label: "Cuchilla", value: "cuchilla" },
  { label: "Filtro", value: "filtro" },
  { label: "Kit mantenimiento", value: "kit_mantenimiento" },
  { label: "Otro", value: "otro" },
];

export const unidadDesgasteMaquinaItems: Array<{
  label: string;
  value: UnidadDesgasteMaquina;
}> = [
  { label: "Copias A4 equivalentes", value: "copias_a4_equiv" },
  { label: "Metro cuadrado", value: "m2" },
  { label: "Metros lineales", value: "metros_lineales" },
  { label: "Horas", value: "horas" },
  { label: "Ciclos", value: "ciclos" },
  { label: "Piezas", value: "piezas" },
];

export const maquinariaBaseSectionOrder: MaquinariaTemplateSectionId[] = [
  "datos_generales",
  "ubicacion_organizacion",
  "capacidades_fisicas",
  "parametros_tecnicos",
  "perfiles_operativos",
  "consumibles",
  "desgaste_repuestos",
  "vinculacion_economica",
  "documentacion_observaciones",
];

export function getFamiliaPlantillaMaquinariaLabel(value: FamiliaPlantillaMaquinaria) {
  return familiaPlantillaMaquinariaItems.find((item) => item.value === value)?.label ?? value;
}

export function getEstadoMaquinaLabel(value: EstadoMaquina) {
  return estadoMaquinaItems.find((item) => item.value === value)?.label ?? value;
}

export function getEstadoConfiguracionMaquinaLabel(value: EstadoConfiguracionMaquina) {
  return (
    estadoConfiguracionMaquinaItems.find((item) => item.value === value)?.label ?? value
  );
}

export function getGeometriaTrabajoMaquinaLabel(value: GeometriaTrabajoMaquina) {
  return geometriaTrabajoMaquinaItems.find((item) => item.value === value)?.label ?? value;
}

export function getUnidadProduccionMaquinaLabel(value: UnidadProduccionMaquina) {
  return unidadProduccionMaquinaItems.find((item) => item.value === value)?.label ?? value;
}

export type MaquinaPerfilOperativo = {
  id: string;
  nombre: string;
  tipoPerfil: TipoPerfilOperativoMaquina;
  activo: boolean;
  anchoAplicable: number | null;
  altoAplicable: number | null;
  operationMode: string;
  printMode: ModoImpresionPerfil | "";
  printSides: CarasPerfil | "";
  productivityValue: number | null;
  productivityUnit: UnidadProduccionMaquina | "";
  setupMin: number | null;
  cleanupMin: number | null;
  feedReloadMin: number | null;
  sheetThicknessMm: number | null;
  maxBatchHeightMm: number | null;
  materialPreset: string;
  setupEstimadoMin: number | null;
  cantidadPasadas: number | null;
  dobleFaz: boolean;
  detalle: Record<string, unknown> | null;
};

export type MaquinaConsumible = {
  id: string;
  materiaPrimaVarianteId: string;
  materiaPrimaVarianteSku: string;
  materiaPrimaVarianteNombre: string;
  materiaPrimaNombre: string;
  materiaPrimaPrecioReferencia: number | null;
  nombre: string;
  tipo: TipoConsumibleMaquina;
  unidad: UnidadConsumoMaquina;
  rendimientoEstimado: number | null;
  consumoBase: number | null;
  perfilOperativoNombre: string;
  activo: boolean;
  detalle: Record<string, unknown> | null;
  observaciones: string;
};

export type MaquinaComponenteDesgaste = {
  id: string;
  materiaPrimaVarianteId: string;
  materiaPrimaVarianteSku: string;
  materiaPrimaVarianteNombre: string;
  materiaPrimaNombre: string;
  materiaPrimaPrecioReferencia: number | null;
  nombre: string;
  tipo: TipoComponenteDesgasteMaquina;
  vidaUtilEstimada: number | null;
  unidadDesgaste: UnidadDesgasteMaquina;
  modoProrrateo: string;
  activo: boolean;
  detalle: Record<string, unknown> | null;
  observaciones: string;
};

export type Maquina = {
  id: string;
  codigo: string;
  nombre: string;
  plantilla: PlantillaMaquinaria;
  plantillaVersion: number;
  fabricante: string;
  modelo: string;
  numeroSerie: string;
  plantaId: string;
  plantaNombre: string;
  centroCostoPrincipalId: string;
  centroCostoPrincipalNombre: string;
  estado: EstadoMaquina;
  estadoConfiguracion: EstadoConfiguracionMaquina;
  geometriaTrabajo: GeometriaTrabajoMaquina;
  unidadProduccionPrincipal: UnidadProduccionMaquina;
  anchoUtil: number | null;
  largoUtil: number | null;
  altoUtil: number | null;
  espesorMaximo: number | null;
  pesoMaximo: number | null;
  fechaAlta: string;
  activo: boolean;
  observaciones: string;
  parametrosTecnicos: Record<string, unknown> | null;
  capacidadesAvanzadas: Record<string, unknown> | null;
  perfilesOperativos: MaquinaPerfilOperativo[];
  consumibles: MaquinaConsumible[];
  componentesDesgaste: MaquinaComponenteDesgaste[];
  createdAt: string;
  updatedAt: string;
};

export type MaquinaPayload = {
  codigo?: string;
  nombre: string;
  plantilla: PlantillaMaquinaria;
  plantillaVersion?: number;
  fabricante?: string;
  modelo?: string;
  numeroSerie?: string;
  plantaId: string;
  centroCostoPrincipalId?: string;
  estado: EstadoMaquina;
  estadoConfiguracion?: EstadoConfiguracionMaquina;
  geometriaTrabajo: GeometriaTrabajoMaquina;
  unidadProduccionPrincipal: UnidadProduccionMaquina;
  anchoUtil?: number;
  largoUtil?: number;
  altoUtil?: number;
  espesorMaximo?: number;
  pesoMaximo?: number;
  fechaAlta?: string;
  activo: boolean;
  observaciones?: string;
  parametrosTecnicos?: Record<string, unknown>;
  capacidadesAvanzadas?: Record<string, unknown>;
  perfilesOperativos: Array<{
    id?: string;
    nombre: string;
    tipoPerfil: TipoPerfilOperativoMaquina;
    activo: boolean;
    anchoAplicable?: number;
    altoAplicable?: number;
    operationMode?: string;
    printMode?: ModoImpresionPerfil;
    printSides?: CarasPerfil;
    productivityValue?: number;
    productivityUnit?: UnidadProduccionMaquina;
    setupMin?: number;
    cleanupMin?: number;
    feedReloadMin?: number;
    sheetThicknessMm?: number;
    maxBatchHeightMm?: number;
    materialPreset?: string;
    cantidadPasadas?: number;
    dobleFaz?: boolean;
    detalle?: Record<string, unknown>;
  }>;
  consumibles: Array<{
    id?: string;
    materiaPrimaVarianteId: string;
    nombre: string;
    tipo: TipoConsumibleMaquina;
    unidad: UnidadConsumoMaquina;
    rendimientoEstimado?: number;
    consumoBase?: number;
    perfilOperativoId?: string;
    perfilOperativoNombre?: string;
    activo: boolean;
    detalle?: Record<string, unknown>;
    observaciones?: string;
  }>;
  componentesDesgaste: Array<{
    id?: string;
    materiaPrimaVarianteId: string;
    nombre: string;
    tipo: TipoComponenteDesgasteMaquina;
    vidaUtilEstimada?: number;
    unidadDesgaste: UnidadDesgasteMaquina;
    modoProrrateo?: string;
    activo: boolean;
    detalle?: Record<string, unknown>;
    observaciones?: string;
  }>;
};

export const printModeItems: Array<{ label: string; value: ModoImpresionPerfil }> = [
  { label: "CMYK", value: "cmyk" },
  { label: "K", value: "k" },
];

export const printSidesItems: Array<{ label: string; value: CarasPerfil }> = [
  { label: "Simple faz", value: "simple_faz" },
  { label: "Doble faz", value: "doble_faz" },
];
