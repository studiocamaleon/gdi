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
import type {
  TableroItemData,
  TableroProduccionData,
} from "@/lib/tablero-produccion";
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
  let tableroMeta: Omit<TableroProduccionData, "items"> = {
    alcance: "completo",
    puedeGestionar: false,
    estacionIdsEjecutables: [],
    vendedorSinVinculo: false,
  };
  let errorInicial: string | null = null;
  let avisoParcial: string | null = null;

  const [tablero, ests, durs, dias, config] = await Promise.allSettled([
      getTableroProduccion(),
      getEstaciones(),
      getDuracionesFamilias(),
      getDiasNoLaborables(),
      getConfiguracionProduccion(),
  ]);
  if (tablero.status === "fulfilled") {
    items = tablero.value.items;
    tableroMeta = {
      alcance: tablero.value.alcance,
      puedeGestionar: tablero.value.puedeGestionar,
      estacionIdsEjecutables: tablero.value.estacionIdsEjecutables,
      vendedorSinVinculo: tablero.value.vendedorSinVinculo,
    };
  } else {
    errorInicial = "No se pudo cargar el tablero de producción.";
  }
  if (ests.status === "fulfilled") estaciones = ests.value;
  if (durs.status === "fulfilled") duraciones = durs.value;
  if (dias.status === "fulfilled") diasNoLaborables = dias.value;
  if (config.status === "fulfilled") {
    tiempoEntrePasosMin = config.value.tiempoEntrePasosMin;
  }
  if ([ests, durs, dias, config].some((resultado) => resultado.status === "rejected")) {
    avisoParcial =
      "Parte de la configuración del taller no está disponible. Las proyecciones pueden ser incompletas.";
  }
  return (
    <TableroProduccion
      initialItems={items}
      initialMeta={tableroMeta}
      initialLoadError={errorInicial}
      initialPartialWarning={avisoParcial}
      estaciones={estaciones}
      duracionesFamilias={duraciones}
      diasNoLaborables={diasNoLaborables}
      tiempoEntrePasosMin={tiempoEntrePasosMin}
    />
  );
}
