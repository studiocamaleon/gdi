"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowLeftRightIcon,
  BanknoteIcon,
  CheckIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  LandmarkIcon,
  PlusIcon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";

import type {
  CuentaFondos,
  MovimientoFondos,
  TesoreriaKpis,
} from "@/lib/administracion";
import {
  cerrarArqueo,
  crearCuentaFondos,
  getMovimientosCuenta,
  transferirEntreCuentas,
} from "@/lib/administracion-api";

const fmt = (n: number, cur = "$") =>
  (n < 0 ? "−" : "") + cur + Math.abs(Math.round(n)).toLocaleString("es-AR");

const ORIGEN_LABELS: Record<string, string> = {
  cobro: "Cobro",
  pago: "Pago",
  transferencia: "Transf.",
  valor: "Cheque",
  ajuste_arqueo: "Arqueo",
};
const ORIGEN_CLASES: Record<string, string> = {
  cobro: "cobro",
  pago: "pago",
  transferencia: "transf",
  valor: "cheque",
  ajuste_arqueo: "arqueo",
};

function IconoCuenta({ tipo }: { tipo: string }) {
  if (tipo === "caja") return <BanknoteIcon />;
  if (tipo === "billetera") return <WalletIcon />;
  if (tipo === "cartera_valores") return <FileTextIcon />;
  return <LandmarkIcon />;
}

function claseIcono(tipo: string) {
  if (tipo === "caja") return "caja";
  if (tipo === "billetera" || tipo === "cartera_valores") return "wallet";
  return "banco";
}

function fechaCorta(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

/* ─────────── Modales ─────────── */

function ModalBase({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="ats-backdrop show" onClick={onClose}>
      <div
        className="ats-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function TransferModal({
  cuentas,
  desdeInicial,
  ocupado,
  onClose,
  onDone,
}: {
  cuentas: CuentaFondos[];
  desdeInicial?: string;
  ocupado: boolean;
  onClose: () => void;
  onDone: (desde: string, hacia: string, monto: number) => void;
}) {
  const [desde, setDesde] = React.useState(desdeInicial ?? cuentas[0]?.id ?? "");
  const [hacia, setHacia] = React.useState(
    cuentas.find((c) => c.id !== (desdeInicial ?? cuentas[0]?.id))?.id ?? "",
  );
  const [monto, setMonto] = React.useState("");
  const cuentaDesde = cuentas.find((c) => c.id === desde);
  const cuentaHacia = cuentas.find((c) => c.id === hacia);
  const valido = Number(monto) > 0 && desde !== hacia && !!cuentaHacia;
  return (
    <ModalBase onClose={onClose}>
      <div className="ats-modal-head">
        <h2>Transferencia entre cuentas</h2>
        <div className="s">
          Movés fondos entre cuentas propias. No afecta el resultado.
        </div>
      </div>
      <div className="ats-modal-body">
        <div className="ats-field">
          <label>Desde</label>
          <select value={desde} onChange={(e) => setDesde(e.target.value)}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} · {fmt(c.saldo)}
              </option>
            ))}
          </select>
        </div>
        <div className="ats-transfer-arrow">
          <ArrowDownIcon />
        </div>
        <div className="ats-field">
          <label>Hacia</label>
          <select value={hacia} onChange={(e) => setHacia(e.target.value)}>
            {cuentas
              .filter((c) => c.id !== desde)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {fmt(c.saldo)}
                </option>
              ))}
          </select>
        </div>
        <div className="ats-field">
          <label>Monto ({cuentaDesde?.moneda ?? "ARS"})</label>
          <div className="ats-money">
            <span className="c">$</span>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        {cuentaDesde &&
        cuentaHacia &&
        cuentaDesde.moneda !== cuentaHacia.moneda ? (
          <div style={{ color: "var(--warn, #a16207)", fontSize: 12 }}>
            Cuentas en distinta moneda — se registra el tipo de cambio del día.
          </div>
        ) : null}
      </div>
      <div className="ats-modal-foot">
        <button type="button" className="btn" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valido || ocupado}
          onClick={() => onDone(desde, hacia, Number(monto))}
        >
          <ArrowLeftRightIcon />
          {ocupado ? "Transfiriendo…" : "Transferir"}
        </button>
      </div>
    </ModalBase>
  );
}

function ArqueoModal({
  cuenta,
  ocupado,
  onClose,
  onDone,
}: {
  cuenta: CuentaFondos;
  ocupado: boolean;
  onClose: () => void;
  onDone: (contado: number) => void;
}) {
  const [contado, setContado] = React.useState("");
  const diff = contado === "" ? null : Number(contado) - cuenta.saldo;
  return (
    <ModalBase onClose={onClose}>
      <div className="ats-modal-head">
        <h2>Arqueo de caja</h2>
        <div className="s">
          {cuenta.nombre} · comparás lo contado contra el sistema.
        </div>
      </div>
      <div className="ats-modal-body">
        <div className="ats-field">
          <label>Efectivo contado</label>
          <div className="ats-money">
            <span className="c">$</span>
            <input
              type="number"
              autoFocus
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="ats-arq-result">
          <div className="ats-arq-row">
            <span className="l">Saldo según sistema</span>
            <span className="v">{fmt(cuenta.saldo)}</span>
          </div>
          <div className="ats-arq-row">
            <span className="l">Efectivo contado</span>
            <span className="v">
              {contado === "" ? "—" : fmt(Number(contado))}
            </span>
          </div>
          <div className="ats-arq-row diff">
            <span className="l">Diferencia</span>
            <span
              className={`v ${diff === null ? "" : diff === 0 ? "ok" : "bad"}`}
            >
              {diff === null ? "—" : (diff > 0 ? "+" : "") + fmt(diff)}
            </span>
          </div>
        </div>
        {diff !== null && diff !== 0 ? (
          <div style={{ fontSize: 12, marginTop: 8, color: "var(--muted-text)" }}>
            Se registrará un ajuste de {fmt(Math.abs(diff))} (
            {diff > 0 ? "sobrante" : "faltante"}) como movimiento.
          </div>
        ) : null}
      </div>
      <div className="ats-modal-foot">
        <button type="button" className="btn" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={contado === "" || ocupado}
          onClick={() => onDone(Number(contado))}
        >
          <CheckIcon />
          {ocupado ? "Cerrando…" : "Cerrar arqueo"}
        </button>
      </div>
    </ModalBase>
  );
}

function NuevaCuentaModal({
  ocupado,
  onClose,
  onDone,
}: {
  ocupado: boolean;
  onClose: () => void;
  onDone: (payload: {
    tipo: string;
    nombre: string;
    banco?: string;
    moneda: string;
  }) => void;
}) {
  const [tipo, setTipo] = React.useState("banco");
  const [nombre, setNombre] = React.useState("");
  const [banco, setBanco] = React.useState("");
  const [moneda, setMoneda] = React.useState("ARS");
  return (
    <ModalBase onClose={onClose}>
      <div className="ats-modal-head">
        <h2>Nueva cuenta</h2>
        <div className="s">Caja, cuenta bancaria o billetera del negocio.</div>
      </div>
      <div className="ats-modal-body">
        <div className="ats-field">
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="caja">Caja (efectivo)</option>
            <option value="banco">Cuenta bancaria</option>
            <option value="billetera">Billetera virtual</option>
            <option value="cartera_valores">Cartera de valores</option>
          </select>
        </div>
        <div className="ats-field">
          <label>Nombre</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Banco Galicia CC ARS"
          />
        </div>
        <div className="ats-field-row">
          <div className="ats-field">
            <label>Banco / detalle</label>
            <input
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="ats-field">
            <label>Moneda</label>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
      </div>
      <div className="ats-modal-foot">
        <button type="button" className="btn" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!nombre.trim() || ocupado}
          onClick={() =>
            onDone({ tipo, nombre: nombre.trim(), banco: banco || undefined, moneda })
          }
        >
          <CheckIcon />
          {ocupado ? "Creando…" : "Crear cuenta"}
        </button>
      </div>
    </ModalBase>
  );
}

/* ─────────── Vista ─────────── */

export function TesoreriaView({
  initialCuentas,
  initialKpis,
}: {
  initialCuentas: CuentaFondos[];
  initialKpis: TesoreriaKpis;
}) {
  const router = useRouter();
  const cuentas = initialCuentas;
  const kpis = initialKpis;
  const [selId, setSelId] = React.useState<string | null>(
    cuentas[0]?.id ?? null,
  );
  const [movimientos, setMovimientos] = React.useState<MovimientoFondos[]>([]);
  const [cargandoMovs, setCargandoMovs] = React.useState(false);
  const [modal, setModal] = React.useState<
    | { t: "transfer"; from?: string }
    | { t: "arqueo" }
    | { t: "cuenta" }
    | null
  >(null);
  const [ocupado, setOcupado] = React.useState(false);

  const sel = cuentas.find((c) => c.id === selId) ?? null;

  React.useEffect(() => {
    if (!selId) return;
    let cancelado = false;
    setCargandoMovs(true);
    getMovimientosCuenta(selId)
      .then((movs) => {
        if (!cancelado) setMovimientos(movs);
      })
      .catch(() => {
        if (!cancelado) setMovimientos([]);
      })
      .finally(() => {
        if (!cancelado) setCargandoMovs(false);
      });
    return () => {
      cancelado = true;
    };
  }, [selId]);

  const ejecutar = async (fn: () => Promise<string>) => {
    setOcupado(true);
    try {
      const mensaje = await fn();
      toast.success(mensaje);
      setModal(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo completar.",
      );
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div
      className="ats-page"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "36px 32px 80px",
      }}
    >
      <div className="ats-wrap">
        <div className="ats-head">
          <div>
            <h1>Tesorería</h1>
            <div className="sub">
              Posición de fondos y movimientos de cajas y bancos.
            </div>
          </div>
          <div className="right">
            <button
              type="button"
              className="btn"
              onClick={() => setModal({ t: "transfer" })}
              disabled={cuentas.length < 2}
            >
              <ArrowLeftRightIcon />
              Transferencia
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModal({ t: "cuenta" })}
            >
              <PlusIcon />
              Nueva cuenta
            </button>
          </div>
        </div>

        <div className="ats-kpis">
          <div className="ats-kpi hero">
            <div className="l">Posición total</div>
            <div className="v">
              {fmt(kpis.posicionArs)}
              <span
                style={{
                  fontSize: 13,
                  color: "var(--muted-text)",
                  fontWeight: 500,
                }}
              >
                {" "}
                ARS
              </span>
            </div>
            <div className="usd">
              <span className="cur">USD</span>
              <span className="n">{fmt(kpis.posicionUsd)}</span>
            </div>
          </div>
          <div className="ats-kpi">
            <div className="l">Efectivo en cajas</div>
            <div className="v sm">{fmt(kpis.efectivo)}</div>
            <div className="s">
              <span className="dot" style={{ background: "var(--signal)" }} />
              {kpis.cajasActivas} caja{kpis.cajasActivas === 1 ? "" : "s"}{" "}
              activa{kpis.cajasActivas === 1 ? "" : "s"}
            </div>
          </div>
          <div className="ats-kpi">
            <div className="l">En bancos</div>
            <div className="v sm">{fmt(kpis.bancos)}</div>
            <div className="s">
              <span className="dot" style={{ background: "#1d4ed8" }} />
              {kpis.cuentasArs} cuenta{kpis.cuentasArs === 1 ? "" : "s"} ARS
            </div>
          </div>
          <div className="ats-kpi acc">
            <div className="l">A acreditar</div>
            <div className="v sm">{fmt(kpis.aAcreditar)}</div>
            <div className="s">
              <span className="dot" style={{ background: "#1d4ed8" }} />
              Cobros con plazo pendiente
            </div>
          </div>
        </div>

        {cuentas.length === 0 ? (
          <div className="ats-empty">
            <div className="ico">
              <LandmarkIcon />
            </div>
            <h3>Todavía no cargaste cuentas</h3>
            <p>
              Creá tus cajas de efectivo y cuentas bancarias para registrar
              cobros, pagos y transferencias con saldo en tiempo real.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ margin: "0 auto" }}
              onClick={() => setModal({ t: "cuenta" })}
            >
              <PlusIcon />
              Crear primera cuenta
            </button>
          </div>
        ) : (
          <div className="ats-layout">
            <div>
              <div className="ats-col-head">
                <span className="t">Cuentas</span>
                <button
                  type="button"
                  className="add"
                  onClick={() => setModal({ t: "cuenta" })}
                >
                  <PlusIcon />
                  Nueva
                </button>
              </div>
              <div className="ats-accts">
                {cuentas.map((cuenta) => (
                  <button
                    key={cuenta.id}
                    type="button"
                    className={`ats-acct-card ${cuenta.id === selId ? "sel" : ""}`}
                    onClick={() => setSelId(cuenta.id)}
                  >
                    <div className="top">
                      <span className={`ats-acct-icon ${claseIcono(cuenta.tipo)}`}>
                        <IconoCuenta tipo={cuenta.tipo} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="nm">{cuenta.nombre}</div>
                        <div className="meta">
                          {cuenta.banco ?? cuenta.cbuAlias ?? "—"}
                        </div>
                      </div>
                      <span className="cur-tag">{cuenta.moneda}</span>
                    </div>
                    <div className="saldo">
                      <span className="sv">{fmt(cuenta.saldo)}</span>
                      <span className="lm">
                        {fechaCorta(cuenta.ultimoMovimiento)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {sel ? (
              <div className="ats-detail">
                <div className="ats-detail-head">
                  <span className={`ats-acct-icon ${claseIcono(sel.tipo)}`}>
                    <IconoCuenta tipo={sel.tipo} />
                  </span>
                  <div>
                    <div className="nm">{sel.nombre}</div>
                    <div className="meta">{sel.banco ?? sel.cbuAlias ?? "—"}</div>
                  </div>
                  <div className="bal">
                    <div className="l">Saldo actual</div>
                    <div className="v">
                      {fmt(sel.saldo)}{" "}
                      <span style={{ fontSize: 12, color: "var(--muted-text-2)" }}>
                        {sel.moneda}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ats-detail-tools">
                  {sel.tipo === "caja" ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setModal({ t: "arqueo" })}
                    >
                      <ClipboardCheckIcon />
                      Arqueo
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setModal({ t: "transfer", from: sel.id })}
                    disabled={cuentas.length < 2}
                  >
                    <ArrowLeftRightIcon />
                    Transferir
                  </button>
                  <span className="sp">
                    {cargandoMovs
                      ? "Cargando…"
                      : `${movimientos.length} movimiento${movimientos.length === 1 ? "" : "s"}`}
                  </span>
                </div>

                {movimientos.length === 0 && !cargandoMovs ? (
                  <div className="ats-mv-empty">
                    <div className="ico">
                      <FileTextIcon />
                    </div>
                    <h3>Sin movimientos todavía</h3>
                    <p>
                      Cuando registres cobros, pagos o transferencias sobre
                      esta cuenta van a aparecer acá con su saldo corrido.
                    </p>
                  </div>
                ) : (
                  <div className="ats-mv-tbl">
                    <div className="ats-mv-tr ats-mv-th">
                      <span>Fecha</span>
                      <span>Concepto / Origen</span>
                      <span className="r">Entrada / Salida</span>
                      <span className="r">Saldo</span>
                    </div>
                    {movimientos.map((m) => (
                      <div key={m.id} className="ats-mv-tr ats-mv-row">
                        <span className="ats-mv-date">{fechaCorta(m.fecha)}</span>
                        <span className="ats-mv-concept">
                          <span className="c">{m.concepto}</span>
                          <span className="o">
                            <span
                              className={`ats-mv-origin ${ORIGEN_CLASES[m.origenTipo] ?? "arqueo"}`}
                            >
                              {ORIGEN_LABELS[m.origenTipo] ?? m.origenTipo}
                            </span>
                            {m.ordenId ? (
                              <Link
                                className="ats-mv-link"
                                href={`/produccion/ordenes/${m.ordenId}`}
                              >
                                {m.ordenNumero}
                              </Link>
                            ) : null}
                          </span>
                        </span>
                        <span className="r">
                          <span
                            className={`ats-mv-amt ${m.tipo === "entrada" ? "in" : "out"}`}
                          >
                            {m.tipo === "entrada"
                              ? "+" + fmt(m.monto)
                              : fmt(-m.monto)}
                          </span>
                        </span>
                        <span className="ats-mv-saldo">
                          {fmt(m.saldoPosterior)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {modal?.t === "transfer" ? (
          <TransferModal
            cuentas={cuentas}
            desdeInicial={modal.from}
            ocupado={ocupado}
            onClose={() => setModal(null)}
            onDone={(desde, hacia, monto) =>
              void ejecutar(async () => {
                await transferirEntreCuentas({
                  desdeCuentaId: desde,
                  haciaCuentaId: hacia,
                  monto,
                });
                return `Transferencia de ${fmt(monto)} registrada.`;
              })
            }
          />
        ) : null}
        {modal?.t === "arqueo" && sel ? (
          <ArqueoModal
            cuenta={sel}
            ocupado={ocupado}
            onClose={() => setModal(null)}
            onDone={(contado) =>
              void ejecutar(async () => {
                const r = await cerrarArqueo(sel.id, contado);
                return r.diferencia === 0
                  ? "Arqueo cerrado sin diferencias."
                  : `Arqueo cerrado · ajuste ${fmt(Math.abs(r.diferencia))}.`;
              })
            }
          />
        ) : null}
        {modal?.t === "cuenta" ? (
          <NuevaCuentaModal
            ocupado={ocupado}
            onClose={() => setModal(null)}
            onDone={(payload) =>
              void ejecutar(async () => {
                await crearCuentaFondos(payload);
                return `Cuenta "${payload.nombre}" creada.`;
              })
            }
          />
        ) : null}
      </div>
    </div>
  );
}
