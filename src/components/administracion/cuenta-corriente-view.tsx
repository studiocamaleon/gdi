"use client";

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

/** Mantiene moneda del tenant y precisión de la presentación original. */
function useFmt() {
  const { moneda } = useConfigRegional();
  return (n: number) => formatearMoneda(n, moneda, { decimales: 0 });
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
        <TableCell className={styles.number}>
          {m.debe > 0 ? fmt(m.debe) : <span className={styles.muted}>—</span>}
        </TableCell>
        <TableCell className={`${styles.number} ${styles.credit}`}>
          {m.haber > 0 ? fmt(m.haber) : <span className={styles.muted}>—</span>}
        </TableCell>
        <TableCell className={`${styles.number} ${styles.balanceCell}`}>
          {fmt(m.saldo)}
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
      title="Antigüedad del saldo"
      description={`${cc.cliente.nombre} · distribución de la deuda por vencimiento.`}
      className={styles.modal}
    >
      <Modal.Body className={styles.agingBody}>
        <div className={styles.agingTotal}>
          <span>Total deudor</span>
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
  const fmt = useFmt();
  const theme = useDesignTheme();
  const scope = useDesignScope();
  const [aging, setAging] = React.useState(false);
  const saldo = cc.saldo;
  const pct = cc.usoLimitePct;
  const limite = cc.cliente.limiteCredito;
  const estadoSaldo =
    saldo > 0
      ? "Saldo deudor"
      : saldo < 0
      ? "Saldo a favor del cliente"
      : "Cuenta saldada";

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
          <ActionLink
            href={`/api/backend/administracion/clientes/${cc.cliente.id}/cuenta-corriente/pdf`}
            prefetch={false}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
          >
            <FileTextIcon />
            Estado de cuenta PDF
          </ActionLink>
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
          data-status={saldo > 0 ? "deudor" : saldo < 0 ? "favor" : "cero"}
        >
          <div className={styles.summaryHeader}>
            <span className={styles.summaryLabel}>Saldo actual</span>
            <span className={styles.summaryIcon}>
              <WalletIcon aria-hidden />
            </span>
          </div>
          <strong className={styles.amount}>{fmt(saldo)}</strong>
          <span className={styles.balanceStatus}>
            <span className={styles.statusDot} aria-hidden />
            {estadoSaldo}
          </span>
        </Card>
        <Card className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <span className={styles.summaryLabel}>Órdenes sin cobrar</span>
            <span className={styles.summaryIcon}>
              <ReceiptTextIcon aria-hidden />
            </span>
          </div>
          <strong className={styles.amount}>{cc.comprobantesPendientes}</strong>
          <p className={styles.hint}>
            {cc.comprobantesPendientes === 1
              ? "Orden con saldo pendiente."
              : "Órdenes con saldo pendiente."}
          </p>
        </Card>
        <Card className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <span className={styles.summaryLabel}>Condiciones de crédito</span>
            <span className={styles.summaryIcon}>
              <ShieldCheckIcon aria-hidden />
            </span>
          </div>
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
      </div>

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
                Órdenes, cobros y saldo después de cada movimiento.
              </Card.Description>
            </div>
          </div>
          <ActionButton
            variant="outline"
            onPress={() => setAging(true)}
            isDisabled={cc.agingTotal <= 0}
            title={
              cc.agingTotal <= 0
                ? "No hay saldo deudor para analizar."
                : undefined
            }
          >
            <ChartNoAxesColumnIcon />
            Antigüedad del saldo
          </ActionButton>
        </Card.Header>
        {cc.movimientos.length === 0 ? (
          <Empty className={styles.empty}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpenIcon />
              </EmptyMedia>
              <EmptyTitle>Todavía no hay movimientos</EmptyTitle>
              <EmptyDescription>
                Cuando se finalice una orden de este cliente o se registre un
                cobro, vas a ver su detalle y el saldo acá.
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
                  <TableHead className={styles.number}>Debe</TableHead>
                  <TableHead className={styles.number}>Haber</TableHead>
                  <TableHead className={styles.number}>Saldo</TableHead>
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
                <p className={styles.hint}>{estadoSaldo}</p>
              </div>
              <strong>{fmt(saldo)}</strong>
            </Card.Footer>
          </>
        )}
      </Card>
      {aging && <AgingModal cc={cc} onClose={() => setAging(false)} />}
    </section>
  );
}
