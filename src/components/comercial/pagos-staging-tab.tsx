"use client";

import * as React from "react";
import Link from "next/link";
import { CoinsIcon, InfoIcon, PlusIcon, Trash2Icon } from "lucide-react";

import {
  CobroFormulario,
  type CobroDraft,
} from "@/components/administracion/cobro-formulario";
import type { CuentaFondosResumen, MetodoPago } from "@/lib/administracion";
import { getCuentasFondos, getMetodosPago } from "@/lib/administracion-api";
import { formatMonedaOrden } from "@/lib/ordenes-trabajo";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";

/**
 * Pestaña Pagos de la ficha ANTES de emitir: los cobros quedan en staging
 * (memoria) y se registran todos juntos al emitir la OT — igual que los
 * items. No persiste nada por sí misma.
 */
export function PagosStagingTab({
  total,
  cobros,
  onAgregar,
  onQuitar,
}: {
  total: number;
  cobros: CobroDraft[];
  onAgregar: (draft: CobroDraft) => void;
  onQuitar: (index: number) => void;
}) {
  const { moneda } = useConfigRegional();
  const [metodos, setMetodos] = React.useState<MetodoPago[] | null>(null);
  const [cuentas, setCuentas] = React.useState<CuentaFondosResumen[]>([]);
  const [showForm, setShowForm] = React.useState(false);

  React.useEffect(() => {
    let activo = true;
    Promise.all([getMetodosPago(), getCuentasFondos()])
      .then(([m, c]) => {
        if (!activo) return;
        setMetodos(m);
        setCuentas(c);
      })
      .catch(() => {
        if (activo) setMetodos([]);
      });
    return () => {
      activo = false;
    };
  }, []);

  const cobrado = cobros.reduce((s, c) => s + c.payload.montoBruto, 0);
  const saldo = Math.max(0, total - cobrado);
  const pct = total > 0 ? Math.min(100, Math.round((cobrado / total) * 100)) : 0;
  const metodosActivos = (metodos ?? []).filter((m) => m.activo);
  const cargando = metodos === null;
  const sinConfig = !cargando && (metodosActivos.length === 0 || cuentas.length === 0);

  return (
    <div className="pagos-tab arc-page">
      <div className="arc-variant-note" style={{ marginBottom: 16 }}>
        <InfoIcon />
        <span>
          La orden todavía no está emitida: los cobros que cargues acá se
          registran <b>al emitir la OT</b>, junto con el resto de la orden. Si
          guardás como borrador, no se persisten.
        </span>
      </div>

      <div className="pagos-kpis">
        <div className="pk">
          <span className="pk-l">Total propuesta</span>
          <span className="pk-v">{formatMonedaOrden(total, moneda)}</span>
          <span className="pk-s">c/ impuestos</span>
        </div>
        <div className={`pk ${cobros.length > 0 ? "pk-ok" : ""}`}>
          <span className="pk-l">A registrar al emitir</span>
          <span className="pk-v">{formatMonedaOrden(cobrado, moneda)}</span>
          <span className="pk-s">
            {cobros.length === 0
              ? "Sin cobros cargados"
              : `${pct}% · ${cobros.length} cobro${cobros.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className={`pk ${saldo <= 0 && total > 0 ? "pk-ok" : "pk-warn"}`}>
          <span className="pk-l">Saldo restante</span>
          <span className="pk-v">{formatMonedaOrden(saldo, moneda)}</span>
          <span className="pk-s">
            {saldo <= 0 && total > 0 ? "Orden saldada" : "A cobrar"}
          </span>
        </div>
      </div>

      {cargando ? (
        <div className="mov-empty">Cargando métodos de pago…</div>
      ) : sinConfig ? (
        <div className="pagos-empty">
          <div className="pe-ico">
            <CoinsIcon size={22} />
          </div>
          <div className="pe-ttl">Falta configurar Administración</div>
          <div className="pe-sub">
            Para cargar cobros necesitás al menos un método de pago activo y
            una cuenta de fondos.
          </div>
          <Link className="btn btn-primary" href="/configuracion/metodos-pago">
            Ir a Métodos de pago
          </Link>
        </div>
      ) : showForm ? (
        <CobroFormulario
          saldo={saldo}
          metodos={metodosActivos}
          cuentas={cuentas}
          guardando={false}
          submitLabel="Agregar cobro a la orden"
          submitLabelCheque="Agregar valor a la orden"
          onSubmit={(draft) => {
            onAgregar(draft);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <>
          <div className="otd-card">
            <div className="otd-card-head">
              <span className="ttl">
                Cobros a registrar <span className="ct">{cobros.length}</span>
              </span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowForm(true)}
              >
                <PlusIcon />
                Agregar cobro
              </button>
            </div>
            {cobros.length === 0 ? (
              <div className="mov-empty">
                Todavía no cargaste cobros. La seña del mostrador va acá: se
                registra al emitir la orden.
              </div>
            ) : (
              <div className="mov-table">
                <div className="mov-th">
                  <span>Fecha</span>
                  <span>Método</span>
                  <span>Cuenta destino</span>
                  <span>Acreditación</span>
                  <span className="r">Monto</span>
                </div>
                {cobros.map((c, i) => (
                  <div key={i} className="mov-row">
                    <span className="mov-fecha">{c.payload.fecha}</span>
                    <span className="mov-metodo">
                      <span className="mov-badge">
                        {c.metodoNombre.slice(0, 1).toUpperCase()}
                      </span>
                      {c.metodoNombre}
                      {c.payload.valor ? (
                        <span className="mov-who">
                          {" "}
                          · {c.payload.valor.numero}
                        </span>
                      ) : null}
                    </span>
                    <span className="mov-ref">{c.cuentaDestinoNombre}</span>
                    <span className="mov-comp">
                      {c.acreditacionLabel}
                      <button
                        type="button"
                        className="btn sm"
                        style={{ marginLeft: 10 }}
                        onClick={() => onQuitar(i)}
                        aria-label="Quitar cobro"
                      >
                        <Trash2Icon />
                        Quitar
                      </button>
                    </span>
                    <span className="mov-monto">
                      {formatMonedaOrden(c.payload.montoBruto, moneda)}
                    </span>
                  </div>
                ))}
                <div className="mov-foot">
                  <span>Total a registrar al emitir</span>
                  <span>{formatMonedaOrden(cobrado, moneda)}</span>
                </div>
              </div>
            )}
          </div>

          {cobros.length > 0 ? (
            <div className="arc-acct-hint" style={{ marginTop: 14 }}>
              <InfoIcon />
              Neto acreditado{" "}
              <b style={{ color: "var(--ink-2)", margin: "0 4px" }}>
                {formatMonedaOrden(
                  cobros.reduce((s, c) => s + c.netoAcreditado, 0),
                  moneda,
                )}
              </b>{" "}
              · disponible real{" "}
              <b style={{ color: "var(--ink-2)", margin: "0 4px" }}>
                {formatMonedaOrden(
                  cobros.reduce((s, c) => s + c.disponibleReal, 0),
                  moneda,
                )}
              </b>{" "}
              según métodos elegidos
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
