import {
  ConsolaPlataformaView,
  PlataformaSinAcceso,
} from "@/components/plataforma/consola-view";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api";
import {
  getContextoPlataforma,
  type StaffPlataforma,
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
  let datos: StaffPlataforma | null = null;
  let sinSesion = false;
  try {
    datos = await getContextoPlataforma();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      sinSesion = true;
    } else if (!(error instanceof ApiError) || error.status !== 403) {
      throw error;
    }
  }

  if (sinSesion) redirect("/backoffice");
  if (!datos) return <PlataformaSinAcceso />;
  if (datos.esSesionPlataforma && datos.debeCambiarPassword)
    redirect("/backoffice/cambiar-clave");
  if (datos.requiereSeguridad)
    redirect(
      datos.esSesionPlataforma ? "/backoffice/seguridad" : "/backoffice",
    );
  return (
    <ConsolaPlataformaView
      staff={datos}
      ambiente={
        process.env.NODE_ENV === "production" ? "produccion" : "desarrollo"
      }
    />
  );
}
