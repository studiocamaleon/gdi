"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { getMaterialesOrden, type MaterialesOrden } from "@/lib/materiales-orden-api";
import { INVENTORY_CHANGED } from "@/lib/inventario-navigation";

/** La ficha y la pestaña comparten la misma disponibilidad, incluidas reservas y consumos. */
export function useMaterialesOrden(ordenId: string | null, versionOrden?: object) {
  const [revision, refresh] = useReducer((n: number) => n + 1, 0);
  const actualizar = useCallback(() => refresh(), []);
  const [snapshot, setSnapshot] = useState<{
    ordenId: string;
    versionOrden?: object;
    revision: number;
    data?: MaterialesOrden;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!ordenId) return;
    const controller = new AbortController();
    getMaterialesOrden(ordenId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setSnapshot({ ordenId, versionOrden, revision, data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setSnapshot({
            ordenId, versionOrden, revision,
            error: error instanceof Error ? error.message : "No se pudieron consultar los materiales.",
          });
      });
    return () => controller.abort();
  }, [ordenId, versionOrden, revision]);

  useEffect(() => {
    if (!ordenId) return;
    const timer = setInterval(actualizar, 60_000);
    window.addEventListener("focus", actualizar);
    window.addEventListener(INVENTORY_CHANGED, actualizar);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", actualizar);
      window.removeEventListener(INVENTORY_CHANGED, actualizar);
    };
  }, [ordenId, actualizar]);

  const current = snapshot?.ordenId === ordenId && snapshot.versionOrden === versionOrden
    ? snapshot : null;
  return {
    data: current?.data,
    error: current?.error,
    loading: !!ordenId && (!current || current.revision !== revision),
    actualizar,
  };
}
