/**
 * Tipos del Modelo Universal V2 — espejo del schema Prisma para el frontend.
 *
 * Mantiene compatibilidad con el Tab Precio existente (UnidadComercialProducto,
 * MetodoCalculoPrecioProducto, etc.) que se usaba en el modelo viejo.
 */

export type UnidadComercialProducto = 'unidad' | 'm2' | 'metro_lineal';

export const unidadComercialProductoItems: Array<{
  value: UnidadComercialProducto;
  label: string;
}> = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'm2', label: 'Metro cuadrado (m²)' },
  { value: 'metro_lineal', label: 'Metro lineal' },
];

export type ModoMedidasProducto = 'FIJA' | 'LIBRE' | 'COMERCIAL_ELIGE';

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
  | 'margen_variable'
  | 'por_margen'
  | 'precio_fijo'
  | 'fijado_por_cantidad'
  | 'fijo_con_margen_variable'
  | 'variable_por_cantidad'
  | 'precio_fijo_para_margen_minimo';

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
  precioConfigJson: unknown;
  unidadComercial: string;
  modoMedidas: string;
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

export interface ProductoDetalle extends Omit<ProductoListItem, "rutasAlternativas"> {
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
}

export interface RutaPaso {
  id: string;
  orden: number;
  familiaCodigo: string;
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
  maquinaM1: {
    id: string;
    codigo: string;
    nombre: string;
    plantilla: string;
    parametrosTecnicosJson?: Record<string, unknown> | null;
    perfilesOperativos?: Array<{
      id: string;
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
    esPreferida: boolean;
    orden: number;
    maquina: {
      id: string;
      codigo: string;
      nombre: string;
      plantilla: string;
      perfilesOperativos?: Array<{
        id: string;
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
    };
  }>;
  cargosDirectosPaso: Array<CargoPasoDetalle>;
}

export interface SlotMaterialDetalle {
  id: string;
  slotCodigo: string;
  modoSeleccion: string;
  criterioMotorAuto: string | null;
  estrategiaCosto: string;
  formula: string;
  aplicaMultiCaras: boolean;
  materialVariante: {
    id: string;
    sku: string;
    nombreVariante: string | null;
    precioReferencia: string | null;
  } | null;
  materialesCandidatosJson: unknown;
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
  ordenInterno: number;
  familiaCodigo: string;
  modoActivacion: string | null;
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
  pasos: Array<{ id: string; orden: number; familiaCodigo: string }>;
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
  relacionMaquinaSoportada: string[];
  modoActivacionDefault: string;
  modosTiempoSoportados: string[];
  mecanismosCantidadSoportados: string[];
  modosActivacionSoportados: string[];
  multiplicadoresSoportados: string[];
  slotsRequeridos: Array<{ codigo: string; nombre: string; tipo: string; requerido: boolean }>;
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
