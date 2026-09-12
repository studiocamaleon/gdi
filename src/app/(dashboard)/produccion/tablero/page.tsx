import { TableroProduccion } from "@/components/produccion/tablero-produccion";
import { cargarDatosTableroProduccion } from "@/lib/tablero-produccion-server";

export const dynamic = "force-dynamic";

export default async function TableroProduccionPage() {
  const datos = await cargarDatosTableroProduccion();
  return <TableroProduccion {...datos} />;
}
