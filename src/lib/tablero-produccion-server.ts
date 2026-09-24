import { consultarCapacidadesCached } from "@/lib/capacidades-server";
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

/**
 * El Tablero lee las órdenes emitidas reales (pendiente + producción) con
 * sus pasos materializados, las estaciones configuradas (compartidas con
 * la vista operativa de Estaciones), las medianas históricas por
 * familia (fallback de la cola en horas) y los días no laborables del
 * taller (los saltan la proyección y la simulación). Si la API no
 * responde, la vista arranca vacía y muestra su estado sin datos.
 */
export async function cargarDatosTableroProduccion({ soloPendientes = false }: { soloPendientes?: boolean } = {}) {
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

  const { funciones } = await consultarCapacidadesCached();
  const conEta = funciones.eta_capacidad === true;
  const [tablero, ests, durs, dias, config] = await Promise.allSettled([
    getTableroProduccion({ soloPendientes }),
    getEstaciones(),
    conEta ? getDuracionesFamilias() : Promise.resolve([]),
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
    errorInicial = "No se pudieron cargar los trabajos de producción.";
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
  return {
    initialItems: items,
    initialActualizadoEl: errorInicial ? null : new Date().toISOString(),
    initialMeta: tableroMeta,
    initialLoadError: errorInicial,
    initialPartialWarning: avisoParcial,
    estaciones,
    duracionesFamilias: duraciones,
    diasNoLaborables,
    tiempoEntrePasosMin,
  };
}
