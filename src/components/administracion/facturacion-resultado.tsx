"use client";

import Link from "next/link";
import { Chip, Modal } from "@heroui/react";
import { ArrowUpRightIcon, CheckIcon, CircleAlertIcon } from "lucide-react";
import type { ResultadoLoteFacturacion } from "@/lib/administracion";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ActionButton } from "@/components/design-system/action-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import s from "./facturacion.module.css";

export function FacturacionResultado({
  resultado,
  onClose,
}: {
  resultado: ResultadoLoteFacturacion;
  onClose: () => void;
}) {
  const emitidas = resultado.resultados.filter((r) => r.ok).length;
  const errores = resultado.resultados.length - emitidas;
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Resultado de la facturación"
      description={
        resultado.modo === "agrupada"
          ? "Detalle de las órdenes incluidas en la factura agrupada."
          : "Resultado de la emisión, orden por orden."
      }
    >
      <Modal.Body className={s.resultBody}>
        <div className={s.resultSummary}>
          <Chip variant="soft" color="success">
            <CheckIcon aria-hidden />
            {emitidas}{" "}
            {emitidas === 1 ? "orden facturada" : "órdenes facturadas"}
          </Chip>
          {errores > 0 && (
            <Chip variant="soft" color="danger">
              <CircleAlertIcon aria-hidden />
              {errores} sin emitir
            </Chip>
          )}
        </div>
        {errores > 0 && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Hay órdenes que requieren revisión</AlertTitle>
            <AlertDescription>
              Las facturas emitidas se conservan. Revisá el motivo indicado en
              cada orden que no se pudo facturar.
            </AlertDescription>
          </Alert>
        )}
        <ul className={s.resultList} aria-label="Resultado por orden">
          {resultado.resultados.map((r) => (
            <li key={r.ordenId} data-ok={r.ok}>
              <span className={s.resultIcon}>
                {r.ok ? (
                  <CheckIcon aria-hidden />
                ) : (
                  <CircleAlertIcon aria-hidden />
                )}
              </span>
              <div>
                <strong>{r.numero}</strong>
                <p>
                  {r.ok
                    ? "Facturada"
                    : r.error || "No se pudo emitir el comprobante."}
                </p>
                {r.comprobante && (
                  <Link
                    href={`/administracion/comprobantes/${r.comprobante.id}`}
                    onClick={onClose}
                  >
                    {r.ok
                      ? r.comprobante.numeroCompleto
                      : "Revisar comprobante"}
                    <ArrowUpRightIcon aria-hidden />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Modal.Body>
      <Modal.Footer className={s.resultFooter}>
        <ActionButton variant="outline" onPress={onClose}>
          Volver a Facturación
          <ArrowUpRightIcon aria-hidden />
        </ActionButton>
      </Modal.Footer>
    </FormDialog>
  );
}
