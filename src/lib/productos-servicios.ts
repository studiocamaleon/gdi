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
  unidadComercial: string;
  modoMedidas: string;
  activo: boolean;
  rutasAlternativas: Array<{
    id: string;
    nombre: string;
    esPreferida: boolean;
    ruta: { id: string; codigo: string; nombre: string };
  }>;
}

export interface ProductoDetalle extends Omit<ProductoListItem, "rutasAlternativas"> {
  medidaDefaultAnchoMm: string | null;
  medidaDefaultAltoMm: string | null;
  precioConfigJson: unknown;
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
  maquinaM1: { id: string; codigo: string; nombre: string; plantilla: string } | null;
  perfilM1: { id: string; nombre: string } | null;
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
    maquina: { id: string; codigo: string; nombre: string; plantilla: string };
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
  modosTiempoSoportados: string[];
  mecanismosCantidadSoportados: string[];
  modosActivacionSoportados: string[];
  slotsRequeridos: Array<{ codigo: string; nombre: string; tipo: string; requerido: boolean }>;
  plantillasCompatibles: string[];
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
