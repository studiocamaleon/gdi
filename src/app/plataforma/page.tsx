import {
  ConsolaPlataformaView,
  PlataformaSinAcceso,
} from "@/components/plataforma/consola-view";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api";
import {
  getConsolaPlataforma,
  type ConsolaPlataforma,
} from "@/lib/plataforma-api";

export const dynamic = "force-dynamic";

/**
 * La consola del control plane. Fuera del grupo (dashboard) a propósito: es
 * OTRA superficie (staff de Grafo, cross-tenant), no una vista más de la app
 * de tenant. El proxy ya exige sesión; la autorización la decide el API
 * (403 para cualquiera sin User.rolPlataforma).
 * Ver docs/control-plane-diseno.md
 */
export default async function PlataformaPage() {
  // El catch envuelve SÓLO el fetch (regla del linter): 401 y 403 son estados
  // esperados de esta página — sin sesión y sin rol — y cualquier otro sube.
  let datos: ConsolaPlataforma | null = null;
  let sinSesion = false;
  try {
    datos = await getConsolaPlataforma();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      sinSesion = true;
    } else if (!(error instanceof ApiError) || error.status !== 403) {
      throw error;
    }
  }

  if (sinSesion) redirect("/login");
  if (!datos) return <PlataformaSinAcceso />;
  return (
    <ConsolaPlataformaView
      datos={datos}
      ambiente={process.env.NODE_ENV === "production" ? "produccion" : "desarrollo"}
    />
  );
}
