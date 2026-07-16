import { apiRequest } from "@/lib/api";
import type {
  Cobro,
  Comprobante,
  ComprobanteDetalle,
  ComprobanteItem,
  ComprobantePendiente,
  ComprobanteTipo,
  CondicionFiscalEmisor,
  ConfiguracionFiscal,
  CuentaCorriente,
  CuentaFondos,
  CuentaFondosResumen,
  LeyendaA,
  MetodoPago,
  MetodoPagoTipo,
  ModalidadPuntoVenta,
  MovimientoFondos,
  ProveedorFacturacion,
  PuntoVenta,
  TesoreriaKpis,
} from "@/lib/administracion";

// ── Configuración fiscal ───────────────────────────────────────────────

export type GuardarConfiguracionFiscalPayload = {
  razonSocial: string;
  cuit: string;
  condicionFiscal: CondicionFiscalEmisor;
  ingresosBrutos?: string;
  domicilioFiscal?: string;
  inicioActividades?: string;
  leyendaFacturaA?: LeyendaA | null;
  proveedorFacturacion?: ProveedorFacturacion;
};

/** null si el tenant todavía no configuró sus datos fiscales. */
export async function getConfiguracionFiscal(): Promise<ConfiguracionFiscal | null> {
  return apiRequest<ConfiguracionFiscal | null>(
    "/administracion/configuracion-fiscal",
  );
}

export async function guardarConfiguracionFiscal(
  payload: GuardarConfiguracionFiscalPayload,
): Promise<ConfiguracionFiscal> {
  return apiRequest("/administracion/configuracion-fiscal", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export type UpsertPuntoVentaPayload = {
  numero: number;
  nombre: string;
  modalidad?: ModalidadPuntoVenta;
  activo?: boolean;
};

export async function crearPuntoVenta(
  payload: UpsertPuntoVentaPayload,
): Promise<PuntoVenta> {
  return apiRequest("/administracion/puntos-venta", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function actualizarPuntoVenta(
  id: string,
  payload: UpsertPuntoVentaPayload,
): Promise<PuntoVenta> {
  return apiRequest(`/administracion/puntos-venta/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function eliminarPuntoVenta(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/administracion/puntos-venta/${id}`, {
    method: "DELETE",
  });
}

// ── Comprobantes ───────────────────────────────────────────────────────

export async function getComprobantes(params?: {
  estado?: string;
  tipo?: string;
  clienteId?: string;
  q?: string;
}): Promise<Comprobante[]> {
  const search = new URLSearchParams();
  if (params?.estado) search.set("estado", params.estado);
  if (params?.tipo) search.set("tipo", params.tipo);
  if (params?.clienteId) search.set("clienteId", params.clienteId);
  if (params?.q) search.set("q", params.q);
  const query = search.toString();
  return apiRequest(`/administracion/comprobantes${query ? `?${query}` : ""}`);
}

export async function getComprobante(id: string): Promise<ComprobanteDetalle> {
  return apiRequest(`/administracion/comprobantes/${id}`);
}

export type CrearComprobantePayload = {
  tipo: ComprobanteTipo;
  puntoVentaId: string;
  clienteId?: string;
  ordenId?: string;
  fecha?: string;
  items?: ComprobanteItem[];
  moneda?: "ARS" | "USD";
  cotizacion?: number;
  condicionVenta?: string;
  diasVencimiento?: number;
  comprobanteOrigenId?: string;
};

export async function crearComprobante(
  payload: CrearComprobantePayload,
): Promise<Comprobante> {
  return apiRequest("/administracion/comprobantes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function emitirComprobante(id: string): Promise<Comprobante> {
  return apiRequest(`/administracion/comprobantes/${id}/emitir`, {
    method: "POST",
  });
}

/** Provider manual: el CAE lo saca el usuario del portal de ARCA. */
export async function cargarCae(
  id: string,
  payload: { cae: string; caeVencimiento: string },
): Promise<Comprobante> {
  return apiRequest(`/administracion/comprobantes/${id}/cae`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function descartarComprobante(
  id: string,
): Promise<{ ok: boolean }> {
  return apiRequest(`/administracion/comprobantes/${id}`, { method: "DELETE" });
}

// ── Cuenta corriente ───────────────────────────────────────────────────

export async function getCuentaCorriente(
  clienteId: string,
): Promise<CuentaCorriente> {
  return apiRequest(`/administracion/clientes/${clienteId}/cuenta-corriente`);
}

// ── Imputaciones ───────────────────────────────────────────────────────

export async function getComprobantesPendientes(
  clienteId: string,
): Promise<ComprobantePendiente[]> {
  return apiRequest(
    `/administracion/clientes/${clienteId}/comprobantes-pendientes`,
  );
}

export async function imputarCobro(
  cobroId: string,
  payload: { comprobanteId: string; monto: number },
): Promise<{ id: string; cobroSinImputar: number }> {
  return apiRequest(`/administracion/cobros/${cobroId}/imputaciones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function quitarImputacion(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/administracion/imputaciones/${id}`, { method: "DELETE" });
}

export type UpsertMetodoPagoPayload = {
  nombre: string;
  tipo: MetodoPagoTipo;
  comisionPct: number;
  ivaComisionPct: number;
  plazoAcreditacionDias: number;
  sufreRetencion: boolean;
  cuentaDestinoId?: string | null;
  activo?: boolean;
};

export async function getMetodosPago(): Promise<MetodoPago[]> {
  return apiRequest<MetodoPago[]>("/administracion/metodos-pago");
}

export async function createMetodoPago(
  payload: UpsertMetodoPagoPayload,
): Promise<MetodoPago> {
  return apiRequest<MetodoPago>("/administracion/metodos-pago", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMetodoPago(
  id: string,
  payload: UpsertMetodoPagoPayload,
): Promise<MetodoPago> {
  return apiRequest<MetodoPago>(`/administracion/metodos-pago/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function toggleMetodoPago(id: string): Promise<MetodoPago> {
  return apiRequest<MetodoPago>(
    `/administracion/metodos-pago/${id}/toggle`,
    { method: "PATCH" },
  );
}

export async function instalarCatalogoMetodosPago(): Promise<{
  creados: number;
  total: number;
}> {
  return apiRequest("/administracion/metodos-pago/instalar-catalogo", {
    method: "POST",
  });
}

export async function getCuentasFondos(): Promise<CuentaFondosResumen[]> {
  return apiRequest<CuentaFondosResumen[]>("/administracion/cuentas");
}

// ── Tesorería ──────────────────────────────────────────────────────────

export async function getTesoreria(): Promise<{
  cuentas: CuentaFondos[];
  kpis: TesoreriaKpis;
}> {
  return apiRequest("/administracion/tesoreria");
}

export async function crearCuentaFondos(payload: {
  tipo: string;
  nombre: string;
  banco?: string;
  cbuAlias?: string;
  moneda?: string;
}): Promise<{ id: string }> {
  return apiRequest("/administracion/cuentas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMovimientosCuenta(
  cuentaId: string,
): Promise<MovimientoFondos[]> {
  return apiRequest(`/administracion/cuentas/${cuentaId}/movimientos`);
}

export async function transferirEntreCuentas(payload: {
  desdeCuentaId: string;
  haciaCuentaId: string;
  monto: number;
}): Promise<{ ok: boolean }> {
  return apiRequest("/administracion/cuentas/transferencias", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cerrarArqueo(
  cuentaId: string,
  contado: number,
): Promise<{ diferencia: number }> {
  return apiRequest(`/administracion/cuentas/${cuentaId}/arqueo`, {
    method: "POST",
    body: JSON.stringify({ contado }),
  });
}

// ── Cobros ─────────────────────────────────────────────────────────────

export type CrearCobroPayload = {
  ordenId?: string;
  clienteId?: string;
  fecha: string;
  metodoPagoId: string;
  cuentaDestinoId: string;
  montoBruto: number;
  comisionPctAplicada: number;
  retenciones?: Array<{
    regimen: string;
    jurisdiccion?: string;
    base: number;
    alicuota: number;
    monto: number;
    nroComprobante?: string;
  }>;
  valor?: {
    formato: "fisico" | "echeq";
    origen: "tercero" | "propio";
    numero: string;
    banco: string;
    fechaEmision?: string;
    fechaPago?: string;
  };
  notas?: string;
};

export async function getCobros(params?: {
  ordenId?: string;
}): Promise<Cobro[]> {
  const search = new URLSearchParams();
  if (params?.ordenId) search.set("ordenId", params.ordenId);
  const query = search.toString();
  return apiRequest(`/administracion/cobros${query ? `?${query}` : ""}`);
}

export async function crearCobro(payload: CrearCobroPayload): Promise<Cobro> {
  return apiRequest("/administracion/cobros", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function acreditarCobro(id: string): Promise<Cobro> {
  return apiRequest(`/administracion/cobros/${id}/acreditar`, {
    method: "POST",
  });
}
