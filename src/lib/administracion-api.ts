import { apiRequest } from "@/lib/api";
import type {
  Cobro,
  CobroPendienteAcreditacion,
  Comprobante,
  ComprobanteDetalle,
  ComprobanteItem,
  ComprobantePendiente,
  ComprobanteTipo,
  CondicionFiscalEmisor,
  FacturaDocumento,
  ConfiguracionFiscal,
  CuentaCorriente,
  FilaDeudor,
  CuentaFondos,
  CuentaFondosResumen,
  LeyendaA,
  MetodoPago,
  MetodoPagoTipo,
  ModalidadPuntoVenta,
  MovimientosFondosPagina,
  OrdenFacturable,
  ProveedorFacturacion,
  PuntoVenta,
  ResultadoLoteFacturacion,
  TesoreriaKpis,
  ValorTesoreria,
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
  ordenId?: string;
  q?: string;
}): Promise<Comprobante[]> {
  const search = new URLSearchParams();
  if (params?.estado) search.set("estado", params.estado);
  if (params?.tipo) search.set("tipo", params.tipo);
  if (params?.clienteId) search.set("clienteId", params.clienteId);
  if (params?.ordenId) search.set("ordenId", params.ordenId);
  if (params?.q) search.set("q", params.q);
  const query = search.toString();
  return apiRequest(`/administracion/comprobantes${query ? `?${query}` : ""}`);
}

// ── Facturación sobre órdenes ──────────────────────────────────────────

export async function getFacturacionPendientes(): Promise<OrdenFacturable[]> {
  return apiRequest(`/administracion/facturacion/pendientes`);
}

export async function facturarOrden(
  ordenId: string,
  payload: { monto?: number; concepto?: string; puntoVentaId?: string },
): Promise<Comprobante> {
  return apiRequest(`/administracion/ordenes/${ordenId}/facturar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Nota de crédito contra una factura de la orden. Es la forma de deshacer lo
 * fiscal —ARCA no anula, se corrige con otro comprobante— y lo que después
 * permite cancelar la orden.
 */
export async function notaCreditoOrden(
  ordenId: string,
  payload: { comprobanteOrigenId: string; motivo: string; monto?: number },
): Promise<Comprobante> {
  return apiRequest(`/administracion/ordenes/${ordenId}/nota-credito`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function facturarLote(payload: {
  ordenIds: string[];
  modo: "por_orden" | "agrupada";
  puntoVentaId?: string;
}): Promise<ResultadoLoteFacturacion> {
  return apiRequest(`/administracion/facturacion/lote`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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

/** El comprobante impreso, con todo lo que la ley exige que figure. */
export async function getFactura(id: string): Promise<FacturaDocumento> {
  return apiRequest(`/administracion/comprobantes/${id}/factura`);
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

/** Matriz de aging por cliente. Sólo trae clientes con saldo. */
export async function getDeudores(): Promise<FilaDeudor[]> {
  return apiRequest("/administracion/deudores");
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
  return apiRequest<MetodoPago>(`/administracion/metodos-pago/${id}/toggle`, {
    method: "PATCH",
  });
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
  monedaLocal: string;
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
  saldoInicial?: number;
  permiteSaldoNegativo?: boolean;
}): Promise<{ id: string }> {
  return apiRequest("/administracion/cuentas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMovimientosCuenta(
  cuentaId: string,
  filtros?: {
    page?: number;
    pageSize?: number;
    q?: string;
    origenTipo?: string;
    estadoConciliacion?: string;
    desde?: string;
    hasta?: string;
  },
): Promise<MovimientosFondosPagina> {
  const query = new URLSearchParams();
  if (filtros?.page) query.set("page", String(filtros.page));
  if (filtros?.pageSize) query.set("pageSize", String(filtros.pageSize));
  if (filtros?.q) query.set("q", filtros.q);
  if (filtros?.origenTipo) query.set("origenTipo", filtros.origenTipo);
  if (filtros?.estadoConciliacion)
    query.set("estadoConciliacion", filtros.estadoConciliacion);
  if (filtros?.desde) query.set("desde", filtros.desde);
  if (filtros?.hasta) query.set("hasta", filtros.hasta);
  const suffix = query.size ? `?${query.toString()}` : "";
  return apiRequest(`/administracion/cuentas/${cuentaId}/movimientos${suffix}`);
}

export async function editarCuentaFondos(
  cuentaId: string,
  payload: {
    tipo?: string;
    nombre?: string;
    banco?: string;
    cbuAlias?: string;
    moneda?: string;
    permiteSaldoNegativo?: boolean;
    activo?: boolean;
  },
): Promise<{ id: string }> {
  return apiRequest(`/administracion/cuentas/${cuentaId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function ajustarCuentaFondos(
  cuentaId: string,
  payload: {
    tipo: "entrada" | "salida";
    monto: number;
    fecha: string;
    concepto: string;
    idempotencyKey?: string;
    referencia?: string;
    notas?: string;
  },
): Promise<{ ok: boolean; id: string }> {
  return apiRequest(`/administracion/cuentas/${cuentaId}/ajustes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function conciliarMovimientoFondos(
  cuentaId: string,
  movimientoId: string,
  payload: {
    estado: "pendiente" | "conciliado" | "diferencia";
    notas?: string;
  },
): Promise<{ ok: boolean }> {
  return apiRequest(
    `/administracion/cuentas/${cuentaId}/movimientos/${movimientoId}/conciliacion`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export async function transferirEntreCuentas(payload: {
  desdeCuentaId: string;
  haciaCuentaId: string;
  /** En la moneda de la cuenta de ORIGEN. */
  monto: number;
  /** Obligatorio entre monedas distintas: lo que llegó, en la del DESTINO. */
  montoDestino?: number;
  idempotencyKey?: string;
  referencia?: string;
  notas?: string;
}): Promise<{ ok: boolean }> {
  return apiRequest("/administracion/cuentas/transferencias", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cerrarArqueo(
  cuentaId: string,
  contado: number,
  opciones?: { idempotencyKey?: string; notas?: string },
): Promise<{ diferencia: number }> {
  return apiRequest(`/administracion/cuentas/${cuentaId}/arqueo`, {
    method: "POST",
    body: JSON.stringify({ contado, ...opciones }),
  });
}

export async function getValoresTesoreria(): Promise<ValorTesoreria[]> {
  return apiRequest("/administracion/valores");
}

export async function depositarValor(
  id: string,
  payload: { cuentaDestinoId: string; fecha: string; notas?: string },
): Promise<{ ok: boolean }> {
  return apiRequest(`/administracion/valores/${id}/depositar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function acreditarValor(
  id: string,
  payload: {
    fecha?: string;
    idempotencyKey?: string;
    referencia?: string;
    notas?: string;
  },
): Promise<{ ok: boolean }> {
  return apiRequest(`/administracion/valores/${id}/acreditar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revertirDepositoValor(
  id: string,
  payload: { motivo: string; fecha?: string },
): Promise<{ ok: boolean }> {
  return apiRequest(`/administracion/valores/${id}/revertir-deposito`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revertirAcreditacionValor(
  id: string,
  payload: { motivo: string; fecha?: string; idempotencyKey?: string },
): Promise<{ ok: boolean }> {
  return apiRequest(`/administracion/valores/${id}/revertir-acreditacion`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function rechazarValor(
  id: string,
  payload: { motivo: string; fecha?: string; idempotencyKey?: string },
): Promise<{ ok: boolean }> {
  return apiRequest(`/administracion/valores/${id}/rechazar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function anularCobro(
  id: string,
  payload: { motivo: string; idempotencyKey?: string },
): Promise<{ ok: boolean }> {
  return apiRequest(`/administracion/cobros/${id}`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

// ── Cobros ─────────────────────────────────────────────────────────────

export type CrearCobroPayload = {
  idempotencyKey?: string;
  ordenId?: string;
  clienteId?: string;
  fecha: string;
  metodoPagoId: string;
  /** Se omite para cheques/eCheq hasta que Tesorería registre el depósito. */
  cuentaDestinoId?: string | null;
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
    modalidad?: "comun" | "diferido";
    origen: "tercero" | "propio";
    numero: string;
    banco: string;
    identificadorBancario?: string;
    fechaEmision?: string;
    fechaPago?: string;
  };
  /** "N° de operación" del medio de pago; sale impreso en el recibo. */
  referencia?: string;
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

/**
 * El PDF del recibo de un cobro (endpoint privado, redirige a URL firmada).
 * El del CLIENTE es otro: sale del link público `/c/<token>`.
 */
export function reciboPdfUrl(cobroId: string): string {
  return `/api/backend/administracion/cobros/${cobroId}/recibo/pdf`;
}

/** El link `/c/<token>` para compartirle el recibo al cliente. */
export async function getReciboEnlace(
  cobroId: string,
): Promise<{ url: string | null }> {
  return apiRequest(`/administracion/cobros/${cobroId}/recibo/enlace`);
}

export async function getCobrosPendientesAcreditacion(): Promise<
  CobroPendienteAcreditacion[]
> {
  return apiRequest("/administracion/cobros/pendientes-acreditacion");
}

export async function acreditarCobro(id: string): Promise<Cobro> {
  return apiRequest(`/administracion/cobros/${id}/acreditar`, {
    method: "POST",
  });
}

/** El gate del botón Facturar: ¿está activa la facturación electrónica (AFIP)? */
export async function getFacturacionHabilitada(): Promise<boolean> {
  const r = await apiRequest<{ habilitada: boolean }>(
    "/administracion/facturacion/estado",
  );
  return r.habilitada;
}
