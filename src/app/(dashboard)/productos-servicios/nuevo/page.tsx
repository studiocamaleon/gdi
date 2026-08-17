import { ProductoWizard } from "@/components/productos-servicios/producto-wizard";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  if (!(await tienePermiso("costos.gestionar"))) {
    return <SinPermiso modulo="Catálogo de productos" />;
  }
  return <ProductoWizard modo="crear" />;
}
