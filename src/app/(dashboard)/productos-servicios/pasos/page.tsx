import { puedeConfigurar } from "@/lib/capacidades-server";
import { PasosFamiliasView } from "@/components/productos-servicios/pasos-familias-view";

export const dynamic = "force-dynamic";

export default async function PasosProduccionPage() {
  const puedeGestionar = await puedeConfigurar("procesos", "costos.nodos.gestionar");
  return <PasosFamiliasView puedeGestionar={puedeGestionar} />;
}
