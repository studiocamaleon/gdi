"use client";

import * as React from "react";
import { toast } from "sonner";
import type { OrdenTrabajoDetalle } from "@/lib/ordenes-trabajo";
import type { PropuestaItem } from "@/lib/propuestas";
import {
  aplicarDescuentoOrden,
  type DescuentoOrdenPayload,
} from "@/lib/ordenes-trabajo-api";
import { OrdenFinancialActions } from "./orden-financial-actions";
import { DescuentoOrdenDialog } from "./descuento-orden-dialog";
import { OrdenCuponField } from "./orden-cupon-field";

/** Precio de una OT persistida, separado de la edición del trabajo de taller. */
export function DescuentosOrdenCreada({
  orden,
  items,
  conCupones,
  bloqueado,
  sinComprobante = false,
  togglingFiscal = false,
  onToggleTratamientoFiscal,
  onActualizada,
}: {
  orden: OrdenTrabajoDetalle;
  items: PropuestaItem[];
  conCupones: boolean;
  bloqueado: boolean;
  sinComprobante?: boolean;
  togglingFiscal?: boolean;
  onToggleTratamientoFiscal?: () => void;
  onActualizada: (orden: OrdenTrabajoDetalle) => void;
}) {
  const [manual, setManual] = React.useState(false);
  const [cupon, setCupon] = React.useState(false);
  const [pendiente, setPendiente] = React.useState(false);
  const enCurso = React.useRef(false);
  const facturada = (orden.facturadoTotal ?? 0) > 0;
  const impedido = bloqueado || facturada || orden.estado === "cancelada";
  async function aplicar(
    payload: Omit<DescuentoOrdenPayload, "expectedVersion">,
  ) {
    if (impedido || enCurso.current) return false;
    enCurso.current = true;
    setPendiente(true);
    try {
      const actualizada = await aplicarDescuentoOrden(orden.id, {
        ...payload,
        expectedVersion: orden.version,
      });
      onActualizada(actualizada);
      setManual(false);
      setCupon(false);
      toast.success(
        payload.modo === "quitar"
          ? "Descuento quitado de la orden."
          : "Descuento guardado. Total y saldo actualizados.",
      );
      return true;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo aplicar el descuento.",
      );
      return false;
    } finally {
      enCurso.current = false;
      setPendiente(false);
    }
  }
  return (
    <>
      <OrdenFinancialActions
        empty={!items.length}
        operacionPendiente={pendiente || impedido}
        sinComprobante={sinComprobante}
        togglingFiscal={togglingFiscal}
        onToggleTratamientoFiscal={onToggleTratamientoFiscal}
        onDescuentoOrden={() => setManual(true)}
        onCuponOrden={conCupones ? () => setCupon((v) => !v) : undefined}
        cuponAbierto={cupon}
        cuponFieldId="cupon-orden-creada"
      />
      {facturada && (
        <p className="mb-3 text-xs text-muted-foreground">
          La orden tiene facturación. Revisá los comprobantes antes de cambiar
          su precio.
        </p>
      )}
      {cupon && (
        <OrdenCuponField
          id="cupon-orden-creada"
          isDisabled={pendiente || impedido}
          onValidar={(codigo) => aplicar({ modo: "cupon", codigo })}
        />
      )}
      <DescuentoOrdenDialog
        target={manual ? { scope: "orden", itemId: null } : null}
        items={items}
        aplicando={pendiente}
        onClose={() => setManual(false)}
        onApply={(_scope, _id, descuento) =>
          void aplicar(
            descuento
              ? { modo: "manual", tipo: descuento.tipo, valor: descuento.valor }
              : { modo: "quitar" },
          )
        }
      />
    </>
  );
}
