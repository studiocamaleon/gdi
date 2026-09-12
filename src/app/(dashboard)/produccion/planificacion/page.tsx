import { PlanificacionView } from "@/components/produccion/planificacion-view";
import { cargarDatosTableroProduccion } from "@/lib/tablero-produccion-server";

export const dynamic = "force-dynamic";

export default async function PlanificacionProduccionPage() {
  const datos = await cargarDatosTableroProduccion();
  return <PlanificacionView {...datos} consultadoEl={new Date().toISOString()} />;
}
