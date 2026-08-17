/**
 * Plantillas de maquinaria — modelo final v3.0 (2026-04-26).
 * Doc: `docs/motor-por-pasos-analisis/06-maquinas-y-perfiles.md` §4.
 * 12 plantillas finales (las 8 viejas de impresoras gran formato unificadas
 * en `impresora_gran_formato_por_area` con discriminantes tecnologia + geometria).
 */
import type { ConsumoPorCobertura } from "@/lib/cobertura-toner";

export type PlantillaMaquinaria =
  | "impresora_laser"
  | "impresora_gran_formato_por_area"
  | "guillotina"
  | "plotter_de_corte"
  | "plotter_cad"
  | "laminadora_bopp_rollo"
  | "corte_laser"
  | "router_cnc"
  | "anilladora"
  | "mesa_de_corte"
  | "plancha_termica"
  | "impresora_3d";

/**
 * Familias de plantilla — agrupación visual para el catálogo.
 * v3.0: simplificadas a 4 (eliminadas las sub-categorías de impresoras
 * porque ahora hay 1 sola plantilla unificada).
 */
export type FamiliaPlantillaMaquinaria =
  | "impresion_digital"
  | "impresion_gran_formato"
  | "corte_mecanizado"
  | "terminacion";

export type EstadoMaquina = "activa" | "inactiva" | "mantenimiento" | "baja";

export type EstadoConfiguracionMaquina = "borrador" | "incompleta" | "lista";

export type GeometriaTrabajoMaquina =
  "pliego" | "rollo" | "plano" | "cilindrico" | "volumen";

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
  | "m_min"
  | "mm_s"
  | "mm_min"
  | "g_h";

export type TipoPerfilOperativoMaquina =
  | "impresion"
  | "corte"
  | "laminado"
  | "mecanizado"
  | "grabado"
  | "fabricacion"
  | "mixto";

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
  | "ml_tinta"
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
  "maquina" | "perfil_operativo" | "consumible" | "desgaste";

export type MaquinariaTemplateFieldKind =
  "text" | "textarea" | "number" | "select" | "multiselect" | "boolean";

export type MaquinariaTemplateFieldUnit =
  | "cm"
  | "mm"
  | "m2"
  | "m2_h"
  | "metro_lineal"
  | "unidades_min"
  | "piezas_h"
  | "hojas_h"
  | "copias_min"
  | "ppm"
  | "rpm"
  | "kw"
  | "g_m2"
  | "kg"
  | "litros"
  | "m_min"
  | "mm_s"
  | "mm_min"
  | "g_h"
  | "gramos"
  | "seg"
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
  /** Se muestra como tooltip del label. Sin declarar = el label alcanza. */
  description?: string;
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
  allowedProfileTypes?: TipoPerfilOperativoMaquina[];
  visibleSections: MaquinariaTemplateSectionId[];
  sections: MaquinariaTemplateSection[];
  help: MaquinariaTemplateHelp;
};

// v3.0: 4 familias finales (alineadas a las 12 plantillas finales).
export const familiaPlantillaMaquinariaItems: Array<{
  label: string;
  value: FamiliaPlantillaMaquinaria;
}> = [
  { label: "Impresión digital", value: "impresion_digital" },
  { label: "Impresión gran formato", value: "impresion_gran_formato" },
  { label: "Corte y mecanizado", value: "corte_mecanizado" },
  { label: "Terminación", value: "terminacion" },
];

export const estadoMaquinaItems: Array<{
  label: string;
  value: EstadoMaquina;
}> = [
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
  { label: "Cilíndrico", value: "cilindrico" },
  { label: "Volumen", value: "volumen" },
];

export const tecnologiaMaquinaItems = [
  { label: "Láser", value: "laser" },
  { label: "Eco-solvente", value: "eco_solvente" },
  { label: "Ultravioleta", value: "uv" },
  { label: "Látex", value: "latex" },
  { label: "Sublimación", value: "sublimacion" },
  { label: "DTF textil", value: "dtf_textil" },
  { label: "DTF UV", value: "dtf_uv" },
  { label: "Inkjet", value: "inkjet" },
] as const;

export type TecnologiaMaquina =
  (typeof tecnologiaMaquinaItems)[number]["value"];

function normalizeTecnologiaMaquinaValue(value: unknown) {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "solvente") {
    return "eco_solvente";
  }
  return tecnologiaMaquinaItems.some((item) => item.value === normalized)
    ? (normalized as TecnologiaMaquina)
    : null;
}

export function getMaquinaGeometriasCompatibles(input: {
  geometriaTrabajo: GeometriaTrabajoMaquina;
  plantilla?: PlantillaMaquinaria;
  capacidadesAvanzadas?: Record<string, unknown> | null;
}) {
  const raw =
    input.capacidadesAvanzadas &&
    Array.isArray(input.capacidadesAvanzadas.geometriasCompatibles)
      ? input.capacidadesAvanzadas.geometriasCompatibles
      : [];
  const normalized = raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(
      (item): item is GeometriaTrabajoMaquina =>
        item === "pliego" ||
        item === "rollo" ||
        item === "plano" ||
        item === "cilindrico" ||
        item === "volumen",
    );
  if (normalized.length > 0) {
    return Array.from(new Set(normalized));
  }
  // v3.0: GRAN_FORMATO_POR_AREA con geometria=MESA_EXTENSORA puede operar
  // en plano y rollo según el modo. El resto usa su geometría declarada.
  if (input.plantilla === "impresora_gran_formato_por_area") {
    return ["plano", "rollo"] as GeometriaTrabajoMaquina[];
  }
  return [input.geometriaTrabajo];
}

/**
 * v3.0: la tecnología de la máquina ahora es un discriminante explícito en
 * `parametrosTecnicosJson.tecnologia` (LATEX | SOLVENTE | UV | SUBLIMACION |
 * DTF_UV | DTF_TEXTIL) para IMPRESORA_GRAN_FORMATO_POR_AREA. Para
 * IMPRESORA_LASER, es siempre "laser".
 */
export function getMaquinaTecnologia(input: {
  plantilla?: PlantillaMaquinaria;
  parametrosTecnicos?: Record<string, unknown> | null;
  capacidadesAvanzadas?: Record<string, unknown> | null;
}) {
  // 1. Lectura explícita desde paramsTecnicos (modelo v3.0).
  const tecnologiaExplicita = input.parametrosTecnicos?.tecnologia;
  if (typeof tecnologiaExplicita === "string" && tecnologiaExplicita.trim()) {
    return tecnologiaExplicita.toLowerCase();
  }
  // 2. Compat: legacy capacidadesAvanzadas.tecnologiaMaquina.
  const explicit = normalizeTecnologiaMaquinaValue(
    input.capacidadesAvanzadas?.tecnologiaMaquina,
  );
  if (explicit) {
    return explicit;
  }
  // 3. Default por plantilla (las únicas con tecnología fija).
  if (input.plantilla === "impresora_laser") return "laser";
  if (input.plantilla === "plotter_cad") return "inkjet";
  return null;
}

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
  { label: "Milímetros por segundo", value: "mm_s" },
  { label: "Milímetros por minuto", value: "mm_min" },
  { label: "Gramos por hora", value: "g_h" },
];

export const tipoPerfilOperativoMaquinaItems: Array<{
  label: string;
  value: TipoPerfilOperativoMaquina;
}> = [
  { label: "Impresion", value: "impresion" },
  { label: "Corte", value: "corte" },
  { label: "Laminado", value: "laminado" },
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
  { label: "Mililitros de tinta procesada", value: "ml_tinta" },
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

export function getFamiliaPlantillaMaquinariaLabel(
  value: FamiliaPlantillaMaquinaria,
) {
  return (
    familiaPlantillaMaquinariaItems.find((item) => item.value === value)
      ?.label ?? value
  );
}

export function getEstadoMaquinaLabel(value: EstadoMaquina) {
  return (
    estadoMaquinaItems.find((item) => item.value === value)?.label ?? value
  );
}

export function getEstadoConfiguracionMaquinaLabel(
  value: EstadoConfiguracionMaquina,
) {
  return (
    estadoConfiguracionMaquinaItems.find((item) => item.value === value)
      ?.label ?? value
  );
}

export function getGeometriaTrabajoMaquinaLabel(
  value: GeometriaTrabajoMaquina,
) {
  return (
    geometriaTrabajoMaquinaItems.find((item) => item.value === value)?.label ??
    value
  );
}

export function getUnidadProduccionMaquinaLabel(
  value: UnidadProduccionMaquina,
) {
  return (
    unidadProduccionMaquinaItems.find((item) => item.value === value)?.label ??
    value
  );
}

/**
 * Perfil operativo — modelo v3.0 (2026-04-26).
 * Solo columnas universales del doc §5–§13. Los discriminantes específicos
 * por plantilla (caras, colores, gramajeMinGr, modoOperacion, modoCalidad, etc.)
 * viven en `detalle` (JSON libre).
 */
export type MaquinaPerfilOperativo = {
  id: string;
  nombre: string;
  tipoPerfil: TipoPerfilOperativoMaquina;
  activo: boolean;
  productivityValue: number | null;
  productivityUnit: UnidadProduccionMaquina | "";
  setupMin: number | null;
  cleanupMin: number | null;
  feedReloadMin: number | null;
  setupEstimadoMin: number | null;
  /** Discriminantes y params específicos según plantilla (doc §5–§13). */
  detalle: Record<string, unknown> | null;
  /** v3.0 (G-M8): JsonLogic para auto-selección por el motor. */
  reglaSeleccionJson: Record<string, unknown> | null;
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
  /** g/m² de tóner por nivel de cobertura; null = usar consumoBase (Normal). */
  consumoPorCobertura: ConsumoPorCobertura | null;
  perfilOperativoId: string | null;
  perfilOperativoNombre: string;
  activo: boolean;
  detalle: Record<string, unknown> | null;
  observaciones: string;
};

export type MaquinaComponenteDesgaste = {
  id: string;
  /** Vacío cuando el repuesto se cargó sólo con su precio. */
  materiaPrimaVarianteId: string;
  precioUnitario: number | null;
  soloColor: boolean;
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

export type MaquinaConfiguracionFaltante = {
  codigo: string;
  seccion: "descripcion" | "ajustes";
  mensaje: string;
  campo?: string;
  perfilId?: string;
};

export type MaquinaDiagnosticoConfiguracion = {
  estado: EstadoConfiguracionMaquina;
  faltantes: MaquinaConfiguracionFaltante[];
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
  gramajeMaxGr: number | null;
  fechaAlta: string;
  activo: boolean;
  observaciones: string;
  parametrosTecnicos: Record<string, unknown> | null;
  capacidadesAvanzadas: Record<string, unknown> | null;
  perfilesOperativos: MaquinaPerfilOperativo[];
  consumibles: MaquinaConsumible[];
  componentesDesgaste: MaquinaComponenteDesgaste[];
  diagnosticoConfiguracion: MaquinaDiagnosticoConfiguracion;
  createdAt: string;
  updatedAt: string;
};

export type MaquinaPayload = {
  expectedUpdatedAt?: string;
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
  gramajeMaxGr?: number;
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
    productivityValue?: number;
    productivityUnit?: UnidadProduccionMaquina;
    setupMin?: number;
    cleanupMin?: number;
    feedReloadMin?: number;
    detalle?: Record<string, unknown>;
    reglaSeleccionJson?: Record<string, unknown>;
  }>;
  consumibles: Array<{
    id?: string;
    materiaPrimaVarianteId: string;
    nombre?: string;
    tipo?: TipoConsumibleMaquina;
    unidad?: UnidadConsumoMaquina;
    rendimientoEstimado?: number;
    consumoBase?: number;
    consumoPorCobertura?: ConsumoPorCobertura | null;
    perfilOperativoId?: string;
    perfilOperativoNombre?: string;
    activo: boolean;
    detalle?: Record<string, unknown>;
    observaciones?: string;
  }>;
  componentesDesgaste: Array<{
    id?: string;
    /** Opcional: el repuesto puede declararse sólo con su precio. */
    materiaPrimaVarianteId?: string;
    precioUnitario?: number;
    soloColor?: boolean;
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

export type MaquinaResumen = Pick<
  Maquina,
  | "id"
  | "codigo"
  | "nombre"
  | "plantilla"
  | "plantillaVersion"
  | "fabricante"
  | "modelo"
  | "numeroSerie"
  | "plantaId"
  | "plantaNombre"
  | "centroCostoPrincipalId"
  | "centroCostoPrincipalNombre"
  | "estado"
  | "estadoConfiguracion"
  | "geometriaTrabajo"
  | "unidadProduccionPrincipal"
  | "activo"
  | "parametrosTecnicos"
  | "capacidadesAvanzadas"
  | "createdAt"
  | "updatedAt"
  | "diagnosticoConfiguracion"
> & {
  perfilesCount: number;
};

export type MaquinasPage = {
  data: MaquinaResumen[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type MaquinaHistorialEvento = {
  id: string;
  accion: "creada" | "actualizada" | "activada" | "desactivada" | string;
  actorNombre: string;
  descripcion: string;
  cambios: {
    secciones?: string[];
    estado?: EstadoMaquina;
    estadoConfiguracion?: EstadoConfiguracionMaquina;
    activo?: boolean;
  } | null;
  createdAt: string;
};

// v3.0: items legacy (printModeItems, printSidesItems) eliminados.
// Los discriminantes de impresoras (caras, colores) ahora se editan vía
// `perfil.detalle` JSON desde el editor de plantilla específica.
