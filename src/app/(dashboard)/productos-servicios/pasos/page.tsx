import { PasosFamiliasView } from "@/components/productos-servicios/pasos-familias-view";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

export default async function PasosProduccionPage() {
  const puedeGestionar = await tienePermiso("costos.gestionar");
  return <PasosFamiliasView puedeGestionar={puedeGestionar} />;
}
