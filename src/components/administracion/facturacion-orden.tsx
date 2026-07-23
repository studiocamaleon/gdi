"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ReceiptTextIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  estadoCobranzaOrden,
  estadoFiscalOrden,
  type Comprobante,
  type Cobro,
} from "@/lib/administracion";
import {
  facturarOrden,
  getCobros,
  getComprobantes,
  getFacturacionHabilitada,
  reciboPdfUrl,
} from "@/lib/administracion-api";
import { formatFechaOrden, formatMonedaOrden } from "@/lib/ordenes-trabajo";

/** Fecha · método · recibo · acreditación · monto. */
const COLS_COBRO = "84px 1fr 118px 96px 108px";

/**
 * Facturación desde la ficha de la orden. La factura es OPCIONAL y "sigue"
 * a la orden: la deuda del cliente es comercial (total − cobrado) y estos
 * componentes muestran el eje FISCAL en paralelo.
 * Ver docs/facturacion-ordenes-deuda-comercial-diseno.md §6.1/§6.3.
 */

const ESTADO_FISCAL_LABEL: Record<string, string> = {
  sin_facturar: "Sin facturar",
  parcial: "Facturada parcial",
  facturada: "Facturada",
};

const ESTADO_COBRANZA_LABEL: Record<string, string> = {
  sin_cobrar: "Sin cobrar",
  parcial: "Cobrada parcial",
  cobrada: "Cobrada",
};

const COMPROBANTE_ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  emitido: "Emitida",
  rechazado: "Rechazada",
  anulado: "Anulada",
};

/** Modal "Facturar orden": monto con atajos (100% / 50% / libre) + concepto. */
export function FacturarOrdenModal({
  ordenId,
  numero,
  saldoSinFacturar,
  onClose,
  onFacturada,
}: {
  ordenId: string;
  numero: string;
  saldoSinFacturar: number;
  onClose: () => void;
  onFacturada: (comprobante: Comprobante) => void;
}) {
  const [monto, setMonto] = React.useState(String(Math.round(saldoSinFacturar)));
  const [concepto, setConcepto] = React.useState(
    `Trabajos de impresión — ${numero}`,
  );
  const [enviando, setEnviando] = React.useState(false);

  const montoNum = Number(monto);
  const valido =
    Number.isFinite(montoNum) &&
    montoNum > 0 &&
    montoNum <= saldoSinFacturar + 0.01 &&
    concepto.trim().length > 0;

  const emitir = async () => {
    if (!valido || enviando) return;
    setEnviando(true);
    try {
      const comprobante = await facturarOrden(ordenId, {
        monto: montoNum,
        concepto: concepto.trim(),
      });
      if (comprobante.estado === "emitido") {
        toast.success(`Factura ${comprobante.numeroCompleto} emitida.`);
      } else {
        toast.error(
          `La factura quedó ${COMPROBANTE_ESTADO_LABEL[comprobante.estado]?.toLowerCase() ?? comprobante.estado}: revisala en Administración → Comprobantes.`,
        );
      }
      onFacturada(comprobante);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo facturar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="acc-backdrop show" onClick={onClose}>
      <div
        className="acc-modal"
        style={{ width: "min(480px,96vw)" }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="acc-modal-head">
          <button type="button" className="acc-modal-x" onClick={onClose}>
            <XIcon />
          </button>
          <h2>Facturar {numero}</h2>
          <div className="s">
            Saldo sin facturar: {formatMonedaOrden(saldoSinFacturar)} · la
            factura queda vinculada a la orden
          </div>
        </div>
        <div className="acc-modal-body">
          <div className="cobro-form" style={{ padding: 0 }}>
            <div className="cf-grid" style={{ gridTemplateColumns: "1fr" }}>
              <label className="cf-field cf-monto">
                <span className="cf-lbl">Monto a facturar (IVA incluido)</span>
                <div className="cf-money">
                  <span className="cf-cur">$</span>
                  <input
                    type="number"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="0"
                    autoFocus
                  />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button
                    className="cf-max"
                    type="button"
                    onClick={() => setMonto(String(Math.round(saldoSinFacturar)))}
                  >
                    100% del saldo
                  </button>
                  <button
                    className="cf-max"
                    type="button"
                    onClick={() =>
                      setMonto(String(Math.round(saldoSinFacturar / 2)))
                    }
                  >
                    50%
                  </button>
                </div>
                {montoNum > saldoSinFacturar + 0.01 ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--danger)",
                      marginTop: 4,
                    }}
                  >
                    No se puede facturar más que el saldo de la orden.
                  </span>
                ) : null}
              </label>
              <label className="cf-field">
                <span className="cf-lbl">Concepto del renglón</span>
                <input
                  type="text"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  placeholder="Trabajos de impresión…"
                />
              </label>
            </div>
            <div className="cf-actions">
              <button
                type="button"
                className="btn"
                onClick={onClose}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`btn btn-primary ${valido ? "" : "is-disabled"}`}
                disabled={!valido || enviando}
                onClick={() => void emitir()}
              >
                <CheckIcon />
                {enviando ? "Emitiendo…" : "Emitir factura"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Chips de los dos ejes + barras de avance (cabecera del tab). */
function EjesOrden({
  total,
  facturado,
  cobrado,
}: {
  total: number;
  facturado: number;
  cobrado: number;
}) {
  const fiscal = estadoFiscalOrden(total, facturado);
  const cobranza = estadoCobranzaOrden(total, cobrado);
  const pctF = total > 0 ? Math.min(100, Math.round((facturado / total) * 100)) : 0;
  const pctC = total > 0 ? Math.min(100, Math.round((cobrado / total) * 100)) : 0;
  return (
    <div className="pagos-kpis" style={{ marginBottom: 14 }}>
      <div className="pk">
        <span className="pk-l">Total de la orden</span>
        <span className="pk-v">{formatMonedaOrden(total)}</span>
        <span className="pk-s">c/ impuestos</span>
      </div>
      <div className={`pk ${fiscal === "facturada" ? "pk-ok" : ""}`}>
        <span className="pk-l">Facturado</span>
        <span className="pk-v">{formatMonedaOrden(facturado)}</span>
        <span className="pk-s">
          {ESTADO_FISCAL_LABEL[fiscal]} · {pctF}%
        </span>
      </div>
      <div className={`pk ${cobranza === "cobrada" ? "pk-ok" : "pk-warn"}`}>
        <span className="pk-l">Cobrado</span>
        <span className="pk-v">{formatMonedaOrden(cobrado)}</span>
        <span className="pk-s">
          {ESTADO_COBRANZA_LABEL[cobranza]} · {pctC}%
        </span>
      </div>
    </div>
  );
}

/**
 * Tab "Comprobantes" de la ficha de la orden: los dos ejes arriba, la
 * lista de comprobantes fiscales vinculados (con su monto aplicado a ESTA
 * orden) y los cobros como referencia. El botón Facturar vive acá y en el
 * header de la ficha.
 */
export function ComprobantesOrdenTab({
  ordenId,
  numero,
  total,
  facturadoInicial,
  cobradoInicial,
  puedeFacturar,
  recargarToken = 0,
}: {
  ordenId: string;
  numero: string;
  total: number;
  facturadoInicial: number;
  cobradoInicial: number;
  /** false en borradores (se emite la OT primero). */
  puedeFacturar: boolean;
  /**
   * Cambia cuando algo de afuera facturó (ej. el botón "Facturar" del header de
   * la OT, que monta su propio modal): fuerza recargar comprobantes y cobros.
   */
  recargarToken?: number;
}) {
  const [comprobantes, setComprobantes] = React.useState<Comprobante[] | null>(
    null,
  );
  const [cobros, setCobros] = React.useState<Cobro[] | null>(null);
  const [facturarOpen, setFacturarOpen] = React.useState(false);
  const [refrescos, setRefrescos] = React.useState(0);
  // El botón Facturar sólo aparece con la integración AFIP activa. null =
  // todavía no sabemos, así que no se muestra ni el botón ni el aviso.
  const [facturacionActiva, setFacturacionActiva] = React.useState<
    boolean | null
  >(null);

  React.useEffect(() => {
    let activo = true;
    getComprobantes({ ordenId })
      .then((data) => activo && setComprobantes(data))
      .catch(() => activo && setComprobantes([]));
    getCobros({ ordenId })
      .then((data) => activo && setCobros(data))
      .catch(() => activo && setCobros([]));
    getFacturacionHabilitada()
      .then((h: boolean) => activo && setFacturacionActiva(h))
      .catch(() => activo && setFacturacionActiva(false));
    return () => {
      activo = false;
    };
  }, [ordenId, refrescos, recargarToken]);

  // Los ejes se recalculan de lo listado (fuente viva); si todavía no
  // cargó, valen los denormalizados que vinieron con la orden.
  const montoDeEstaOrden = (c: Comprobante) =>
    c.ordenes.find((o) => o.ordenId === ordenId)?.monto ?? c.total;
  const facturado =
    comprobantes === null
      ? facturadoInicial
      : comprobantes.reduce((s, c) => {
          if (c.estado !== "emitido") return s;
          if (c.tipo === "factura") return s + montoDeEstaOrden(c);
          if (c.tipo === "nota_credito") return s - montoDeEstaOrden(c);
          return s;
        }, 0);
  const cobrado =
    cobros === null
      ? cobradoInicial
      : cobros.reduce((s, c) => s + c.montoBruto, 0);
  const saldoSinFacturar = Math.max(0, total - Math.max(0, facturado));

  const listaComp = comprobantes ?? [];
  const listaCobros = cobros ?? [];

  return (
    <div className="pagos-tab">
      <EjesOrden total={total} facturado={Math.max(0, facturado)} cobrado={cobrado} />

      <div className="otd-card">
        <div className="otd-card-head">
          <span className="ttl">
            Comprobantes fiscales <span className="ct">{listaComp.length}</span>
          </span>
          {puedeFacturar && facturacionActiva && saldoSinFacturar > 0.01 ? (
            <button
              type="button"
              className="btn btn-primary sm"
              onClick={() => setFacturarOpen(true)}
            >
              <ReceiptTextIcon />
              Facturar
            </button>
          ) : puedeFacturar &&
            facturacionActiva === false &&
            saldoSinFacturar > 0.01 ? (
            // No se esconde sin explicar: se dice por qué y adónde ir.
            <a className="otd-fact-off" href="/configuracion/integraciones">
              Activá la facturación electrónica →
            </a>
          ) : null}
        </div>
        {comprobantes === null ? (
          <div className="mov-empty">Cargando comprobantes…</div>
        ) : listaComp.length === 0 ? (
          <div className="mov-empty">
            Esta orden no tiene comprobantes fiscales.
            {puedeFacturar
              ? " Facturala entera o parcial cuando lo necesites — la deuda del cliente corre igual, esté facturada o no."
              : " Emití la orden para poder facturarla."}
          </div>
        ) : (
          <div className="mov-table">
            <div className="mov-th">
              <span>Fecha</span>
              <span>Comprobante</span>
              <span>Estado</span>
              <span>CAE</span>
              <span className="r">Aplica a esta orden</span>
            </div>
            {listaComp.map((c) => (
              <div key={c.id} className="mov-row">
                <span className="mov-fecha">{formatFechaOrden(c.fecha)}</span>
                <span className="mov-metodo">
                  <span className="mov-badge">
                    {c.tipo === "factura"
                      ? "FA"
                      : c.tipo === "nota_credito"
                        ? "NC"
                        : "ND"}
                  </span>
                  <Link
                    href={`/administracion/comprobantes/${c.id}`}
                    style={{ color: "inherit" }}
                  >
                    {c.numeroCompleto}
                  </Link>
                  {c.ordenes.length > 1 ? (
                    <span className="mov-who">
                      · lote de {c.ordenes.length} órdenes
                    </span>
                  ) : null}
                </span>
                <span className="mov-ref">
                  {COMPROBANTE_ESTADO_LABEL[c.estado] ?? c.estado}
                </span>
                <span className="mov-comp">
                  {c.cae ? (
                    c.cae
                  ) : c.estado === "emitido" ? (
                    <span style={{ color: "var(--warn)" }}>Sin CAE</span>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="mov-monto">
                  {c.tipo === "nota_credito" ? "−" : ""}
                  {formatMonedaOrden(montoDeEstaOrden(c))}
                </span>
              </div>
            ))}
            <div className="mov-foot">
              <span>Facturado neto de NC</span>
              <span>{formatMonedaOrden(Math.max(0, facturado))}</span>
            </div>
          </div>
        )}
      </div>

      <div className="otd-card">
        <div className="otd-card-head">
          <span className="ttl">
            Cobros <span className="ct">{listaCobros.length}</span>
          </span>
          <Link className="btn sm" href={`/administracion/cobros/nuevo?ordenId=${ordenId}`}>
            Registrar cobro
          </Link>
        </div>
        {cobros === null ? (
          <div className="mov-empty">Cargando cobros…</div>
        ) : listaCobros.length === 0 ? (
          <div className="mov-empty">
            Sin cobros registrados. El detalle completo vive en la pestaña
            Pagos.
          </div>
        ) : (
          <div className="mov-table">
            <div className="mov-th" style={{ gridTemplateColumns: COLS_COBRO }}>
              <span>Fecha</span>
              <span>Método</span>
              <span>Recibo</span>
              <span>Acreditación</span>
              <span className="r">Monto</span>
            </div>
            {listaCobros.map((c) => (
              <div key={c.id} className="mov-row" style={{ gridTemplateColumns: COLS_COBRO }}>
                <span className="mov-fecha">{formatFechaOrden(c.fecha)}</span>
                <span className="mov-metodo">{c.metodoNombre}</span>
                <span className="mov-comp">
                  {c.numeroRecibo ? (
                    <a
                      className="mov-recibo"
                      href={reciboPdfUrl(c.id)}
                      target="_blank"
                      rel="noreferrer"
                      title="Ver el recibo en PDF"
                    >
                      {c.numeroRecibo}
                    </a>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="mov-comp">
                  {c.estadoAcreditacion === "acreditado"
                    ? "Acreditado"
                    : "Pendiente"}
                </span>
                <span className="mov-monto">
                  {formatMonedaOrden(c.montoBruto)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="otd-card otd-track">
        <div className="ot-track-ico">
          <FileTextIcon size={15} />
        </div>
        <div className="ot-track-txt">
          <div className="tt">Facturación en lote</div>
          <div className="ts">
            Para facturar varias órdenes juntas usá Administración →
            Facturación.
          </div>
        </div>
        <Link className="btn sm" href="/administracion/facturacion">
          <ExternalLinkIcon />
          Abrir
        </Link>
      </div>

      {facturarOpen ? (
        <FacturarOrdenModal
          ordenId={ordenId}
          numero={numero}
          saldoSinFacturar={saldoSinFacturar}
          onClose={() => setFacturarOpen(false)}
          onFacturada={() => setRefrescos((n) => n + 1)}
        />
      ) : null}
    </div>
  );
}
