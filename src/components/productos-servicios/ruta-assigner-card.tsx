"use client";

/**
 * P1.6 — Tarjeta de asignación/cambio de ruta para un producto.
 *
 * Reemplaza al tab "Ruta (legacy)" — permite elegir qué `ProcesoDefinicion`
 * usa el producto como ruta base (usarRutaComunVariantes=true). Si todavía
 * no tiene ruta, se muestra expandida. Si ya tiene, queda colapsada con un
 * botón "Cambiar ruta" para abrirla.
 */
import * as React from "react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  onChanged,
}: {
  productoId: string;
  currentProcesoDefinicionId: string | null;
  currentProcesoNombre: string | null;
  onChanged: () => void | Promise<void>;
}) {
  const [procesos, setProcesos] = React.useState<Proceso[]>([]);
  const [selected, setSelected] = React.useState<string>(
    currentProcesoDefinicionId ?? NONE,
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  // Por defecto expandido si el producto no tiene ruta; colapsado si ya tiene.
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

  // ── Estado colapsado: ruta asignada, botón "Cambiar"
  if (!expanded && currentProcesoDefinicionId) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Ruta asignada:{" "}
                <span className="font-mono text-sm">{currentProcesoNombre}</span>
              </CardTitle>
              <CardDescription>
                Todas las variantes de este producto usan esta ruta como base
                (<code>usarRutaComunVariantes=true</code>).
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
              Cambiar ruta
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  // ── Estado expandido: selector + guardar/cancelar
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {currentProcesoDefinicionId ? "Cambiar ruta" : "Asignar ruta al producto"}
            </CardTitle>
            <CardDescription>
              Elegí qué proceso usa este producto como <strong>ruta base</strong>. Una vez
              asignada, los pasos aparecen abajo y podés editarlos directamente desde este tab.
            </CardDescription>
          </div>
          {currentProcesoDefinicionId && (
            <Badge variant="outline">actual: {currentProcesoNombre}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center p-6"><GdiSpinner className="size-6" /></div>
        ) : (
          <>
            <div className="grid gap-2">
              <Label>Proceso</Label>
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
              <p className="text-xs text-muted-foreground">
                Si todavía no existe un proceso que te sirva, creá uno desde el módulo{" "}
                <a href="/procesos" className="underline">Procesos</a> y volvé acá.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
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
      </CardContent>
    </Card>
  );
}
