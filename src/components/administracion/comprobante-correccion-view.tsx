"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@heroui/react";
import { toast } from "sonner";
import { crearNotaCreditoTotal } from "@/lib/administracion-api";
import {
  COMPROBANTE_ESTADO_LABELS,
  formatCuitODash,
  type Comprobante,
} from "@/lib/administracion";
import { formatearMonedaDoc, monedaDe } from "@/lib/moneda";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import listPage from "@/components/design-system/list-page.module.css";
import s from "./comprobante.module.css";

export function ComprobanteCorreccionView({ origen }: { origen: Comprobante }) {
  const router = useRouter();
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const [guardando, setGuardando] = useState(false);
  const valido =
    origen.tipo === "factura" &&
    origen.estado === "emitido" &&
    !origen.corregido &&
    !origen.notasCredito?.length;
  async function preparar() {
    if (guardando || !valido) return;
    setGuardando(true);
    try {
      const nota = await crearNotaCreditoTotal(origen.id);
      toast.success("Nota de crédito preparada. Revisala antes de emitir.");
      router.push(`/administracion/comprobantes/${nota.id}`);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "No se pudo preparar la nota de crédito.",
      );
      setGuardando(false);
    }
  }
  return (
    <section {...scope} className={`${theme} ${listPage.page} ${s.page}`}>
      <header className={listPage.header}>
        <div>
          <h1>Anular factura con nota de crédito</h1>
          <p className={listPage.subtitle}>
            Corrección total de {origen.numeroCompleto}
          </p>
        </div>
        <ActionLink
          variant="outline"
          href={`/administracion/comprobantes/${origen.id}`}
        >
          Volver a la factura
        </ActionLink>
      </header>
      <Card className={s.card}>
        <Card.Header className={s.cardHeader}>
          <div>
            <Card.Title>Datos de la factura original</Card.Title>
            <Card.Description>
              La nota de crédito conserva el receptor y la letra originales.
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Content className={s.cardBody}>
          {origen.notasCredito?.map((nota) => (
            <ActionLink
              key={nota.id}
              variant="outline"
              href={`/administracion/comprobantes/${nota.id}`}
            >
              Abrir nota de crédito · {COMPROBANTE_ESTADO_LABELS[nota.estado]} ·{" "}
              {formatearMonedaDoc(nota.total, monedaDe(origen.moneda))}
            </ActionLink>
          ))}
          <dl className={s.infoGrid}>
            <div>
              <dt>Cliente</dt>
              <dd>{origen.clienteNombre}</dd>
            </div>
            <div>
              <dt>Razón social</dt>
              <dd>{origen.clienteRazonSocial || origen.clienteNombre}</dd>
            </div>
            <div>
              <dt>CUIT</dt>
              <dd>{formatCuitODash(origen.clienteCuit)}</dd>
            </div>
            <div>
              <dt>Nota de crédito</dt>
              <dd>{origen.letra}</dd>
            </div>
            <div>
              <dt>Total a acreditar</dt>
              <dd>
                {formatearMonedaDoc(origen.total, monedaDe(origen.moneda))}
              </dd>
            </div>
            <div>
              <dt>Órdenes vinculadas</dt>
              <dd>
                {origen.ordenes.map((o) => o.numero).join(", ") ||
                  origen.ordenNumero ||
                  "Sin orden"}
              </dd>
            </div>
          </dl>
          <Alert>
            <AlertTitle>
              {valido
                ? "Primero, revisar el borrador"
                : "Esta factura ya tiene una corrección o no está emitida"}
            </AlertTitle>
            <AlertDescription>
              {valido
                ? "Se copiarán todos los ítems, descuentos e impuestos. Al emitir la nota, se libera el importe facturado de las órdenes y se conservan sus pagos. Después podés volver a facturarlas con los datos actuales del cliente."
                : "Revisá las notas existentes antes de preparar otra anulación total."}
            </AlertDescription>
          </Alert>
        </Card.Content>
        <Card.Footer>
          <ActionButton
            onPress={() => void preparar()}
            isPending={guardando}
            isDisabled={guardando || !valido}
          >
            Crear borrador de nota de crédito
          </ActionButton>
        </Card.Footer>
      </Card>
    </section>
  );
}
