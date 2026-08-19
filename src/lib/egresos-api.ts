import { apiRequest } from "@/lib/api";
import type {
  CategoriaEgreso,
  Egreso,
  GastoRecurrente,
  PresupuestadoVsReal,
  NaturalezaEgreso,
  PagoDeEgreso,
  ReporteEgresos,
  ResumenEgresos,
  SaldoProveedor,
} from "@/lib/egresos";

// ── Categorías ─────────────────────────────────────────────────────────

export async function getCategoriasEgreso(): Promise<CategoriaEgreso[]> {
  return apiRequest<CategoriaEgreso[]>("/egresos/categorias");
}

export async function crearCategoriaEgreso(body: {
  nombre: string;
  naturaleza: NaturalezaEgreso;
}): Promise<CategoriaEgreso> {
  return apiRequest<CategoriaEgreso>("/egresos/categorias", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export async function editarCategoriaEgreso(
  id: string,
  body: { nombre?: string; activo?: boolean; orden?: number },
): Promise<CategoriaEgreso> {
  return apiRequest<CategoriaEgreso>(`/egresos/categorias/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ── Egresos ────────────────────────────────────────────────────────────

export type FiltrosEgresos = {
  estado?: string;
  categoriaId?: string;
  proveedorId?: string;
  desde?: string;
  hasta?: string;
  /** 'competencia' (default) | 'vencimiento'. */
  eje?: string;
  /** true = sólo Cuentas por pagar (con vencimiento e impagos). */
  soloPendientes?: boolean;
  texto?: string;
};

export async function getEgresos(
  filtros: FiltrosEgresos = {},
): Promise<{ egresos: Egreso[] }> {
  const q = new URLSearchParams();
  if (filtros.estado) q.set("estado", filtros.estado);
  if (filtros.categoriaId) q.set("categoriaId", filtros.categoriaId);
  if (filtros.proveedorId) q.set("proveedorId", filtros.proveedorId);
  if (filtros.desde) q.set("desde", filtros.desde);
  if (filtros.hasta) q.set("hasta", filtros.hasta);
  if (filtros.eje) q.set("eje", filtros.eje);
  if (filtros.soloPendientes) q.set("soloPendientes", "true");
  if (filtros.texto) q.set("texto", filtros.texto);
  const query = q.toString();
  return apiRequest<{ egresos: Egreso[] }>(
    `/egresos${query ? `?${query}` : ""}`,
  );
}

export async function getResumenEgresos(): Promise<ResumenEgresos> {
  return apiRequest<ResumenEgresos>("/egresos/resumen");
}

/** "¿En qué se me va la plata?" — agrupado por COMPETENCIA. */
export async function getReporteEgresos(rango?: {
  desde?: string;
  hasta?: string;
}): Promise<ReporteEgresos> {
  const q = new URLSearchParams();
  if (rango?.desde) q.set("desde", rango.desde);
  if (rango?.hasta) q.set("hasta", rango.hasta);
  const query = q.toString();
  return apiRequest<ReporteEgresos>(
    `/egresos/reporte${query ? `?${query}` : ""}`,
  );
}

/** Saldo por proveedor con antigüedad (journey E2). */
export async function getSaldosProveedores(): Promise<{
  proveedores: SaldoProveedor[];
  total: number;
}> {
  return apiRequest<{ proveedores: SaldoProveedor[]; total: number }>(
    "/egresos/proveedores",
  );
}

// ── Gastos recurrentes (F3) ────────────────────────────────────────────

export async function getRecurrentes(): Promise<{
  recurrentes: GastoRecurrente[];
}> {
  return apiRequest<{ recurrentes: GastoRecurrente[] }>("/egresos/recurrentes");
}

export async function crearRecurrente(body: {
  descripcion: string;
  categoriaEgresoId: string;
  proveedorId?: string;
  monto: number;
  metodoPagoId?: string;
  frecuencia?: string;
  diaVencimiento?: number;
  vigenteDesde: string;
  vigenteHasta?: string;
  gastoFijoEstructuraId?: string | null;
}): Promise<GastoRecurrente> {
  return apiRequest<GastoRecurrente>("/egresos/recurrentes", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export async function editarRecurrente(
  id: string,
  body: {
    descripcion?: string;
    monto?: number;
    diaVencimiento?: number;
    vigenteHasta?: string;
    activo?: boolean;
    gastoFijoEstructuraId?: string | null;
  },
): Promise<GastoRecurrente> {
  return apiRequest<GastoRecurrente>(`/egresos/recurrentes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export async function borrarRecurrente(
  id: string,
): Promise<{ ok: boolean; desactivada: boolean }> {
  return apiRequest<{ ok: boolean; desactivada: boolean }>(
    `/egresos/recurrentes/${id}`,
    { method: "DELETE" },
  );
}

/** Emitir a mano lo pendiente, sin esperar al cron de la madrugada. */
export async function generarRecurrentes(): Promise<{ emitidos: number }> {
  return apiRequest<{ emitidos: number }>("/egresos/recurrentes/generar", {
    method: "POST",
  });
}

/** Presupuestado vs. real de la estructura (journey E4). */
export async function getPresupuestadoVsReal(
  periodo?: string,
): Promise<PresupuestadoVsReal> {
  const q = periodo ? `?periodo=${periodo}` : "";
  return apiRequest<PresupuestadoVsReal>(`/egresos/presupuestado${q}`);
}

export type CrearEgresoBody = {
  descripcion: string;
  categoriaEgresoId: string;
  proveedorId?: string;
  beneficiarioNombre?: string;
  fechaCompetencia?: string;
  /** Ausente = contado, y entonces `pago` es obligatorio. */
  fechaVencimiento?: string;
  neto: number;
  iva?: number;
  otrosImpuestos?: number;
  tipoComprobante?: string;
  puntoVenta?: string;
  numeroComprobante?: string;
  centroCostoId?: string;
  empleadoId?: string;
  notas?: string;
  /** N cuotas = N egresos hermanados, uno por vencimiento mensual. */
  cuotas?: number;
  /** Presente = el egreso nace pagado (switch "ya está pagado"). */
  pago?: {
    metodoPagoId: string;
    cuentaOrigenId: string;
    fecha?: string;
    referencia?: string;
  };
};

export async function crearEgreso(
  body: CrearEgresoBody,
): Promise<{ id: string; numero: string }> {
  return apiRequest<{ id: string; numero: string }>("/egresos", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export type EditarEgresoBody = {
  descripcion?: string;
  categoriaEgresoId?: string;
  fechaCompetencia?: string;
  fechaVencimiento?: string;
  neto?: number;
  iva?: number;
  otrosImpuestos?: number;
  centroCostoId?: string;
  notas?: string;
};

export async function editarEgreso(
  id: string,
  body: EditarEgresoBody,
): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/egresos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export async function anularEgreso(
  id: string,
  motivo: string,
): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/egresos/${id}/anular`, {
    method: "PATCH",
    body: JSON.stringify({ motivo }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function getPagosDeEgreso(
  id: string,
): Promise<{ pagos: PagoDeEgreso[] }> {
  return apiRequest<{ pagos: PagoDeEgreso[] }>(`/egresos/${id}/pagos`);
}

// ── Pagos ──────────────────────────────────────────────────────────────

export async function registrarPagoEgresos(body: {
  idempotencyKey?: string;
  metodoPagoId: string;
  cuentaOrigenId?: string;
  fecha?: string;
  referencia?: string;
  notas?: string;
  imputaciones: Array<{ egresoId: string; monto: number }>;
  /** Reducen lo que sale sin reducir lo que se salda. */
  retenciones?: Array<{
    regimen: string;
    jurisdiccion?: string;
    base: number;
    alicuota: number;
    monto: number;
    nroComprobante?: string;
  }>;
  /** Cheque PROPIO que se emite. Con método cheque va esto o `valorId`. */
  cheque?: {
    numero: string;
    banco: string;
    formato: string;
    modalidad?: "comun" | "diferido";
    identificadorBancario?: string;
    fechaEmision?: string;
    fechaPago?: string;
  };
  /** Cheque DE TERCERO que se endosa, elegido de la cartera. */
  valorId?: string;
}): Promise<{
  id: string;
  numero: string;
  montoBruto: number;
  retencionesTotal: number;
  montoNeto: number;
  /** El cheque quedó en cartera: la plata todavía no salió. */
  enCartera: boolean;
}> {
  return apiRequest<{
    id: string;
    numero: string;
    montoBruto: number;
    retencionesTotal: number;
    montoNeto: number;
    enCartera: boolean;
  }>("/egresos/pagos", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export async function anularPagoEgreso(
  id: string,
  motivo: string,
): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/egresos/pagos/${id}/anular`, {
    method: "PATCH",
    body: JSON.stringify({ motivo }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function debitarValorPropio(
  id: string,
  payload: {
    fecha?: string;
    idempotencyKey?: string;
    referencia?: string;
    notas?: string;
  },
): Promise<{ ok: boolean }> {
  return apiRequest(`/egresos/valores/${id}/debitar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function rechazarValorPropio(
  id: string,
  payload: {
    motivo: string;
    fecha?: string;
    idempotencyKey?: string;
  },
): Promise<{ ok: boolean }> {
  return apiRequest(`/egresos/valores/${id}/rechazar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Un cheque de tercero en cartera, disponible para endosar. */
export type ValorEnCartera = {
  id: string;
  numero: string;
  banco: string;
  importe: number;
  moneda: string;
  formato: string;
  modalidad: string;
  fechaPago: string | null;
  clienteNombre: string | null;
};

export async function getValoresEnCartera(): Promise<{
  valores: ValorEnCartera[];
}> {
  return apiRequest("/egresos/valores-en-cartera", { cache: "no-store" });
}
