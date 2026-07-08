/**
 * Tipos del Modelo Universal V2 — espejo del schema Prisma para el frontend.
 *
 * Mantiene compatibilidad con el Tab Precio existente (UnidadComercialProducto,
 * MetodoCalculoPrecioProducto, etc.) que se usaba en el modelo viejo.
 */

export type UnidadComercialProducto = "unidad" | "m2" | "metro_lineal";

export const unidadComercialProductoItems: Array<{
  value: UnidadComercialProducto;
  label: string;
}> = [
  { value: "unidad", label: "Unidad" },
  { value: "m2", label: "Metro cuadrado (m²)" },
  { value: "metro_lineal", label: "Metro lineal" },
];

export type ModoMedidasProducto =
  "FIJA" | "LIBRE" | "COMERCIAL_ELIGE" | "MIXTA";

export type MinimoComercialPolitica =
  | "NONE"
  | "ADVERTIR_FACTURAR_MINIMO"
  | "BLOQUEAR";

export type MinimoComercialBase =
  | "cantidad_comercial"
  | "pliegos_impresos";

export interface MedidaPredefinidaProducto {
  id: string;
  nombre: string;
  anchoMm: number;
  altoMm: number;
  esDefault: boolean;
}

export interface AtributoComercialSchema {
  key: string;
  label: string;
  tipo: string;
  visible: boolean;
  orden: number;
}

export interface ProductoCategoriaComercial {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  subcategorias: ProductoSubcategoriaComercial[];
}

export interface ProductoSubcategoriaComercial {
  id: string;
  categoriaId: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  atributosSchemaJson: AtributoComercialSchema[];
  orden: number;
  activo: boolean;
  categoria?: Omit<ProductoCategoriaComercial, "subcategorias">;
}

// ============================================================================
// MÉTODOS DE CÁLCULO DE PRECIO (Tab Precio preservado)
// ============================================================================

export type MetodoCalculoPrecioProducto =
  | "margen_variable"
  | "por_margen"
  | "precio_fijo"
  | "fijado_por_cantidad"
  | "fijo_con_margen_variable"
  | "variable_por_cantidad"
  | "precio_fijo_para_margen_minimo";

// ============================================================================
// PRODUCTO (modelo nuevo)
// ============================================================================

export interface ProductoListItem {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  atributosComercialesJson: Record<string, unknown> | null;
  medidaDefaultAnchoMm: string | null;
  medidaDefaultAltoMm: string | null;
  medidasPredefinidasJson: MedidaPredefinidaProducto[] | null;
  precioConfigJson: unknown;
  unidadComercial: string;
  modoMedidas: ModoMedidasProducto;
  minimoComercialPolitica: MinimoComercialPolitica;
  minimoComercialCantidad: string | null;
  minimoComercialBase: MinimoComercialBase;
  activo: boolean;
  subcategoriaComercial: ProductoSubcategoriaComercial & {
    categoria: Omit<ProductoCategoriaComercial, "subcategorias">;
  };
  rutasAlternativas: Array<{
    id: string;
    nombre: string;
    esPreferida: boolean;
    ruta: { id: string; codigo: string; nombre: string };
  }>;
}

export interface ProductoDetalle extends Omit<
  ProductoListItem,
  "rutasAlternativas"
> {
  rutasAlternativas: RutaAlternativaDetalle[];
  pasosExtras: PasoExtra[];
  cargosDirectosCotizacion: CargoCotizacionDetalle[];
}

export interface RutaAlternativaDetalle {
  id: string;
  nombre: string;
  esPreferida: boolean;
  rutaVersion: number;
  reglaAutoSeleccionJson: unknown;
  ruta: {
    id: string;
    codigo: string;
    nombre: string;
    pasos: Array<RutaPaso>;
  };
  configPasos: Array<ConfigPasoDetalle>;
  /** G-F3: pasos extras inline de esta ruta (no de la ruta base reusable). */
  pasosExtras?: Array<PasoExtra>;
}

export interface RutaPaso {
  id: string;
  orden: number;
  familiaCodigo: string;
  icono?: string | null;
  activo: boolean;
}

export interface ConfigPasoDetalle {
  id: string;
  rutaPasoId: string;
  rutaPaso: RutaPaso;
  modoActivacion: string | null;
  condicionActivacionJson: unknown;
  modoTiempo: string | null;
  mecanismoCantidad: string | null;
  mecanismoCantidadConfigJson?: unknown;
  multiplicadoresActivos: string[];
  paramsPasoJson: unknown;
  nombreVisible?: string | null;
  maquinaM1: {
    id: string;
    codigo: string;
    nombre: string;
    plantilla: string;
    anchoUtil?: number | string | null;
    parametrosTecnicosJson?: Record<string, unknown> | null;
    perfilesOperativos?: Array<{
      id: string;
      nombre?: string;
      activo?: boolean;
      tipoPerfil?: string | null;
      detalleJson?: Record<string, unknown> | null;
    }>;
    centroCostoPrincipalId?: string | null;
    centroCostoPrincipal?: {
      id: string;
      codigo: string;
      nombre: string;
    } | null;
  } | null;
  perfilM1: {
    id: string;
    nombre: string;
    tipoPerfil?: string | null;
    detalleJson?: Record<string, unknown> | null;
  } | null;
  modoColorOptions?: Array<{
    value: string;
    label: string;
    perfilIds: string[];
  }>;
  centroCosto: {
    id: string;
    codigo: string;
    nombre: string;
    unidadBaseFutura: string;
  } | null;
  setupOverrideMin?: number | null;
  cleanupOverrideMin?: number | null;
  tiempoFijoOverrideMin?: number | null;
  slotsMateriales: Array<SlotMaterialDetalle>;
  /** G-F2: candidatas M-2; cuando length > 1 el cotizador muestra Select de override. */
  maquinasCandidatas?: Array<{
    id: string;
    maquinaId: string;
    perfilDefaultId?: string | null;
    modoColorAllowedModes?: string[];
    modoColorOptions?: Array<{
      value: string;
      label: string;
      perfilIds: string[];
    }>;
    esPreferida: boolean;
    orden: number;
    perfilDefault?: {
      id: string;
      nombre: string;
      tipoPerfil?: string | null;
      detalleJson?: Record<string, unknown> | null;
    } | null;
    maquina: {
      id: string;
      codigo: string;
      nombre: string;
      plantilla: string;
      anchoUtil?: number | string | null;
      parametrosTecnicosJson?: Record<string, unknown> | null;
      perfilesOperativos?: Array<{
        id: string;
        nombre?: string;
        activo?: boolean;
        tipoPerfil?: string | null;
        productivityValue?: number | string | null;
        productivityUnit?: string | null;
        detalleJson?: Record<string, unknown> | null;
      }>;
      centroCostoPrincipalId?: string | null;
      centroCostoPrincipal?: {
        id: string;
        codigo: string;
        nombre: string;
      } | null;
    };
  }>;
  cargosDirectosPaso: Array<CargoPasoDetalle>;
}

export interface SlotMaterialDetalle {
  id: string;
  slotCodigo: string;
  slotNombre: string | null;
  slotRol: string | null;
  modoSeleccion: string;
  criterioMotorAuto: string | null;
  estrategiaCosto: string;
  formula: string;
  cantidadFactor: string | number | null;
  cantidadBase: string | null;
  aplicaMultiCaras: boolean;
  materialVariante: {
    id: string;
    sku: string;
    nombreVariante: string | null;
    precioReferencia: string | null;
    atributosVarianteJson?: Record<string, unknown> | null;
    materiaPrima: {
      id: string;
      codigo: string;
      nombre: string;
      familia: string;
      subfamilia: string;
      templateId: string;
      variantes?: Array<{
        id: string;
        sku: string;
        nombreVariante: string | null;
        precioReferencia: string | null;
        atributosVarianteJson?: Record<string, unknown> | null;
      }>;
    };
  } | null;
  candidatos: Array<{
    id: string;
    materiaPrimaId: string;
    defaultVarianteId: string | null;
    orden: number;
    materiaPrima: {
      id: string;
      codigo: string;
      nombre: string;
      familia: string;
      subfamilia: string;
      templateId: string;
    };
    defaultVariante: {
      id: string;
      sku: string;
      nombreVariante: string | null;
      precioReferencia: string | null;
    } | null;
    variantes: Array<{
      variante: {
        id: string;
        sku: string;
        nombreVariante: string | null;
        precioReferencia: string | null;
        atributosVarianteJson?: Record<string, unknown> | null;
      };
    }>;
  }>;
}

export interface CargoPasoDetalle {
  id: string;
  modoActivacion: string;
  cargoDirectoCatalogo: CargoDirectoCatalogo;
}

export interface CargoCotizacionDetalle {
  id: string;
  modoActivacion: string;
  cargoDirectoCatalogo: CargoDirectoCatalogo;
}

export interface PasoExtra {
  id: string;
  rutaAlternativaId: string | null;
  insertarDespuesDeRutaPasoId: string | null;
  ordenInterno: number;
  familiaCodigo: string;
  nombreVisible: string | null;
  modoActivacion: string | null;
  condicionActivacionJson: unknown;
  modoTiempo: string | null;
  mecanismoCantidad: string | null;
  mecanismoCantidadConfigJson: unknown;
  multiplicadoresActivos: string[];
  paramsPasoJson: unknown;
  maquinaM1Id: string | null;
  perfilM1Id: string | null;
  centroCostoId: string | null;
  setupOverrideMin: string | null;
  cleanupOverrideMin: string | null;
  tiempoFijoOverrideMin: string | null;
  /** Sub-fase 3: config inline embebida (slots / candidatas / cargos). */
  configSlotsMaterialesJson?: unknown;
  configMaquinasCandidatasJson?: unknown;
  configCargosDirectosJson?: unknown;
  /** M-2: candidatas hidratadas por el detalle (mismo shape que configPasos). */
  maquinasCandidatas?: ConfigPasoDetalle["maquinasCandidatas"];
  /** G-F4: slots de material hidratados por el detalle (mismo shape que configPasos). */
  slotsMateriales?: ConfigPasoDetalle["slotsMateriales"];
  activo: boolean;
  maquinaM1?: {
    id: string;
    codigo: string;
    nombre: string;
    plantilla: string;
  } | null;
  perfilM1?: { id: string; nombre: string } | null;
  centroCosto?: {
    id: string;
    codigo: string;
    nombre: string;
    unidadBaseFutura?: string;
  } | null;
}

// ============================================================================
// RUTA
// ============================================================================

export interface RutaListItem {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  versionActual: number;
  activo: boolean;
  pasos: Array<{
    id: string;
    orden: number;
    familiaCodigo: string;
    icono?: string | null;
  }>;
  _count: { productosAlternativas: number };
}

// ============================================================================
// FAMILIA
// ============================================================================

export interface FamiliaListItem {
  codigo: string;
  nombre: string;
  categoria: string;
  descripcion?: string;
  visibleEnSelector?: boolean;
  relacionMaquinaSoportada: string[];
  modoActivacionDefault: string;
  modosTiempoSoportados: string[];
  mecanismosCantidadSoportados: string[];
  modosActivacionSoportados: string[];
  multiplicadoresSoportados: string[];
  permiteSlotsAdicionales: boolean;
  slotsRequeridos: Array<{
    codigo: string;
    nombre: string;
    tipo: string;
    requerido: boolean;
    compatibilidadMaterial?: {
      familiasMateriaPrima?: string[];
      subfamiliasMateriaPrima?: string[];
      templateIds?: string[];
      tipoTecnico?: string[];
    };
  }>;
  plantillasCompatibles: string[];
  inputsRequeridos: string[];
  outputsCanonicos: string[];
  validaciones: Array<{
    codigo: string;
    tipo: string;
    mensaje: string;
    [key: string]: unknown;
  }>;
  paramsPasoSchema: Array<{
    campo: string;
    etiqueta: string;
    tipo: string;
    valoresPermitidos?: string[];
    default?: unknown;
    requerido?: boolean;
    descripcion?: string;
  }>;
  productosTipicos?: string[];
}

export interface CategoriaFamilia {
  codigo: string;
  nombre: string;
  descripcion: string;
  orden: number;
}

export interface CatalogoFamilias {
  categorias: CategoriaFamilia[];
  familias: FamiliaListItem[];
}

// ============================================================================
// CARGO DIRECTO
// ============================================================================

export interface CargoDirectoCatalogo {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  modoCalculo: string;
  modosActivacionSoportados: string[];
  configJson: unknown;
  activo: boolean;
}
