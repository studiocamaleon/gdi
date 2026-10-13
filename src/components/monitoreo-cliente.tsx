"use client";

import { useEffect } from "react";
import { iniciarMonitoreoCliente } from "@/lib/observabilidad-cliente";

/** La configuración se consulta después del montaje, sin alterar el HTML inicial. */
export function MonitoreoCliente() {
  useEffect(() => {
    // En desarrollo esta petición compila una ruta. Desde instrumentation-client
    // podía disparar HMR mientras el router todavía se estaba hidratando.
    void iniciarMonitoreoCliente();
  }, []);

  return null;
}
