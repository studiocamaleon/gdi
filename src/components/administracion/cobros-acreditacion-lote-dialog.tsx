"use client";

import * as React from "react";
import { Modal } from "@heroui/react";
import { TesoreriaDialog } from "./tesoreria-dialog";
import { ActionButton } from "@/components/design-system/action-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CobroPendienteAcreditacion } from "@/lib/administracion";
import type { AcreditarCobrosLotePayload } from "@/lib/administracion-api";
import { formatearMoneda, monedaDe } from "@/lib/moneda";
import { cn } from "@/lib/utils";
import styles from "./cobro-acreditacion-dialog.module.css";
import tesoreria from "./tesoreria-view.module.css";

export function CobrosAcreditacionLoteDialog({
  cobros,
  hoy,
  ocupado,
  onClose,
  onConfirmar,
}: {
  cobros: CobroPendienteAcreditacion[];
  hoy: string;
  ocupado: boolean;
  onClose: () => void;
  onConfirmar: (payload: AcreditarCobrosLotePayload) => void;
}) {
  const [fecha, setFecha] = React.useState(hoy);
  const [referencia, setReferencia] = React.useState("");
  const [revisado, setRevisado] = React.useState(false);
  const totales = new Map<string, number>();
  for (const cobro of cobros)
    totales.set(
      cobro.moneda,
      (totales.get(cobro.moneda) ?? 0) + cobro.disponibleReal,
    );
  const fmt = (monto: number, moneda: string) =>
    formatearMoneda(monto, monedaDe(moneda));
  return (
    <TesoreriaDialog
      open
      isDismissable={!ocupado}
      className={styles.dialog}
      onOpenChange={(open) => !open && !ocupado && onClose()}
      title={`Acreditar ${cobros.length} cobros`}
      description="Una misma liquidación para los cobros seleccionados."
    >
      <Modal.Body className={cn(tesoreria.formBody, styles.body)}>
        <FieldGroup>
          <Alert>
            <AlertDescription>
              Se conservan las comisiones y retenciones mostradas de cada cobro.
              Si algún importe difiere del comprobante recibido, corregilo desde
              la acreditación individual.
            </AlertDescription>
          </Alert>
          <Field>
            <FieldLabel htmlFor="lote-fecha">
              Fecha real de acreditación
            </FieldLabel>
            <Input
              id="lote-fecha"
              type="date"
              max={hoy}
              value={fecha}
              disabled={ocupado}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="lote-liq">
              Nombre / referencia de LIQ
            </FieldLabel>
            <Input
              id="lote-liq"
              maxLength={100}
              required
              placeholder="Ej. LIQ-000123"
              value={referencia}
              disabled={ocupado}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </Field>
          <Table aria-label="Resumen de la liquidación">
            <TableHeader>
              <TableRow>
                <TableHead>Cobro</TableHead>
                <TableHead>Comisión + IVA</TableHead>
                <TableHead>Retenciones</TableHead>
                <TableHead>A acreditar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cobros.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.clienteNombre ?? "Sin cliente"}
                    <br />
                    {c.ordenNumero ?? c.metodoNombre}
                  </TableCell>
                  <TableCell>
                    {fmt(c.comisionMonto + c.comisionIvaMonto, c.moneda)}
                  </TableCell>
                  <TableCell>
                    {fmt(
                      c.retenciones.reduce((s, r) => s + r.monto, 0),
                      c.moneda,
                    )}
                  </TableCell>
                  <TableCell>{fmt(c.disponibleReal, c.moneda)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div aria-label="Total a acreditar">
            {[...totales].map(([moneda, total]) => (
              <p key={moneda}>
                Total {moneda}: <strong>{fmt(total, moneda)}</strong>
              </p>
            ))}
          </div>
          <Field orientation="horizontal">
            <Checkbox
              aria-label="Revisé los importes contra la liquidación recibida."
              id="lote-revisado"
              checked={revisado}
              disabled={ocupado}
              onCheckedChange={setRevisado}
            />
            <FieldLabel htmlFor="lote-revisado">
              Revisé los importes contra la liquidación recibida.
            </FieldLabel>
          </Field>
        </FieldGroup>
      </Modal.Body>
      <Modal.Footer className={styles.footer}>
        <div className={styles.actions}>
          <ActionButton
            variant="secondary"
            isDisabled={ocupado}
            onPress={onClose}
          >
            Cancelar
          </ActionButton>
          <ActionButton
            isDisabled={
              ocupado ||
              !fecha ||
              fecha > hoy ||
              !referencia.trim() ||
              !revisado
            }
            onPress={() =>
              onConfirmar({
                cobros: cobros.map((c) => ({
                  id: c.id,
                  fecha,
                  referencia: referencia.trim(),
                  comisionMonto: c.comisionMonto,
                  comisionIvaMonto: c.comisionIvaMonto,
                  retenciones: c.retenciones.map((r) => ({
                    regimen: r.regimen,
                    jurisdiccion: r.jurisdiccion ?? undefined,
                    agente: r.agente ?? undefined,
                    reglaId: r.reglaId ?? undefined,
                    base: r.base,
                    alicuota: r.alicuota,
                    monto: r.monto,
                    nroComprobante: r.nroComprobante ?? undefined,
                  })),
                })),
              })
            }
          >
            {ocupado ? "Acreditando…" : `Acreditar ${cobros.length} cobros`}
          </ActionButton>
        </div>
      </Modal.Footer>
    </TesoreriaDialog>
  );
}
