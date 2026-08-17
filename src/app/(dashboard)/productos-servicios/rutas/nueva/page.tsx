import { RutaFormView } from "@/components/productos-servicios/ruta-form-view";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { getCatalogoFamilias } from "@/lib/productos-servicios-api";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

export default async function NuevaRutaPage() {
  if (!(await tienePermiso("costos.gestionar"))) {
    return <SinPermiso modulo="Rutas de producción" />;
  }
  const catalogo = await getCatalogoFamilias();
  return <RutaFormView modo="crear" catalogoFamilias={catalogo} />;
}
