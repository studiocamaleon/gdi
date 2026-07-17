import { TableroProduccion } from "@/components/produccion/tablero-produccion";
import { getTableroProduccion } from "@/lib/ordenes-trabajo-api";
import type { TableroItemData } from "@/lib/tablero-produccion";

export const dynamic = "force-dynamic";

/**
 * El Tablero lee las órdenes emitidas reales (pendiente + producción) con
 * sus pasos materializados. Si la API no responde, la vista arranca vacía
 * y muestra su estado sin datos.
 */
export default async function TableroProduccionPage() {
  let items: TableroItemData[];
  try {
    ({ items } = await getTableroProduccion());
  } catch {
    items = [];
  }
  return <TableroProduccion initialItems={items} />;
}
