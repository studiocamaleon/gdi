"use client";

import { Button } from "@/components/ui/button";

/**
 * Un reporte que no carga tiene que decirlo y ofrecer reintentar, no tirar la
 * pantalla de error de Next: la consulta puede tardar o el API puede estar
 * reiniciando, y el resto del módulo sigue sirviendo. Cuando esto eran tabs, el
 * shell atajaba el error acá mismo; ahora que cada reporte es una ruta, el
 * límite de error es este archivo.
 */
export default function ErrorReporte({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="d-empty" style={{ padding: 48, display: "grid", gap: 14, justifyItems: "center" }}>
      <div>No se pudo cargar el reporte.</div>
      <Button type="button" variant="outline" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
