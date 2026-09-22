import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { puedeConfigurar, tieneCapacidad } from "@/lib/capacidades-server";
import { RutaFormView } from "@/components/productos-servicios/ruta-form-view";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { getCatalogoFamilias } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function NuevaRutaPage() {
  if (!(await tieneCapacidad("procesos"))) return <FuncionNoIncluida />;
  if (!(await puedeConfigurar("procesos", "costos.gestionar"))) {
    return <SinPermiso modulo="Flujos de producción" />;
  }
  const catalogo = await getCatalogoFamilias();
  return <RutaFormView modo="crear" catalogoFamilias={catalogo} />;
}
