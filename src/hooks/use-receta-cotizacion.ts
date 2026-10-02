"use client";
import * as React from "react";
import {
  getRecetasCotizacionProducto,
  type RecetaCotizacion,
} from "@/lib/productos-servicios-api";

export function useRecetaCotizacion(
  productoId: string | undefined,
  rutaAlternativaId: string | undefined,
) {
  const [datos, setDatos] = React.useState<{
    productoId: string;
    recetas: RecetaCotizacion[];
  }>();
  React.useEffect(() => {
    if (!productoId || !rutaAlternativaId) return;
    let activo = true;
    void getRecetasCotizacionProducto(productoId)
      .then((recetas) => {
        if (activo) setDatos({ productoId, recetas });
      })
      .catch(() => {
        if (activo) setDatos({ productoId, recetas: [] });
      });
    return () => {
      activo = false;
    };
  }, [productoId, rutaAlternativaId]);
  return datos && datos.productoId === productoId
    ? datos.recetas.find((r) => r.rutaAlternativa.id === rutaAlternativaId)
        ?.revisionPublicada
    : undefined;
}
