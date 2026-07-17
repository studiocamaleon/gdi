import { TableroProduccion } from "@/components/produccion/tablero-produccion";
import { getTableroProduccion } from "@/lib/ordenes-trabajo-api";
import {
  getDiasNoLaborables,
  getDuracionesFamilias,
  getEstaciones,
  type DiaNoLaborable,
  type DuracionFamilia,
} from "@/lib/estaciones-api";
import type { TableroItemData } from "@/lib/tablero-produccion";
import type { Estacion } from "@/lib/estaciones";

export const dynamic = "force-dynamic";

/**
 * El Tablero lee las órdenes emitidas reales (pendiente + producción) con
 * sus pasos materializados, las estaciones configuradas para agrupar la
 * vista Por estación (familia → estación), las medianas históricas por
 * familia (fallback de la cola en horas) y los días no laborables del
 * taller (los saltan la proyección y la simulación). Si la API no
 * responde, la vista arranca vacía y muestra su estado sin datos.
 */
export default async function TableroProduccionPage() {
  let items: TableroItemData[] = [];
  let estaciones: Estacion[] = [];
  let duraciones: DuracionFamilia[] = [];
  let diasNoLaborables: DiaNoLaborable[] = [];
  try {
    [{ items }, estaciones, duraciones, diasNoLaborables] = await Promise.all([
      getTableroProduccion(),
      getEstaciones(),
      getDuracionesFamilias(),
      getDiasNoLaborables(),
    ]);
  } catch {
    // Estados vacíos de la vista.
  }
  return (
    <TableroProduccion
      initialItems={items}
      estaciones={estaciones}
      duracionesFamilias={duraciones}
      diasNoLaborables={diasNoLaborables}
    />
  );
}
