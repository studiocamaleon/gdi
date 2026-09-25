import { apiRequest } from "@/lib/api";

export type AccesoEmpresa = {
  modo: "operativo" | "solo_lectura" | "bloqueado";
  codigo: string;
  descripcion: string;
};
export type EmpresaFila = {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  creadoEl: string;
  usuariosHabilitados: number;
  acceso: AccesoEmpresa;
  plan: string | null;
  proveedor: string | null;
  estadoSuscripcion: string | null;
  estadoProveedor: string | null;
};
export type EmpresaPlataforma = {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  creadoEl: string;
  origenAlta: string;
  bloqueo: { motivo: string | null; desde: string | null };
  acceso: AccesoEmpresa;
  usuariosHabilitados: number;
  invitacionesPendientes: number;
  invitacionAdministrador?: InvitacionEmpresa | null;
  storageBytes: number;
  storageCuotaBytes: number | null;
  puedeAsignarPlanManual: boolean;
  suscripcion: null | {
    id: string;
    planId: string;
    planNombre: string;
    versionId?: string | null;
    versionNumero?: number | null;
    planComercialNombre?: string;
    planCodigo: string;
    proveedor: string;
    estado: string;
    estadoProveedor: string | null;
    referenciaExterna: string | null;
    desde: string;
    hasta: string | null;
    trialHasta: string | null;
    moraDesde: string | null;
    graciaHasta: string | null;
    proximoCobro: string | null;
    cambioProgramado: string | null;
    cambioProgramadoEl: string | null;
    ultimaSyncProveedorEl: string | null;
    ultimoEventoProveedorEl: string | null;
  };
  funciones: Array<{
    clave: string;
    nombre: string;
    incluida: boolean;
    habilitada: boolean;
    motivo: string;
  }>;
  limites: {
    usuariosMax: number | null;
    ordenesMesMax: number | null;
    storageGb: number | null;
  };
};
export type PaginaEmpresas = {
  empresas: EmpresaFila[];
  total: number;
  pagina: number;
  limite: number;
};
export type HistorialEmpresa = {
  total: number;
  pagina: number;
  limite: number;
  eventos: Array<{
    id: string;
    tipo: string;
    descripcion: string;
    creadoEl: string;
    staffNombre: string | null;
    staffEmail: string;
  }>;
};
export type UsuariosEmpresa = {
  total: number;
  pagina: number;
  limite: number;
  usuarios: Array<{
    id: string;
    nombre: string | null;
    email: string;
    rol: string;
    habilitado: boolean;
  }>;
};
export type StaffPlataforma = NonNullable<ConsolaPlataforma["staff"]> & {
  requiereSeguridad: boolean;
  debeCambiarPassword: boolean;
};
export const getContextoPlataforma = () =>
  apiRequest<StaffPlataforma>("/plataforma/contexto", { cache: "no-store" });
export const getEmpresasPlataforma = (query: URLSearchParams) =>
  apiRequest<PaginaEmpresas>(`/plataforma/empresas?${query}`, {
    cache: "no-store",
  });
export const getEmpresaPlataforma = (id: string) =>
  apiRequest<EmpresaPlataforma>(`/plataforma/empresas/${id}`, {
    cache: "no-store",
  });
export const getHistorialEmpresa = (id: string, pagina: number) =>
  apiRequest<HistorialEmpresa>(
    `/plataforma/empresas/${id}/historial?pagina=${pagina}`,
    { cache: "no-store" },
  );
export const getUsuariosEmpresa = (id: string, pagina: number) =>
  apiRequest<UsuariosEmpresa>(
    `/plataforma/empresas/${id}/usuarios?pagina=${pagina}`,
    { cache: "no-store" },
  );

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
  comercialVersionado?: boolean;
  revisionOferta?: number;
  ofertaActualId?: string | null;
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precioMensual: number;
  moneda: string;
  features: Record<string, unknown>;
  paddlePriceId: string | null;
  paddleProductId: string | null;
  paddlePriceIdAnual: string | null;
  precioAnual: number | null;
  trialDias: number | null;
  publico: boolean;
  registroPublico: boolean;
  recomendado: boolean;
  precioAConsultar: boolean;
  tenants: number;
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
  /** GMV por moneda del tenant. Más de una entrada = los totales de arriba
   *  mezclan monedas sin convertir; la consola lo avisa. */
  porMoneda?: Array<{ moneda: string; ventas: number; tenants: number }>;
};

export async function getNegocioPlataforma(
  periodo: PeriodoNegocio,
): Promise<NegocioPlataforma> {
  return apiRequest(`/plataforma/negocio?periodo=${periodo}`, {
    cache: "no-store",
  });
}

export async function getPlanesPlataforma(): Promise<PlanCatalogo[]> {
  return apiRequest("/plataforma/planes", { cache: "no-store" });
}

export function retirarPlanAnterior(
  planId: string,
  revision: number,
  motivo: string,
) {
  return apiRequest<{ ok: true }>(
    "/plataforma/planes-ofertas/retirar-anterior",
    {
      method: "POST",
      body: JSON.stringify({ planId, revision, motivo }),
    },
  );
}

/** Edita la bajada comercial del plan (la que ve el tenant). */
export async function describirPlan(
  planId: string,
  descripcion: string | null,
): Promise<PlanCatalogo[]> {
  return apiRequest(`/plataforma/planes/${planId}/descripcion`, {
    method: "PUT",
    body: JSON.stringify(descripcion ? { descripcion } : {}),
  });
}

/** Vincula un plan con su precio de Paddle (vacío = desvincular). */
export async function vincularPlanPaddle(
  planId: string,
  priceId: string | null,
  productId: string | null,
  ciclo: "mensual" | "anual" = "mensual",
): Promise<PlanCatalogo[]> {
  return apiRequest(`/plataforma/planes/${planId}/paddle`, {
    method: "PUT",
    body: JSON.stringify({
      ...(priceId ? { priceId } : {}),
      ...(productId ? { productId } : {}),
      ciclo,
    }),
  });
}

export async function cambiarPlanTenant(
  tenantId: string,
  planId: string,
  motivo: string,
): Promise<EmpresaPlataforma> {
  return apiRequest(`/plataforma/tenants/${tenantId}/plan`, {
    method: "PUT",
    body: JSON.stringify({ planId, motivo }),
  });
}

export async function suspenderTenant(
  tenantId: string,
  motivo: string,
): Promise<EmpresaPlataforma> {
  return apiRequest(`/plataforma/tenants/${tenantId}/suspender`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
}

export async function reactivarTenant(
  tenantId: string,
  motivo: string,
): Promise<EmpresaPlataforma> {
  return apiRequest(`/plataforma/tenants/${tenantId}/reactivar`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
}

export type InvitacionEmpresa = {
  id: string;
  email: string;
  venceEl: string;
  aceptadaEl: string | null;
  correoEstado: string;
  ultimoIntentoEl: string | null;
  enviadoEl: string | null;
};
export type ResultadoInvitacionEmpresa = {
  tenantId: string;
  invitacionUrl?: string;
  invitacion: InvitacionEmpresa;
};

export const reenviarInvitacionEmpresa = (
  tenantId: string,
): Promise<ResultadoInvitacionEmpresa> =>
  apiRequest(`/plataforma/tenants/${tenantId}/invitacion/reenviar`, {
    method: "POST",
  });

export async function crearTenantPlataforma(dto: {
  nombre: string;
  slug: string;
  planId: string;
  adminEmail: string;
}): Promise<ResultadoInvitacionEmpresa> {
  return apiRequest("/plataforma/tenants", {
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

export async function getSesionesImpersonacion(): Promise<
  SesionImpersonacion[]
> {
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
