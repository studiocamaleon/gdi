import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { ImpresorasView } from "@/components/impresion/impresoras-view";
export const dynamic = "force-dynamic";
export default async function ImpresorasPage() {
  if (!(await tienePermiso("configuracion.ver")))
    return <SinPermiso modulo="Impresoras" />;
  return <ImpresorasView />;
}
