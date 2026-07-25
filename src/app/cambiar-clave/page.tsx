import { CambiarPasswordForm } from "@/components/auth/cambiar-password-form";
import { getCurrentUserCached } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * Cambiar la propia clave. Es la única pantalla a la que el layout deja entrar
 * cuando un administrador restableció la clave: hasta que se cambie, la que
 * está en uso la sabe otra persona.
 */
export default async function CambiarClavePage() {
  const { currentUser } = await getCurrentUserCached();
  return <CambiarPasswordForm obligado={Boolean(currentUser.debeCambiarPassword)} />;
}
