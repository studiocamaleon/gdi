"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClienteOpcion } from "./cliente-selector-orden";
import { listClientes } from "@/lib/clientes-api";

function mergeClientes(current: ClienteOpcion[], incoming: ClienteOpcion[]) {
  return [
    ...new Map(
      [...current, ...incoming].map((cliente) => [cliente.id, cliente]),
    ).values(),
  ].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Consulta y caché local independientes del control visual. */
export function useClientesOrden(
  initialClientes: ClienteOpcion[],
  clientePersistido?: ClienteOpcion | null,
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteOptions, setRemoteOptions] = useState<ClienteOpcion[]>([]);
  const options = useMemo(
    // La página inicial y las búsquedas son parciales. El cliente de la OT
    // tiene que estar en la colección aun si no aparece en esos resultados.
    () => mergeClientes(
      clientePersistido ? [clientePersistido] : [],
      mergeClientes(initialClientes, remoteOptions),
    ),
    [initialClientes, remoteOptions, clientePersistido],
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
    listClientes({ q: debouncedQuery, limit: 30 }, true)
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
