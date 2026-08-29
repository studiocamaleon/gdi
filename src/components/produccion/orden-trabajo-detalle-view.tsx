"use client";

import * as React from "react";

import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  CoinsIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FactoryIcon,
  PanelLeftIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";

import { EstadoOtBadge } from "@/components/produccion/ordenes-trabajo-view";
import type { Cobro } from "@/lib/administracion";
import { getCobros } from "@/lib/administracion-api";
import {
  ORDEN_TRABAJO_ESTADOS,
  ORDEN_TRABAJO_FLOW,
  fechaLocalDesdeIso,
  formatFechaOrden,
  formatMonedaOrden,
  type OrdenTrabajoDetalle,
  type OrdenTrabajoEventoTipo,
  type OrdenTrabajoPago,
  type OrdenTrabajoProducto,
} from "@/lib/ordenes-trabajo";
import {
  useConfigRegional,
  useFecha,
} from "@/components/navigation/config-regional-provider";

/* ─────────── helpers ─────────── */

export const EVENTO_ICONOS: Record<
  OrdenTrabajoEventoTipo,
  { Icono: typeof CheckIcon; tone?: "ok" }
> = {
  emision: { Icono: CheckIcon, tone: "ok" },
  numero_asignado: { Icono: TagIcon },
  borrador: { Icono: SaveIcon },
  productos: { Icono: PlusIcon },
  estado: { Icono: TagIcon },
  modificacion: { Icono: PencilIcon },
  item_agregado: { Icono: PlusIcon },
  item_modificado: { Icono: PencilIcon },
  item_quitado: { Icono: Trash2Icon },
  cancelacion: { Icono: Trash2Icon },
  tratamiento_fiscal: { Icono: CoinsIcon },
  paso: { Icono: FactoryIcon },
  nota: { Icono: TagIcon },
};

export function useFormatEventoFecha(): (iso: string) => string {
  const { hora, esHoy } = useFecha();
  return React.useCallback(
    (iso: string) => {
      const hh = hora(iso);
      if (!hh) return iso;
      // "hoy" se decide en hora del TENANT: comparar con getDate() usa la zona
      // del proceso, y a las 22 del taller el servidor en UTC ya está en el día
      // siguiente — el mismo evento sería "hoy" en el navegador y con fecha en
      // el servidor. Ver src/lib/fecha.ts
      return esHoy(iso) ? `hoy · ${hh}` : `${formatFechaOrden(iso)} · ${hh}`;
    },
    [hora, esHoy],
  );
}

/* ─────────── Ruta macro ─────────── */

const RUTA_MACRO = ["Pre-prensa", "Impresión", "Post-prensa", "QA", "Despacho"];

function OtRouteMini({
  estado,
  progreso,
}: {
  estado: OrdenTrabajoDetalle["estado"];
  progreso: number;
}) {
  const doneCount = Math.round((progreso / 100) * RUTA_MACRO.length);
  return (
    <div className="otd-route">
      {RUTA_MACRO.map((s, i) => {
        const st =
          i < doneCount
            ? "done"
            : i === doneCount && estado === "produccion"
              ? "run"
              : "wait";
        return (
          <React.Fragment key={s}>
            <div className={`otd-stage ${st}`}>
              <span className="otd-node">
                {st === "done" ? (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : st === "run" ? (
                  <span className="otd-pulse" />
                ) : (
                  <span className="otd-empty" />
                )}
              </span>
              <span className="otd-slbl">{s}</span>
            </div>
            {i < RUTA_MACRO.length - 1 ? (
              <span className={`otd-link ${i < doneCount ? "on" : ""}`} />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─────────── Producto expandible ─────────── */

function ProductoRow({ p }: { p: OrdenTrabajoProducto }) {
  const { moneda } = useConfigRegional();
  const [open, setOpen] = React.useState(false);
  return (
    <div className={`otd-prod ${open ? "open" : ""}`}>
      <div className="otd-prod-head" onClick={() => setOpen((o) => !o)}>
        <span className="chev">
          <ChevronRightIcon
            size={14}
            style={{
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform .15s ease",
            }}
          />
        </span>
        <span className="otd-prod-nm">
          {p.nombre}
          <small>{p.familia}</small>
        </span>
        <span className="otd-prod-qty">
          {p.cantidad.toLocaleString("es-AR")} {p.cantidadUnidad}
        </span>
        <span className="otd-prod-total">
          {formatMonedaOrden(p.total, moneda)}
        </span>
      </div>
      {open ? (
        <div className="otd-prod-body">
          <div className="otd-specs">
            {p.specs.map((s) => (
              <div key={s.etiqueta} className="otd-spec">
                <span className="k">{s.etiqueta}</span>
                <span className="v">{s.valor}</span>
              </div>
            ))}
          </div>
          {p.adicionales.length > 0 ? (
            <div className="otd-adic">
              {p.adicionales.map((a) => (
                <span key={a} className="otd-chip">
                  {a}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ─────────── Pagos ─────────── */

const PAGO_METODOS = [
  { key: "transferencia", nombre: "Transferencia", ini: "TR" },
  { key: "efectivo", nombre: "Efectivo", ini: "EF" },
  { key: "mercadopago", nombre: "Mercado Pago", ini: "MP" },
  { key: "cheque", nombre: "Cheque", ini: "CH" },
  { key: "tarjeta", nombre: "Tarjeta", ini: "TC" },
];

const metodoIni = (nombre: string) =>
  PAGO_METODOS.find((m) => m.nombre === nombre)?.ini ?? "$";

type MovimientoView = {
  fecha: string;
  metodo: string;
  referencia: string;
  monto: number;
  comprobante: string;
  usuarioNombre: string;
};

function CobroForm({
  saldo,
  onSubmit,
  onCancel,
}: {
  saldo: number;
  onSubmit: (
    mov: Omit<MovimientoView, "comprobante" | "usuarioNombre">,
  ) => void;
  onCancel: () => void;
}) {
  const { moneda } = useConfigRegional();
  const { fechaNumerica } = useFecha();
  const [monto, setMonto] = React.useState(saldo > 0 ? String(saldo) : "");
  const [metodo, setMetodo] = React.useState("Transferencia");
  const [fecha, setFecha] = React.useState(() =>
    fechaNumerica(new Date().toISOString()),
  );
  const [referencia, setReferencia] = React.useState("");
  const valido = Number(monto) > 0;
  return (
    <div className="cobro-form">
      <div className="cf-grid">
        <label className="cf-field cf-monto">
          <span className="cf-lbl">Monto a registrar</span>
          <div className="cf-money">
            <span className="cf-cur">{moneda.simbolo}</span>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
            />
          </div>
          {saldo > 0 ? (
            <button
              className="cf-max"
              type="button"
              onClick={() => setMonto(String(saldo))}
            >
              Saldo completo · {formatMonedaOrden(saldo, moneda)}
            </button>
          ) : null}
        </label>
        <label className="cf-field">
          <span className="cf-lbl">Método</span>
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {PAGO_METODOS.map((m) => (
              <option key={m.key}>{m.nombre}</option>
            ))}
          </select>
        </label>
        <label className="cf-field">
          <span className="cf-lbl">Fecha</span>
          <input
            type="text"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            placeholder="dd/mm/aaaa"
          />
        </label>
        <label className="cf-field cf-ref">
          <span className="cf-lbl">
            Referencia <span className="opt">(opcional)</span>
          </span>
          <input
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Nº operación, banco, caja…"
          />
        </label>
      </div>
      <div className="cf-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className={`btn btn-primary ${valido ? "" : "is-disabled"}`}
          disabled={!valido}
          onClick={() =>
            valido &&
            onSubmit({
              fecha,
              metodo,
              referencia: referencia || "—",
              monto: Number(monto),
            })
          }
        >
          <CheckIcon />
          Registrar cobro
        </button>
      </div>
    </div>
  );
}

export function PagosTab({
  pago,
  total,
  ordenId,
  puedeCobrar = true,
  sinComprobante = false,
}: {
  pago: OrdenTrabajoPago | null;
  total: number;
  /** Con ordenId la pestaña usa cobros persistidos (módulo Administración). */
  ordenId?: string | null;
  /** false en borradores: un borrador no puede recibir plata (se emite primero). */
  puedeCobrar?: boolean;
  /** Orden sin comprobante fiscal: el total es neto (§6). */
  sinComprobante?: boolean;
}) {
  const { moneda } = useConfigRegional();
  const [cobros, setCobros] = React.useState<Cobro[] | null>(null);
  React.useEffect(() => {
    if (!ordenId) return;
    let activo = true;
    getCobros({ ordenId })
      .then((data) => {
        if (activo) setCobros(data);
      })
      .catch(() => {
        if (activo) setCobros([]);
      });
    return () => {
      activo = false;
    };
  }, [ordenId]);

  const [movs, setMovs] = React.useState<MovimientoView[]>(() =>
    (pago?.movimientos ?? []).map((m) => ({
      fecha: formatFechaOrden(m.fecha),
      metodo: m.metodo,
      referencia: m.referencia,
      monto: m.monto,
      comprobante: m.comprobante,
      usuarioNombre: m.usuarioNombre,
    })),
  );
  const [showForm, setShowForm] = React.useState(false);
  const [flash, setFlash] = React.useState<number | null>(null);

  const cobrado = movs.reduce((s, m) => s + m.monto, 0);
  const saldo = Math.max(0, total - cobrado);
  const pct =
    total > 0 ? Math.min(100, Math.round((cobrado / total) * 100)) : 0;
  const saldado = saldo <= 0;

  const registrar = (
    mov: Omit<MovimientoView, "comprobante" | "usuarioNombre">,
  ) => {
    setMovs((prev) => [
      {
        ...mov,
        comprobante: "REC-" + String(38 + prev.length).padStart(4, "0"),
        usuarioNombre: "Lucas G. Gomez",
      },
      ...prev,
    ]);
    setShowForm(false);
    setFlash(mov.monto);
    setTimeout(() => setFlash(null), 2600);
  };

  if (ordenId) {
    const lista = cobros ?? [];
    const cargando = cobros === null;
    const cobradoReal = lista.reduce((s, c) => s + c.montoBruto, 0);
    const comisionesReal = lista.reduce(
      (s, c) => s + c.comisionMonto + c.comisionIvaMonto,
      0,
    );
    const netoReal = lista.reduce((s, c) => s + c.netoAcreditado, 0);
    const retencionesReal = lista.reduce((s, c) => s + c.retencionesTotal, 0);
    const disponibleTotal = lista.reduce((s, c) => s + c.disponibleReal, 0);
    const pendientes = lista.filter(
      (c) => c.estadoAcreditacion === "pendiente",
    ).length;
    const saldoReal = Math.max(0, total - cobradoReal);
    const pctReal =
      total > 0 ? Math.min(100, Math.round((cobradoReal / total) * 100)) : 0;
    const saldadoReal = total > 0 && saldoReal <= 0;

    return (
      <div className="pagos-tab">
        <div className="pagos-kpis">
          <div className="pk">
            <span className="pk-l">Total de la orden</span>
            <span className="pk-v">{formatMonedaOrden(total, moneda)}</span>
            <span className="pk-s">
              {sinComprobante ? "sin comprobante" : "c/ impuestos"}
            </span>
          </div>
          <div className="pk pk-ok">
            <span className="pk-l">Cobrado</span>
            <span className="pk-v">
              {formatMonedaOrden(cobradoReal, moneda)}
            </span>
            <span className="pk-s">
              {pctReal}% · {lista.length} cobro{lista.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className={`pk ${saldadoReal ? "pk-ok" : "pk-warn"}`}>
            <span className="pk-l">Saldo pendiente</span>
            <span className="pk-v">{formatMonedaOrden(saldoReal, moneda)}</span>
            <span className="pk-s">
              {saldadoReal ? "Orden saldada" : "A cobrar"}
            </span>
          </div>
        </div>

        <div className="pagos-bar-card">
          <div className="pbc-head">
            <span className="pbc-ttl">Avance de cobranza</span>
            <span className={`pbc-badge ${saldadoReal ? "ok" : "warn"}`}>
              {saldadoReal ? "Saldada" : `${pctReal}% cobrado`}
            </span>
          </div>
          <div className="pbc-track">
            <div className="pbc-fill" style={{ width: pctReal + "%" }} />
          </div>
          <div className="pbc-legend">
            <span>
              <span className="dot ok" />
              Cobrado {formatMonedaOrden(cobradoReal, moneda)}
            </span>
            <span>
              <span className="dot wait" />
              Pendiente {formatMonedaOrden(saldoReal, moneda)}
            </span>
          </div>
        </div>

        <div className="pagos-grid">
          <div className="arc-page">
            <div className="arc-sum-card">
              <div className="h">Cobranza · las 3 cifras</div>
              <div className="arc-three">
                <div className="arc-tc f">
                  <div className="l">Cobrado (bruto)</div>
                  <div className="v">
                    {formatMonedaOrden(cobradoReal, moneda)}
                  </div>
                  <div className="sub">
                    {lista.length === 0
                      ? "Sin cobros registrados"
                      : `${lista.length} cobro${lista.length === 1 ? "" : "s"} registrado${lista.length === 1 ? "" : "s"}`}
                  </div>
                </div>
                <div className="arc-tc n">
                  <div className="l">Neto acreditado</div>
                  <div className="v">{formatMonedaOrden(netoReal, moneda)}</div>
                  {comisionesReal > 0 ? (
                    <div className="delta">
                      −{formatMonedaOrden(comisionesReal, moneda)} comisiones +
                      IVA
                    </div>
                  ) : (
                    <div className="sub">Sin comisiones de métodos</div>
                  )}
                </div>
                <div className="arc-tc d">
                  <div className="l">Disponible real</div>
                  <div className="v">
                    {formatMonedaOrden(disponibleTotal, moneda)}
                  </div>
                  {retencionesReal > 0 ? (
                    <div className="delta">
                      −{formatMonedaOrden(retencionesReal, moneda)} retenciones
                    </div>
                  ) : (
                    <div className="sub">
                      {pendientes > 0
                        ? `${pendientes} cobro${pendientes === 1 ? "" : "s"} pendiente${pendientes === 1 ? "" : "s"} de acreditar`
                        : "Sin retenciones"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="otd-card pagos-reg">
            <div className="otd-card-head">
              <span className="ttl">Registrar cobro</span>
            </div>
            {saldadoReal ? (
              <div className="pagos-saldado">
                <span className="ps-ico">
                  <CheckIcon size={18} />
                </span>
                <div className="ps-txt">
                  <div className="ps-ttl">Orden totalmente saldada</div>
                  <div className="ps-sub">No hay saldo pendiente de cobro.</div>
                </div>
              </div>
            ) : (
              <div className="pagos-reg-cta">
                <div className="prc-saldo">
                  <span className="l">Saldo a cobrar</span>
                  <span className="v">
                    {formatMonedaOrden(saldoReal, moneda)}
                  </span>
                </div>
                {puedeCobrar ? (
                  <Link
                    className="btn btn-primary"
                    href={`/administracion/cobros/nuevo?ordenId=${ordenId}`}
                  >
                    <PlusIcon />
                    Registrar pago parcial o total
                  </Link>
                ) : (
                  <div className="mov-empty" style={{ padding: "10px 0" }}>
                    La orden es un borrador: emitila para poder registrar
                    cobros.
                  </div>
                )}
                <div className="prc-methods">
                  {PAGO_METODOS.map((m) => (
                    <span key={m.key} className="prc-chip">
                      {m.nombre}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="otd-card">
          <div className="otd-card-head">
            <span className="ttl">
              Cobros <span className="ct">{lista.length}</span>
            </span>
          </div>
          {cargando ? (
            <div className="mov-empty">Cargando cobros…</div>
          ) : lista.length === 0 ? (
            <div className="mov-empty">
              Todavía no se registraron cobros para esta orden.
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
              {lista.map((c) => (
                <div key={c.id} className="mov-row">
                  <span className="mov-fecha">{formatFechaOrden(c.fecha)}</span>
                  <span className="mov-metodo">
                    <span className="mov-badge">
                      {metodoIni(c.metodoNombre)}
                    </span>
                    {c.metodoNombre}
                  </span>
                  <span className="mov-ref">
                    {c.cuentaDestinoNombre ?? "Valor en cartera"}
                    {c.valor ? (
                      <span className="mov-who">
                        · {c.valor.numero} ({c.valor.estado})
                      </span>
                    ) : null}
                  </span>
                  <span className="mov-comp">
                    {c.estadoAcreditacion === "acreditado"
                      ? "Acreditado"
                      : c.fechaAcreditacionEstimada
                        ? `Pendiente · ${formatFechaOrden(c.fechaAcreditacionEstimada)}`
                        : "Pendiente"}
                  </span>
                  <span className="mov-monto">
                    {formatMonedaOrden(c.montoBruto, moneda)}
                  </span>
                </div>
              ))}
              <div className="mov-foot">
                <span>Total cobrado</span>
                <span>{formatMonedaOrden(cobradoReal, moneda)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!pago) {
    return (
      <div className="pagos-empty">
        <div className="pe-ico">
          <CoinsIcon size={22} />
        </div>
        <div className="pe-ttl">Sin plan de pagos configurado</div>
        <div className="pe-sub">
          Definí anticipo, condiciones y vencimientos para empezar a registrar
          cobros de esta orden.
        </div>
        <button type="button" className="btn btn-primary">
          <PlusIcon />
          Configurar plan de pagos
        </button>
      </div>
    );
  }

  return (
    <div className="pagos-tab">
      {flash != null ? (
        <div className="pagos-flash">
          <span className="pf-ico">
            <CheckIcon />
          </span>
          Cobro de <strong>{formatMonedaOrden(flash, moneda)}</strong>{" "}
          registrado correctamente.
        </div>
      ) : null}

      <div className="pagos-kpis">
        <div className="pk">
          <span className="pk-l">Total de la orden</span>
          <span className="pk-v">{formatMonedaOrden(total, moneda)}</span>
          <span className="pk-s">
            {sinComprobante ? "sin comprobante" : "c/ impuestos"}
          </span>
        </div>
        <div className="pk pk-ok">
          <span className="pk-l">Cobrado</span>
          <span className="pk-v">{formatMonedaOrden(cobrado, moneda)}</span>
          <span className="pk-s">
            {pct}% · {movs.length} movimiento{movs.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className={`pk ${saldado ? "pk-ok" : "pk-warn"}`}>
          <span className="pk-l">Saldo pendiente</span>
          <span className="pk-v">{formatMonedaOrden(saldo, moneda)}</span>
          <span className="pk-s">
            {saldado ? "Orden saldada" : "Contra entrega"}
          </span>
        </div>
      </div>

      <div className="pagos-bar-card">
        <div className="pbc-head">
          <span className="pbc-ttl">Avance de cobranza</span>
          <span className={`pbc-badge ${saldado ? "ok" : "warn"}`}>
            {saldado ? "Saldada" : `${pct}% cobrado`}
          </span>
        </div>
        <div className="pbc-track">
          <div className="pbc-fill" style={{ width: pct + "%" }} />
        </div>
        <div className="pbc-legend">
          <span>
            <span className="dot ok" />
            Cobrado {formatMonedaOrden(cobrado, moneda)}
          </span>
          <span>
            <span className="dot wait" />
            Pendiente {formatMonedaOrden(saldo, moneda)}
          </span>
        </div>
      </div>

      <div className="pagos-grid">
        <div className="otd-card">
          <div className="otd-card-head">
            <span className="ttl">Cronograma de vencimientos</span>
            <span className="sub">{pago.plan}</span>
          </div>
          <div className="cron">
            {pago.cuotas.map((c, i) => (
              <div key={i} className={`cron-row ${c.estado}`}>
                <span className="cron-node">
                  <span className="cron-dot" />
                </span>
                <div className="cron-body">
                  <div className="cron-top">
                    <span className="cron-concepto">{c.concepto}</span>
                    <span className="cron-monto">
                      {formatMonedaOrden(c.monto, moneda)}
                    </span>
                  </div>
                  <div className="cron-meta">
                    <span className="cron-vence">
                      Vence {formatFechaOrden(c.vence)}
                    </span>
                    <span className={`cron-badge ${c.estado}`}>
                      {c.estado === "pagado"
                        ? "Pagado"
                        : c.estado === "parcial"
                          ? "Pago parcial"
                          : c.estado === "vencido"
                            ? "Vencido"
                            : "Pendiente"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="cron-cond">
            <TagIcon />
            <span>
              Condición comercial: <strong>{pago.condicion}</strong>
            </span>
          </div>
        </div>

        <div className="otd-card pagos-reg">
          <div className="otd-card-head">
            <span className="ttl">Registrar cobro</span>
          </div>
          {saldado ? (
            <div className="pagos-saldado">
              <span className="ps-ico">
                <CheckIcon size={18} />
              </span>
              <div className="ps-txt">
                <div className="ps-ttl">Orden totalmente saldada</div>
                <div className="ps-sub">No hay saldo pendiente de cobro.</div>
              </div>
            </div>
          ) : showForm ? (
            <CobroForm
              saldo={saldo}
              onSubmit={registrar}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <div className="pagos-reg-cta">
              <div className="prc-saldo">
                <span className="l">Saldo a cobrar</span>
                <span className="v">{formatMonedaOrden(saldo, moneda)}</span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowForm(true)}
              >
                <PlusIcon />
                Registrar pago parcial o total
              </button>
              <div className="prc-methods">
                {PAGO_METODOS.map((m) => (
                  <span key={m.key} className="prc-chip">
                    {m.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="otd-card">
        <div className="otd-card-head">
          <span className="ttl">
            Movimientos <span className="ct">{movs.length}</span>
          </span>
          <button type="button" className="btn sm">
            <DownloadIcon />
            Exportar recibos
          </button>
        </div>
        {movs.length === 0 ? (
          <div className="mov-empty">
            Todavía no se registraron cobros para esta orden.
          </div>
        ) : (
          <div className="mov-table">
            <div className="mov-th">
              <span>Fecha</span>
              <span>Método</span>
              <span>Referencia</span>
              <span>Comprobante</span>
              <span className="r">Monto</span>
            </div>
            {movs.map((m, i) => (
              <div key={i} className="mov-row">
                <span className="mov-fecha">{m.fecha}</span>
                <span className="mov-metodo">
                  <span className="mov-badge">{metodoIni(m.metodo)}</span>
                  {m.metodo}
                </span>
                <span className="mov-ref">
                  {m.referencia}
                  <span className="mov-who">· {m.usuarioNombre}</span>
                </span>
                <span className="mov-comp">{m.comprobante}</span>
                <span className="mov-monto">
                  {formatMonedaOrden(m.monto, moneda)}
                </span>
              </div>
            ))}
            <div className="mov-foot">
              <span>Total cobrado</span>
              <span>{formatMonedaOrden(cobrado, moneda)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Vista principal ─────────── */

export function OrdenTrabajoDetalleView({
  detalle,
}: {
  detalle: OrdenTrabajoDetalle;
}) {
  const { moneda } = useConfigRegional();
  const formatEventoFecha = useFormatEventoFecha();
  const orden = detalle;
  const productos = orden.productos;
  const hasDetail = productos.length > 0;
  const [tab, setTab] = React.useState<"resumen" | "pagos">("resumen");

  const subtotal = hasDetail
    ? productos.reduce((s, p) => s + p.subtotal, 0)
    : Math.round(orden.total / 1.26);
  const impuestos = hasDetail
    ? productos.reduce((s, p) => s + p.impuestos, 0)
    : Math.round(subtotal * 0.21);
  const cargos = orden.cargosDirectos;
  const total = subtotal + impuestos + cargos;

  const curIdx = ORDEN_TRABAJO_FLOW.indexOf(orden.estado);

  const cobrado = orden.pago
    ? orden.pago.movimientos.reduce((s, m) => s + m.monto, 0)
    : 0;
  const saldoCompacto = Math.max(0, total - cobrado);
  const pctCompacto = total > 0 ? Math.round((cobrado / total) * 100) : 0;

  const hoy = new Date();
  const creadaLocal = fechaLocalDesdeIso(orden.creadaEl);
  const esNueva =
    orden.estado !== "borrador" &&
    creadaLocal !== null &&
    creadaLocal.getFullYear() === hoy.getFullYear() &&
    creadaLocal.getMonth() === hoy.getMonth() &&
    creadaLocal.getDate() === hoy.getDate();

  return (
    <div
      className="otd-page"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        width: "auto",
        maxWidth: "none",
        margin: 0,
        padding: "28px 34px 60px",
      }}
    >
      <div className="otl-inner">
        <div className="otd-head">
          <div className="left">
            <Link className="back-link" href="/produccion/ordenes">
              <ArrowLeftIcon />
              Órdenes
            </Link>
            <div className="otd-title-row">
              <h1>{orden.numero}</h1>
              <EstadoOtBadge estado={orden.estado} />
              {esNueva ? (
                <span className="otd-new-tag-lg">RECIÉN EMITIDA</span>
              ) : null}
            </div>
            <div className="otd-cliente">
              {orden.clienteNombre} ·{" "}
              <span className="muted">{orden.resumen}</span>
            </div>
          </div>
          <div className="right otd-actions">
            <button type="button" className="btn">
              <ExternalLinkIcon />
              Compartir seguimiento
            </button>
            <button type="button" className="btn">
              <DownloadIcon />
              PDF
            </button>
            <button type="button" className="btn">
              <CopyIcon />
              Duplicar
            </button>
            <button type="button" className="btn btn-primary">
              <FactoryIcon />
              Ver en taller
            </button>
          </div>
        </div>

        <div className="otd-flow">
          {ORDEN_TRABAJO_FLOW.map((k, i) => {
            const e = ORDEN_TRABAJO_ESTADOS[k];
            const st = i < curIdx ? "past" : i === curIdx ? "cur" : "future";
            return (
              <React.Fragment key={k}>
                <div className={`otd-fstage ${st}`}>
                  <span
                    className="fs-dot"
                    style={st !== "future" ? { background: e.dot } : {}}
                  />
                  <span
                    className="fs-lbl"
                    style={st === "cur" ? { color: e.fg } : {}}
                  >
                    {e.label}
                  </span>
                </div>
                {i < ORDEN_TRABAJO_FLOW.length - 1 ? (
                  <span className={`otd-fline ${i < curIdx ? "on" : ""}`} />
                ) : null}
              </React.Fragment>
            );
          })}
        </div>

        <div className="otd-tabs">
          <button
            type="button"
            className={`otd-tab ${tab === "resumen" ? "on" : ""}`}
            onClick={() => setTab("resumen")}
          >
            <PanelLeftIcon />
            Resumen
          </button>
          <button
            type="button"
            className={`otd-tab ${tab === "pagos" ? "on" : ""}`}
            onClick={() => setTab("pagos")}
          >
            <CoinsIcon />
            Pagos
            {orden.pago && saldoCompacto > 0 ? (
              <span className="otd-tab-dot" />
            ) : null}
          </button>
        </div>

        {tab === "pagos" ? (
          <PagosTab
            pago={orden.pago}
            total={total}
            sinComprobante={orden.tratamientoFiscal === "SIN_COMPROBANTE"}
          />
        ) : (
          <div className="otd-grid">
            <div className="otd-main">
              <div className="otd-card">
                <div className="otd-meta">
                  <div className="otd-mi">
                    <span className="l">Cliente</span>
                    <span className="v">{orden.clienteNombre}</span>
                  </div>
                  <div className="otd-mi">
                    <span className="l">Vendedor</span>
                    <span className="v">{orden.vendedorNombre}</span>
                  </div>
                  <div className="otd-mi">
                    <span className="l">Emitida</span>
                    <span className="v mono">
                      {formatFechaOrden(orden.creadaEl)}
                    </span>
                  </div>
                  <div className="otd-mi">
                    <span className="l">Entrega</span>
                    <span className="v mono">
                      {formatFechaOrden(orden.fechaEntrega)}
                    </span>
                  </div>
                </div>
              </div>

              {orden.estado !== "borrador" ? (
                <div className="otd-card">
                  <div className="otd-card-head">
                    <span className="ttl">Avance de producción</span>
                    <span className="sub mono">{orden.progresoPct ?? 0}%</span>
                  </div>
                  <OtRouteMini
                    estado={orden.estado}
                    progreso={orden.progresoPct ?? 0}
                  />
                </div>
              ) : null}

              <div className="otd-card">
                <div className="otd-card-head">
                  <span className="ttl">
                    Productos{" "}
                    <span className="ct">
                      {hasDetail ? productos.length : orden.itemsCount}
                    </span>
                  </span>
                  <span className="sub">Toca para ver especificaciones</span>
                </div>
                {hasDetail ? (
                  <div className="otd-prods">
                    <div className="otd-prod-th">
                      <span />
                      <span>Producto</span>
                      <span className="r">Cantidad</span>
                      <span className="r">Total</span>
                    </div>
                    {productos.map((p, i) => (
                      <ProductoRow key={`${p.codigo}-${i}`} p={p} />
                    ))}
                  </div>
                ) : (
                  <div className="otd-noprod">
                    {orden.itemsCount} ítem(s) — {orden.resumen}.
                    <div className="hint">
                      El detalle completo de especificaciones se muestra en
                      órdenes emitidas desde el sistema.
                    </div>
                  </div>
                )}
              </div>

              {orden.eventos.length > 0 ? (
                <div className="otd-card">
                  <div className="otd-card-head">
                    <span className="ttl">Historial</span>
                  </div>
                  <div className="otd-timeline">
                    {orden.eventos.map((ev, i) => {
                      const { Icono, tone } =
                        EVENTO_ICONOS[ev.tipo] ?? EVENTO_ICONOS.nota;
                      return (
                        <div key={i} className={`otd-ev ${tone ?? ""}`}>
                          <span className="otd-ev-ico">
                            <Icono />
                          </span>
                          <div className="otd-ev-body">
                            <div className="otd-ev-txt">{ev.descripcion}</div>
                            <div className="otd-ev-meta">
                              <span className="mono">
                                {formatEventoFecha(ev.fecha)}
                              </span>{" "}
                              · {ev.usuarioNombre}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="otd-side">
              <div className="otd-card otd-econ">
                <div className="otd-card-head">
                  <span className="ttl">Resumen económico</span>
                </div>
                <div className="otd-econ-rows">
                  <div className="er">
                    <span className="l">Subtotal</span>
                    <span className="v">
                      {formatMonedaOrden(subtotal, moneda)}
                    </span>
                  </div>
                  <div className="er">
                    <span className="l">
                      Impuestos <span className="s">IVA 21% · IIBB 5%</span>
                    </span>
                    <span className="v">
                      {formatMonedaOrden(impuestos, moneda)}
                    </span>
                  </div>
                  {cargos > 0 ? (
                    <div className="er">
                      <span className="l">Cargos directos</span>
                      <span className="v">
                        {formatMonedaOrden(cargos, moneda)}
                      </span>
                    </div>
                  ) : null}
                  <div className="er total">
                    <span className="l">Total c/ imp.</span>
                    <span className="v">
                      {formatMonedaOrden(total, moneda)}
                    </span>
                  </div>
                </div>
              </div>

              {orden.pago ? (
                <div className="otd-card otd-cobranza">
                  <div className="otd-card-head">
                    <span className="ttl">Estado de cobranza</span>
                    <span
                      className={`cob-badge ${saldoCompacto <= 0 ? "ok" : "warn"}`}
                    >
                      {saldoCompacto <= 0 ? "Saldada" : pctCompacto + "%"}
                    </span>
                  </div>
                  <div className="cob-mini-track">
                    <div
                      className="cob-mini-fill"
                      style={{ width: pctCompacto + "%" }}
                    />
                  </div>
                  <div className="pg-rows">
                    <div className="pg">
                      <span className="l">Cobrado</span>
                      <span className="v mono">
                        {formatMonedaOrden(cobrado, moneda)}
                      </span>
                    </div>
                    <div className="pg">
                      <span className="l">Saldo pendiente</span>
                      <span className="v mono">
                        {formatMonedaOrden(saldoCompacto, moneda)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      marginTop: 4,
                    }}
                    onClick={() => setTab("pagos")}
                  >
                    <CoinsIcon />
                    Ver pagos y registrar cobro
                  </button>
                </div>
              ) : null}

              <div className="otd-card otd-track">
                <div className="ot-track-ico">
                  <ExternalLinkIcon size={15} />
                </div>
                <div className="ot-track-txt">
                  <div className="tt">Link de seguimiento</div>
                  <div className="ts">
                    El cliente ve el avance en tiempo real
                  </div>
                </div>
                <button type="button" className="btn sm">
                  Copiar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
