"use client";
import { useImpresionDirecta } from "@/components/navigation/capacidades-provider";

import { useState } from "react";
import { EtiquetaOrdenDialog } from "@/components/impresion/etiqueta-orden-dialog";
import { ArrowUpRight, CalendarDays, CircleCheck, Printer } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { FormDialog } from "@/components/design-system/form-dialog";
import { fechaConDia } from "@/lib/fecha";
import type { AvisoFinalizacionOrden } from "@/lib/ordenes-trabajo-api";
import s from "./orden-finalizada-dialog.module.css";

const cantidad = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

export function OrdenFinalizadaDialog({
  aviso,
  puedeVerOrden,
  onClose,
}: {
  aviso: AvisoFinalizacionOrden;
  puedeVerOrden: boolean;
  onClose: () => void;
}) {
  const impresionDirecta = useImpresionDirecta();
  const [imprimir, setImprimir] = useState(false);
  if (imprimir)
    return (
      <EtiquetaOrdenDialog
        ordenId={aviso.ordenId}
        onClose={() => setImprimir(false)}
      />
    );
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <FormDialog
        isOpen
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={
          <span className={s.title}>
            <CircleCheck aria-hidden="true" />
            Producción finalizada
          </span>
        }
        description="Todos los trabajos de esta orden están terminados. Ya podés preparar la entrega."
        className={s.dialog}
      >
        <div className={s.body}>
          <div className={s.identity}>
            <span>ORDEN DE TRABAJO</span>
            <strong>{aviso.ordenNumero}</strong>
            <p>{aviso.clienteNombre}</p>
          </div>
          <table
            className={s.table}
            aria-label="Trabajos de la orden finalizada"
          >
            <thead>
              <tr>
                <th scope="col">Trabajo</th>
                <th scope="col">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {aviso.trabajos.map((trabajo) => (
                <tr key={trabajo.id}>
                  <td>{trabajo.nombre}</td>
                  <td>
                    {cantidad.format(trabajo.cantidad)}{" "}
                    <span>{trabajo.unidad}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {aviso.fechaEntrega && (
            <div className={s.delivery}>
              <CalendarDays aria-hidden="true" />
              <div>
                <span>Entrega comprometida</span>
                <time dateTime={aviso.fechaEntrega}>
                  {fechaConDia(aviso.fechaEntrega)}
                </time>
              </div>
            </div>
          )}
        </div>
        <div className={s.footer}>
          <ActionButton variant="outline" onPress={() => setImprimir(true)}>
            <Printer aria-hidden="true" />
            {impresionDirecta ? "Imprimir etiqueta" : "Descargar etiqueta"}
          </ActionButton>
          {puedeVerOrden && (
            <ActionLink
              variant="outline"
              href={`/produccion/ordenes/${aviso.ordenId}`}
              onClick={onClose}
            >
              Ver OT
              <ArrowUpRight />
            </ActionLink>
          )}
          <ActionButton variant="primary" onPress={onClose} autoFocus>
            Entendido
          </ActionButton>
        </div>
      </FormDialog>
    </DesignSystemProvider>
  );
}
