"use client";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import * as React from "react";
import { RefreshCwIcon, ExpandIcon } from "lucide-react";
import { apiRequest } from "@/lib/api";
import type { PropuestaItem } from "@/lib/propuestas";
import {
  nombreLoteEntrega,
  type ResumenDistribucion,
} from "@/lib/planificacion-entregas";
import { formatFechaOrden } from "@/lib/ordenes-trabajo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import styles from "./produccion-entregas.module.css";
import theme from "@/components/ui/workspace-theme.module.css";
import { cn } from "@/lib/utils";

type LoteDetalle = {
  id: string;
  itemId: string;
  nombre: string;
  cantidad: number;
  fechaEntrega: string;
  cotizacion: PropuestaItem["cotizacion"];
  jobContext: PropuestaItem["jobContext"];
};

/** Sólo descarga la geometría del lote abierto; no multiplica el peso de la OT. */
export function ProduccionEntregas({
  item,
  lotes,
  vista = "produccion",
  loteId,
  onLoteChange,
  render,
}: {
  item: PropuestaItem;
  vista?: "produccion" | "aprovechamiento";
  loteId?: string;
  onLoteChange?: (id: string) => void;
  lotes: NonNullable<ResumenDistribucion["lotes"]>;
  render: (lote: PropuestaItem, ampliada: boolean) => React.ReactNode;
}) {
  const [ampliada, setAmpliada] = React.useState(false);
  const [seleccion, setSeleccion] = React.useState(lotes[0]?.id ?? "");
  const seleccionado =
    lotes.find((l) => l.id === (loteId ?? seleccion)) ?? lotes[0];
  const [detalle, setDetalle] = React.useState<LoteDetalle | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [intento, reintentar] = React.useReducer((n) => n + 1, 0);
  const id = seleccionado?.id;
  React.useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    void apiRequest<LoteDetalle>(
      `/ordenes-trabajo/items/${item.id}/planificacion-entregas/lotes/${id}`,
      { signal: controller.signal },
    )
      .then((d) => {
        if (!controller.signal.aborted) {
          setDetalle(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el lote.",
          );
      });
    return () => controller.abort();
  }, [id, item.id, intento]);
  if (!seleccionado) return null;
  const contenido = (grande: boolean) =>
    error ? (
      <div className={styles.status} role="alert">
        {error}
        <Button
          variant="outline"
          onClick={() => {
            setError(null);
            reintentar();
          }}
        >
          <RefreshCwIcon /> Reintentar
        </Button>
      </div>
    ) : detalle?.id !== id ? (
      <div className={styles.status} role="status">
        <GdiSpinner className="size-4" /> Cargando el plan del lote…
      </div>
    ) : (
      render(
        {
          ...item,
          id: detalle.itemId,
          productoNombre: detalle.nombre,
          cantidad: detalle.cantidad,
          cotizacion: detalle.cotizacion,
          jobContext: detalle.jobContext,
          distribucionEntregas: null,
          cotizacionItemId: undefined,
        },
        grande,
      )
    );
  return (
    <section
      className={cn(theme.theme, styles.wrap)}
      aria-label="Fabricación por entrega"
    >
      <div className={styles.toolbar}>
        <label className={styles.selector}>
          <span>Lote de producción</span>
          <select
            value={id}
            onChange={(e) => {
              setSeleccion(e.target.value);
              onLoteChange?.(e.target.value);
              setError(null);
            }}
          >
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {nombreLoteEntrega(l.secuencia)} · {l.cantidad} unidades ·{" "}
                {formatFechaOrden(l.fechaEntrega)}
              </option>
            ))}
          </select>
        </label>
        <p>
          {vista === "aprovechamiento"
            ? "Disposición calculada para este lote. Repetí únicamente las copias indicadas."
            : "Operaciones y tiempos de esta entrega."}
        </p>
        <Button variant="outline" size="sm" onClick={() => setAmpliada(true)}>
          <ExpandIcon /> Ampliar
        </Button>
      </div>
      {!ampliada && contenido(false)}
      <Dialog open={ampliada} onOpenChange={setAmpliada}>
        <DialogContent className={cn(theme.theme, styles.dialog)}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle>
              {item.productoNombre} ·{" "}
              {nombreLoteEntrega(seleccionado.secuencia)}
            </DialogTitle>
            <DialogDescription>
              {seleccionado.cantidad} unidades · Entrega{" "}
              {formatFechaOrden(seleccionado.fechaEntrega)}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.dialogBody}>
            {ampliada && contenido(true)}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
