import { TableroProduccion } from "@/components/produccion/tablero-produccion";
import { getTableroProduccion } from "@/lib/ordenes-trabajo-api";
import {
  getConfiguracionProduccion,
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
  let tiempoEntrePasosMin = 0;
  try {
    const [tablero, ests, durs, dias, config] = await Promise.all([
      getTableroProduccion(),
      getEstaciones(),
      getDuracionesFamilias(),
      getDiasNoLaborables(),
      getConfiguracionProduccion(),
    ]);
    items = tablero.items;
    estaciones = ests;
    duraciones = durs;
    diasNoLaborables = dias;
    tiempoEntrePasosMin = config.tiempoEntrePasosMin;
  } catch {
    // Estados vacíos de la vista.
  }
  return (
    <TableroProduccion
      initialItems={items}
      estaciones={estaciones}
      duracionesFamilias={duraciones}
      diasNoLaborables={diasNoLaborables}
      tiempoEntrePasosMin={tiempoEntrePasosMin}
    />
  );
}
