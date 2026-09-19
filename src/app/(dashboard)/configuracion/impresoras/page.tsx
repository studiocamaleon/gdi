import { getCurrentUserCached } from "@/lib/auth-server";
import { notFound } from "next/navigation";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { ImpresorasView } from "@/components/impresion/impresoras-view";
export const dynamic = "force-dynamic";
export default async function ImpresorasPage() {
  const { currentUser } = await getCurrentUserCached();
  if (!currentUser.tenantActual?.suscripcion?.capacidades?.impresionDirecta)
    notFound();
  if (!(await tienePermiso("configuracion.ver")))
    return <SinPermiso modulo="Impresoras" />;
  return <ImpresorasView />;
}
