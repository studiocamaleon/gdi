"use client";
import {
  FacturaDetalleSelector,
  type DetalleFactura,
} from "./factura-detalle-selector";
import { ActionButton } from "@/components/design-system/action-button";
import { useCapacidad } from "@/components/navigation/capacidades-provider";

import { montoCobroEnOrden } from "@/lib/cobro-aplicado";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import * as React from "react";
import Link from "next/link";
import {
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
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
  anularCobro,
  notaCreditoOrden,
  reciboPdfUrl,
} from "@/lib/administracion-api";
import { formatFechaOrden, formatMonedaOrden } from "@/lib/ordenes-trabajo";
import { formatearMoneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";

/** Facturar es una acción fiscal independiente de editar los datos de la OT. */
export function FacturarOrdenAccion({
  ordenId,
  numero,
  total,
  facturado,
  descuentoTotal = 0,
  habilitada = true,
  bloqueada = false,
  onFacturada,
}: {
  ordenId: string;
  numero: string;
  total: number;
  facturado: number;
  descuentoTotal?: number;
  habilitada?: boolean;
  bloqueada?: boolean;
  onFacturada: () => void;
}) {
  const motivoId = React.useId();
  const permiso = usePuede("administracion.facturacion.gestionar");
  const capacidad = useCapacidad("fiscal_argentina");
  const autorizada = permiso && capacidad && habilitada;
  const [estado, setEstado] = React.useState<
    "cargando" | "activa" | "inactiva" | "error"
  >("cargando");
  const [consultando, setConsultando] = React.useState(false);
  const [saldoModal, setSaldoModal] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!autorizada) return;
    let vigente = true;
    setEstado("cargando");
    getFacturacionHabilitada()
      .then((activa) => {
        if (vigente) setEstado(activa ? "activa" : "inactiva");
      })
      .catch(() => {
        if (vigente) setEstado("error");
      });
    return () => {
      vigente = false;
    };
  }, [autorizada, ordenId]);
  React.useEffect(() => {
    setSaldoModal(null);
  }, [ordenId, bloqueada, autorizada]);
  async function abrir() {
    if (!autorizada || bloqueada || consultando || estado !== "activa") return;
    setConsultando(true);
    try {
      // No usar como saldo definitivo la copia que llegó al abrir la ficha.
      const actuales = await getComprobantes({ ordenId });
      if (
        actuales.some((c) => ["en_proceso", "por_verificar"].includes(c.estado))
      ) {
        toast.error(
          "Hay un comprobante en proceso o por verificar. Revisalo antes de volver a facturar.",
        );
        return;
      }
      const neto = actuales.reduce((acum, c) => {
        if (c.estado !== "emitido") return acum;
        const monto =
          c.ordenes.find((o) => o.ordenId === ordenId)?.monto ?? c.total;
        return (
          acum +
          (c.tipo === "nota_credito"
            ? -monto
            : c.tipo === "factura"
              ? monto
              : 0)
        );
      }, 0);
      const saldo = Math.max(0, total - Math.max(0, neto));
      if (saldo <= 0.01) {
        toast.info("La orden ya está facturada por completo.");
        onFacturada();
        return;
      }
      setSaldoModal(saldo);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo comprobar el saldo a facturar.",
      );
    } finally {
      setConsultando(false);
    }
  }
  if (!autorizada || total - facturado <= 0.01) return null;
  const motivo = bloqueada
    ? "Guardá o descartá los cambios de la orden antes de facturar."
    : estado === "inactiva"
      ? "Activá la facturación electrónica en Configuración → Integraciones."
      : estado === "error"
        ? "No se pudo consultar la facturación. Volvé a abrir la orden para reintentar."
        : estado === "cargando"
          ? "Comprobando facturación…"
          : "Facturar esta orden";
  return (
    <>
      <ActionButton
        variant="outline"
        isDisabled={bloqueada || consultando || estado !== "activa"}
        aria-describedby={motivoId}
        title={motivo}
        onPress={() => void abrir()}
      >
        <ReceiptTextIcon />
        {consultando ? "Consultando…" : "Facturar"}
      </ActionButton>
      <span id={motivoId} className="sr-only">
        {motivo}
      </span>
      {saldoModal !== null && !bloqueada && (
        <FacturarOrdenModal
          ordenId={ordenId}
          numero={numero}
          saldoSinFacturar={saldoModal}
          descuentoTotal={descuentoTotal}
          onClose={() => setSaldoModal(null)}
          onFacturada={onFacturada}
        />
      )}
    </>
  );
}

/** Fecha · método · recibo · acreditación · monto · acción. */
const COLS_COBRO = "84px 1fr 118px 96px 108px 40px";

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
  en_proceso: "Enviando",
  por_verificar: "Por verificar",
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
  /**
   * Conservado por compatibilidad con las fichas. El detalle ahora incluye
   * productos y cargos aunque no haya descuentos.
   */
  descuentoTotal?: number;
  onClose: () => void;
  onFacturada: (comprobante: Comprobante) => void;
}) {
  const { moneda } = useConfigRegional();
  const saldoCentavos = Math.round(saldoSinFacturar * 100);
  const [monto, setMonto] = React.useState(String(saldoCentavos / 100));
  const [concepto, setConcepto] = React.useState(
    `Trabajos de impresión — ${numero}`,
  );
  const [detalle, setDetalle] = React.useState<DetalleFactura>("items");
  const [enviando, setEnviando] = React.useState(false);

  const montoNum = Number(monto);
  const valido =
    Number.isFinite(montoNum) &&
    montoNum > 0 &&
    montoNum <= saldoSinFacturar + 0.01;

  const emitir = async () => {
    if (!valido || enviando) return;
    setEnviando(true);
    try {
      const comprobante = await facturarOrden(ordenId, {
        monto: montoNum,
        concepto: concepto.trim(),
        detalle,
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
            Saldo sin facturar:{" "}
            {formatearMoneda(saldoSinFacturar, moneda, { decimales: 2 })} · la
            factura queda vinculada a la orden
          </div>
        </div>
        <div className="acc-modal-body">
          <div className="cobro-form" style={{ padding: 0 }}>
            <div className="cf-grid" style={{ gridTemplateColumns: "1fr" }}>
              <label className="cf-field cf-monto">
                <span className="cf-lbl">Monto a facturar (IVA incluido)</span>
                <div className="cf-money">
                  <span className="cf-cur">{moneda.simbolo}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
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
                    onClick={() => setMonto(String(saldoCentavos / 100))}
                  >
                    100% del saldo
                  </button>
                  <button
                    className="cf-max"
                    type="button"
                    onClick={() =>
                      setMonto(String(Math.round(saldoCentavos / 2) / 100))
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
              <FacturaDetalleSelector
                value={detalle}
                onChange={setDetalle}
                disabled={enviando}
              />
              <label className="cf-field">
                <span className="cf-lbl">Concepto del resumen (opcional)</span>
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
  const { moneda } = useConfigRegional();
  const fiscal = estadoFiscalOrden(total, facturado);
  const cobranza = estadoCobranzaOrden(total, cobrado);
  const pctF =
    total > 0 ? Math.min(100, Math.round((facturado / total) * 100)) : 0;
  const pctC =
    total > 0 ? Math.min(100, Math.round((cobrado / total) * 100)) : 0;
  return (
    <div className="pagos-kpis" style={{ marginBottom: 14 }}>
      <div className="pk">
        <span className="pk-l">Total de la orden</span>
        <span className="pk-v">{formatMonedaOrden(total, moneda)}</span>
        <span className="pk-s">c/ impuestos</span>
      </div>
      <div className={`pk ${fiscal === "facturada" ? "pk-ok" : ""}`}>
        <span className="pk-l">Facturado</span>
        <span className="pk-v">{formatMonedaOrden(facturado, moneda)}</span>
        <span className="pk-s">
          {ESTADO_FISCAL_LABEL[fiscal]} · {pctF}%
        </span>
      </div>
      <div className={`pk ${cobranza === "cobrada" ? "pk-ok" : "pk-warn"}`}>
        <span className="pk-l">Cobrado</span>
        <span className="pk-v">{formatMonedaOrden(cobrado, moneda)}</span>
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
  soloLectura = false,
  facturacionBloqueada = false,
  onFacturada,
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
  soloLectura?: boolean;
  facturacionBloqueada?: boolean;
  onFacturada?: () => void;
}) {
  const { moneda } = useConfigRegional();
  const [comprobantes, setComprobantes] = React.useState<Comprobante[] | null>(
    null,
  );
  const [cobros, setCobros] = React.useState<Cobro[] | null>(null);
  const [errorCobros, setErrorCobros] = React.useState(false);
  const [refrescos, setRefrescos] = React.useState(0);
  /** La factura que se está por acreditar, o null. */
  const [ncPara, setNcPara] = React.useState<Comprobante | null>(null);
  const [cobroParaAnular, setCobroParaAnular] = React.useState<Cobro | null>(
    null,
  );
  // Anular es otro permiso que facturar: emitir y deshacer no son lo mismo.
  const fiscalDisponible = useCapacidad("fiscal_argentina");
  const permisoAnular = usePuede("administracion.anular");
  const permisoVerCobros = usePuede("administracion.cobrar.ver");
  const puedeAnularCobro = permisoAnular && permisoVerCobros;
  const permisoVerFacturacion = usePuede("administracion.facturacion.ver");
  const puedeAnular = permisoAnular && permisoVerFacturacion;

  React.useEffect(() => {
    let activo = true;
    setCobros(null);
    setErrorCobros(false);
    getComprobantes({ ordenId })
      .then((data) => activo && setComprobantes(data))
      .catch(() => activo && setComprobantes([]));
    getCobros({ ordenId })
      .then((data) => activo && setCobros(data))
      .catch(() => activo && setErrorCobros(true));
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
      : cobros.reduce((s, c) => s + montoCobroEnOrden(c), 0);

  React.useEffect(() => {
    if (!soloLectura) return;
    setNcPara(null);
    setCobroParaAnular(null);
  }, [soloLectura]);

  const listaComp = comprobantes ?? [];
  const listaCobros = cobros ?? [];

  return (
    <div className="pagos-tab">
      <EjesOrden
        total={total}
        facturado={Math.max(0, facturado)}
        cobrado={cobrado}
      />

      <div className="otd-card">
        <div className="otd-card-head">
          <span className="ttl">
            Comprobantes fiscales <span className="ct">{listaComp.length}</span>
          </span>
          <FacturarOrdenAccion
            ordenId={ordenId}
            numero={numero}
            total={total}
            facturado={facturado}
            habilitada={puedeFacturar}
            bloqueada={facturacionBloqueada}
            onFacturada={() => {
              setRefrescos((n) => n + 1);
              onFacturada?.();
            }}
          />
        </div>
        {comprobantes === null ? (
          <div className="mov-empty">Cargando comprobantes…</div>
        ) : listaComp.length === 0 ? (
          <div className="mov-empty">
            Esta orden no tiene comprobantes fiscales.
            {puedeFacturar
              ? " Podés facturarla entera o parcialmente con permiso de facturación, sin editar la orden."
              : " La facturación no está disponible para el estado o tratamiento fiscal de esta orden."}
          </div>
        ) : (
          <div className="mov-table fo-comps">
            <div className="mov-th">
              <span>Fecha</span>
              <span>Comprobante</span>
              <span>Estado</span>
              <span>CAE</span>
              <span className="r">Aplica a esta orden</span>
              <span />
            </div>
            {listaComp.map((c) => (
              <div key={c.id} className="mov-row">
                <span className="mov-fecha">{formatFechaOrden(c.fecha)}</span>
                <span className="fo-comp">
                  <span className="mov-badge">
                    {c.tipo === "factura"
                      ? "FA"
                      : c.tipo === "nota_credito"
                        ? "NC"
                        : "ND"}
                  </span>
                  {/* Número y "lote de N" apilados: en una sola línea el número
                      se partía en tres renglones y aplastaba al badge. */}
                  <span className="fo-comp-txt">
                    <Link
                      href={`/administracion/comprobantes/${c.id}`}
                      className="fo-comp-nro"
                    >
                      {c.numeroCompleto}
                    </Link>
                    {c.ordenes.length > 1 ? (
                      <span className="fo-comp-sub">
                        lote de {c.ordenes.length} órdenes
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="mov-ref">
                  {COMPROBANTE_ESTADO_LABEL[c.estado] ?? c.estado}
                </span>
                <span className="fo-comp-cae" title={c.cae ?? undefined}>
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
                  {formatMonedaOrden(montoDeEstaOrden(c), moneda)}
                </span>
                {/* La NC es lo único que deshace una factura emitida: ARCA no
                    anula, se corrige con otro comprobante. Columna propia para
                    que no empuje al monto. */}
                <span className="fo-comp-acc">
                  {c.tipo === "factura" &&
                  c.estado === "emitido" &&
                  !soloLectura &&
                  puedeAnular &&
                  fiscalDisponible ? (
                    <button
                      type="button"
                      className="fo-nc-btn"
                      onClick={() => setNcPara(c)}
                      title="Emitir una nota de crédito que anule esta factura"
                    >
                      Nota de crédito
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
            <div className="mov-foot">
              <span>Facturado neto de NC</span>
              <span>{formatMonedaOrden(Math.max(0, facturado), moneda)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="otd-card">
        <div className="otd-card-head">
          <span className="ttl">
            Cobros <span className="ct">{listaCobros.length}</span>
          </span>
          {!soloLectura && puedeFacturar ? (
            <Link
              className="btn sm"
              href={`/administracion/cobros/nuevo?ordenId=${ordenId}`}
            >
              Registrar cobro
            </Link>
          ) : null}
        </div>
        {errorCobros ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudieron consultar los cobros</AlertTitle>
            <AlertDescription>
              Volvé a abrir la pestaña para reintentar.
            </AlertDescription>
          </Alert>
        ) : cobros === null ? (
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
              <span className="r">Aplicado a esta OT</span>
              <span aria-label="Acciones" />
            </div>
            {listaCobros.map((c) => (
              <div
                key={c.id}
                className="mov-row"
                style={{ gridTemplateColumns: COLS_COBRO }}
              >
                <span className="mov-fecha">{formatFechaOrden(c.fecha)}</span>
                <span className="mov-metodo">
                  {c.metodoNombre}
                  {c.origenAplicacion === "cuenta_corriente" ? (
                    <span className="mov-who"> · Cuenta corriente</span>
                  ) : null}
                </span>
                <span className="mov-comp">
                  {c.numeroRecibo && c.puedeAbrirRecibo !== false ? (
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
                    (c.numeroRecibo ?? "—")
                  )}
                </span>
                <span className="mov-comp">
                  {c.estadoAcreditacion === "acreditado"
                    ? "Acreditado"
                    : "Pendiente"}
                </span>
                <span className="mov-monto">
                  {formatMonedaOrden(montoCobroEnOrden(c), moneda)}
                </span>
                <span className="fo-comp-acc">
                  {!soloLectura &&
                  puedeAnularCobro &&
                  c.puedeAbrirRecibo !== false ? (
                    <button
                      type="button"
                      className="fo-nc-btn"
                      onClick={() => setCobroParaAnular(c)}
                      title="Anular este cobro y revertir su movimiento"
                    >
                      <RotateCcwIcon aria-hidden="true" />
                      <span className="sr-only">Anular cobro</span>
                    </button>
                  ) : null}
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

      <ConfirmacionDestructiva
        open={!soloLectura && puedeAnularCobro && cobroParaAnular !== null}
        onOpenChange={(open) => {
          if (!open) setCobroParaAnular(null);
        }}
        titulo={`Anular cobro ${cobroParaAnular?.numeroRecibo ?? ""}`}
        descripcion={`Se conserva el historial y se registra un contramovimiento por ${formatMonedaOrden(cobroParaAnular?.disponibleReal ?? 0, moneda)}.`}
        impacto={[
          "Se anula el recibo completo, incluidas sus aplicaciones a otras órdenes o facturas.",
          "El importe vuelve a quedar pendiente en la cuenta corriente.",
          "Si ya ingresó a una cuenta, Tesorería registra la salida de reversión.",
          "El recibo queda anulado y no se elimina del historial.",
        ]}
        requiereTipear={false}
        motivo={{
          label: "Motivo de la anulación",
          placeholder: "Ej.: cobro duplicado · medio de pago incorrecto",
        }}
        accionLabel="Anular cobro"
        onConfirmar={async (motivo) => {
          if (soloLectura || !puedeAnularCobro || !cobroParaAnular) return;
          try {
            await anularCobro(cobroParaAnular.id, {
              motivo,
              idempotencyKey: crypto.randomUUID(),
            });
            setCobroParaAnular(null);
            setRefrescos((n) => n + 1);
            toast.success("Cobro anulado y fondos revertidos.");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "No se pudo anular el cobro.",
            );
          }
        }}
      />

      <ConfirmacionDestructiva
        open={!soloLectura && puedeAnular && ncPara !== null}
        onOpenChange={(open) => {
          if (!open) setNcPara(null);
        }}
        titulo={`Nota de crédito de ${ncPara?.numeroCompleto ?? ""}`}
        descripcion={`Se emite una NC por ${formatMonedaOrden(ncPara ? montoDeEstaOrden(ncPara) : 0, moneda)} que anula esa factura ante ARCA. La factura original no se borra —no se puede—: queda compensada por la nota.`}
        impacto={[
          "El facturado de la orden baja: vuelve a quedar sin facturar.",
          "Los cobros imputados a esa factura se liberan y buscan otra.",
          "Recién con la factura acreditada se puede cancelar la orden.",
        ]}
        requiereTipear={false}
        motivo={{
          label: "¿Por qué se anula? Va en el detalle del comprobante.",
          placeholder:
            "Ej.: error en el importe · el cliente canceló el trabajo",
        }}
        accionLabel="Emitir nota de crédito"
        onConfirmar={async (motivo) => {
          if (soloLectura || !puedeAnular || !ncPara) return;
          try {
            const nc = await notaCreditoOrden(ordenId, {
              comprobanteOrigenId: ncPara.id,
              motivo,
            });
            setNcPara(null);
            setRefrescos((n) => n + 1);
            toast.success(
              nc.estado === "emitido"
                ? `Nota de crédito ${nc.numeroCompleto} emitida.`
                : `La nota de crédito quedó ${COMPROBANTE_ESTADO_LABEL[nc.estado]?.toLowerCase() ?? nc.estado}: revisala en Comprobantes.`,
            );
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "No se pudo emitir la nota de crédito.",
            );
          }
        }}
      />
    </div>
  );
}
