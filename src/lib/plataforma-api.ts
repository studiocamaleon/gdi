import { apiRequest } from "@/lib/api";

/**
 * Consola del control plane — espejo de `GET /plataforma/consola`
 * (apps/api/src/plataforma/plataforma.service.ts).
 * Sólo staff (User.rolPlataforma); el resto recibe 403.
 * Ver docs/control-plane-diseno.md
 */

export type TenantConsola = {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  creadoEl: string;
  usuariosActivos: number;
  ultimoAccesoEl: string | null;
  sinActividad14d: boolean;
  ots30d: number;
  cotizaciones30d: number;
  cobros30d: number;
  storageBytes: number;
  storageCuotaBytes: number | null;
  integraciones: Array<{
    proveedor: string;
    estado: "DESCONECTADA" | "CONECTADA" | "ERROR";
    ultimoErrorTexto: string | null;
  }>;
  whatsappPendientes: number;
  whatsappFallidas: number;
  /** Null = tenant legacy sin plan (grandfathered). */
  plan: {
    codigo: string;
    nombre: string;
    precioMensual: number;
    estado: string;
    usuariosMax: number | null;
    ordenesMesMax: number | null;
    storageGb: number | null;
  } | null;
};

export type PlanCatalogo = {
  id: string;
  codigo: string;
  nombre: string;
  precioMensual: number;
  features: Record<string, unknown>;
};

export type EventoPlataforma = {
  id: string;
  tipo: string;
  descripcion: string;
  tenantAfectadoId: string | null;
  staffNombre: string | null;
  staffEmail: string;
  creadoEl: string;
};

export type ConsolaPlataforma = {
  /** Quién está mirando (pie del rail). */
  staff: {
    nombre: string | null;
    email: string;
    rol: string;
    esSesionPlataforma: boolean;
  } | null;
  /** Últimos movimientos del control plane (PlataformaEvento, real desde A). */
  auditoria: EventoPlataforma[];
  resumen: {
    tenants: number;
    tenantsActivos: number;
    usuariosActivos: number;
    ots30d: number;
    storageBytes: number;
    sinActividad14d: number;
    mrr: number;
    sinPlan: number;
    ots30dPrev: number;
    cotizaciones30d: number;
    cotizaciones30dPrev: number;
    cobros30d: number;
    cobros30dPrev: number;
  };
  /** 12 semanas de actividad agregada (lunes ISO + conteos). */
  actividadSemanal: Array<{
    semana: string;
    ots: number;
    cotizaciones: number;
    cobros: number;
  }>;
  /** Altas de tenants por mes, últimos 6 ("YYYY-MM"). */
  altasMensuales: Array<{ mes: string; altas: number }>;
  tenants: TenantConsola[];
};

export async function getConsolaPlataforma(): Promise<ConsolaPlataforma> {
  return apiRequest("/plataforma/consola", { cache: "no-store" });
}

// ── Negocio del ecosistema (inteligencia de producto cross-tenant) ──────────
// Ver docs/control-plane-negocio-diseno.md

export type PeriodoNegocio = "30d" | "90d" | "12m";

export type NegocioPlataforma = {
  periodo: {
    clave: PeriodoNegocio;
    etiqueta: string;
    desde: string;
    hasta: string;
  };
  kpis: {
    ventas: number;
    ventasPrev: number;
    ordenes: number;
    ordenesPrev: number;
    ticketPromedio: number;
    facturado: number;
    facturadoPrev: number;
    cobrado: number;
    cobradoPrev: number;
    presupuestos: number;
  };
  serie: Array<{ periodo: string; ventas: number; facturado: number }>;
  porCategoria: Array<{
    categoria: string;
    ventas: number;
    ordenes: number;
    pct: number;
  }>;
  porTenant: Array<{
    tenantId: string;
    nombre: string;
    slug: string;
    ventas: number;
    ordenes: number;
    ticket: number;
    pct: number;
  }>;
  adopcion: {
    totalTenants: number;
    conVentas: number;
    conPresupuestos: number;
    conFacturacion: number;
  };
  porTecnologia: Array<{ tecnologia: string; ventas: number; pct: number }>;
  medidas: {
    estandar: number;
    personalizada: number;
    sinDato: number;
    pctEstandar: number | null;
  };
  adicionales: {
    itemsTotales: number;
    itemsCon: number;
    pctCon: number;
    top: Array<{ etiqueta: string; items: number; pctItems: number }>;
  };
  embudo: {
    emitidas: number;
    aprobadas: number;
    produccion: number;
    entregadas: number;
    emitidasMonto: number;
    aprobadasMonto: number;
    tasaAprobacion: number | null;
    tasaEntrega: number | null;
    fugas: Array<{ motivo: string; cantidad: number }>;
  };
  insights: Array<{
    clave: string;
    severidad: "riesgo" | "oportunidad" | "positivo" | "info";
    titulo: string;
    detalle: string;
  }>;
  distribucionTamano: Array<{ rango: string; tenants: number }>;
  medianaTicket: number;
};

export async function getNegocioPlataforma(
  periodo: PeriodoNegocio,
): Promise<NegocioPlataforma> {
  return apiRequest(`/plataforma/negocio?periodo=${periodo}`, {
    cache: "no-store",
  });
}

export async function getPlanesPlataforma(): Promise<PlanCatalogo[]> {
  return apiRequest("/plataforma/planes");
}

export async function cambiarPlanTenant(
  tenantId: string,
  planId: string,
): Promise<ConsolaPlataforma> {
  return apiRequest(`/plataforma/tenants/${tenantId}/plan`, {
    method: "PUT",
    body: JSON.stringify({ planId }),
  });
}

export async function suspenderTenant(
  tenantId: string,
  motivo: string,
): Promise<ConsolaPlataforma> {
  return apiRequest(`/plataforma/tenants/${tenantId}/suspender`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
}

export async function reactivarTenant(
  tenantId: string,
): Promise<ConsolaPlataforma> {
  return apiRequest(`/plataforma/tenants/${tenantId}/reactivar`, {
    method: "POST",
  });
}

export async function crearTenantPlataforma(dto: {
  nombre: string;
  slug: string;
  planId: string;
  adminEmail: string;
}): Promise<{ tenantId: string; invitacionUrl: string }> {
  return apiRequest("/plataforma/tenants", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export type BillingPlataforma = {
  tenantPlataforma: { id: string; nombre: string; slug: string } | null;
  puntosVenta: Array<{ id: string; numero: number; nombre: string | null }>;
  periodoActual: string;
  pendientes: Array<{
    tenantId: string;
    tenantNombre: string;
    planNombre: string;
    monto: number;
  }>;
  facturas: Array<{
    id: string;
    periodo: string;
    tenantClienteId: string;
    tenantClienteNombre: string;
    monto: number;
    comprobante: {
      id: string;
      estado: string;
      letra: string;
      numeroCompleto: string | null;
    };
    creadaEl: string;
  }>;
};

export async function getBillingPlataforma(): Promise<BillingPlataforma> {
  return apiRequest("/plataforma/billing", { cache: "no-store" });
}

export async function generarBillingPlataforma(dto: {
  puntoVentaId: string;
  periodo?: string;
}): Promise<{
  periodo: string;
  generadas: number;
  yaExistian: number;
  salteadas: Array<{ tenantNombre: string; motivo: string }>;
}> {
  return apiRequest("/plataforma/billing/generar", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export type SesionImpersonacion = {
  id: string;
  tenantId: string;
  tenantNombre: string;
  staffUserId: string;
  staffNombre: string | null;
  motivo: string;
  creadaEl: string;
  expiraEl: string;
  expiraEnSeg: number;
};

export async function getSesionesImpersonacion(): Promise<SesionImpersonacion[]> {
  return apiRequest("/plataforma/impersonacion", { cache: "no-store" });
}

export async function iniciarImpersonacion(
  tenantId: string,
  motivo: string,
): Promise<{ token: string; tenantNombre: string; expiraEl: string }> {
  return apiRequest("/plataforma/impersonacion", {
    method: "POST",
    body: JSON.stringify({ tenantId, motivo }),
  });
}

export async function cerrarImpersonacion(
  sesionId: string,
): Promise<{ ok: true }> {
  return apiRequest(`/plataforma/impersonacion/${sesionId}/cerrar`, {
    method: "POST",
  });
}

export function formatBytesPlataforma(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}
