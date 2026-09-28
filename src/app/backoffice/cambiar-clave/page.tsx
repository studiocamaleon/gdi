import { redirect } from "next/navigation";
import { CambiarPasswordForm } from "@/components/auth/cambiar-password-form";
import { ApiError } from "@/lib/api";
import { getContextoPlataforma } from "@/lib/plataforma-api";

export const dynamic = "force-dynamic";

/** Usa el contexto del staff, que no requiere pertenecer a una empresa. */
export default async function CambiarClaveBackofficePage() {
  let contexto;
  try {
    contexto = await getContextoPlataforma();
  } catch (error) {
    if (!(error instanceof ApiError) || ![401, 403].includes(error.status)) {
      throw error;
    }
  }
  if (!contexto?.esSesionPlataforma) redirect("/backoffice");
  return (
    <CambiarPasswordForm
      obligado={contexto.debeCambiarPassword}
      destino="/backoffice/seguridad"
    />
  );
}
