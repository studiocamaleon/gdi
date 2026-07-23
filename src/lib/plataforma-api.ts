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
  staff: { nombre: string | null; email: string; rol: string } | null;
  /** Últimos movimientos del control plane (PlataformaEvento, real desde A). */
  auditoria: EventoPlataforma[];
  resumen: {
    tenants: number;
    tenantsActivos: number;
    usuariosActivos: number;
    ots30d: number;
    storageBytes: number;
    sinActividad14d: number;
  };
  tenants: TenantConsola[];
};

export async function getConsolaPlataforma(): Promise<ConsolaPlataforma> {
  return apiRequest("/plataforma/consola", { cache: "no-store" });
}

export function formatBytesPlataforma(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}
