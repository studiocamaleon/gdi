"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ChartNoAxesColumnIcon,
  CheckIcon,
  ChevronRightIcon,
  CoinsIcon,
  FileTextIcon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

import {
  TRAMOS_AGING,
  TRAMO_AGING_COLOR,
  TRAMO_AGING_LABELS,
  formatCuitODash,
  type CuentaCorriente,
  type MovimientoCuentaCorriente,
} from "@/lib/administracion";
import { CONDICION_FISCAL_LABELS, type CondicionFiscal } from "@/lib/clientes";

const fmt = (n: number) =>
  (n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("es-AR");

function LedgerRow({ m }: { m: MovimientoCuentaCorriente }) {
  const [open, setOpen] = React.useState(false);
  const tiene = !!m.imputaciones?.length;
  return (
    <>
      <div
        className={`acc-lg-tr acc-lg-row ${tiene ? "clickable" : ""} ${open ? "open" : ""}`}
        onClick={() => tiene && setOpen((o) => !o)}
      >
        <span className="acc-lg-fecha">{m.fecha}</span>
        <span className="acc-lg-concept">
          {tiene ? (
            <ChevronRightIcon className="acc-lg-chev" />
          ) : (
            <span style={{ width: 14 }} />
          )}
          <span
            className={`acc-lg-tipo t-${
              m.tipo === "nd" || m.tipo === "orden" ? "fa" : m.tipo
            }`}
          >
            {m.sigla}
          </span>
          <span className="acc-lg-desc">
            {m.descripcion}
            {m.tipo === "orden" && m.facturadoPct !== undefined ? (
              <span className="acc-lg-dim" style={{ marginLeft: 8 }}>
                fact. {m.facturadoPct}%
              </span>
            ) : null}
          </span>
        </span>
        <span className="acc-lg-debe">
          {m.debe > 0 ? fmt(m.debe) : <span className="acc-lg-dim">—</span>}
        </span>
        <span className="acc-lg-haber">
          {m.haber > 0 ? fmt(m.haber) : <span className="acc-lg-dim">—</span>}
        </span>
        <span className="acc-lg-saldo">{fmt(m.saldo)}</span>
      </div>
      {open && tiene ? (
        <div className="acc-lg-exp">
          <div className="acc-imp-mini">
            <div className="t">Imputado a</div>
            {m.imputaciones?.map((im, i) => (
              <div key={i} className={`acc-imp-line ${im.resto ? "rest" : ""}`}>
                {im.resto ? (
                  <InfoIcon style={{ width: 13, height: 13 }} />
                ) : (
                  <CheckIcon
                    style={{ width: 13, height: 13, color: "var(--ok)" }}
                  />
                )}
                <span className="n">{im.nombre}</span>
                <span className="m">{fmt(im.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
  const total = cc.agingTotal;
  return (
    <div className="acc-backdrop show" onClick={onClose}>
      <div
        className="acc-modal"
        style={{ width: "min(460px,96vw)" }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="acc-modal-head">
          <button type="button" className="acc-modal-x" onClick={onClose}>
            <XIcon />
          </button>
          <h2>Aging del cliente</h2>
          <div className="s">{cc.cliente.nombre} · antigüedad del saldo deudor</div>
        </div>
        <div className="acc-modal-body">
          {TRAMOS_AGING.map((t, i) => (
            <div
              key={t}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderTop: i ? "1px solid var(--hairline)" : "none",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: TRAMO_AGING_COLOR[t],
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, minWidth: 80 }}>
                {TRAMO_AGING_LABELS[t]}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 999,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: (total ? (cc.aging[t] / total) * 100 : 0) + "%",
                    background: TRAMO_AGING_COLOR[t],
                  }}
                />
              </div>
              <span
                className="mono"
                style={{ fontWeight: 600, minWidth: 80, textAlign: "right" }}
              >
                {fmt(cc.aging[t])}
              </span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: "1px solid var(--border)",
              marginTop: 8,
              paddingTop: 12,
              fontWeight: 600,
            }}
          >
            <span>Total deudor</span>
            <span className="mono" style={{ color: "var(--signal)" }}>
              {fmt(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CuentaCorrienteView({ cc }: { cc: CuentaCorriente }) {
  const [aging, setAging] = React.useState(false);

  const saldo = cc.saldo;
  const pct = cc.usoLimitePct;
  const limite = cc.cliente.limiteCredito;

  return (
    <div
      className="acc-page"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "28px 28px 90px",
      }}
    >
      <div className="acc-wrap">
        <Link className="acc-crumb" href="/clientes">
          <ArrowLeftIcon />
          Clientes
        </Link>

        <div className="acc-head">
          <div className="acc-cli">
            <div className="nm">{cc.cliente.nombre}</div>
            <div className="meta">
              <span className="cond">
                {CONDICION_FISCAL_LABELS[
                  cc.cliente.condicionFiscal as CondicionFiscal
                ] ?? cc.cliente.condicionFiscal}
              </span>
              <span>CUIT {formatCuitODash(cc.cliente.cuit)}</span>
              {cc.cliente.vendedor ? (
                <span>· Vendedor: {cc.cliente.vendedor}</span>
              ) : null}
            </div>
          </div>
          <div className="acc-saldo">
            <div className="l">Saldo actual</div>
            <div className={`v ${saldo <= 0 ? "ok" : ""}`}>{fmt(saldo)}</div>
            <div className="s">
              {saldo > 0 ? "Deudor" : "Sin deuda"} ·{" "}
              {cc.comprobantesPendientes}{" "}
              {cc.comprobantesPendientes === 1 ? "orden" : "órdenes"} sin
              cobrar
            </div>
          </div>
          <div className="acc-limit">
            {limite === null ? (
              <>
                <div className="l">Límite de crédito</div>
                <div className="sin-limite">
                  Sin límite definido.{" "}
                  <Link href={`/clientes/${cc.cliente.id}`}>Configurar</Link>
                </div>
              </>
            ) : (
              <>
                <div className="l">
                  Límite de crédito <span className="pct">{pct}%</span>
                </div>
                <div className="acc-limit-bar">
                  <div
                    className="acc-limit-fill"
                    style={{
                      width: Math.min(100, Math.max(0, pct ?? 0)) + "%",
                      background: cc.excedido
                        ? "var(--danger)"
                        : (pct ?? 0) > 80
                          ? "var(--warn)"
                          : "var(--ok)",
                    }}
                  />
                </div>
                <div className="nums">
                  Usa <b>{fmt(Math.max(0, saldo))}</b> de <b>{fmt(limite)}</b>
                </div>
                {cc.excedido ? (
                  <div className="acc-limit-alert">
                    <TriangleAlertIcon />
                    Supera el límite de crédito en {fmt(cc.excedente)}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="acc-actions-bar">
          <Link
            className="btn btn-primary"
            href={`/administracion/cobros/nuevo?clienteId=${cc.cliente.id}`}
          >
            <CoinsIcon />
            Registrar cobro
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() => setAging(true)}
            disabled={cc.agingTotal <= 0}
          >
            <ChartNoAxesColumnIcon />
            Ver aging
          </button>
          <div className="sp">
            <a
              className="btn"
              href={`/api/backend/administracion/clientes/${cc.cliente.id}/cuenta-corriente/pdf`}
              target="_blank"
              rel="noopener"
            >
              <FileTextIcon />
              Estado de cuenta PDF
            </a>
          </div>
        </div>

        <div className="acc-ledger">
          <div className="acc-lg-tr acc-lg-th">
            <span>Fecha</span>
            <span>Concepto</span>
            <span className="r">Debe</span>
            <span className="r">Haber</span>
            <span className="r">Saldo</span>
          </div>
          {cc.movimientos.length === 0 ? (
            <div className="acc-vacio">
              Este cliente todavía no tiene movimientos: cuando una orden
              suya se finalice o le registres un cobro van a aparecer acá.
            </div>
          ) : (
            cc.movimientos.map((m) => <LedgerRow key={m.id} m={m} />)
          )}
          {cc.movimientos.length > 0 ? (
            <div className="acc-lg-foot">
              <span>
                {saldo > 0 ? "Saldo deudor actual" : "Saldo a favor del cliente"}
              </span>
              <span className="v">{fmt(saldo)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {aging ? <AgingModal cc={cc} onClose={() => setAging(false)} /> : null}
    </div>
  );
}
