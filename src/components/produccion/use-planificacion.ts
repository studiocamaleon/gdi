"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { useCambiosSistema } from "@/components/notificaciones/notificaciones-provider";
import { getTableroProduccion } from "@/lib/ordenes-trabajo-api";
import {
  getConfiguracionProduccion,
  getDiasNoLaborables,
  getDuracionesFamilias,
  getEstaciones,
} from "@/lib/estaciones-api";
import { simularFlujo, type ResultadoSimulacion } from "@/lib/flujo-produccion";
import { crearOperacionesPlan } from "@/lib/planificacion-vista";
import type { cargarDatosTableroProduccion } from "@/lib/tablero-produccion-server";

export type DatosPlanificacion = Awaited<
  ReturnType<typeof cargarDatosTableroProduccion>
> & { consultadoEl: string };
const SIMULACION_VACIA: ResultadoSimulacion = {
  porItem: new Map(),
  llegadasPorEstacion: new Map(),
  traza: [],
};

export function usePlanificacion(inicial: DatosPlanificacion) {
  const { zonaHoraria: zona } = useConfigRegional();
  const [datos, setDatos] = useState(inicial);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState(inicial.initialLoadError);
  const enVuelo = useRef(false);
  const montado = useRef(false);
  const actualizar = useCallback(async () => {
    if (enVuelo.current || !montado.current) return;
    enVuelo.current = true;
    setActualizando(true);
    try {
      // Publicamos una lectura completa: nunca mezclar una agenda nueva con calendarios de otra lectura fallida.
      const [
        tablero,
        estaciones,
        duracionesFamilias,
        diasNoLaborables,
        config,
      ] = await Promise.all([
        getTableroProduccion(),
        getEstaciones(),
        getDuracionesFamilias(),
        getDiasNoLaborables(),
        getConfiguracionProduccion(),
      ]);
      if (!montado.current) return;
      const { items, ...initialMeta } = tablero;
      const consultadoEl = new Date().toISOString();
      setDatos({
        initialItems: items,
        initialActualizadoEl: consultadoEl,
        initialMeta,
        estaciones,
        duracionesFamilias,
        diasNoLaborables,
        tiempoEntrePasosMin: config.tiempoEntrePasosMin,
        initialLoadError: null,
        initialPartialWarning: null,
        consultadoEl,
      });
      setError(null);
    } catch {
      if (montado.current)
        setError(
          "No se pudo actualizar la planificación. Se conserva la última consulta disponible.",
        );
    } finally {
      enVuelo.current = false;
      if (montado.current) setActualizando(false);
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    const refrescarVisible = () => {
      if (document.visibilityState === "visible") void actualizar();
    };
    const timer = window.setInterval(refrescarVisible, 60_000);
    window.addEventListener("focus", refrescarVisible);
    document.addEventListener("visibilitychange", refrescarVisible);
    return () => {
      montado.current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refrescarVisible);
      document.removeEventListener("visibilitychange", refrescarVisible);
    };
  }, [actualizar]);
  useCambiosSistema(
    (evento) => {
      if (
        evento.topicos.includes("tablero-produccion") &&
        document.visibilityState === "visible"
      )
        void actualizar();
    },
    [actualizar],
  );

  const entrada = useMemo(
    () => ({
      items: datos.initialItems,
      estaciones: datos.estaciones,
      ahora: new Date(datos.consultadoEl),
      zona,
      noLaborables: new Set(datos.diasNoLaborables.map((dia) => dia.fecha)),
      medianas: new Map(
        datos.duracionesFamilias.map((familia) => [
          familia.familiaCodigo,
          familia.medianaMin,
        ]),
      ),
      tiempoEntrePasosMin: datos.tiempoEntrePasosMin,
    }),
    [datos, zona],
  );
  const enSegundoPlano =
    datos.initialItems.reduce((n, item) => n + item.pasos.length, 0) > 200;
  const directa = useMemo(
    () => (enSegundoPlano ? null : simularFlujo(entrada)),
    [entrada, enSegundoPlano],
  );
  const [calculada, setCalculada] = useState<{
    datos: DatosPlanificacion;
    entrada: typeof entrada;
    resultado: ResultadoSimulacion;
  } | null>(null);
  const [errorCalculo, setErrorCalculo] = useState<{
    entrada: typeof entrada;
    mensaje: string;
  } | null>(null);
  useEffect(() => {
    if (!enSegundoPlano) return;
    let vigente = true;
    let worker: Worker | undefined;
    const fallar = () => {
      worker?.terminate();
      if (vigente)
        setErrorCalculo({
          entrada,
          mensaje:
            "No se pudo calcular la planificación. Volvé a actualizar la vista.",
        });
    };
    try {
      worker = new Worker(
        new URL("./planificacion-calculo.worker.ts", import.meta.url),
      );
      worker.onmessage = (
        evento: MessageEvent<{
          resultado?: ResultadoSimulacion;
          error?: string;
        }>,
      ) => {
        if (!vigente) return;
        if (evento.data.resultado)
          setCalculada({ datos, entrada, resultado: evento.data.resultado });
        else fallar();
        worker?.terminate();
      };
      worker.onerror = fallar;
      worker.postMessage(entrada);
    } catch {
      fallar();
    }
    return () => {
      vigente = false;
      worker?.terminate();
    };
  }, [datos, entrada, enSegundoPlano]);
  // Durante una actualización conservamos un conjunto coherente: nunca tareas
  // de la consulta nueva con ventanas calculadas para la consulta anterior.
  const datosVisibles = directa ? datos : (calculada?.datos ?? datos);
  const contextoVisible = directa ? entrada : (calculada?.entrada ?? entrada);
  const simulacion = directa ?? calculada?.resultado ?? SIMULACION_VACIA;
  const operaciones = useMemo(
    () =>
      crearOperacionesPlan(
        datosVisibles.initialItems,
        datosVisibles.estaciones,
        simulacion,
      ),
    [datosVisibles, simulacion],
  );
  const errorActual =
    errorCalculo?.entrada === entrada ? errorCalculo.mensaje : null;
  return {
    datos: datosVisibles,
    operaciones,
    simulacion,
    ahora: contextoVisible.ahora,
    zona: contextoVisible.zona,
    noLaborables: contextoVisible.noLaborables,
    actualizar,
    actualizando,
    error: errorActual ?? error,
    calculando:
      enSegundoPlano && calculada?.entrada !== entrada && !errorActual,
    sinSimulacion: !directa && !calculada,
  };
}
