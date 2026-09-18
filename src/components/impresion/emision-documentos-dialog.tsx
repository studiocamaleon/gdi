"use client";
import { useState } from "react";
import { Printer } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { FormDialog } from "@/components/design-system/form-dialog";
import { leerImpresora } from "@/lib/impresora-puesto";
import { ImpresoraPuestoForm } from "./impresora-puesto-form";
import { useImpresionDocumentos } from "./documentos-impresion-provider";
import s from "./documentos-impresion.module.css";

export function EmisionDocumentosDialog({
  cantidad,
  onClose,
  onEmitir,
}: {
  cantidad: number;
  onClose: () => void;
  onEmitir: (imprimir: boolean) => void;
}) {
  const { tenantId } = useImpresionDocumentos();
  const [config, setConfig] = useState(() =>
    leerImpresora(tenantId, "documentos"),
  );
  const [configurando, setConfigurando] = useState(!config.impresora);
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <FormDialog
        isOpen
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title="Emitir orden de trabajo"
        description={`${cantidad} documento${cantidad === 1 ? "" : "s"} de centro de copiado en A4 blanco y negro.`}
        className={s.dialog}
      >
        <div className={s.body}>
          <p>
            Guardaremos la orden y sus archivos. Después enviaremos los PDF
            disponibles con las copias y la faz cotizadas.
          </p>
          {configurando ? (
            <ImpresoraPuestoForm
              uso="documentos"
              tenantId={tenantId}
              inicial={config}
              onGuardar={(c) => {
                setConfig(c);
                setConfigurando(false);
              }}
            />
          ) : (
            <div className={s.destino}>
              <strong>{config.impresora}</strong>
              <ActionButton
                variant="tertiary"
                onPress={() => setConfigurando(true)}
              >
                Cambiar impresora
              </ActionButton>
            </div>
          )}
          <p className={s.nota}>
            Se abrirá el panel de impresión para seguir cada envío. Los
            documentos que necesiten revisión quedarán pendientes en la OT.
          </p>
        </div>
        <div className={s.footer}>
          <ActionButton variant="tertiary" onPress={onClose}>
            Volver
          </ActionButton>
          <ActionButton variant="outline" onPress={() => onEmitir(false)}>
            Emitir sin imprimir
          </ActionButton>
          <ActionButton
            isDisabled={!config.impresora || configurando}
            onPress={() => onEmitir(true)}
          >
            <Printer data-icon="inline-start" />
            Emitir e imprimir
          </ActionButton>
        </div>
      </FormDialog>
    </DesignSystemProvider>
  );
}
