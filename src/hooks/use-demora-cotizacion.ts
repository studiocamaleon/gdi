"use client";

import { useEffect, useMemo, useState } from "react";
import type { estimarDemoraNuevos, ItemHipotetico, SimulacionItem } from "@/lib/flujo-produccion";

export type EntradaDemora = Parameters<typeof estimarDemoraNuevos>[0];
export type RespuestaDemora = { resultado: Map<string, SimulacionItem> } | { error: string };
const ERROR = "No se pudo estimar la entrega. Volvé a intentar o fijá la fecha del producto.";

/** La receta proyectada sólo contiene datos JSON, sin precios ni geometría.
 * Su clave evita volver a simular al actualizar fechas/comentarios de la ficha.
 * El motor se importa exclusivamente desde el worker: nunca bloquea el render.
 */
export function useDemoraCotizacion(
  nuevos: ItemHipotetico[],
  contexto: Omit<EntradaDemora, "nuevos"> | null,
  habilitado: boolean,
) {
  const clave = JSON.stringify(nuevos);
  const receta = useMemo(() => JSON.parse(clave) as ItemHipotetico[], [clave]);
  const entrada = useMemo(() => habilitado && contexto && receta.length
    ? { ...contexto, nuevos: receta }
    : null, [habilitado, contexto, receta]);
  const [completada, setCompletada] = useState<{
    entrada: EntradaDemora;
    resultado: Map<string, SimulacionItem>;
  } | null>(null);

  useEffect(() => {
    if (!entrada) return;
    let vigente = true;
    let worker: Worker | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const terminar = () => {
      clearTimeout(timeout);
      worker?.terminate();
    };
    const fallar = () => {
      terminar();
      if (!vigente) return;
      setCompletada({ entrada, resultado: new Map(entrada.nuevos.map((item) => [item.id, {
        finEstimado: null, sinEstimar: true, parcial: false,
        asumeDesbloqueo: false, motivoSinEstimar: ERROR,
      }])) });
      vigente = false;
    };
    try {
      worker = new Worker(new URL("./demora-cotizacion.worker.ts", import.meta.url));
      worker.onmessage = (evento: MessageEvent<RespuestaDemora>) => {
        if (!vigente) return;
        if ("resultado" in evento.data) {
          setCompletada({ entrada, resultado: evento.data.resultado });
          vigente = false;
          terminar();
        } else fallar();
      };
      worker.onerror = fallar;
      worker.onmessageerror = fallar;
      timeout = setTimeout(fallar, 30_000);
      // structured clone conserva Date, Map y Set del calendario y del resultado.
      worker.postMessage(entrada);
    } catch {
      fallar();
    }
    return () => {
      vigente = false;
      terminar(); // Cancela cálculos anteriores; no acumula una cola al editar rápido.
    };
  }, [entrada]);

  return {
    porItem: entrada && completada?.entrada === entrada ? completada.resultado : null,
    calculando: Boolean(entrada && completada?.entrada !== entrada),
  };
}
