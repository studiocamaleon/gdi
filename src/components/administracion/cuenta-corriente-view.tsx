"use client";
import { useCapacidad } from "@/components/navigation/capacidades-provider";

import * as React from "react";
import Link from "next/link";
import { Card, Chip, Modal } from "@heroui/react";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  ChartNoAxesColumnIcon,
  CheckIcon,
  ChevronRightIcon,
  CoinsIcon,
  FileTextIcon,
  InfoIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "lucide-react";

import {
  TRAMOS_AGING,
  TRAMO_AGING_LABELS,
  formatCuitODash,
  type CuentaCorriente,
  type MovimientoCuentaCorriente,
} from "@/lib/administracion";
import { CONDICION_FISCAL_LABELS, type CondicionFiscal } from "@/lib/clientes";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda } from "@/lib/moneda";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { FormDialog } from "@/components/design-system/form-dialog";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import listPage from "@/components/design-system/list-page.module.css";
import styles from "./cuenta-corriente.module.css";

/** Conserva la moneda y los centavos del saldo. */
function useFmt() {
  const { moneda } = useConfigRegional();
  return (n: number) => formatearMoneda(n, moneda);
}

function AllocationGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ nombre: string; monto: number; resto?: boolean }>;
}) {
  const fmt = useFmt();
  return (
    <section className={styles.allocationGroup}>
      <h3>{title}</h3>
      {items.map((item, index) => (
        <div
          key={index}
          className={styles.allocationLine}
          data-resto={item.resto || undefined}
        >
          {item.resto ? <InfoIcon aria-hidden /> : <CheckIcon aria-hidden />}
          <span>{item.nombre}</span>
          <span>{fmt(item.monto)}</span>
        </div>
      ))}
    </section>
  );
}

function LedgerRow({ m }: { m: MovimientoCuentaCorriente }) {
  const fmt = useFmt();
  // La API conserva la convención contable (debe - haber). En pantalla
  // mostramos la perspectiva del cliente: los pagos suman y los cargos restan.
  const saldoCliente = -m.saldo;
  const conSigno = (monto: number) =>
    `${monto > 0 ? "+ " : monto < 0 ? "− " : ""}${fmt(Math.abs(monto))}`;
  const [open, setOpen] = React.useState(false);
  const detailId = React.useId();
  const tiene = !!m.imputaciones?.length || !!m.aplicaciones?.length;
  return (
    <>
      <TableRow
        data-expandable={tiene || undefined}
        data-expanded={open || undefined}
        onClick={(event) => {
          if (tiene && !(event.target as HTMLElement).closest("button"))
            setOpen((value) => !value);
        }}
      >
        <TableCell className={styles.date}>
          <time dateTime={m.fecha}>{m.fecha}</time>
        </TableCell>
        <TableCell>
          <div className={styles.concept}>
            {tiene ? (
              <ActionButton
                variant="ghost"
                isIconOnly
                className={styles.toggle}
                aria-label={`${open ? "Ocultar" : "Ver"} aplicaciones de ${
                  m.descripcion
                }`}
                aria-expanded={open}
                aria-controls={detailId}
                onPress={() => setOpen((value) => !value)}
              >
                <ChevronRightIcon />
              </ActionButton>
            ) : (
              <span className={styles.disclosureSpacer} aria-hidden />
            )}
            <Chip
              size="sm"
              variant="soft"
              color={
                m.tipo === "cobro" || m.tipo === "nc" ? "success" : "default"
              }
              className={styles.type}
            >
              {m.sigla}
            </Chip>
            <div>
              <span className={styles.conceptTitle}>{m.descripcion}</span>
              {m.tipo === "orden" && m.facturadoPct !== undefined && (
                <span className={styles.conceptHint}>
                  Facturado: {m.facturadoPct}%
                </span>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell className={`${styles.number} ${styles.debit}`}>
          {m.debe > 0 ? conSigno(-m.debe) : <span className={styles.muted}>—</span>}
        </TableCell>
        <TableCell className={`${styles.number} ${styles.credit}`}>
          {m.haber > 0 ? conSigno(m.haber) : <span className={styles.muted}>—</span>}
        </TableCell>
        <TableCell
          className={`${styles.number} ${styles.balanceCell}`}
          data-balance={saldoCliente < 0 ? "debe" : saldoCliente > 0 ? "favor" : "cero"}
        >
          {conSigno(saldoCliente)}
        </TableCell>
      </TableRow>
      {open && tiene && (
        <TableRow>
          <TableCell colSpan={5} className={styles.expandedCell}>
            <div id={detailId} className={styles.allocations}>
              {!!m.aplicaciones?.length && (
                <AllocationGroup
                  title="Aplicado comercialmente a"
                  items={m.aplicaciones}
                />
              )}
              {!!m.imputaciones?.length && (
                <AllocationGroup
                  title="Imputado fiscalmente a"
                  items={m.imputaciones}
                />
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function AgingModal({
  cc,
  onClose,
}: {
  cc: CuentaCorriente;
  onClose: () => void;
}) {
  const fmt = useFmt();
  const total = cc.agingTotal;
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Vencimientos pendientes"
      description={`${cc.cliente.nombre} · saldo pendiente de pago, ordenado por vencimiento.`}
      className={styles.modal}
    >
      <Modal.Body className={styles.agingBody}>
        <div className={styles.agingTotal}>
          <span>Saldo pendiente de pago</span>
          <strong>{fmt(total)}</strong>
        </div>
        {TRAMOS_AGING.map((tramo) => (
          <div key={tramo} className={styles.agingRow} data-tramo={tramo}>
            <div className={styles.agingLabel}>
              <span aria-hidden />
              <span>
                {TRAMO_AGING_LABELS[tramo]}
                {tramo !== "a_vencer" && tramo !== "d0_30" ? " días" : ""}
              </span>
              <strong>{fmt(cc.aging[tramo])}</strong>
            </div>
            <div className={styles.meter} aria-hidden>
              <div
                className={styles.meterFill}
                style={{
                  width: `${total ? (cc.aging[tramo] / total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
        {(cc.sinVencimiento ?? 0) > 0 && (
          <p className={styles.hint}>
            «A vencer» incluye {fmt(cc.sinVencimiento!)} de órdenes cuyo
            vencimiento todavía no está definido. Se fija al finalizar la OT,
            según las condiciones del cliente.
          </p>
        )}
      </Modal.Body>
      <Modal.Footer className={styles.modalFooter}>
        <ActionButton variant="outline" onPress={onClose}>
          Cerrar detalle
        </ActionButton>
      </Modal.Footer>
    </FormDialog>
  );
}

export function CuentaCorrienteView({ cc }: { cc: CuentaCorriente }) {
  const conPdf = useCapacidad("documentos_pdf");
  const fmt = useFmt();
  const theme = useDesignTheme();
  const scope = useDesignScope();
  const [aging, setAging] = React.useState(false);
  const saldo = cc.saldo;
  const pct = cc.usoLimitePct;
  const limite = cc.cliente.limiteCredito;
  const saldoCliente = -saldo;
  const vencido = Math.round(
    (cc.aging.d0_30 + cc.aging.d31_60 + cc.aging.d61_90 + cc.aging.d90_mas) * 100,
  ) / 100;
  const conSigno = (monto: number) =>
    `${monto > 0 ? "+ " : monto < 0 ? "− " : ""}${fmt(Math.abs(monto))}`;

  return (
    <section
      {...scope}
      data-visual="brand"
      className={`${theme} ${listPage.page} ${styles.page}`}
    >
      <ActionLink href="/crm/clientes" variant="ghost" className={styles.back}>
        <ArrowLeftIcon />
        Volver a clientes
      </ActionLink>
      <header className={listPage.header}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>CRM · Gestión de clientes</p>
          <h1>
            Cuenta corriente<span className={styles.dot}>.</span>
          </h1>
          <div className={styles.clientLine}>
            <strong>{cc.cliente.nombre}</strong>
            <span>
              {CONDICION_FISCAL_LABELS[
                cc.cliente.condicionFiscal as CondicionFiscal
              ] ?? cc.cliente.condicionFiscal}
            </span>
            <span>CUIT {formatCuitODash(cc.cliente.cuit)}</span>
            {cc.cliente.vendedor && (
              <span>Vendedor: {cc.cliente.vendedor}</span>
            )}
          </div>
        </div>
        <div className={styles.actions}>
          {conPdf && <ActionLink
            href={`/api/backend/administracion/clientes/${cc.cliente.id}/cuenta-corriente/pdf`}
            prefetch={false}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
          >
            <FileTextIcon />
            Estado de cuenta PDF
          </ActionLink>}
          <ActionLink
            href={`/administracion/cobros/nuevo?clienteId=${cc.cliente.id}`}
            prefetch={false}
          >
            <CoinsIcon />
            Registrar cobro
            <ArrowUpRightIcon />
          </ActionLink>
        </div>
      </header>

      <div className={styles.summary} aria-label="Resumen de cuenta corriente">
        <Card
          className={`${styles.summaryCard} ${styles.balance}`}
          aria-label="Saldo total"
          data-status={saldoCliente < 0 ? "debe" : saldoCliente > 0 ? "favor" : "cero"}
        >
          <div className={styles.summaryHeader}>
            <span className={styles.summaryLabel}>Saldo total</span>
            <span className={styles.summaryIcon}><WalletIcon aria-hidden /></span>
          </div>
          <strong className={styles.amount}>
            {conSigno(saldoCliente)}
          </strong>
          <p className={styles.hint}>
            {saldoCliente < 0
              ? "Saldo a pagar, incluido lo que aún no venció."
              : saldoCliente > 0
                ? "Saldo a favor del cliente."
                : "Saldo total en cero."}
          </p>
        </Card>
        <Card className={styles.summaryCard} aria-label="Saldo vencido">
          <div className={styles.summaryHeader}>
            <span className={styles.summaryLabel}>Saldo vencido</span>
            <span className={styles.summaryIcon}><ReceiptTextIcon aria-hidden /></span>
          </div>
          <strong className={`${styles.amount} ${vencido > 0 ? styles.debit : ""}`}>
            {conSigno(-vencido)}
          </strong>
          <div className={styles.pendingDetail}>
            <p className={styles.hint}>
              {vencido > 0
                ? "Pagos pendientes fuera de término."
                : "No hay pagos vencidos."}
            </p>
            {cc.agingTotal > 0 && (
              <ActionButton variant="ghost" onPress={() => setAging(true)}>
                <ChartNoAxesColumnIcon />
                Ver vencimientos
                <ArrowUpRightIcon />
              </ActionButton>
            )}
          </div>
        </Card>
      </div>

      <details className={styles.creditConditions}>
        <summary>
          <ShieldCheckIcon aria-hidden />
          Condiciones de crédito
          <ChevronRightIcon aria-hidden />
        </summary>
        <Card className={styles.creditDetails}>
          {cc.cliente.plazoCuentaCorrienteDias === null ? (
            <>
              <strong className={styles.creditTitle}>Venta común</strong>
              <p className={styles.hint}>
                Cuenta corriente no habilitada. Las órdenes vencen al finalizar.
              </p>
            </>
          ) : limite === null ? (
            <>
              <strong className={styles.creditTitle}>
                Sin límite de crédito
              </strong>
              <p className={styles.hint}>
                Cuenta corriente a {cc.cliente.plazoCuentaCorrienteDias} días.
              </p>
            </>
          ) : (
            <>
              <strong className={styles.creditTitle}>
                {fmt(limite)}{" "}
                <span className={styles.hint}>· {pct ?? 0}% utilizado</span>
              </strong>
              <div className={styles.meter} aria-hidden>
                <div
                  className={styles.meterFill}
                  data-tone={
                    cc.excedido
                      ? "danger"
                      : (pct ?? 0) > 80
                      ? "warning"
                      : "normal"
                  }
                  style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }}
                />
              </div>
              <p className={styles.hint}>
                Usa {fmt(Math.max(0, saldo))} · plazo de{" "}
                {cc.cliente.plazoCuentaCorrienteDias} días.
              </p>
              {cc.excedido && (
                <p className={styles.creditAlert}>
                  Supera el límite en {fmt(cc.excedente)}.
                </p>
              )}
            </>
          )}
          <Link
            href={`/crm/clientes/${cc.cliente.id}`}
            className={styles.creditLink}
          >
            Ver ficha y condiciones
            <ArrowUpRightIcon aria-hidden />
          </Link>
        </Card>
      </details>

      <Card className={styles.ledger}>
        <Card.Header className={styles.ledgerHeader}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionIcon} aria-hidden>
              <BookOpenIcon />
            </span>
            <div>
              <Card.Title className={styles.sectionTitle}>
                Movimientos de la cuenta
              </Card.Title>
              <Card.Description className={styles.sectionDescription}>
                Cargos desde la emisión de cada orden y pagos recibidos, con el saldo después de cada movimiento.
              </Card.Description>
            </div>
          </div>
          <div className={styles.balanceLegend} aria-label="Cómo leer el saldo">
            <span className={styles.debit}>− Debe</span>
            <span className={styles.credit}>+ A favor</span>
            <span>0 Al día</span>
          </div>
        </Card.Header>
        {cc.movimientos.length === 0 ? (
          <Empty className={styles.empty}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpenIcon />
              </EmptyMedia>
              <EmptyTitle>Todavía no hay movimientos</EmptyTitle>
              <EmptyDescription>
                Cuando se emita una orden de este cliente o se registre un
                cobro, vas a ver su detalle acá.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <Table
              className={styles.table}
              aria-label={`Cuenta corriente de ${cc.cliente.nombre}`}
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className={styles.number}>Cargos</TableHead>
                  <TableHead className={styles.number}>Pagos y créditos</TableHead>
                  <TableHead
                    className={styles.number}
                    title="Negativo: debe. Positivo: a favor. El vencimiento se consulta por separado."
                  >
                    Saldo
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cc.movimientos.map((m) => (
                  <LedgerRow key={m.id} m={m} />
                ))}
              </TableBody>
            </Table>
            <Card.Footer className={styles.ledgerFooter}>
              <div>
                <p className={styles.footerLabel}>
                  {cc.movimientos.length}{" "}
                  {cc.movimientos.length === 1 ? "movimiento" : "movimientos"} ·
                  más recientes primero
                </p>
              </div>
            </Card.Footer>
          </>
        )}
      </Card>
      {aging && <AgingModal cc={cc} onClose={() => setAging(false)} />}
    </section>
  );
}
