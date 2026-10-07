"use client";

import { useState } from "react";
import { RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { actualizarProductoRutaAlt } from "@/lib/productos-servicios-api";

export function FlujosInactivos({
  flujos,
  onCambio,
}: {
  flujos: Array<{ id: string; nombre: string }>;
  onCambio: () => void;
}) {
  const [pendiente, setPendiente] = useState<string | null>(null);
  if (!flujos.length) return null;
  async function reactivar(id: string) {
    if (pendiente) return;
    setPendiente(id);
    try {
      await actualizarProductoRutaAlt(id, { activo: true });
      toast.success("Flujo reactivado");
      onCambio();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo reactivar el flujo.",
      );
    } finally {
      setPendiente(null);
    }
  }
  return (
    <details className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer text-sm text-muted-foreground">
        Flujos inactivos ({flujos.length})
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        {flujos.map((flujo) => (
          <div
            key={flujo.id}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-sm">{flujo.nombre}</span>
            <ActionButton
              variant="outline"
              isDisabled={pendiente !== null}
              onPress={() => void reactivar(flujo.id)}
              aria-label={`Reactivar ${flujo.nombre}`}
            >
              <RotateCcwIcon />
              {pendiente === flujo.id ? "Reactivando…" : "Reactivar"}
            </ActionButton>
          </div>
        ))}
      </div>
    </details>
  );
}
