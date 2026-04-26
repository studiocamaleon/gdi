"use client";

/**
 * <ConfirmacionDestructiva /> — dialog de confirmación para acciones
 * irreversibles, patrón GitHub: el usuario debe escribir el nombre del item
 * a borrar/desactivar/quitar para habilitar el botón rojo.
 *
 * Uso (controlado):
 *   const [open, setOpen] = useState(false);
 *   <ConfirmacionDestructiva
 *     open={open}
 *     onOpenChange={setOpen}
 *     titulo="Eliminar producto"
 *     descripcion="Esto elimina el producto y todas sus rutas alternativas."
 *     impacto={[
 *       "Las cotizaciones existentes quedan huérfanas.",
 *       "La configuración por paso se pierde.",
 *     ]}
 *     nombreItem={producto.nombre}
 *     textoConfirmacion={producto.nombre}  // qué tiene que escribir
 *     accionLabel="Eliminar producto"
 *     onConfirmar={async () => { await eliminar(); setOpen(false); }}
 *   />
 *
 * Si no querés copy-name (acciones menos críticas), pasá `requiereTipear={false}`.
 */

import * as React from "react";
import { AlertTriangleIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfirmacionDestructivaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descripcion?: React.ReactNode;
  /** Lista de bullets de qué pasa al confirmar. */
  impacto?: string[];
  /** Nombre humano del item (visible en el dialog para contexto). */
  nombreItem?: string;
  /** Texto exacto que el usuario debe tipear para habilitar el botón. Default: nombreItem. */
  textoConfirmacion?: string;
  /** Si false, omite el input de tipeo (acciones menos críticas). */
  requiereTipear?: boolean;
  /** Label del botón de confirmación. */
  accionLabel: string;
  /** Callback al confirmar. Devuelve promise para mostrar estado de carga. */
  onConfirmar: () => void | Promise<void>;
}

export function ConfirmacionDestructiva({
  open,
  onOpenChange,
  titulo,
  descripcion,
  impacto,
  nombreItem,
  textoConfirmacion,
  requiereTipear = true,
  accionLabel,
  onConfirmar,
}: ConfirmacionDestructivaProps) {
  const palabraEsperada = textoConfirmacion ?? nombreItem ?? "";
  const [tipeado, setTipeado] = React.useState("");
  const [ejecutando, setEjecutando] = React.useState(false);

  // Reset al cerrar
  React.useEffect(() => {
    if (!open) {
      setTipeado("");
      setEjecutando(false);
    }
  }, [open]);

  const habilitado =
    !ejecutando && (!requiereTipear || tipeado.trim() === palabraEsperada.trim());

  const handleConfirmar = async () => {
    if (!habilitado) return;
    setEjecutando(true);
    try {
      await onConfirmar();
    } finally {
      // El parent normalmente cierra el dialog; igual aseguramos el reset si queda abierto
      setEjecutando(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertTriangleIcon className="size-4 text-red-600" />
            </div>
            <div className="flex-1 space-y-1">
              <AlertDialogTitle>{titulo}</AlertDialogTitle>
              {descripcion && (
                <AlertDialogDescription>{descripcion}</AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>

        {impacto && impacto.length > 0 && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-900">
            <div className="mb-1 font-medium">Esto va a:</div>
            <ul className="ml-4 list-disc space-y-0.5">
              {impacto.map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          </div>
        )}

        {requiereTipear && palabraEsperada && (
          <div className="mt-4 space-y-2">
            <Label htmlFor="confirmacion-tipeo" className="text-xs">
              Para confirmar, escribí{" "}
              <span className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">
                {palabraEsperada}
              </span>{" "}
              abajo:
            </Label>
            <Input
              id="confirmacion-tipeo"
              value={tipeado}
              onChange={(e) => setTipeado(e.target.value)}
              placeholder={palabraEsperada}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-sm"
            />
          </div>
        )}

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ejecutando}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirmar} disabled={!habilitado}>
            {ejecutando ? "Procesando..." : accionLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
