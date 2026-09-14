"use client";

import { useRef, useState } from "react";
import {
  getPanelActividad,
  type PanelActividad,
} from "@/lib/panel-general-api";

/** Paginación independiente de la composición visual; el cursor permanece fijo
 * mientras llegan movimientos nuevos al resumen que se actualiza por polling.
 */
export function usePanelActividad() {
  const [historial, setHistorial] = useState<PanelActividad | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const busy = useRef(false);

  function reiniciar() {
    request.current += 1;
    busy.current = false;
    setHistorial(null);
    setError(null);
  }

  async function cargar(mas = false) {
    if (busy.current) return;
    busy.current = true;
    const id = ++request.current;
    setCargando(true);
    setError(null);
    try {
      const siguiente = await getPanelActividad(
        mas ? (historial?.siguienteCursor ?? undefined) : undefined,
      );
      if (request.current !== id) return;
      setHistorial((anterior) =>
        mas && anterior
          ? { ...siguiente, items: [...anterior.items, ...siguiente.items] }
          : siguiente,
      );
    } catch {
      if (request.current === id)
        setError("No pudimos cargar la actividad. Volvé a intentarlo.");
    } finally {
      if (request.current === id) {
        busy.current = false;
        setCargando(false);
      }
    }
  }
  return { historial, cargando, error, cargar, reiniciar };
}
