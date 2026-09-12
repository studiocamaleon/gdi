"use client";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DeclararTiempoPaso } from "./paso-acciones";
import type { TrabajoCola, TiempoCola } from "@/lib/colas-produccion";
import {
  completarSeriaInstantaneo,
  type OpcionesAccionProduccion,
} from "@/lib/acciones-produccion";
import theme from "@/components/ui/workspace-theme.module.css";

/** Reúne las declaraciones; ninguna operación se guarda hasta resolver la selección entera. */
export function CompletarSeleccionCola({
  items,
  onConfirmar,
  onCancelar,
}: {
  items: TrabajoCola[];
  onConfirmar: (tiempos: TiempoCola[]) => Promise<void>;
  onCancelar: () => void;
}) {
  const [pendientes] = React.useState(() =>
    items.filter((i) => completarSeriaInstantaneo(i.control.paso)),
  );
  const [tiempos, setTiempos] = React.useState<TiempoCola[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const envio = React.useRef(false);
  const actual = pendientes[tiempos.length];
  async function guardar(declaraciones: TiempoCola[]) {
    if (envio.current) return;
    envio.current = true;
    setBusy(true);
    setError(null);
    try {
      await onConfirmar(declaraciones);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la selección.",
      );
    } finally {
      envio.current = false;
      setBusy(false);
    }
  }
  function registrar(opts: OpcionesAccionProduccion) {
    if (!actual || envio.current) return;
    const siguientes = [...tiempos, { pasoId: actual.id, ...opts }];
    setTiempos(siguientes);
    if (siguientes.length === pendientes.length) void guardar(siguientes);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancelar();
      }}
    >
      <DialogContent className={theme.theme} showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Registrar tiempos</DialogTitle>
          <DialogDescription>
            {actual
              ? `${tiempos.length + 1} de ${pendientes.length} trabajos sin tiempo medido suficiente. ${items.length} trabajos se completarán juntos al terminar.`
              : "Todos los tiempos están revisados. La selección se guarda completa."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {actual ? (
          <div className="flex flex-col gap-4">
            <p>
              {actual.ordenNumero} · {actual.producto}
              {actual.lote ? ` · ${actual.lote.nombre}` : ""} · {actual.nombre}
            </p>
            <DeclararTiempoPaso
              key={actual.id}
              estimado={actual.duracionEstimadaMin}
              busy={busy}
              onConfirmar={registrar}
              onCancelar={onCancelar}
            />
          </div>
        ) : (
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void guardar(tiempos)}>
              {busy ? "Completando…" : "Reintentar"}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={onCancelar}>
              Cancelar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
