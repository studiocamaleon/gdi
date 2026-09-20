"use client";

import { useCallback, useEffect, useState } from "react";
import { getStockPage } from "@/lib/inventario-stock-api";
import type { StockPageResponse } from "@/lib/inventario-stock";
import { INVENTORY_CHANGED } from "@/lib/inventario-navigation";

/** Cancela consultas viejas; nunca presenta una respuesta bajo filtros diferentes. */
export function useInventoryPage<T, P extends object>(
  load: (params: P, signal?: AbortSignal) => Promise<T>,
  params: P,
  intervalMs?: number,
) {
  const [snapshot, setSnapshot] = useState<{
    key: string;
    data: T | null;
    error: string | null;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const key = JSON.stringify(params);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      load(JSON.parse(key), controller.signal)
        .then((data) => {
          if (!controller.signal.aborted)
            setSnapshot({ key, data, error: null });
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted)
            setSnapshot({
              key,
              data: null,
              error:
                err instanceof Error
                  ? err.message
                  : "No se pudo consultar el inventario.",
            });
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, revision, load]);
  useEffect(() => {
    const timer = intervalMs
      ? window.setInterval(() => {
          if (document.visibilityState === "visible") refresh();
        }, intervalMs)
      : undefined;
    window.addEventListener("focus", refresh);
    window.addEventListener(INVENTORY_CHANGED, refresh);
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(INVENTORY_CHANGED, refresh);
    };
  }, [refresh, intervalMs]);
  const current = snapshot?.key === key ? snapshot : null;
  return {
    result: current?.data ?? null,
    loading: current === null,
    error: current?.error ?? null,
    refresh,
  };
}

export function useStockPage(params: Parameters<typeof getStockPage>[0]) {
  return useInventoryPage<
    StockPageResponse,
    Parameters<typeof getStockPage>[0]
  >(getStockPage, params);
}
