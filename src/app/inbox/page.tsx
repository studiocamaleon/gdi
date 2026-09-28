import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getCurrentUserCached } from "@/lib/auth-server";
import { getSessionToken } from "@/lib/session";
import { ConfigRegionalProvider } from "@/components/navigation/config-regional-provider";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { InboxView } from "@/components/inbox/inbox-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox | Grafoprint" };

/** Ruta privada independiente: conserva sesión y cambio de clave obligatorio. */
export default async function InboxPage() {
  if (!(await getSessionToken())) redirect("/login");
  const current = await getCurrentUserCached().catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 401)
      redirect("/salir?motivo=sesion");
    throw error;
  });
  const user = current.currentUser;
  if (user.debeCambiarPassword) redirect("/cambiar-clave");
  if (
    user.impersonacion ||
    !user.tenantActual ||
    !(
      user.tenantActual.permisos?.includes("inbox.atender") ||
      (user.tenantActual.rol === "administrador" &&
        user.tenantActual.permisos?.includes("configuracion.gestionar"))
    )
  )
    return <SinPermiso modulo="Conversaciones" />;
  return (
    <ConfigRegionalProvider regional={user.tenantActual.regional}>
      <InboxView
        identidad={{
          puedeConfigurarConexion:
            user.tenantActual.rol === "administrador" &&
            user.tenantActual.permisos?.includes("configuracion.gestionar"),
          empresaId: user.tenantActual.id,
          usuarioId: user.id,
          empresa: user.tenantActual.nombre,
          operador: user.nombreCompleto || user.email,
        }}
      />
    </ConfigRegionalProvider>
  );
}
