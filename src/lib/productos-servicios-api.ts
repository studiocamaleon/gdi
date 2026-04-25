/**
 * Cliente API del módulo Productos & Servicios — Modelo Universal V2.
 *
 * Endpoints respaldados por `apps/api/src/productos-servicios/productos-servicios.controller.ts`.
 */

import { apiRequest } from '@/lib/api';
import type {
  CargoDirectoCatalogo,
  CatalogoFamilias,
  ProductoDetalle,
  ProductoListItem,
  RutaListItem,
} from '@/lib/productos-servicios';

export async function getProductos(activo?: boolean): Promise<ProductoListItem[]> {
  const qs = activo === undefined ? '' : `?activo=${activo}`;
  return apiRequest<ProductoListItem[]>(`/productos-servicios/productos${qs}`);
}

export async function getProductoById(id: string): Promise<ProductoDetalle> {
  return apiRequest<ProductoDetalle>(`/productos-servicios/productos/${id}`);
}

export interface ValidacionProducto {
  exitoso: boolean;
  errores: Array<{
    severidad: 'ERROR' | 'WARNING';
    codigo: string;
    mensaje: string;
    ubicacion?: { rutaAltId?: string; rutaPasoId?: string; slotCodigo?: string };
  }>;
}

export async function validarProducto(id: string): Promise<ValidacionProducto> {
  return apiRequest<ValidacionProducto>(`/productos-servicios/productos/${id}/validar`);
}

export interface CrearProductoPayload {
  codigo: string;
  nombre: string;
  descripcion?: string;
  unidadComercial: 'unidad' | 'm2' | 'metro_lineal';
  modoMedidas: 'FIJA' | 'LIBRE' | 'COMERCIAL_ELIGE';
  medidaDefaultAnchoMm?: number;
  medidaDefaultAltoMm?: number;
  precioConfigJson?: Record<string, unknown>;
}

export async function crearProducto(payload: CrearProductoPayload) {
  return apiRequest('/productos-servicios/productos', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface ActualizarProductoPayload {
  nombre?: string;
  descripcion?: string;
  unidadComercial?: 'unidad' | 'm2' | 'metro_lineal';
  modoMedidas?: 'FIJA' | 'LIBRE' | 'COMERCIAL_ELIGE';
  medidaDefaultAnchoMm?: number | null;
  medidaDefaultAltoMm?: number | null;
  precioConfigJson?: Record<string, unknown>;
  activo?: boolean;
}

export async function actualizarProducto(id: string, payload: ActualizarProductoPayload) {
  return apiRequest(`/productos-servicios/productos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function eliminarProducto(id: string) {
  return apiRequest(`/productos-servicios/productos/${id}`, {
    method: 'DELETE',
  });
}

export async function getRutas(): Promise<RutaListItem[]> {
  return apiRequest<RutaListItem[]>('/productos-servicios/rutas');
}

export async function getRutaById(id: string) {
  return apiRequest(`/productos-servicios/rutas/${id}`);
}

export interface PasoRutaPayload {
  orden: number;
  familiaCodigo: string;
}

export interface CrearRutaPayload {
  codigo: string;
  nombre: string;
  descripcion?: string;
  pasos: PasoRutaPayload[];
}

export async function crearRuta(payload: CrearRutaPayload) {
  return apiRequest('/productos-servicios/rutas', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface ActualizarRutaPayload {
  nombre?: string;
  descripcion?: string;
  activo?: boolean;
  pasos?: PasoRutaPayload[];
  nuevaVersion?: boolean;
  cambios?: string;
}

export async function actualizarRuta(id: string, payload: ActualizarRutaPayload) {
  return apiRequest(`/productos-servicios/rutas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function eliminarRuta(id: string) {
  return apiRequest(`/productos-servicios/rutas/${id}`, { method: 'DELETE' });
}

// ============================================================================
// PRODUCTO ↔ RUTAS ALTERNATIVAS
// ============================================================================

export interface CrearProductoRutaAltPayload {
  rutaId: string;
  rutaVersion: number;
  nombre: string;
  esPreferida?: boolean;
  reglaAutoSeleccionJson?: Record<string, unknown>;
  orden?: number;
}

export async function crearProductoRutaAlt(productoId: string, payload: CrearProductoRutaAltPayload) {
  return apiRequest(`/productos-servicios/productos/${productoId}/rutas-alternativas`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface ActualizarProductoRutaAltPayload {
  nombre?: string;
  esPreferida?: boolean;
  reglaAutoSeleccionJson?: Record<string, unknown>;
  orden?: number;
  activo?: boolean;
}

export async function actualizarProductoRutaAlt(
  rutaAltId: string,
  payload: ActualizarProductoRutaAltPayload,
) {
  return apiRequest(`/productos-servicios/productos/rutas-alternativas/${rutaAltId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function eliminarProductoRutaAlt(rutaAltId: string) {
  return apiRequest(`/productos-servicios/productos/rutas-alternativas/${rutaAltId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// CONFIG PASO (upsert)
// ============================================================================

export interface UpsertSlotMaterialPayload {
  slotCodigo: string;
  modoSeleccion: 'HARDCODED' | 'COMERCIAL_ELIGE' | 'MOTOR_ELIGE_AUTO';
  criterioMotorAuto?: string | null;
  criterioInputCampo?: string | null;
  criterioMaterialCampo?: string | null;
  materialVarianteId?: string | null;
  materialesCandidatosJson?: Array<Record<string, unknown>>;
  estrategiaCosto?: string;
  formula?: string;
  aplicaMultiCaras?: boolean;
}

export interface UpsertConfigPasoPayload {
  rutaPasoId: string;
  modoActivacion?: string | null;
  condicionActivacionJson?: Record<string, unknown> | null;
  modoTiempo?: string | null;
  mecanismoCantidad?: string | null;
  mecanismoCantidadConfigJson?: Record<string, unknown> | null;
  multiplicadoresActivos?: string[];
  paramsPasoJson?: Record<string, unknown> | null;
  maquinaM1Id?: string | null;
  perfilM1Id?: string | null;
  setupOverrideMin?: number | null;
  cleanupOverrideMin?: number | null;
  tiempoFijoOverrideMin?: number | null;
  slotsMateriales?: UpsertSlotMaterialPayload[];
}

export async function upsertConfigPaso(rutaAltId: string, payload: UpsertConfigPasoPayload) {
  return apiRequest(`/productos-servicios/productos/rutas-alternativas/${rutaAltId}/config-pasos`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getCatalogoFamilias(): Promise<CatalogoFamilias> {
  return apiRequest<CatalogoFamilias>('/productos-servicios/familias');
}

export async function getCargosDirectosCatalogo(soloActivos = true): Promise<CargoDirectoCatalogo[]> {
  const qs = soloActivos ? '' : '?soloActivos=false';
  return apiRequest<CargoDirectoCatalogo[]>(`/productos-servicios/cargos-directos${qs}`);
}

export interface CrearCargoDirectoPayload {
  codigo: string;
  nombre: string;
  descripcion?: string;
  modoCalculo: 'MONTO_FIJO_PLANO' | 'PORCENTAJE_SOBRE_BASE' | 'POR_UNIDAD_INPUT';
  modosActivacionSoportados?: string[];
  configJson?: Record<string, unknown>;
}

export async function crearCargoDirecto(payload: CrearCargoDirectoPayload) {
  return apiRequest('/productos-servicios/cargos-directos', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface ActualizarCargoDirectoPayload {
  nombre?: string;
  descripcion?: string;
  modoCalculo?: 'MONTO_FIJO_PLANO' | 'PORCENTAJE_SOBRE_BASE' | 'POR_UNIDAD_INPUT';
  modosActivacionSoportados?: string[];
  configJson?: Record<string, unknown>;
  activo?: boolean;
}

export async function actualizarCargoDirecto(id: string, payload: ActualizarCargoDirectoPayload) {
  return apiRequest(`/productos-servicios/cargos-directos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function eliminarCargoDirecto(id: string) {
  return apiRequest(`/productos-servicios/cargos-directos/${id}`, { method: 'DELETE' });
}

// === Asociación cargos ↔ producto/paso (F.3.10) ===

export interface AsociarCargoCotizacionPayload {
  cargoDirectoCatalogoId: string;
  modoActivacion: 'OBLIGATORIO' | 'OPCIONAL' | 'CONDICIONAL';
  condicionActivacionJson?: Record<string, unknown>;
  configOverrideJson?: Record<string, unknown>;
}

export async function asociarCargoCotizacion(
  productoId: string,
  payload: AsociarCargoCotizacionPayload,
) {
  return apiRequest(`/productos-servicios/productos/${productoId}/cargos-cotizacion`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function desasociarCargoCotizacion(asociacionId: string) {
  return apiRequest(`/productos-servicios/productos/cargos-cotizacion/${asociacionId}`, {
    method: 'DELETE',
  });
}

export interface AsociarCargoPasoPayload {
  cargoDirectoCatalogoId: string;
  modoActivacion: 'OBLIGATORIO' | 'OPCIONAL' | 'CONDICIONAL';
  condicionActivacionJson?: Record<string, unknown>;
  configOverrideJson?: Record<string, unknown>;
}

export async function asociarCargoPaso(configPasoId: string, payload: AsociarCargoPasoPayload) {
  return apiRequest(`/productos-servicios/productos/config-pasos/${configPasoId}/cargos`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function desasociarCargoPaso(asociacionId: string) {
  return apiRequest(`/productos-servicios/productos/config-pasos/cargos/${asociacionId}`, {
    method: 'DELETE',
  });
}

// === G-F3: Pasos extras inline ===

export interface AgregarPasoExtraPayload {
  familiaCodigo: string;
  insertarDespuesDeRutaPasoId?: string | null;
  ordenInterno?: number;
  modoActivacion?: 'OBLIGATORIO' | 'OPCIONAL' | 'CONDICIONAL';
  modoTiempo?: 'T-1' | 'T-2' | 'T-3' | 'T-4';
  mecanismoCantidad?: 'DIRECT_FROM_JOBCONTEXT' | 'CONVERSION';
  paramsPasoJson?: Record<string, unknown>;
  maquinaM1Id?: string;
  perfilM1Id?: string;
}

export async function agregarPasoExtra(productoId: string, payload: AgregarPasoExtraPayload) {
  return apiRequest(`/productos-servicios/productos/${productoId}/pasos-extras`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function eliminarPasoExtra(pasoExtraId: string) {
  return apiRequest(`/productos-servicios/productos/pasos-extras/${pasoExtraId}`, {
    method: 'DELETE',
  });
}

export interface LookupsConfigPaso {
  maquinas: Array<{
    id: string;
    codigo: string;
    nombre: string;
    plantilla: string;
    perfilesOperativos: Array<{
      id: string;
      nombre: string;
      productivityValue: string | null;
      productivityUnit: string | null;
    }>;
  }>;
  materiasPrimas: Array<{
    id: string;
    codigo: string;
    nombre: string;
    familia: string;
    subfamilia: string;
    variantes: Array<{
      id: string;
      sku: string;
      nombreVariante: string | null;
      precioReferencia: string | null;
    }>;
  }>;
}

export async function getLookupsConfigPaso(): Promise<LookupsConfigPaso> {
  return apiRequest<LookupsConfigPaso>('/productos-servicios/lookups-config-paso');
}

// ============================================================================
// MOTOR — invocación de cotización
// ============================================================================

/**
 * Input compartido del NestingViewer (G-M1).
 *
 * Replica el shape `NestingEjecutado` del backend
 * (`apps/api/src/motor-universal/tipos.ts`) para que el frontend lo consuma sin
 * duplicar lógica. Cualquier algoritmo soportado (shelf-rollo, grid-2d-single,
 * grid-2d-multi) produce este mismo shape, lo que permite que `<NestingViewer>`
 * sea único para todos.
 */
export interface NestingViewerInput {
  algorithm: 'shelf-rollo' | 'grid-2d-single' | 'grid-2d-multi';
  cantidadCalculada: number;
  unidad: 'm_lineales' | 'pliegos' | 'm2' | 'piezas';
  aprovechamientoPct: number;
  substrates: Array<
    | { kind: 'sheet'; count: number; widthMm: number; heightMm: number }
    | { kind: 'roll'; lengthMm: number; widthMm: number }
  >;
  placements: Array<{
    pieceId: string;
    substrateIndex?: number;
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    rotated: boolean;
    panelIndex?: number;
    panelCount?: number;
    panelAxis?: 'vertical' | 'horizontal';
    usefulWidthMm?: number;
    usefulHeightMm?: number;
    overlapStartMm?: number;
    overlapEndMm?: number;
    meta?: unknown;
  }>;
  piezasPorPliego?: number;
  consumedLengthMm?: number;
  piezasAcomodadas: number;
}

export interface CotizarRequest {
  productoId: string;
  rutaAlternativaId?: string | null;
  jobContext: {
    cantidad: number;
    caras?: 1 | 2;
    tipoCopia?: 1 | 2 | 3;
    numerosXTalonario?: number;
    piezas?: Array<{ cantidad: number; anchoMm: number; altoMm: number }>;
    medidaCustomMm?: { anchoMm: number; altoMm: number };
    tecnologia?: string;
    tintasAdicionales?: string[];
    distanciaKm?: number;
    m2_instalados?: number;
    zonaInstalacion?: string;
    opcionalesActivados?: Record<string, boolean>;
    [key: string]: unknown;
  };
  clienteId?: string | null;
  periodo?: string | null;
}

export interface CotizarResponse {
  exitoso: boolean;
  errores: Array<{
    codigo: string;
    severidad: string;
    mensaje: string;
    rutaPasoId?: string;
    contexto?: Record<string, unknown>;
  }>;
  cotizacion?: {
    productoId: string;
    productoNombre: string;
    rutaNombre: string;
    cantidadEfectiva: number;
    cantidadPedida: number;
    costos: {
      tiempoTotal: number;
      materialesTotal: number;
      cargosDirectosTotal: number;
      total: number;
      unitario: number;
    };
    precio?: {
      precioUnitario: number;
      precioTotal: number;
      margenAplicadoPct?: number;
      margenNegativo: boolean;
      mensaje?: string;
    };
    pasos: Array<{
      rutaPasoOrden: number;
      familiaCodigo: string;
      activado: boolean;
      razonNoActivado?: string;
      tiempo?: { totalMin: number; tarifaHora: number; costo: number };
      materiales?: Array<{ materialNombre: string; cantidad: number; costoTotal: number }>;
      cargosDirectosPaso?: Array<{
        cargoCodigo: string;
        cargoNombre: string;
        monto: number;
        modoCalculo: string;
      }>;
      costoTotal: number;
      /** G-M1 — Resultado del nesting cuando el paso lo invoca. */
      nestingResult?: NestingViewerInput;
    }>;
    cargosDirectosCotizacion: Array<{
      cargoCodigo: string;
      cargoNombre: string;
      monto: number;
    }>;
  };
}

export async function cotizar(req: CotizarRequest): Promise<CotizarResponse> {
  return apiRequest<CotizarResponse>('/motor-universal/cotizar', {
    method: 'POST',
    body: JSON.stringify(req),
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface CotizarYGuardarResponse {
  result: CotizarResponse;
  cotizacionId?: string;
  cotizacionItemId?: string;
}

export async function cotizarYGuardar(
  req: CotizarRequest & { cotizacionId?: string },
): Promise<CotizarYGuardarResponse> {
  return apiRequest<CotizarYGuardarResponse>('/motor-universal/cotizar-y-guardar', {
    method: 'POST',
    body: JSON.stringify(req),
    headers: { 'Content-Type': 'application/json' },
  });
}
