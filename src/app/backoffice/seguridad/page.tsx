import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getContextoPlataforma } from "@/lib/plataforma-api";
import { SeguridadBackoffice } from "@/components/plataforma/seguridad-backoffice";
export const dynamic = "force-dynamic";
export default async function SeguridadPage() {
  let contexto;
  try {
    contexto = await getContextoPlataforma();
  } catch (error) {
    if (!(error instanceof ApiError) || ![401, 403].includes(error.status))
      throw error;
  }
  if (!contexto?.esSesionPlataforma) redirect("/backoffice");
  if (contexto.debeCambiarPassword) redirect("/backoffice/cambiar-clave");
  if (!contexto.requiereSeguridad) redirect("/plataforma");
  return <SeguridadBackoffice email={contexto.email} />;
}
