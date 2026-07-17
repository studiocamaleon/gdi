import { TableroProduccion } from "@/components/produccion/tablero-produccion";
import { getTableroProduccion } from "@/lib/ordenes-trabajo-api";
import { getEstaciones } from "@/lib/estaciones-api";
import type { TableroItemData } from "@/lib/tablero-produccion";
import type { Estacion } from "@/lib/estaciones";

export const dynamic = "force-dynamic";

/**
 * El Tablero lee las órdenes emitidas reales (pendiente + producción) con
 * sus pasos materializados, y las estaciones configuradas para agrupar la
 * vista Por estación (familia → estación). Si la API no responde, la vista
 * arranca vacía y muestra su estado sin datos.
 */
export default async function TableroProduccionPage() {
  let items: TableroItemData[] = [];
  let estaciones: Estacion[] = [];
  try {
    [{ items }, estaciones] = await Promise.all([
      getTableroProduccion(),
      getEstaciones(),
    ]);
  } catch {
    // Estados vacíos de la vista.
  }
  return <TableroProduccion initialItems={items} estaciones={estaciones} />;
}
