"use client";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { PropuestaItem } from "@/lib/propuestas";
import {
  consultarPrevisionMateriales,
  solicitudPrevisionMateriales,
  type PrevisionMateriales,
} from "@/lib/prevision-materiales";
import { INVENTORY_CHANGED } from "@/lib/inventario-navigation";
export function usePrevisionMateriales(
  items: PropuestaItem[],
  enabled: boolean,
) {
  const key = useMemo(
    () =>
      enabled && items.length
        ? JSON.stringify(solicitudPrevisionMateriales(items))
        : null,
    [items, enabled],
  );
  const [revision, refresh] = useReducer((n: number) => n + 1, 0);
  const [state, setState] = useState<{
    key: string | null;
    revision: number;
    data: PrevisionMateriales | null;
    error: string | null;
  }>({ key: null, revision: 0, data: null, error: null });
  const actualizar = useCallback(() => refresh(), []);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void consultarPrevisionMateriales(JSON.parse(key), controller.signal)
        .then((data) => {
          if (!controller.signal.aborted)
            setState({ key, revision, data, error: null });
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setState({
              key,
              revision,
              data: null,
              error:
                e instanceof Error
                  ? e.message
                  : "No se pudo consultar el abastecimiento.",
            });
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, revision]);
  useEffect(() => {
    if (!key) return;
    const timer = setInterval(actualizar, 60_000);
    window.addEventListener("focus", actualizar);
    window.addEventListener(INVENTORY_CHANGED, actualizar);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", actualizar);
      window.removeEventListener(INVENTORY_CHANGED, actualizar);
    };
  }, [key, actualizar]);
  const vigente = state.key === key && state.revision === revision;
  return {
    data: vigente ? state.data : null,
    error: vigente ? state.error : null,
    loading: !!key && (!vigente || (!state.data && !state.error)),
    actualizar,
  };
}
