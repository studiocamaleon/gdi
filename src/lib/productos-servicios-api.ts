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

export async function getCatalogoFamilias(): Promise<CatalogoFamilias> {
  return apiRequest<CatalogoFamilias>('/productos-servicios/familias');
}

export async function getCargosDirectosCatalogo(): Promise<CargoDirectoCatalogo[]> {
  return apiRequest<CargoDirectoCatalogo[]>('/productos-servicios/cargos-directos');
}

// ============================================================================
// MOTOR — invocación de cotización
// ============================================================================

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
      costoTotal: number;
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
