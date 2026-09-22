"use client";
import * as React from "react";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import type { Archivo } from "@/lib/archivos";
import { getDesarrolloOrden, getEstadoDocumentalOrden, type DesarrolloDocumental, type EstadoDocumentalOrden } from "@/lib/desarrollo-documental-api";
import { DesarrolloDocumentalPanel } from "./desarrollo-documental-panel";
import { ActionButton } from "@/components/design-system/action-button";

export function DesarrolloDocumentalOrden({ ordenId, archivos, soloLectura, onCambioDocumental }: {
  ordenId: string; archivos: Archivo[]; soloLectura: boolean;
  onCambioDocumental: (next: EstadoDocumentalOrden) => void;
}) {
  const conArte = useCapacidad("aprobacion_arte");
  const puedeGestionar = usePuede("comercial.gestionar");
  const [data, setData] = React.useState<DesarrolloDocumental | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [intento, setIntento] = React.useState(0);
  const sinEdicion = React.useCallback(() => {}, []);
  React.useEffect(() => {
    let vigente = true;
    Promise.all([getDesarrolloOrden(ordenId), getEstadoDocumentalOrden(ordenId)]).then(([next, estado]) => {
      if (vigente) { setData(next); setError(null); onCambioDocumental(estado); }
    }).catch(cause => {
      if (vigente) setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial de arte.");
    });
    return () => { vigente = false; };
  }, [ordenId, intento, onCambioDocumental]);
  const cambiar = (next: DesarrolloDocumental) => {
    setData(next);
    void getEstadoDocumentalOrden(ordenId).then(onCambioDocumental).catch(() => setError("El arte se guardó, pero no se pudieron actualizar los controles. Recargá la vista."));
  };
  if (error) return <div role="alert"><p>{error}</p><ActionButton variant="outline" onPress={() => setIntento(n => n + 1)}>Reintentar</ActionButton></div>;
  if (!data) return <p>Cargando versiones de arte…</p>;
  if (!conArte && !data.maestros.length) return null;
  return <DesarrolloDocumentalPanel ordenId={ordenId} initial={data} archivos={archivos}
    ordenes={[{ id: ordenId, numero: "Esta OT", estado: "" }]}
    canManage={puedeGestionar && !soloLectura} onCambio={cambiar} onEdicionChange={sinEdicion} />;
}
