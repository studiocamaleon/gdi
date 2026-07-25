import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { AlmacenamientoView } from "@/components/archivos/almacenamiento-view";

export const dynamic = "force-dynamic";

/**
 * Configuración → Almacenamiento. El uso se pide desde el cliente: es un dato
 * que cambia con cada subida y no vale la pena congelarlo en el render.
 */
export default async function AlmacenamientoPage() {
  if (!(await tienePermiso("configuracion.ver"))) {
    return <SinPermiso modulo="Almacenamiento" />;
  }

  return <AlmacenamientoView />;
}
