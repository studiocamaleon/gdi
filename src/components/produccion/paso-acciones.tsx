"use client";

import * as React from "react";
import { Ban, Check, Pause, Play, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MOTIVOS_PAUSA,
  etiquetaDuracion,
  type TableroPasoAccion,
} from "@/lib/tablero-produccion";
import {
  accionesDisponiblesProduccion,
  chipsDeclarar,
  completarSeriaInstantaneo,
  type ControlAccionesProduccion,
  type OpcionesAccionProduccion,
} from "@/lib/acciones-produccion";
import theme from "@/components/ui/workspace-theme.module.css";

export const ETIQUETAS_ACCION: Record<TableroPasoAccion, string> = {
  iniciar: "Iniciar",
  pausar: "Pausar",
  continuar: "Continuar",
  completar: "Completar",
  bloquear: "Bloquear",
  desbloquear: "Desbloquear",
  reabrir: "Reabrir",
};
const ICONOS = {
  iniciar: Play,
  pausar: Pause,
  continuar: Play,
  completar: Check,
  bloquear: Ban,
  desbloquear: Unlock,
  reabrir: Play,
};

/** Compartido por el cierre individual y el múltiple. Sin tiempo requiere una elección explícita. */
export function DeclararTiempoPaso({
  estimado,
  busy,
  onConfirmar,
  onCancelar,
}: {
  estimado: number | null;
  busy: boolean;
  onConfirmar: (opts: OpcionesAccionProduccion) => void;
  onCancelar: () => void;
}) {
  const [otro, setOtro] = React.useState("");
  const id = React.useId();
  const minutos = Number(otro);
  return (
    <FieldGroup>
      <div className="flex flex-wrap gap-2">
        {chipsDeclarar(estimado).map((min) => (
          <Button
            key={min}
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onConfirmar({ tiempoDeclaradoMin: min })}
          >
            {etiquetaDuracion(min)}
          </Button>
        ))}
      </div>
      <Field>
        <FieldLabel htmlFor={id}>Otro tiempo aproximado (minutos)</FieldLabel>
        <div className="flex gap-2">
          <Input
            id={id}
            type="number"
            min={1}
            value={otro}
            onChange={(e) => setOtro(e.target.value)}
            disabled={busy}
          />
          <Button
            variant="outline"
            disabled={busy || !Number.isFinite(minutos) || minutos < 1}
            onClick={() => onConfirmar({ tiempoDeclaradoMin: minutos })}
          >
            Usar tiempo
          </Button>
        </div>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onConfirmar({ sinTiempoConfirmado: true })}
        >
          Completar sin tiempo
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </FieldGroup>
  );
}

export function PasoAccionesProduccion({
  busy,
  onAccion,
  referencia,
  enLinea = false,
  ...control
}: ControlAccionesProduccion & {
  busy: boolean;
  referencia?: string;
  enLinea?: boolean;
  onAccion: (
    accion: TableroPasoAccion,
    opts?: OpcionesAccionProduccion,
  ) => Promise<void>;
}) {
  const [formulario, setFormulario] = React.useState<
    "bloquear" | "pausar" | "tiempo" | null
  >(null);
  const [motivo, setMotivo] = React.useState("");
  const [detalle, setDetalle] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const envio = React.useRef(false);
  const id = React.useId();
  const acciones = accionesDisponiblesProduccion(control);
  const ocupado = busy || enviando;
  async function ejecutar(
    accion: TableroPasoAccion,
    opts?: OpcionesAccionProduccion,
  ) {
    if (envio.current || busy) return;
    envio.current = true;
    setEnviando(true);
    setError(null);
    try {
      await onAccion(accion, opts);
      setFormulario(null);
      setMotivo("");
      setDetalle("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo registrar la acción.",
      );
    } finally {
      envio.current = false;
      setEnviando(false);
    }
  }
  const titulo =
    formulario === "tiempo"
      ? "Registrar tiempo"
      : formulario === "pausar"
        ? "Pausar trabajo"
        : "Bloquear trabajo";
  const descripcion = `${referencia ?? control.paso.nombre}${formulario === "tiempo" ? " · Sin tiempo medido suficiente. ¿Cuánto llevó aproximadamente?" : ""}`;
  const contenido = (
    <>
      {" "}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {formulario === "tiempo" ? (
        <DeclararTiempoPaso
          estimado={control.paso.duracionEstimadaMin}
          busy={ocupado}
          onConfirmar={(opts) => void ejecutar("completar", opts)}
          onCancelar={() => setFormulario(null)}
        />
      ) : (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={id}>
              {formulario === "pausar"
                ? "¿Por qué se pausa?"
                : "¿Qué está frenando este paso?"}
            </FieldLabel>
            {formulario === "pausar" ? (
              <ToggleGroup
                id={id}
                value={motivo ? [motivo] : []}
                onValueChange={(values) => setMotivo(String(values[0] ?? ""))}
                variant="outline"
                spacing={1}
                className="flex-wrap"
                disabled={ocupado}
              >
                {MOTIVOS_PAUSA.map((m) => (
                  <ToggleGroupItem key={m.codigo} value={m.codigo}>
                    {m.etiqueta}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : (
              <Input
                id={id}
                value={motivo}
                maxLength={300}
                disabled={ocupado}
                onChange={(e) => setMotivo(e.target.value)}
              />
            )}
          </Field>
          {formulario === "pausar" && motivo === "otro" && (
            <Field>
              <FieldLabel htmlFor={`${id}-detalle`}>
                Contanos brevemente el motivo
              </FieldLabel>
              <Input
                id={`${id}-detalle`}
                value={detalle}
                maxLength={300}
                disabled={ocupado}
                onChange={(e) => setDetalle(e.target.value)}
              />
            </Field>
          )}
          <div className="flex gap-2">
            <Button
              disabled={
                ocupado ||
                !motivo.trim() ||
                (formulario === "pausar" &&
                  motivo === "otro" &&
                  !detalle.trim())
              }
              onClick={() =>
                void ejecutar(formulario === "pausar" ? "pausar" : "bloquear", {
                  motivo: motivo.trim(),
                  ...(motivo === "otro"
                    ? { motivoDetalle: detalle.trim() }
                    : {}),
                })
              }
            >
              {formulario === "pausar" ? "Pausar" : "Bloquear"}
            </Button>
            <Button
              variant="ghost"
              disabled={ocupado}
              onClick={() => setFormulario(null)}
            >
              Cancelar
            </Button>
          </div>
        </FieldGroup>
      )}
    </>
  );
  if (!acciones.length) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {acciones.map((accion) => {
          const Icono = ICONOS[accion];
          return (
            <Button
              key={accion}
              size="sm"
              variant="outline"
              disabled={ocupado}
              aria-label={`${ETIQUETAS_ACCION[accion]} ${referencia ?? control.paso.nombre}`}
              onClick={() => {
                setError(null);
                if (accion === "bloquear" || accion === "pausar") {
                  setMotivo("");
                  setDetalle("");
                  setFormulario(accion);
                } else if (
                  accion === "completar" &&
                  completarSeriaInstantaneo(control.paso)
                )
                  setFormulario("tiempo");
                else void ejecutar(accion);
              }}
            >
              <Icono data-icon="inline-start" />
              {ETIQUETAS_ACCION[accion]}
            </Button>
          );
        })}
      </div>
      {error && !formulario && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {enLinea ? (
        formulario && (
          <div className="flex flex-col gap-4">
            <p>{descripcion}</p>
            {contenido}
          </div>
        )
      ) : (
        <Dialog
          open={formulario !== null}
          onOpenChange={(open) => {
            if (!open && !ocupado) {
              setFormulario(null);
              setError(null);
            }
          }}
        >
          <DialogContent className={theme.theme} showCloseButton={!ocupado}>
            <DialogHeader>
              <DialogTitle>{titulo}</DialogTitle>
              <DialogDescription>{descripcion}</DialogDescription>
            </DialogHeader>
            {contenido}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
