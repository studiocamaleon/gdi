import { apiRequest } from "@/lib/api";
import type {
  CategoriaEgreso,
  Egreso,
  NaturalezaEgreso,
  PagoDeEgreso,
  ReporteEgresos,
  ResumenEgresos,
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
  metodoPagoId: string;
  cuentaOrigenId: string;
  fecha?: string;
  referencia?: string;
  notas?: string;
  imputaciones: Array<{ egresoId: string; monto: number }>;
}): Promise<{ id: string; numero: string; montoNeto: number }> {
  return apiRequest<{ id: string; numero: string; montoNeto: number }>(
    "/egresos/pagos",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
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
