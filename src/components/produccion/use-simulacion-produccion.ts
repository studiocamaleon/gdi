"use client";

import { useEffect, useMemo, useState } from "react";
import { simularFlujo, type ResultadoSimulacion } from "@/lib/flujo-produccion";

export const SIMULACION_VACIA: ResultadoSimulacion = {
  porItem: new Map(),
  llegadasPorEstacion: new Map(),
  traza: [],
};

export function useSimulacionProduccion<
  T extends { entrada: Parameters<typeof simularFlujo>[0] },
>(consulta: T, habilitada = true) {
  const enWorker =
    habilitada &&
    consulta.entrada.items.reduce((n, i) => n + i.pasos.length, 0) > 200;
  const directa = useMemo(
    () =>
      habilitada && !enWorker
        ? { consulta, resultado: simularFlujo(consulta.entrada) }
        : null,
    [consulta, habilitada, enWorker],
  );
  const [calculada, setCalculada] = useState<{
    consulta: T;
    resultado: ResultadoSimulacion;
  } | null>(null);
  const [fallida, setFallida] = useState<T | null>(null);

  useEffect(() => {
    if (!enWorker) return;
    let vigente = true;
    let worker: Worker | undefined;
    const fallar = () => {
      worker?.terminate();
      if (vigente) setFallida(consulta);
    };
    try {
      worker = new Worker(
        new URL("./planificacion-calculo.worker.ts", import.meta.url),
      );
      worker.onmessage = (
        evento: MessageEvent<{ resultado?: ResultadoSimulacion }>,
      ) => {
        if (!vigente) return;
        const resultado = evento.data.resultado;
        if (!resultado) return fallar();
        setFallida(null);
        setCalculada({ consulta, resultado });
        worker?.terminate();
      };
      worker.onerror = fallar;
      worker.postMessage(consulta.entrada);
    } catch {
      fallar();
    }
    return () => {
      vigente = false;
      worker?.terminate();
    };
  }, [consulta, enWorker]);

  const ultima = habilitada ? (directa ?? calculada) : null;
  const actual = ultima?.consulta === consulta ? ultima.resultado : null;
  const error =
    enWorker && fallida === consulta
      ? "No se pudo calcular la planificación. Volvé a actualizar la vista."
      : null;
  return { actual, ultima, error, calculando: enWorker && !actual && !error };
}
