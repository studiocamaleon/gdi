"use client";

import { useEffect, useState } from "react";
import {
  completarFabricacionNesting,
  faltanCapasFabricacion,
} from "@/lib/fabricacion-export";
import type { NestingViewerInput } from "@/lib/productos-servicios-api";

export function useCapasFabricacion(original: NestingViewerInput) {
  const [estado, setEstado] = useState<{
    original: NestingViewerInput;
    resultado?: NestingViewerInput;
    error?: string;
  }>();
  const [intento, setIntento] = useState(0);
  const faltan = faltanCapasFabricacion(original);
  useEffect(() => {
    if (!faltan) return;
    let activo = true;
    completarFabricacionNesting(original).then(
      (resultado) => {
        if (activo) setEstado({ original, resultado });
      },
      (error) => {
        if (activo)
          setEstado({
            original,
            error:
              error instanceof Error
                ? error.message
                : "No se pudieron recuperar las capas.",
          });
      },
    );
    return () => {
      activo = false;
    };
  }, [original, faltan, intento]);
  const actual = estado?.original === original ? estado : undefined;
  return {
    result: actual?.resultado ?? original,
    cargando: faltan && !actual,
    error: actual?.error,
    reintentar: () => {
      setEstado(undefined);
      setIntento((i) => i + 1);
    },
  };
}
