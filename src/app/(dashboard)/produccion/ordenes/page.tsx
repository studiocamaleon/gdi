import { OrdenesTrabajoView } from "@/components/produccion/ordenes-trabajo-view";
import { getOrdenesTrabajo } from "@/lib/ordenes-trabajo-api";

export const dynamic = "force-dynamic";

export default async function OrdenesTrabajoPage() {
  const respuesta = await getOrdenesTrabajo({ limit: 200 });
  return <OrdenesTrabajoView ordenes={respuesta.data} />;
}
