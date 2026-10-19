"use client";
import {
  calcularRetenciones,
  cifrasCobro,
  estimarAcreditacion,
  redondearDinero,
} from "../../../apps/api/src/common/medios-pago";
import { AGENTES_RETENCION } from "./retenciones-config-editor";
import { useCapacidad } from "@/components/navigation/capacidades-provider";

import { cuentaCompatibleCobro } from "../../../apps/api/src/common/cuentas-cobro";
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
  type CuentaFondosResumen,
  type MetodoPago,
} from "@/lib/administracion";
import { crearIntentoCobro } from "@/lib/intento-cobro";
import type { CrearCobroPayload } from "@/lib/administracion-api";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda, numeroMoneda, parsearMonto } from "@/lib/moneda";
import { MoneyInput } from "@/components/ui/money-input";
import { Input } from "@/components/ui/input";
import { CobroConfirmacion } from "./cobro-confirmacion";

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
  agente: string;
  reglaId?: string;
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

function hoyIso(zonaHoraria: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Formulario de cobro (diseño admin/Registrar cobro.html, grid form +
 * aside con las 3 cifras). No persiste: entrega un CobroDraft por
 * onSubmit — la página de registrar cobro lo POSTea; la ficha de
 * creación de OT lo deja en staging hasta emitir.
 */
export function CobroFormulario({
  saldo,
  limitarAlSaldo = false,
  metodos,
  cuentas,
  guardando,
  submitLabelCheque = "Registrar valor en cartera",
  submitLabel = "Registrar cobro",
  registroAlEmitir = false,
  onSubmit,
  onCancel,
  cancelHref,
}: {
  saldo: number;
  limitarAlSaldo?: boolean;
  metodos: MetodoPago[];
  cuentas: CuentaFondosResumen[];
  guardando: boolean;
  submitLabel?: string;
  submitLabelCheque?: string;
  registroAlEmitir?: boolean;
  onSubmit: (draft: CobroDraft) => void | Promise<void>;
  onCancel?: () => void;
  cancelHref?: string;
}) {
  const intento = React.useRef(crearIntentoCobro());
  const [enviando, setEnviando] = React.useState(false);
  const [porConfirmar, setPorConfirmar] = React.useState<CobroDraft | null>(null);
  const { moneda, zonaHoraria, paisCodigo } = useConfigRegional();
  const fmt = (n: number) => formatearMoneda(n, moneda);
  const conValores = useCapacidad("valores");
  const metodosActivos = metodos.filter(
    (m) => m.activo && (conValores || m.tipo !== "cheque_echeq"),
  );
  const [metodoId, setMetodoId] = React.useState("");
  const metodo = metodosActivos.find((m) => m.id === metodoId) ?? null;
  const esCheque = metodo?.tipo === "cheque_echeq";
  const cuentasCompatibles = cuentas.filter(c =>
    c.moneda === moneda.codigo && !!metodo && cuentaCompatibleCobro(metodo.tipo, c.tipo),
  );

  // El texto viaja con los separadores de la moneda (lo maneja MoneyInput);
  // el número parseado se guarda aparte para no re-parsear en cada cálculo.
  const [monto, setMonto] = React.useState(() =>
    saldo > 0 ? numeroMoneda(saldo, moneda) : "",
  );
  const [montoNum, setMontoNum] = React.useState<number | null>(
    saldo > 0 ? saldo : null,
  );
  // "N° de operación": va impreso en el recibo, que es donde el cliente lo
  // reconoce (el ID de la transferencia, el cupón de la tarjeta, el ticket).
  const [referencia, setReferencia] = React.useState("");
  const [fecha, setFecha] = React.useState(() => hoyIso(zonaHoraria));
  const [comEdit, setComEdit] = React.useState<number | null>(null);
  const [cuentaId, setCuentaId] = React.useState<string | null>(null);
  const [retOpen, setRetOpen] = React.useState(false);
  const [retsManual, setRetsManual] = React.useState<RetLinea[] | null>(null);
  const [chq, setChq] = React.useState({
    formato: "fisico" as "fisico" | "echeq",
    modalidad: "comun" as "comun" | "diferido",
    numero: "",
    banco: BANCOS[0],
    identificadorBancario: "",
    emision: "",
    pago: "",
  });

  const bruto = montoNum ?? 0;
  const comPct = comEdit ?? metodo?.comisionPct ?? 0;
  const cifras = cifrasCobro(bruto, comPct, metodo?.ivaComisionPct ?? 0, 0);
  const comision = cifras.comisionMonto;
  const ivaCom = cifras.comisionIvaMonto;
  const neto = cifras.netoAcreditado;
  const sugeridas: RetLinea[] = calcularRetenciones(
    metodo?.sufreRetencion ? (metodo.retencionesConfig ?? []) : [],
    bruto,
    neto,
    fecha,
  ).map((r) => ({
    regimen: r.regimen,
    jurisdiccion: r.jurisdiccion ?? "",
    agente: r.agente ?? "procesador",
    reglaId: r.reglaId ?? undefined,
    base: numeroMoneda(r.base, moneda),
    alicuota: String(r.alicuota),
    monto: numeroMoneda(r.monto, moneda),
    comprobante: "",
  }));
  const rets = retsManual ?? sugeridas;
  const setRets = (update: (prev: RetLinea[]) => RetLinea[]) =>
    setRetsManual((prev) => update(prev ?? sugeridas));
  const totalRet = rets.reduce(
    (s, r) => s + (parsearMonto(r.monto, moneda) ?? 0),
    0,
  );
  const disponible = redondearDinero(neto - totalRet);
  const cuentaUsadaId = esCheque
    ? null
    : (cuentasCompatibles.find(c => c.id === cuentaId)?.id ??
      cuentasCompatibles.find((c) => c.id === metodo?.cuentaDestinoId)?.id ??
      cuentasCompatibles[0]?.id ??
      null);
  const cuentaUsada = cuentasCompatibles.find((c) => c.id === cuentaUsadaId);
  const estimacion =
    fecha && metodo && !esCheque
      ? estimarAcreditacion(
          fecha,
          metodo?.plazoAcreditacionDias ?? 0,
          metodo?.calendarioAcreditacion,
          paisCodigo,
          metodo?.feriadosAdicionales?.filter(Boolean),
        )
      : null;
  const fechaAcreditacion = !metodo
    ? "Elegí un medio de pago"
    : esCheque
    ? chq.modalidad === "diferido"
      ? chq.pago || "al acreditar el valor"
      : "al acreditar el valor"
    : (estimacion?.fecha.split("-").reverse().join("/") ??
      "Elegí la fecha del cobro");

  const seleccionarMetodo = (id: string) => {
    setMetodoId(id);
    setComEdit(null);
    setRetsManual(null);
    setCuentaId(null);
  };

  const addRet = () => {
    setRetOpen(true);
    setRets((prev) => [
      ...prev,
      {
        agente: "cliente",
        regimen: RETENCION_REGIMENES[0],
        jurisdiccion: "",
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
          const b = parsearMonto(nr.base, moneda) ?? 0;
          const a = Number(nr.alicuota) || 0;
          // El monto calculado se escribe ya formateado: es el texto de un
          // MoneyInput y tiene que re-parsear con los separadores de la moneda.
          nr.monto = numeroMoneda(redondearDinero((b * a) / 100), moneda);
        }
        return nr;
      }),
    );
  const delRet = (i: number) =>
    setRets((prev) => prev.filter((_, j) => j !== i));

  const excedeSaldo =
    limitarAlSaldo &&
    (saldo <= 0 || redondearDinero(bruto) > redondearDinero(saldo));

  const revisar = () => {
    if (guardando || enviando || porConfirmar || excedeSaldo) return;
    if (!metodo || !fecha || bruto <= 0 || (!esCheque && !cuentaUsadaId))
      return;
    if (disponible <= 0) {
      toast.error(
        "Las comisiones y retenciones no pueden consumir todo el cobro.",
      );
      return;
    }
    if (esCheque && !chq.numero.trim()) {
      toast.error("Cargá el número del cheque/echeq.");
      return;
    }
    if (esCheque && chq.modalidad === "diferido" && !chq.pago) {
      toast.error("Indicá la fecha de pago del cheque diferido.");
      return;
    }
    if (esCheque && chq.emision && chq.pago && chq.pago < chq.emision) {
      toast.error("La fecha de pago no puede ser anterior a la emisión.");
      return;
    }
    const draft: CobroDraft = {
      // La imputación cobro→factura la hace el SISTEMA (FIFO sobre las facturas
      // impagas de la orden, `facturacion-ordenes.service#matchearCobro`): el
      // cobro entra siempre libre y el matching lo aplica.
      // docs/facturacion-ordenes-deuda-comercial-diseno.md §5.
      imputaciones: [],
      payload: {
        fecha,
        metodoPagoId: metodo.id,
        ...(esCheque ? {} : { cuentaDestinoId: cuentaUsadaId! }),
        montoBruto: bruto,
        comisionPctAplicada: comPct,
        referencia: referencia.trim() || undefined,
        retenciones: rets
          .filter((r) => (parsearMonto(r.monto, moneda) ?? 0) > 0)
          .map((r) => ({
            agente: r.agente,
            reglaId: r.reglaId,
            regimen: r.regimen,
            jurisdiccion: r.jurisdiccion,
            base: parsearMonto(r.base, moneda) ?? 0,
            alicuota: Number(r.alicuota) || 0,
            monto: parsearMonto(r.monto, moneda) ?? 0,
            nroComprobante: r.comprobante || undefined,
          })),
        valor: esCheque
          ? {
              formato: chq.formato,
              modalidad: chq.modalidad,
              origen: "tercero",
              numero: chq.numero.trim(),
              banco: chq.banco,
              identificadorBancario:
                chq.formato === "echeq"
                  ? chq.identificadorBancario.trim() || undefined
                  : undefined,
              fechaEmision: chq.emision || undefined,
              fechaPago: chq.pago || undefined,
            }
          : undefined,
      },
      metodoNombre: metodo.nombre,
      metodoTipo: metodo.tipo,
      cuentaDestinoNombre: esCheque
        ? "Valor en cartera"
        : (cuentaUsada?.nombre ?? "—"),
      comisionMonto: comision,
      comisionIvaMonto: ivaCom,
      netoAcreditado: neto,
      retencionesTotal: totalRet,
      disponibleReal: disponible,
      acreditacionLabel: fechaAcreditacion,
    };
    setPorConfirmar(draft);
  };

  const confirmar = async () => {
    if (!porConfirmar || guardando || enviando || excedeSaldo) return;
    const draft = porConfirmar;
    const clave = intento.current.iniciar(draft.payload);
    if (!clave) return;
    setEnviando(true);
    try {
      await onSubmit({
        ...draft,
        payload: { ...draft.payload, idempotencyKey: clave },
      });
      setPorConfirmar(null);
    } catch {
      // El padre muestra el error. Reintentar conserva la misma clave.
      intento.current.liberar();
      setEnviando(false);
    }
  };

  return (
    <div className="arc-grid">
      {estimacion?.advertencia ? (
        <p role="status" className="text-sm text-muted-foreground">
          {estimacion.advertencia}
        </p>
      ) : null}
      <div className="arc-card">
        <div className="arc-card-sec">
          <div className="arc-sec-t">Datos del cobro</div>
          <div className="arc-frow">
            <div className="arc-field">
              <label>Monto a cobrar</label>
              <MoneyInput
                className="big"
                inputClassName="h-auto"
                value={monto}
                onValueChange={(texto, numero) => {
                  setMonto(texto);
                  setMontoNum(numero);
                }}
                moneda={moneda}
                placeholder="0"
                ariaLabel="Monto a cobrar"
              />
              {saldo > 0 ? (
                <button
                  type="button"
                  className="arc-max"
                  onClick={() => {
                    setMonto(numeroMoneda(saldo, moneda));
                    setMontoNum(saldo);
                  }}
                >
                  Saldo completo · {fmt(saldo)}
                </button>
              ) : null}
            </div>
            <div className="arc-field">
              <label htmlFor="cobro-metodo-pago">Medio de pago</label>
              <select
                id="cobro-metodo-pago"
                required
                value={metodoId}
                onChange={(e) => seleccionarMetodo(e.target.value)}
              >
                <option value="" disabled>
                  Elegí un medio de pago
                </option>
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
            {metodo ? (
              <>
                Autocompletado desde{" "}
                <b style={{ margin: "0 4px", color: "var(--ink-2)" }}>
                  {metodo.nombre}
                </b>{" "}
                — podés ajustarlo.
              </>
            ) : "Elegí un medio de pago para ver su acreditación."}
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
              <label>Neto antes de retenciones</label>
              <div className="arc-money">
                <span className="c">{moneda.simbolo}</span>
                <input
                  type="text"
                  disabled
                  value={numeroMoneda(neto, moneda, 2)}
                />
              </div>
            </div>
            <div className="arc-field autofilled">
              <label>Fecha estimada</label>
              <input type="text" disabled value={fechaAcreditacion} />
            </div>
          </div>
          <div className="arc-field">
            <label>N° de operación</label>
            <input
              type="text"
              maxLength={60}
              placeholder="ID de transferencia, cupón, ticket…"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </div>
          {esCheque ? (
            <div className="arc-auto-note" style={{ marginBottom: 0 }}>
              <LandmarkIcon />
              El valor queda en cartera sin cuenta destino. La cuenta bancaria
              se elige cuando se registra el depósito.
            </div>
          ) : (
            <div className="arc-field" style={{ marginBottom: 0 }}>
              <label htmlFor="cobro-cuenta-destino">Cuenta destino</label>
              <select
                id="cobro-cuenta-destino"
                value={cuentaUsadaId ?? ""}
                onChange={(e) => setCuentaId(e.target.value)}
                disabled={cuentasCompatibles.length === 0}
              >
                {cuentasCompatibles.length === 0 ? (
                  <option value="">
                    {metodo
                      ? `Sin cuentas disponibles en ${moneda.codigo}`
                      : "Primero elegí un medio de pago"}
                  </option>
                ) : null}
                {cuentasCompatibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {metodo && cuentasCompatibles.length === 0 ? (
                <p className="mt-2 text-sm text-destructive">
                  No hay una cuenta compatible con este medio en {moneda.codigo}. Transferencias y tarjetas requieren banco o billetera; el efectivo requiere una caja asignada.
                </p>
              ) : null}
            </div>
          )}
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
                <label>Formato</label>
                <select
                  value={chq.formato}
                  onChange={(e) =>
                    setChq((prev) => ({
                      ...prev,
                      formato: e.target.value as "fisico" | "echeq",
                    }))
                  }
                >
                  <option value="fisico">Cheque físico</option>
                  <option value="echeq">eCheq</option>
                </select>
              </div>
              <div className="arc-field">
                <label>Modalidad</label>
                <select
                  value={chq.modalidad}
                  onChange={(e) => {
                    const modalidad = e.target.value as "comun" | "diferido";
                    setChq((prev) => ({
                      ...prev,
                      modalidad,
                      pago: modalidad === "comun" ? "" : prev.pago,
                    }));
                  }}
                >
                  <option value="comun">Común</option>
                  <option value="diferido">Diferido</option>
                </select>
              </div>
            </div>
            <div className="arc-frow">
              <div className="arc-field">
                <label>Número del instrumento</label>
                <input
                  value={chq.numero}
                  onChange={(e) =>
                    setChq((prev) => ({ ...prev, numero: e.target.value }))
                  }
                  placeholder="0000 0000"
                />
              </div>
              <div className="arc-field">
                <label>Banco emisor</label>
                <select
                  value={chq.banco}
                  onChange={(e) =>
                    setChq((prev) => ({ ...prev, banco: e.target.value }))
                  }
                >
                  {BANCOS.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="arc-frow">
              {chq.formato === "echeq" ? (
                <div className="arc-field">
                  <label>
                    ID bancario <span className="opt">(opcional)</span>
                  </label>
                  <input
                    value={chq.identificadorBancario}
                    onChange={(e) =>
                      setChq((prev) => ({
                        ...prev,
                        identificadorBancario: e.target.value,
                      }))
                    }
                    placeholder="Identificador informado por el banco"
                  />
                </div>
              ) : null}
              <div className="arc-field">
                <label>Fecha de emisión</label>
                <input
                  type="date"
                  value={chq.emision}
                  onChange={(e) =>
                    setChq((prev) => ({ ...prev, emision: e.target.value }))
                  }
                />
              </div>
            </div>
            {chq.modalidad === "diferido" ? (
              <div className="arc-frow">
                <div className="arc-field">
                  <label>Fecha de pago</label>
                  <input
                    type="date"
                    value={chq.pago}
                    onChange={(e) =>
                      setChq((prev) => ({ ...prev, pago: e.target.value }))
                    }
                  />
                </div>
              </div>
            ) : null}
            <p className="text-sm text-muted-foreground">
              El cheque queda en cartera como valor recibido de un tercero.
            </p>
          </div>
        ) : null}

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
            {totalRet > 0 ? (
              <span className="sum">−{fmt(totalRet)}</span>
            ) : null}
          </div>
          {retOpen ? (
            <div className="arc-ret-body">
              <p className="text-sm text-muted-foreground">
                Las retenciones del procesador o banco son estimadas hasta
                confirmar su liquidación. No agregan un segundo costo de IIBB al
                producto.
              </p>
              {retsManual !== null && sugeridas.length > 0 ? (
                <button type="button" onClick={() => setRetsManual(null)}>
                  Recalcular con la configuración del método
                </button>
              ) : null}
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
                  <div className="arc-field">
                    <label>Quién retiene</label>
                    <select
                      aria-label="Quién retiene"
                      value={r.agente}
                      onChange={(e) => setRet(i, "agente", e.target.value)}
                    >
                      {AGENTES_RETENCION.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="arc-frow" style={{ marginBottom: 10 }}>
                    <div className="arc-field sm" style={{ marginBottom: 0 }}>
                      <label>Régimen</label>
                      <select
                        value={r.regimen}
                        onChange={(e) => setRet(i, "regimen", e.target.value)}
                      >
                        {[...RETENCION_REGIMENES, "otro"].map((x) => (
                          <option key={x} value={x}>
                            {RETENCION_REGIMEN_LABELS[x]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="arc-field sm" style={{ marginBottom: 0 }}>
                      <label>Jurisdicción</label>
                      <Input
                        aria-label={`Jurisdicción de retención ${i + 1}`}
                        value={r.jurisdiccion}
                        maxLength={60}
                        placeholder="Ej. Santa Cruz"
                        onChange={(e) =>
                          setRet(i, "jurisdiccion", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="arc-frow3" style={{ marginBottom: 10 }}>
                    <div className="arc-field sm" style={{ marginBottom: 0 }}>
                      <label>Base imponible</label>
                      <MoneyInput
                        inputClassName="h-auto"
                        value={r.base}
                        onValueChange={(texto) => setRet(i, "base", texto)}
                        moneda={moneda}
                        ariaLabel="Base imponible"
                      />
                    </div>
                    <div className="arc-field sm" style={{ marginBottom: 0 }}>
                      <label>Alícuota</label>
                      <div className="arc-suffix">
                        <input
                          type="number"
                          step="0.01"
                          value={r.alicuota}
                          onChange={(e) =>
                            setRet(i, "alicuota", e.target.value)
                          }
                          placeholder="0"
                        />
                        <span className="s">%</span>
                      </div>
                    </div>
                    <div className="arc-field sm" style={{ marginBottom: 0 }}>
                      <label>Monto</label>
                      <MoneyInput
                        inputClassName="h-auto"
                        value={r.monto}
                        onValueChange={(texto) => setRet(i, "monto", texto)}
                        moneda={moneda}
                        placeholder="0"
                        ariaLabel="Monto de la retención"
                      />
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
              Sin retenciones cargadas. Abrí la sección para informar
              retenciones sobre este pago.
            </div>
          ) : null}
        </div>
      </div>

      <div className="arc-aside">
        <div className="arc-sum-card">
          <div className="h">Resumen del cobro</div>
          <div className="arc-three">
            <div className="arc-tc f">
              <div className="l">Bruto cobrado</div>
              <div className="v">{fmt(bruto)}</div>
              {/* El sistema imputa el cobro a las facturas impagas de la orden
                  (FIFO); lo que sobra queda a cuenta del cliente. */}
              <div className="sub">Se imputa a la orden</div>
            </div>
            <div className="arc-tc n">
              <div className="l">Neto antes de retenciones</div>
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
              <div className="l">Disponible previsto</div>
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
          {!metodo ? (
            <>Elegí un medio de pago para ver la cuenta de destino.</>
          ) : esCheque ? (
            <>Valor en cartera · cuenta bancaria al depositar</>
          ) : (
            <>
              Acredita en{" "}
              <b style={{ color: "var(--ink-2)", margin: "0 4px" }}>
                {cuentaUsada?.nombre ?? "—"}
              </b>{" "}
              · {fechaAcreditacion}
            </>
          )}
        </div>
        {excedeSaldo ? (
          <p role="alert">
            {saldo <= 0
              ? "La orden ya está saldada."
              : `El cobro no puede superar el saldo pendiente de ${fmt(saldo)}.`}
          </p>
        ) : null}
        <div className="arc-sum-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              bruto <= 0 ||
              !fecha ||
              !metodo ||
              (!esCheque && !cuentaUsadaId) ||
              disponible <= 0 ||
              guardando ||
              enviando ||
              excedeSaldo
            }
            onClick={revisar}
          >
            <CheckIcon />
            {guardando || enviando
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
            <button
              type="button"
              className="btn arc-btn-ghost"
              onClick={onCancel}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
      {porConfirmar && (
        <CobroConfirmacion
          draft={porConfirmar}
          registroAlEmitir={registroAlEmitir}
          enviando={guardando || enviando}
          onCancelar={() => {
            if (!guardando && !enviando) setPorConfirmar(null);
          }}
          onConfirmar={confirmar}
        />
      )}
    </div>
  );
}
