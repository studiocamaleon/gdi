"use client";

/**
 * <AvisoOtEnBorrador /> — se abre al aterrizar en una OT recién convertida
 * desde un presupuesto.
 *
 * Por qué existe: convertir deja la OT en BORRADOR a propósito (le da al
 * comercial una última revisión antes de mandarla al taller), pero para quien
 * no conoce el sistema "convertir" suena a terminado, y la orden se queda
 * quieta sin que nadie lo note. El estado ya se ve en pantalla; el problema no
 * es de información sino de expectativa, así que hace falta una decisión
 * explícita y no un cartel más.
 *
 * Regla del proyecto: nunca confirm() nativo — siempre modales del sistema.
 */

import * as React from "react";
import { FileClockIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface AvisoOtEnBorradorProps {
  open: boolean;
  /** Número de la orden ya creada (OT-2026-0025). */
  numero: string;
  /** True mientras corre la emisión. */
  emitiendo?: boolean;
  onEmitirAhora: () => void | Promise<void>;
  onEmitirDespues: () => void;
}

export function AvisoOtEnBorrador({
  open,
  numero,
  emitiendo = false,
  onEmitirAhora,
  onEmitirDespues,
}: AvisoOtEnBorradorProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Cerrar por afuera equivale a "emitir después": no se pierde nada,
        // la orden ya existe.
        if (!next && !emitiendo) onEmitirDespues();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileClockIcon className="size-4 text-amber-600" />
            {numero} quedó en borrador
          </AlertDialogTitle>
          <AlertDialogDescription>
            El presupuesto ya se convirtió y la orden existe, pero{" "}
            <strong>todavía no está emitida</strong>: el taller no la ve y no
            aparece en el tablero de producción hasta que la emitas. Es a
            propósito, para que puedas revisar la fecha de entrega y los
            productos antes de mandarla.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onEmitirDespues}
            disabled={emitiendo}
          >
            Reviso y la emito después
          </Button>
          <Button
            type="button"
            onClick={() => void onEmitirAhora()}
            disabled={emitiendo}
          >
            {emitiendo ? "Emitiendo…" : "Emitir al taller ahora"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
