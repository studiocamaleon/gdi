"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckIcon,
  ChevronRightIcon,
  InfoIcon,
  LandmarkIcon,
  PlusIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  RETENCION_REGIMENES,
  RETENCION_REGIMEN_LABELS,
  type ComprobantePendiente,
  type CuentaFondosResumen,
  type MetodoPago,
} from "@/lib/administracion";
import type { CrearCobroPayload } from "@/lib/administracion-api";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const JURISDICCIONES = [
  "CABA",
  "Buenos Aires",
  "Córdoba",
  "Santa Fe",
  "Mendoza",
  "Nacional (ARCA)",
];
const BANCOS = [
  "Banco Galicia",
  "Banco Nación",
  "Banco Provincia",
  "Santander",
  "BBVA",
  "Macro",
  "Credicoop",
  "Otro",
];

type RetLinea = {
  regimen: string;
  jurisdiccion: string;
  base: string;
  alicuota: string;
  monto: string;
  comprobante: string;
};

/**
 * Cobro armado por el formulario, listo para persistir (payload sin
 * ordenId/clienteId) + proyección calculada para mostrarlo en listas
 * (staging en la ficha de creación de OT) sin recomputar las cifras.
 */
export type CobroDraft = {
  payload: Omit<CrearCobroPayload, "ordenId" | "clienteId">;
  /** Comprobantes a los que aplicar el cobro. Vacío = anticipo a cuenta. */
  imputaciones: Array<{ comprobanteId: string; monto: number }>;
  metodoNombre: string;
  metodoTipo: string;
  cuentaDestinoNombre: string;
  comisionMonto: number;
  comisionIvaMonto: number;
  netoAcreditado: number;
  retencionesTotal: number;
  disponibleReal: number;
  acreditacionLabel: string;
};

function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sumarDias(iso: string, dias: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(y, (m ?? 1) - 1, d ?? 1);
  fecha.setDate(fecha.getDate() + dias);
  return `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}/${fecha.getFullYear()}`;
}

/**
 * Formulario de cobro (diseño admin/Registrar cobro.html, grid form +
 * aside con las 3 cifras). No persiste: entrega un CobroDraft por
 * onSubmit — la página de registrar cobro lo POSTea; la ficha de
 * creación de OT lo deja en staging hasta emitir.
 */
export function CobroFormulario({
  saldo,
  metodos,
  cuentas,
  pendientes = [],
  guardando,
  submitLabelCheque = "Registrar valor en cartera",
  submitLabel = "Registrar cobro",
  onSubmit,
  onCancel,
  cancelHref,
}: {
  saldo: number;
  metodos: MetodoPago[];
  cuentas: CuentaFondosResumen[];
  /** Comprobantes del cliente con saldo. Sin ellos no hay "contra factura". */
  pendientes?: ComprobantePendiente[];
  guardando: boolean;
  submitLabel?: string;
  submitLabelCheque?: string;
  onSubmit: (draft: CobroDraft) => void;
  onCancel?: () => void;
  cancelHref?: string;
}) {
  const metodosActivos = metodos.filter((m) => m.activo);
  const [metodoId, setMetodoId] = React.useState(metodosActivos[0]?.id ?? "");
  const metodo = metodosActivos.find((m) => m.id === metodoId) ?? null;
  const esCheque = metodo?.tipo === "cheque_echeq";

  const [monto, setMonto] = React.useState(saldo > 0 ? String(saldo) : "");
  const [fecha, setFecha] = React.useState(hoyIso());
  const [comEdit, setComEdit] = React.useState<number | null>(null);
  const [cuentaId, setCuentaId] = React.useState<string | null>(null);
  const [retOpen, setRetOpen] = React.useState(false);
  const [rets, setRets] = React.useState<RetLinea[]>([]);
  const [contraFactura, setContraFactura] = React.useState(false);
  const [imputaciones, setImputaciones] = React.useState<Record<string, string>>(
    {},
  );
  const [chq, setChq] = React.useState({
    numero: "",
    banco: BANCOS[0],
    emision: "",
    pago: "",
    origen: "tercero" as "tercero" | "propio",
  });

  const bruto = Number(monto) || 0;
  const comPct = comEdit ?? metodo?.comisionPct ?? 0;
  const comision = (bruto * comPct) / 100;
  const ivaCom = (comision * (metodo?.ivaComisionPct ?? 0)) / 100;
  const neto = bruto - comision - ivaCom;
  const totalRet = rets.reduce((s, r) => s + (Number(r.monto) || 0), 0);
  const disponible = neto - totalRet;
  const cuentaUsadaId =
    cuentaId ?? metodo?.cuentaDestinoId ?? cuentas[0]?.id ?? null;
  const cuentaUsada = cuentas.find((c) => c.id === cuentaUsadaId);
  const fechaAcreditacion = esCheque
    ? chq.pago || "al acreditar el valor"
    : sumarDias(fecha, metodo?.plazoAcreditacionDias ?? 0);

  const seleccionarMetodo = (id: string) => {
    setMetodoId(id);
    setComEdit(null);
    setCuentaId(null);
  };

  // Se imputa el BRUTO: la comisión del método es un costo nuestro, no algo
  // que el cliente deje de deber.
  const totalImputado = contraFactura
    ? Object.values(imputaciones).reduce((s, v) => s + (Number(v) || 0), 0)
    : 0;
  const sinImputar = Math.max(0, bruto - totalImputado);
  const excedeImputacion = totalImputado > bruto + 0.001;

  /**
   * Al tildar propone el mínimo entre lo que falta del cobro y el saldo del
   * comprobante: el caso normal es cancelar la factura sin pasarse.
   */
  const toggleImputacion = (p: ComprobantePendiente) =>
    setImputaciones((prev) => {
      const next = { ...prev };
      if (next[p.id] !== undefined) {
        delete next[p.id];
        return next;
      }
      const yaImputado = Object.entries(prev).reduce(
        (s, [, v]) => s + (Number(v) || 0),
        0,
      );
      const disponibleCobro = Math.max(0, bruto - yaImputado);
      next[p.id] = String(Math.min(p.saldo, disponibleCobro) || 0);
      return next;
    });

  const addRet = () => {
    setRetOpen(true);
    setRets((prev) => [
      ...prev,
      {
        regimen: RETENCION_REGIMENES[0],
        jurisdiccion: JURISDICCIONES[0],
        base: monto,
        alicuota: "",
        monto: "",
        comprobante: "",
      },
    ]);
  };
  const setRet = (i: number, campo: keyof RetLinea, valor: string) =>
    setRets((prev) =>
      prev.map((r, j) => {
        if (j !== i) return r;
        const nr = { ...r, [campo]: valor };
        if (campo === "alicuota" || campo === "base") {
          const b = Number(nr.base) || 0;
          const a = Number(nr.alicuota) || 0;
          if (b && a) nr.monto = String(Math.round((b * a) / 100));
        }
        return nr;
      }),
    );
  const delRet = (i: number) =>
    setRets((prev) => prev.filter((_, j) => j !== i));

  const submit = () => {
    if (!metodo || !cuentaUsadaId || bruto <= 0) return;
    if (esCheque && !chq.numero.trim()) {
      toast.error("Cargá el número del cheque/echeq.");
      return;
    }
    if (excedeImputacion) {
      toast.error(
        "Estás imputando más de lo que entra en el cobro. Ajustá los montos.",
      );
      return;
    }
    onSubmit({
      imputaciones: contraFactura
        ? Object.entries(imputaciones)
            .map(([comprobanteId, v]) => ({
              comprobanteId,
              monto: Number(v) || 0,
            }))
            .filter((i) => i.monto > 0)
        : [],
      payload: {
        fecha,
        metodoPagoId: metodo.id,
        cuentaDestinoId: cuentaUsadaId,
        montoBruto: bruto,
        comisionPctAplicada: comPct,
        retenciones: rets
          .filter((r) => Number(r.monto) > 0)
          .map((r) => ({
            regimen: r.regimen,
            jurisdiccion: r.jurisdiccion,
            base: Number(r.base) || 0,
            alicuota: Number(r.alicuota) || 0,
            monto: Number(r.monto),
            nroComprobante: r.comprobante || undefined,
          })),
        valor: esCheque
          ? {
              formato: chq.numero.match(/^e/i) ? "echeq" : "fisico",
              origen: chq.origen,
              numero: chq.numero.trim(),
              banco: chq.banco,
              fechaEmision: chq.emision || undefined,
              fechaPago: chq.pago || undefined,
            }
          : undefined,
      },
      metodoNombre: metodo.nombre,
      metodoTipo: metodo.tipo,
      cuentaDestinoNombre: cuentaUsada?.nombre ?? "—",
      comisionMonto: comision,
      comisionIvaMonto: ivaCom,
      netoAcreditado: neto,
      retencionesTotal: totalRet,
      disponibleReal: disponible,
      acreditacionLabel: fechaAcreditacion,
    });
  };

  return (
    <div className="arc-grid">
      <div className="arc-card">
        <div className="arc-card-sec">
          <div className="arc-sec-t">Datos del cobro</div>
          <div className="arc-frow">
            <div className="arc-field">
              <label>Monto a cobrar</label>
              <div className="arc-money big">
                <span className="c">$</span>
                <input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0"
                />
              </div>
              {saldo > 0 ? (
                <button
                  type="button"
                  className="arc-max"
                  onClick={() => setMonto(String(saldo))}
                >
                  Saldo completo · {fmt(saldo)}
                </button>
              ) : null}
            </div>
            <div className="arc-field">
              <label>Método de pago</label>
              <select
                value={metodoId}
                onChange={(e) => seleccionarMetodo(e.target.value)}
              >
                {metodosActivos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
              <div
                className="arc-field"
                style={{ marginTop: 12, marginBottom: 0 }}
              >
                <label>Fecha del cobro</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="arc-card-sec">
          <div className="arc-sec-t">
            Acreditación <span className="n">según método · editable</span>
          </div>
          <div className="arc-auto-note">
            <ZapIcon />
            Autocompletado desde{" "}
            <b style={{ margin: "0 4px", color: "var(--ink-2)" }}>
              {metodo?.nombre ?? "—"}
            </b>{" "}
            — podés ajustarlo.
          </div>
          <div className="arc-frow3">
            <div className="arc-field autofilled">
              <label>Comisión</label>
              <div className="arc-suffix">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={comPct}
                  onChange={(e) => setComEdit(+e.target.value || 0)}
                />
                <span className="s">%</span>
              </div>
            </div>
            <div className="arc-field">
              <label>Neto acreditado</label>
              <div className="arc-money">
                <span className="c">$</span>
                <input
                  type="text"
                  disabled
                  value={Math.round(neto).toLocaleString("es-AR")}
                />
              </div>
            </div>
            <div className="arc-field autofilled">
              <label>Fecha estimada</label>
              <input type="text" disabled value={fechaAcreditacion} />
            </div>
          </div>
          <div className="arc-field" style={{ marginBottom: 0 }}>
            <label>Cuenta destino</label>
            <select
              value={cuentaUsadaId ?? ""}
              onChange={(e) => setCuentaId(e.target.value)}
            >
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {esCheque ? (
          <div className="arc-card-sec">
            <div className="arc-sec-t">
              Datos del valor <span className="n">{metodo?.nombre}</span>
            </div>
            <div className="arc-variant-note">
              <InfoIcon />
              <span>
                Este cobro crea un <b>valor en cartera</b>. El disponible real
                se acredita recién en la fecha de pago del valor.
              </span>
            </div>
            <div className="arc-frow">
              <div className="arc-field">
                <label>Número de cheque / echeq</label>
                <input
                  value={chq.numero}
                  onChange={(e) => setChq({ ...chq, numero: e.target.value })}
                  placeholder="0000 0000"
                />
              </div>
              <div className="arc-field">
                <label>Banco emisor</label>
                <select
                  value={chq.banco}
                  onChange={(e) => setChq({ ...chq, banco: e.target.value })}
                >
                  {BANCOS.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="arc-frow">
              <div className="arc-field">
                <label>Fecha de emisión</label>
                <input
                  type="date"
                  value={chq.emision}
                  onChange={(e) => setChq({ ...chq, emision: e.target.value })}
                />
              </div>
              <div className="arc-field">
                <label>
                  Fecha de pago <span className="opt">(si es diferido)</span>
                </label>
                <input
                  type="date"
                  value={chq.pago}
                  onChange={(e) => setChq({ ...chq, pago: e.target.value })}
                />
              </div>
            </div>
            <div className="arc-field" style={{ marginBottom: 0 }}>
              <label>Origen del valor</label>
              <div className="arc-radio-row">
                <button
                  type="button"
                  className={`arc-radio-chip ${chq.origen === "propio" ? "on" : ""}`}
                  onClick={() => setChq({ ...chq, origen: "propio" })}
                >
                  Propio
                </button>
                <button
                  type="button"
                  className={`arc-radio-chip ${chq.origen === "tercero" ? "on" : ""}`}
                  onClick={() => setChq({ ...chq, origen: "tercero" })}
                >
                  De tercero
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="arc-card-sec">
          <div className="arc-sec-t">Aplicado a</div>
          <div className="arc-radio-row">
            <button
              type="button"
              className={`arc-radio-chip ${!contraFactura ? "on" : ""}`}
              onClick={() => setContraFactura(false)}
            >
              Anticipo (a cuenta)
            </button>
            <button
              type="button"
              className={`arc-radio-chip ${contraFactura ? "on" : ""}`}
              onClick={() => setContraFactura(true)}
              disabled={pendientes.length === 0}
              title={
                pendientes.length === 0
                  ? "Este cliente no tiene comprobantes con saldo pendiente"
                  : undefined
              }
            >
              Contra factura
            </button>
          </div>

          {!contraFactura ? (
            <div
              className="arc-auto-note"
              style={{ marginTop: 12, marginBottom: 0 }}
            >
              <InfoIcon />
              {pendientes.length === 0
                ? "Sin comprobantes con saldo: el cobro queda a cuenta."
                : "Seña a cuenta, sin imputar a ningún comprobante."}
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div className="arc-imp-th">
                <span />
                <span>Comprobante pendiente</span>
                <span className="r">Saldo</span>
                <span className="r">Imputar</span>
              </div>
              {pendientes.map((p) => {
                const sel = imputaciones[p.id] !== undefined;
                return (
                  <div key={p.id} className="arc-imp-row">
                    <button
                      type="button"
                      className={`arc-imp-cb ${sel ? "on" : ""}`}
                      onClick={() => toggleImputacion(p)}
                      aria-label={`Imputar a ${p.numeroCompleto}`}
                    >
                      {sel ? <CheckIcon /> : null}
                    </button>
                    <div className="arc-imp-cmp">
                      <div className="n">{p.numeroCompleto}</div>
                      <div className={`d ${p.vencida ? "venc" : ""}`}>
                        {p.fecha}
                        {p.vencimiento ? ` · vence ${p.vencimiento}` : ""}
                        {p.vencida ? " · vencida" : ""}
                      </div>
                    </div>
                    <span className="arc-imp-saldo">{fmt(p.saldo)}</span>
                    <div className="arc-imp-monto">
                      <input
                        type="number"
                        disabled={!sel}
                        value={sel ? imputaciones[p.id] : ""}
                        onChange={(e) =>
                          setImputaciones((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                );
              })}
              <div className="arc-imp-prog">
                <div className="legend">
                  <span className="k">Imputado</span>
                  <span className="v">
                    {fmt(totalImputado)} de {fmt(bruto)}
                  </span>
                </div>
                <div className="bar">
                  <div
                    className="used"
                    style={{
                      width:
                        (bruto > 0
                          ? Math.min(100, (totalImputado / bruto) * 100)
                          : 0) + "%",
                    }}
                  />
                </div>
                <div className="legend">
                  <span className="k">Sin imputar</span>
                  <span className={`v ${sinImputar > 0 ? "rest" : ""}`}>
                    {fmt(sinImputar)}
                  </span>
                </div>
                {sinImputar > 0 ? (
                  <div className="anticipo-note">
                    <InfoIcon />
                    Lo que quede sin imputar ({fmt(sinImputar)}) sigue siendo{" "}
                    <b style={{ margin: "0 3px" }}>anticipo a cuenta</b> del
                    cliente.
                  </div>
                ) : null}
                {excedeImputacion ? (
                  <div className="anticipo-note" style={{ color: "var(--danger)" }}>
                    <InfoIcon />
                    Estás imputando más de lo que entra en el cobro.
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="arc-card-sec">
          <div
            className={`arc-collapse-head ${retOpen ? "open" : ""}`}
            onClick={() => setRetOpen((o) => !o)}
          >
            <ChevronRightIcon className="chev" />
            <span className="t">Retenciones / percepciones</span>
            {rets.length > 0 ? (
              <span className="badge">{rets.length}</span>
            ) : null}
            {totalRet > 0 ? <span className="sum">−{fmt(totalRet)}</span> : null}
          </div>
          {retOpen ? (
            <div className="arc-ret-body">
              {rets.map((r, i) => (
                <div key={i} className="arc-ret-line">
                  <button
                    type="button"
                    className="rm"
                    onClick={() => delRet(i)}
                    aria-label="Quitar retención"
                  >
                    <XIcon />
                  </button>
                  <div className="arc-frow" style={{ marginBottom: 10 }}>
                    <div className="arc-field sm" style={{ marginBottom: 0 }}>
                      <label>Régimen</label>
                      <select
                        value={r.regimen}
                        onChange={(e) => setRet(i, "regimen", e.target.value)}
                      >
                        {RETENCION_REGIMENES.map((x) => (
                          <option key={x} value={x}>
                            {RETENCION_REGIMEN_LABELS[x]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="arc-field sm" style={{ marginBottom: 0 }}>
                      <label>Jurisdicción</label>
                      <select
                        value={r.jurisdiccion}
                        onChange={(e) =>
                          setRet(i, "jurisdiccion", e.target.value)
                        }
                      >
                        {JURISDICCIONES.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="arc-frow3" style={{ marginBottom: 10 }}>
                    <div className="arc-field sm" style={{ marginBottom: 0 }}>
                      <label>Base imponible</label>
                      <div className="arc-money">
                        <span className="c" style={{ fontSize: 11 }}>
                          $
                        </span>
                        <input
                          type="number"
                          value={r.base}
                          onChange={(e) => setRet(i, "base", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="arc-field sm" style={{ marginBottom: 0 }}>
                      <label>Alícuota</label>
                      <div className="arc-suffix">
                        <input
                          type="number"
                          step="0.01"
                          value={r.alicuota}
                          onChange={(e) => setRet(i, "alicuota", e.target.value)}
                          placeholder="0"
                        />
                        <span className="s">%</span>
                      </div>
                    </div>
                    <div className="arc-field sm" style={{ marginBottom: 0 }}>
                      <label>Monto</label>
                      <div className="arc-money">
                        <span className="c" style={{ fontSize: 11 }}>
                          $
                        </span>
                        <input
                          type="number"
                          value={r.monto}
                          onChange={(e) => setRet(i, "monto", e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="arc-field sm" style={{ marginBottom: 0 }}>
                    <label>Nº comprobante de retención</label>
                    <input
                      value={r.comprobante}
                      onChange={(e) => setRet(i, "comprobante", e.target.value)}
                      placeholder="Ej. 0001-00004521"
                    />
                  </div>
                </div>
              ))}
              <button type="button" className="arc-ret-add" onClick={addRet}>
                <PlusIcon />
                Agregar {rets.length > 0 ? "otra " : ""}retención
              </button>
            </div>
          ) : null}
          {!retOpen && rets.length === 0 ? (
            <div
              className="arc-auto-note"
              style={{ marginTop: 10, marginBottom: 0 }}
            >
              <InfoIcon />
              Sin retenciones. Abrí la sección si el cliente retiene sobre este
              pago.
            </div>
          ) : null}
        </div>
      </div>

      <div className="arc-aside">
        <div className="arc-sum-card">
          <div className="h">Resumen del cobro</div>
          <div className="arc-three">
            <div className="arc-tc f">
              <div className="l">Facturado / cobrado</div>
              <div className="v">{fmt(bruto)}</div>
              <div className="sub">Anticipo a cuenta</div>
            </div>
            <div className="arc-tc n">
              <div className="l">Neto acreditado</div>
              <div className="v">{fmt(neto)}</div>
              {comision > 0 ? (
                <div className="delta">
                  −{fmt(comision + ivaCom)} comisión + IVA
                </div>
              ) : (
                <div className="sub">Sin comisión de método</div>
              )}
            </div>
            <div className="arc-tc d">
              <div className="l">Disponible real</div>
              <div className="v">{fmt(disponible)}</div>
              {totalRet > 0 ? (
                <div className="delta">−{fmt(totalRet)} retenciones</div>
              ) : (
                <div className="sub">
                  {esCheque ? "Al acreditar el valor" : "Sin retenciones"}
                </div>
              )}
            </div>
          </div>
          <div className="arc-breakdown">
            <div className="arc-bd-row">
              <span>Bruto</span>
              <span className="v">{fmt(bruto)}</span>
            </div>
            {comision > 0 ? (
              <div className="arc-bd-row neg">
                <span>Comisión {comPct}%</span>
                <span className="v">−{fmt(comision)}</span>
              </div>
            ) : null}
            {ivaCom > 0 ? (
              <div className="arc-bd-row neg">
                <span>IVA s/comisión</span>
                <span className="v">−{fmt(ivaCom)}</span>
              </div>
            ) : null}
            {totalRet > 0 ? (
              <div className="arc-bd-row neg">
                <span>Retenciones ({rets.length})</span>
                <span className="v">−{fmt(totalRet)}</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="arc-acct-hint">
          <LandmarkIcon />
          Acredita en{" "}
          <b style={{ color: "var(--ink-2)", margin: "0 4px" }}>
            {cuentaUsada?.nombre ?? "—"}
          </b>{" "}
          · {fechaAcreditacion}
        </div>
        <div className="arc-sum-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={bruto <= 0 || !metodo || guardando}
            onClick={submit}
          >
            <CheckIcon />
            {guardando
              ? "Registrando…"
              : esCheque
                ? submitLabelCheque
                : submitLabel}
          </button>
          {cancelHref ? (
            <Link className="btn arc-btn-ghost" href={cancelHref}>
              Cancelar
            </Link>
          ) : onCancel ? (
            <button type="button" className="btn arc-btn-ghost" onClick={onCancel}>
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
