"use client";

import { Modal } from "@heroui/react";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ActionButton } from "@/components/design-system/action-button";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda } from "@/lib/moneda";
import type { CobroDraft } from "./cobro-formulario";

export function CobroConfirmacion({
  draft,
  registroAlEmitir,
  enviando,
  onCancelar,
  onConfirmar,
}: {
  draft: CobroDraft;
  registroAlEmitir: boolean;
  enviando: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const { moneda } = useConfigRegional();
  const detalles = [
    ["Medio de pago", draft.metodoNombre],
    ["Cuenta de destino", draft.cuentaDestinoNombre],
    ["Fecha del cobro", draft.payload.fecha.split("-").reverse().join("/")],
    ...(draft.payload.referencia ? [["N° de operación", draft.payload.referencia]] : []),
    ...(draft.payload.valor ? [["Número del cheque/echeq", draft.payload.valor.numero]] : []),
  ];

  return (
    <FormDialog
      isOpen
      isDismissable={!enviando}
      onOpenChange={(open) => {
        if (!open && !enviando) onCancelar();
      }}
      title="Confirmar cobro"
      description="Revisá el monto y el medio de pago antes de confirmar."
    >
      <Modal.Body className="flex flex-col gap-5 px-6 py-5">
        <dl className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">Monto a cobrar</dt>
            <dd className="text-2xl font-semibold">
              {formatearMoneda(draft.payload.montoBruto, moneda)} {moneda.codigo}
            </dd>
          </div>
          {detalles.map(([nombre, valor]) => (
            <div key={nombre} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <dt className="text-sm text-muted-foreground">{nombre}</dt>
              <dd className="font-medium break-words">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">
          {registroAlEmitir
            ? "El cobro se agregará a la orden y se registrará al emitirla."
            : "Una vez registrado, el cobro no se puede editar."}
        </p>
      </Modal.Body>
      <Modal.Footer className="flex flex-wrap justify-end gap-2 px-6 py-4">
        <ActionButton variant="outline" autoFocus onPress={onCancelar} isDisabled={enviando}>
          Volver a corregir
        </ActionButton>
        <ActionButton onPress={onConfirmar} isPending={enviando} isDisabled={enviando}>
          {enviando ? "Registrando…" : registroAlEmitir ? "Confirmar y agregar" : "Confirmar y registrar"}
        </ActionButton>
      </Modal.Footer>
    </FormDialog>
  );
}
