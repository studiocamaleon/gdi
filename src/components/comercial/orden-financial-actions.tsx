"use client";

import {
  BadgePercentIcon,
  CircleDollarSignIcon,
  FileXIcon,
  TicketPercentIcon,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";

/** Acciones del resumen. El controlador decide permisos y ejecuta las operaciones. */
export function OrdenFinancialActions({
  empty,
  emitiendo = false,
  guardandoBorrador = false,
  sinComprobante = false,
  togglingFiscal = false,
  operacionPendiente = false,
  cuponAbierto = false,
  cuponFieldId,
  onAgregarCargo,
  onDescuentoOrden,
  onCuponOrden,
  onToggleTratamientoFiscal,
}: {
  empty: boolean;
  emitiendo?: boolean;
  guardandoBorrador?: boolean;
  sinComprobante?: boolean;
  togglingFiscal?: boolean;
  operacionPendiente?: boolean;
  cuponAbierto?: boolean;
  cuponFieldId?: string;
  onAgregarCargo?: () => void;
  onDescuentoOrden?: () => void;
  onCuponOrden?: () => void;
  onToggleTratamientoFiscal?: () => void;
}) {
  if (
    !onAgregarCargo &&
    !onDescuentoOrden &&
    !onCuponOrden &&
    !onToggleTratamientoFiscal
  )
    return null;
  return (
    <div
      role="group"
      aria-label="Condiciones comerciales"
      className="mb-4 flex flex-wrap items-center gap-2"
    >
      {onAgregarCargo && (
        <ActionButton
          variant="outline"
          isIconOnly
          aria-label="Agregar cargo"
          title="Agregar cargo"
          onPress={onAgregarCargo}
          isDisabled={emitiendo || guardandoBorrador || operacionPendiente}
        >
          <CircleDollarSignIcon />
        </ActionButton>
      )}
      {onToggleTratamientoFiscal && (
        <ActionButton
          variant={sinComprobante ? "secondary" : "outline"}
          isIconOnly
          onPress={onToggleTratamientoFiscal}
          isDisabled={togglingFiscal || empty || operacionPendiente}
          aria-pressed={sinComprobante}
          aria-label="Sin comprobante fiscal en el sistema"
          title={
            sinComprobante
              ? "Volver a comprobante fiscal (tecla X)"
              : "Marcar sin comprobante fiscal en el sistema (tecla X)"
          }
        >
          <FileXIcon />
        </ActionButton>
      )}
      {onDescuentoOrden && (
        <ActionButton
          variant="outline"
          isIconOnly
          title="Aplicar descuento"
          onPress={onDescuentoOrden}
          isDisabled={
            emitiendo || guardandoBorrador || empty || operacionPendiente
          }
          aria-label="Aplicar un descuento a toda la orden"
        >
          <BadgePercentIcon />
        </ActionButton>
      )}
      {onCuponOrden && (
        <ActionButton
          variant={cuponAbierto ? "secondary" : "outline"}
          isIconOnly
          title="Ingresar cupón"
          onPress={onCuponOrden}
          isDisabled={
            emitiendo || guardandoBorrador || empty || operacionPendiente
          }
          aria-label="Ingresar cupón"
          aria-expanded={cuponAbierto}
          aria-controls={cuponAbierto ? cuponFieldId : undefined}
        >
          <TicketPercentIcon />
        </ActionButton>
      )}
    </div>
  );
}
