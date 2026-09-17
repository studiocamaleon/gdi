"use client";

import { Modal } from "@heroui/react";
import { ReceiptTextIcon } from "lucide-react";
import type { OrdenFacturable } from "@/lib/administracion";
import { formatearMoneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ActionButton } from "@/components/design-system/action-button";
import s from "./facturacion.module.css";

export type LotePorConfirmar = {
  ordenes: Pick<
    OrdenFacturable,
    "ordenId" | "numero" | "clienteNombre" | "saldoSinFacturar"
  >[];
  modo: "por_orden" | "agrupada";
};

export function FacturacionConfirmacion({
  lote,
  enviando,
  onCancelar,
  onConfirmar,
}: {
  lote: LotePorConfirmar;
  enviando: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const { moneda } = useConfigRegional();
  const fmt = (monto: number) => formatearMoneda(monto, moneda);
  const cantidadFacturas = lote.modo === "agrupada" ? 1 : lote.ordenes.length;
  const total = lote.ordenes.reduce((s, o) => s + o.saldoSinFacturar, 0);
  return (
    <FormDialog
      isOpen
      isDismissable={!enviando}
      onOpenChange={(open) => {
        if (!open && !enviando) onCancelar();
      }}
      title="Confirmar emisión"
      description="Revisá las órdenes y el importe antes de emitir."
    >
      <Modal.Body className={s.resultBody}>
        <ul className={s.confirmationOrders} aria-label="Órdenes a facturar">
          {lote.ordenes.map((o) => (
            <li key={o.ordenId}>
              <span>
                <strong>{o.numero}</strong>
                <small>{o.clienteNombre ?? "Mostrador / sin cliente"}</small>
              </span>
              <span>{fmt(o.saldoSinFacturar)}</span>
            </li>
          ))}
        </ul>
        <dl className={s.selectionTotal}>
          <div>
            <dt>Modalidad</dt>
            <dd>
              {lote.modo === "agrupada"
                ? "Una factura agrupada"
                : "Una factura por orden"}
            </dd>
          </div>
          <div>
            <dt>Facturas a emitir</dt>
            <dd>{cantidadFacturas}</dd>
          </div>
          <div>
            <dt>Total a facturar</dt>
            <dd>{fmt(total)}</dd>
          </div>
        </dl>
        <p className={s.confirmationHint} aria-live="polite">
          {enviando
            ? "Emitiendo. El resultado se mostrará al terminar."
            : cantidadFacturas === 1
              ? "Al confirmar se emitirá la factura y quedará vinculada a las órdenes indicadas."
              : "Al confirmar se emitirán las facturas y quedarán vinculadas a las órdenes indicadas."}
        </p>
      </Modal.Body>
      <Modal.Footer className={s.confirmationFooter}>
        <ActionButton
          variant="outline"
          autoFocus
          onPress={onCancelar}
          isDisabled={enviando}
        >
          Cancelar
        </ActionButton>
        <ActionButton
          onPress={onConfirmar}
          isPending={enviando}
          isDisabled={enviando}
        >
          <ReceiptTextIcon aria-hidden />
          {enviando ? "Emitiendo…" : "Confirmar y emitir"}
        </ActionButton>
      </Modal.Footer>
    </FormDialog>
  );
}
