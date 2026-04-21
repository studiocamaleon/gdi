"use client";

/**
 * P1.6 — Tarjeta de asignación/cambio de ruta para un producto.
 *
 * Reemplaza al tab "Ruta (legacy)" — permite elegir qué `ProcesoDefinicion`
 * usa el producto como ruta base (usarRutaComunVariantes=true). Si todavía
 * no tiene ruta, se muestra expandida. Si ya tiene, queda colapsada con un
 * botón "Cambiar ruta" para abrirla.
 *
 * Re-skin Grafo (ruta-banner): serif italic ruta name + mono meta +
 * ghost buttons. La forma colapsada coincide con el design `.route-banner`.
 */
import * as React from "react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProcesos } from "@/lib/procesos-api";
import type { Proceso } from "@/lib/procesos";
import { updateProductoRutaPolicy } from "@/lib/productos-servicios-api";

const NONE = "__none__";

export function RutaAssignerCard({
  productoId,
  currentProcesoDefinicionId,
  currentProcesoNombre,
  variantesCount,
  procesoDefinicionVersion,
  onChanged,
}: {
  productoId: string;
  currentProcesoDefinicionId: string | null;
  currentProcesoNombre: string | null;
  /** Cantidad de variantes del producto — para mostrar en el meta. */
  variantesCount?: number;
  /** Versión del proceso definición — opcional, mock por ahora. */
  procesoDefinicionVersion?: string;
  onChanged: () => void | Promise<void>;
}) {
  const [procesos, setProcesos] = React.useState<Proceso[]>([]);
  const [selected, setSelected] = React.useState<string>(
    currentProcesoDefinicionId ?? NONE,
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [expanded, setExpanded] = React.useState(currentProcesoDefinicionId === null);

  React.useEffect(() => {
    setSelected(currentProcesoDefinicionId ?? NONE);
  }, [currentProcesoDefinicionId]);

  React.useEffect(() => {
    if (!expanded) return;
    setIsLoading(true);
    getProcesos()
      .then((list) => setProcesos(list.filter((p) => p.activo)))
      .catch((err) => {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "No se pudieron cargar los procesos.",
        );
      })
      .finally(() => setIsLoading(false));
  }, [expanded]);

  const selectedProceso = React.useMemo(
    () => procesos.find((p) => p.id === selected) ?? null,
    [procesos, selected],
  );

  const hasChanges =
    (selected === NONE ? null : selected) !== currentProcesoDefinicionId;

  async function save() {
    setIsSaving(true);
    try {
      await updateProductoRutaPolicy(productoId, {
        usarRutaComunVariantes: true,
        procesoDefinicionDefaultId: selected === NONE ? null : selected,
      });
      toast.success(
        selected === NONE ? "Ruta desasignada." : "Ruta asignada al producto.",
      );
      setExpanded(false);
      await onChanged();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la ruta.");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Estado colapsado: route-banner Grafo
  if (!expanded && currentProcesoDefinicionId) {
    return (
      <div className="grid grid-cols-1 items-start gap-6 rounded-[10px] border border-line bg-bg-1 p-5 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            Ruta asignada
          </div>
          <div className="font-serif text-[26px] italic leading-tight text-ink-0">
            {currentProcesoNombre}
            <span className="ml-2 font-sans font-normal not-italic text-sm text-ink-3">
              — Estándar
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px] tracking-[0.04em] text-ink-2">
            <div>
              <span className="text-ink-3">usarRutaComunVariantes</span> ·{" "}
              <span className="text-ok">true</span>
            </div>
            {variantesCount != null && (
              <div>
                <span className="text-ink-3">Variantes</span> · {variantesCount}
              </div>
            )}
            {procesoDefinicionVersion && (
              <div>
                <span className="text-ink-3">Versión</span> ·{" "}
                {procesoDefinicionVersion}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
            Cambiar ruta
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toast.info("Duplicar ruta — próximamente")}
          >
            Duplicar
          </Button>
        </div>
      </div>
    );
  }

  // ── Estado expandido: selector + guardar/cancelar
  return (
    <div className="rounded-[10px] border border-line bg-bg-1 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            {currentProcesoDefinicionId ? "Cambiar ruta" : "Asignar ruta"}
          </div>
          <h3 className="m-0 font-serif text-[22px] font-normal italic leading-tight tracking-[-0.01em] text-ink-0">
            {currentProcesoDefinicionId
              ? "Cambiar ruta del producto"
              : "Asignar ruta al producto"}
          </h3>
          <p className="mt-1 max-w-[560px] text-sm text-ink-2">
            Elegí qué proceso usa este producto como ruta base. Una vez asignada,
            los pasos aparecen abajo y podés editarlos directamente.
          </p>
        </div>
        {currentProcesoDefinicionId && currentProcesoNombre && (
          <span className="rounded-full border border-line-hi px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-2">
            actual: {currentProcesoNombre}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-6">
          <GdiSpinner className="size-6" />
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            <Label className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
              Proceso
            </Label>
            <Select
              value={selected}
              onValueChange={(v) => setSelected(v ?? NONE)}
            >
              <SelectTrigger>
                <SelectValue>
                  {selected === NONE
                    ? "— sin ruta asignada —"
                    : selectedProceso
                      ? `${selectedProceso.codigo} · ${selectedProceso.nombre}`
                      : "—"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— sin ruta asignada —</SelectItem>
                {procesos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo} · {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-ink-3">
              Si todavía no existe un proceso que te sirva, creá uno desde el
              módulo{" "}
              <a href="/procesos" className="text-lime underline">
                Procesos
              </a>{" "}
              y volvé acá.
            </p>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            {currentProcesoDefinicionId && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isSaving}
                onClick={() => {
                  setSelected(currentProcesoDefinicionId ?? NONE);
                  setExpanded(false);
                }}
              >
                Cancelar
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={isSaving || !hasChanges}>
              {isSaving ? <GdiSpinner className="size-4" /> : "Guardar"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
