"use client";

import { useEffect, useState } from "react";
import { celdasQueCambian, type CambiosCeldas, type RevisionCeldas } from "@/lib/tablero-lista-en-vivo";

const SIN_CAMBIOS: CambiosCeldas = new Map();

/** Conserva las claves y el foco: desvanece lo que cambia antes de intercambiar datos. */
export function useTransicionLista<T extends { versiones: ReadonlyMap<string, RevisionCeldas>; contexto: string }>(entrada: T) {
  const [estado, setEstado] = useState({ entrada, visible: entrada, entrando: SIN_CAMBIOS });
  if (estado.entrada !== entrada) {
    const animar = estado.visible.contexto === entrada.contexto && celdasQueCambian(estado.visible.versiones, entrada.versiones).size > 0;
    setEstado({ entrada, visible: animar ? estado.visible : entrada, entrando: SIN_CAMBIOS });
  }
  useEffect(() => {
    const pendiente = estado.entrada !== estado.visible;
    if (!pendiente && !estado.entrando.size) return;
    const reducirMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => {
      setEstado({
        entrada: estado.entrada,
        visible: estado.entrada,
        entrando: pendiente && !reducirMovimiento
          ? celdasQueCambian(estado.visible.versiones, estado.entrada.versiones)
          : SIN_CAMBIOS,
      });
    }, reducirMovimiento ? 0 : pendiente ? 120 : 180);
    return () => clearTimeout(timer);
  }, [estado]);
  // Los filtros se aplican en el momento: no se muestra durante la transición un ámbito anterior.
  return {
    datos: estado.visible.contexto === entrada.contexto ? estado.visible : entrada,
    saliendo: estado.visible.contexto === entrada.contexto
      ? celdasQueCambian(estado.visible.versiones, entrada.versiones) : SIN_CAMBIOS,
    entrando: estado.entrando,
  };
}
