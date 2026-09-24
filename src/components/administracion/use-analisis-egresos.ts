"use client";

import { useRef, useState } from "react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { getPresupuestadoVsReal, getReporteEgresos } from "@/lib/egresos-api";
import type { PresupuestadoVsReal, ReporteEgresos } from "@/lib/egresos";
import {
  errorRangoAnalisis,
  mesAnalisisEgresos,
  mesCompletoAnalisis,
  type RangoAnalisisEgresos,
} from "@/lib/egresos-periodo";
import { claveFechaEnZona } from "@/lib/zona";

export function useAnalisisEgresos(conPresupuesto: boolean) {
  const { zonaHoraria } = useConfigRegional();
  const [rango, setRango] = useState<RangoAnalisisEgresos | null>(null);
  const [reporte, setReporte] = useState<ReporteEgresos | null>(null);
  const [presu, setPresu] = useState<PresupuestadoVsReal | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorPresupuesto, setErrorPresupuesto] = useState<string | null>(null);
  const solicitud = useRef(0);

  async function consultar(nuevoRango?: RangoAnalisisEgresos) {
    const elegido =
      nuevoRango ??
      rango ??
      mesAnalisisEgresos(claveFechaEnZona(new Date(), zonaHoraria));
    const invalido = errorRangoAnalisis(elegido);
    if (invalido) return;
    const actual = ++solicitud.current;
    setRango(elegido);
    setCargando(true);
    setError(null);
    setErrorPresupuesto(null);
    setReporte(null);
    setPresu(null);
    const mes = conPresupuesto ? mesCompletoAnalisis(elegido) : null;
    const [resultado, presupuesto] = await Promise.allSettled([
      getReporteEgresos(elegido),
      mes ? getPresupuestadoVsReal(mes) : Promise.resolve(null),
    ]);
    // Una respuesta anterior no debe reemplazar el período que se está consultando.
    if (actual !== solicitud.current) return;
    if (resultado.status === "fulfilled") setReporte(resultado.value);
    else
      setError(
        resultado.reason instanceof Error
          ? resultado.reason.message
          : "No se pudo cargar el análisis.",
      );
    if (presupuesto.status === "fulfilled") setPresu(presupuesto.value);
    else
      setErrorPresupuesto(
        "No se pudo cargar la comparación de gastos fijos de este mes.",
      );
    setCargando(false);
  }

  return {
    rango,
    reporte,
    presu,
    cargando,
    error,
    errorPresupuesto,
    consultar,
  };
}
