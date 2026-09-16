"use client";

import { useEffect, useState } from "react";

/** Reloj local alineado al intervalo; no consulta la API ni trabaja en segundo plano. */
export function useRelojProduccion(intervalo: number, inicial: number | null, activo = true) {
  const [ahora, setAhora] = useState(inicial);
  useEffect(() => {
    if (!activo) return;
    let timer: ReturnType<typeof setTimeout>;
    const avanzar = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      const instante = Date.now();
      setAhora(instante);
      timer = setTimeout(avanzar, intervalo - (instante % intervalo));
    };
    avanzar();
    document.addEventListener("visibilitychange", avanzar);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", avanzar);
    };
  }, [intervalo, activo]);
  return ahora;
}
