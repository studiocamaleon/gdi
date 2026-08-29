"use client";

/**
 * <ConfirmacionSalida /> — modal del sistema para navegación con cambios sin
 * guardar. Tres salidas: guardar y salir (primaria), descartar y salir, o
 * quedarse editando. Regla del proyecto: nunca confirm() nativo — siempre
 * modales con la estética del sistema.
 */

import * as React from "react";
import { TriangleAlertIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmacionSalidaProps {
  open: boolean;
  /** Cantidad de cambios sin guardar (para el copy). */
  cambios: number;
  /** Dónde están esos cambios. Por defecto "esta orden". */
  donde?: string;
  /** True mientras corre el guardado en lote. */
  guardando?: boolean;
  onGuardarYSalir: () => void | Promise<void>;
  onDescartarYSalir: () => void;
  onSeguirEditando: () => void;
}

export function ConfirmacionSalida({
  open,
  cambios,
  donde = "esta orden",
  guardando = false,
  onGuardarYSalir,
  onDescartarYSalir,
  onSeguirEditando,
}: ConfirmacionSalidaProps) {
  const plural = cambios === 1 ? "" : "s";
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !guardando) onSeguirEditando();
      }}
    >
      {/* Por encima de los modales propios (.mod-bg va en z-index 60): el
          aviso de que estás por perder lo cargado tiene que verse SIEMPRE
          sobre aquello de lo que estás saliendo. */}
      <AlertDialogContent
        className="gp-alert-modal gp-alert-modal-warning z-[80]"
        overlayClassName="gp-alert-overlay z-[80]"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <TriangleAlertIcon className="size-4 text-amber-600" />
            Cambios sin guardar
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tenés {cambios} cambio{plural} sin guardar en {donde}. Si salís sin
            guardar, se descarta{plural ? "n" : ""}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onSeguirEditando}
            disabled={guardando}
          >
            Seguir editando
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDescartarYSalir}
            disabled={guardando}
          >
            Descartar y salir
          </Button>
          <Button
            type="button"
            onClick={() => void onGuardarYSalir()}
            disabled={guardando}
          >
            {guardando ? "Guardando…" : "Guardar y salir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
