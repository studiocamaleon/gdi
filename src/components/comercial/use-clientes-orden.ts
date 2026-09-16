"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClienteDetalle } from "@/lib/clientes";
import { listClientes } from "@/lib/clientes-api";

function mergeClientes(current: ClienteDetalle[], incoming: ClienteDetalle[]) {
  return [
    ...new Map(
      [...current, ...incoming].map((cliente) => [cliente.id, cliente]),
    ).values(),
  ].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Consulta y caché local independientes del control visual. */
export function useClientesOrden(initialClientes: ClienteDetalle[]) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteOptions, setRemoteOptions] = useState<ClienteDetalle[]>([]);
  const options = useMemo(
    () => mergeClientes(initialClientes, remoteOptions),
    [initialClientes, remoteOptions],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    // Invalidar la consulta anterior apenas cambia el texto, antes del debounce.
    if (!open || query !== debouncedQuery) return;
    let cancelled = false;
    listClientes({ q: debouncedQuery, limit: 30 })
      .then((response) => {
        if (!cancelled)
          setRemoteOptions((current) => mergeClientes(current, response.data));
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "No se pudieron cargar clientes. Podés seleccionar los ya disponibles.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, query, open]);

  return {
    options,
    loading,
    error,
    onInputChange: (value: string) => {
      if (value === query) return;
      setQuery(value);
      setError(null);
      if (open) setLoading(true);
    },
    onOpenChange: (value: boolean) => {
      setOpen(value);
      if (value) {
        setLoading(true);
        setError(null);
      }
    },
  };
}
