"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  InfoIcon,
  LinkIcon,
  PlusIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  CONDICIONES_VENTA,
  CONDICION_VENTA_LABELS,
  letraComprobante,
  type Comprobante,
  type ComprobanteTipo,
  type ConfiguracionFiscal,
} from "@/lib/administracion";
import { crearComprobante } from "@/lib/administracion-api";
import {
  CONDICION_FISCAL_LABELS,
  formatCuit,
  type CondicionFiscal,
} from "@/lib/clientes";
import { formatearMoneda, monedaDe } from "@/lib/moneda";
import s from "./comprobante.module.css";

export type ClienteOpcion = {
  id: string;
  nombre: string;
  cuit: string;
  condicionFiscal: CondicionFiscal;
};

export type OrdenOpcion = {
  id: string;
  numero: string;
  clienteId: string | null;
  clienteNombre: string;
  itemsCount: number;
};

type ItemForm = {
  descripcion: string;
  cantidad: string;
  unit: string;
  alicuota: number;
};

const itemVacio = (): ItemForm => ({
  descripcion: "",
  cantidad: "1",
  unit: "",
  alicuota: 21,
});

export function ComprobanteEmisionView({
  config,
  clientes,
  ordenes,
  origen,
}: {
  config: ConfiguracionFiscal;
  clientes: ClienteOpcion[];
  ordenes: OrdenOpcion[];
  origen: Comprobante | null;
}) {
  const router = useRouter();
  const activos = config.puntosVenta.filter((p) => p.activo);

  const [tipo, setTipo] = React.useState<ComprobanteTipo>(
    origen ? "nota_credito" : "factura",
  );
  const [clienteId, setClienteId] = React.useState(
    origen ? "" : (clientes[0]?.id ?? ""),
  );
  const [puntoVentaId, setPuntoVentaId] = React.useState(activos[0]?.id ?? "");
  const [fecha, setFecha] = React.useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [ordenId, setOrdenId] = React.useState("");
  const [items, setItems] = React.useState<ItemForm[]>([itemVacio()]);
  const [moneda, setMoneda] = React.useState<"ARS" | "USD">("ARS");
  const [cotizacion, setCotizacion] = React.useState("");
  // Los montos de esta pantalla son DEL comprobante: siguen a su selector
  // ARS/USD, no a la moneda del tenant.
  const fmt = (n: number) => formatearMoneda(n, monedaDe(moneda), { decimales: 0 });
  const [condicionVenta, setCondicionVenta] = React.useState("contado");
  const [guardando, setGuardando] = React.useState(false);
  const [desdeOrden, setDesdeOrden] = React.useState(false);

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const receptor = cliente?.condicionFiscal ?? "consumidor_final";
  const r = letraComprobante(
    config.condicionFiscal,
    receptor,
    config.leyendaFacturaA,
  );

  // La A exige CUIT del receptor: sin él ARCA rechaza la emisión.
  const faltaCuit = r.letra === "A" && !cliente?.cuit;

  const setItem = (i: number, campo: keyof ItemForm, valor: string | number) =>
    setItems((prev) =>
      prev.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)),
    );

  const base = items.reduce(
    (s, it) => s + (Number(it.cantidad) || 0) * (Number(it.unit) || 0),
    0,
  );
  // Espeja totales-comprobante.ts: en A el IVA se suma, en B ya está
  // incluido en el precio, y C/E no llevan.
  const ivaPorAlicuota = new Map<number, number>();
  for (const it of items) {
    const b = (Number(it.cantidad) || 0) * (Number(it.unit) || 0);
    if (r.letra === "A") {
      ivaPorAlicuota.set(
        it.alicuota,
        (ivaPorAlicuota.get(it.alicuota) ?? 0) + (b * it.alicuota) / 100,
      );
    } else if (r.letra === "B") {
      const neto = it.alicuota > 0 ? b / (1 + it.alicuota / 100) : b;
      ivaPorAlicuota.set(
        it.alicuota,
        (ivaPorAlicuota.get(it.alicuota) ?? 0) + (b - neto),
      );
    }
  }
  const ivaTotal =
    r.letra === "A" || r.letra === "B"
      ? [...ivaPorAlicuota.values()].reduce((a, b) => a + b, 0)
      : 0;
  const neto = r.letra === "B" ? base - ivaTotal : base;
  const total = r.letra === "A" ? base + ivaTotal : base;

  const submit = async () => {
    if (!puntoVentaId) {
      toast.error("Agregá un punto de venta en Datos fiscales.");
      return;
    }
    if (faltaCuit) {
      toast.error(
        "Una Factura A necesita el CUIT del receptor. Cargalo en la ficha del cliente.",
      );
      return;
    }
    if (!desdeOrden && items.every((it) => !it.descripcion.trim())) {
      toast.error("Cargá al menos un ítem.");
      return;
    }
    setGuardando(true);
    try {
      const creado = await crearComprobante({
        tipo,
        puntoVentaId,
        clienteId: clienteId || undefined,
        ordenId: desdeOrden && ordenId ? ordenId : undefined,
        fecha,
        items:
          desdeOrden && ordenId
            ? undefined
            : items
                .filter((it) => it.descripcion.trim())
                .map((it) => ({
                  descripcion: it.descripcion,
                  cantidad: Number(it.cantidad) || 0,
                  precioUnitarioSinIva: Number(it.unit) || 0,
                  alicuotaIva: it.alicuota,
                })),
        moneda,
        cotizacion: moneda === "USD" ? Number(cotizacion) : undefined,
        condicionVenta,
        comprobanteOrigenId: origen?.id,
      });
      toast.success("Borrador creado. Revisalo y emitilo.");
      router.push(`/administracion/comprobantes/${creado.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo crear el comprobante.",
      );
      setGuardando(false);
    }
  };

  return (
    <div
      className={s.page}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "26px 28px 90px",
      }}
    >
      <div className={s.wrap}>
        <Link className={s.crumb} href="/administracion/comprobantes">
          <ArrowLeftIcon />
          Comprobantes
        </Link>
        <div className={s.head}>
          <div>
            <h1>Emitir comprobante</h1>
            <div className="sub">
              La letra se sugiere según la condición fiscal de emisor y
              receptor.
            </div>
          </div>
        </div>

        <div className={s.grid}>
          <div className={s.card}>
            <div className={s.cardSec}>
              <div className={s.secT}>Receptor</div>
              {origen ? (
                <div className={s.autoNote}>
                  <InfoIcon />
                  Corrige a <b style={{ margin: "0 4px" }}>
                    {origen.numeroCompleto}
                  </b>{" "}
                  · {origen.clienteNombre}
                </div>
              ) : null}
              <div className={s.field}>
                <label>Cliente</label>
                <select
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                >
                  <option value="">Consumidor Final</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} · {CONDICION_FISCAL_LABELS[c.condicionFiscal]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={s.letraBox}>
                <div className={s.letraBig}>{r.letra}</div>
                <div className="txt">
                  {r.motivo}
                  <span className="cond">
                    Emisor: {config.razonSocial} ·{" "}
                    {CONDICION_FISCAL_LABELS[config.condicionFiscal]} · CUIT{" "}
                    {formatCuit(config.cuit)}
                  </span>
                </div>
              </div>
              {faltaCuit ? (
                <div className={s.rechBox} style={{ marginTop: 12 }}>
                  <InfoIcon />
                  <div>
                    <div className="t">Falta el CUIT del receptor</div>
                    <div className="m">
                      Una Factura A no se puede emitir sin el CUIT del cliente.
                      Cargalo en su ficha y volvé.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={s.cardSec}>
              <div className={s.frow3}>
                <div className={s.field}>
                  <label>Punto de venta</label>
                  <select
                    value={puntoVentaId}
                    onChange={(e) => setPuntoVentaId(e.target.value)}
                  >
                    {activos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.numeroFormateado} — {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={s.field}>
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>
                <div className={s.field}>
                  <label>Tipo</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as ComprobanteTipo)}
                    disabled={!!origen}
                  >
                    <option value="factura">Factura</option>
                    <option value="nota_credito">Nota de crédito</option>
                    <option value="nota_debito">Nota de débito</option>
                  </select>
                </div>
              </div>
              <div className={s.field} style={{ marginBottom: 0 }}>
                <label>Condición de venta</label>
                <select
                  value={condicionVenta}
                  onChange={(e) => setCondicionVenta(e.target.value)}
                >
                  {CONDICIONES_VENTA.map((c) => (
                    <option key={c} value={c}>
                      {CONDICION_VENTA_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={s.cardSec}>
              <div className={s.secT}>
                Ítems <span className="n">traídos de una orden o libres</span>
              </div>
              <div className={s.fromOt}>
                <LinkIcon />
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>
                  Traer ítems de
                </span>
                <select
                  value={desdeOrden ? ordenId : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOrdenId(v);
                    setDesdeOrden(!!v);
                    const o = ordenes.find((x) => x.id === v);
                    if (o?.clienteId) setClienteId(o.clienteId);
                  }}
                >
                  <option value="">— Sin orden —</option>
                  {ordenes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.numero} · {o.clienteNombre}
                    </option>
                  ))}
                </select>
                <span className="sp">
                  {desdeOrden
                    ? `${ordenes.find((o) => o.id === ordenId)?.itemsCount ?? 0} ítems de la orden`
                    : `${items.filter((i) => i.descripcion.trim()).length} ítems cargados`}
                </span>
              </div>

              {desdeOrden ? (
                <div className={s.autoNote} style={{ marginBottom: 0 }}>
                  <InfoIcon />
                  Los ítems se arman desde la orden al crear el comprobante, con
                  el precio neto de cada producto.
                </div>
              ) : (
                <>
                  <div className={s.itemsT}>
                    <div className={s.itTh}>
                      <span>Descripción</span>
                      <span className="r">Cant.</span>
                      <span className="r">Precio unit.</span>
                      <span className="r">Subtotal</span>
                      <span />
                    </div>
                    {items.map((it, i) => (
                      <div key={i} className={`${s.itR} editable`}>
                        <input
                          className="desc"
                          value={it.descripcion}
                          onChange={(e) =>
                            setItem(i, "descripcion", e.target.value)
                          }
                          placeholder="Descripción del ítem"
                        />
                        <span className="r">
                          <input
                            value={it.cantidad}
                            onChange={(e) =>
                              setItem(i, "cantidad", e.target.value)
                            }
                          />
                        </span>
                        <span className="r">
                          <input
                            value={it.unit}
                            onChange={(e) => setItem(i, "unit", e.target.value)}
                            placeholder="0"
                          />
                        </span>
                        <span
                          className="r mono"
                          style={{ fontWeight: 600, fontSize: 13 }}
                        >
                          {fmt(
                            (Number(it.cantidad) || 0) * (Number(it.unit) || 0),
                          )}
                        </span>
                        <button
                          type="button"
                          className={s.itRm}
                          onClick={() =>
                            setItems((p) => p.filter((_, j) => j !== i))
                          }
                          aria-label="Quitar ítem"
                        >
                          <XIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={s.itAdd}
                    onClick={() => setItems((p) => [...p, itemVacio()])}
                  >
                    <PlusIcon />
                    Agregar ítem
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={s.aside}>
            <div className={s.totCard}>
              <div className="h">
                Totales <span className="lt">{r.letra}</span>
              </div>
              <div className={s.totBody}>
                <div className={s.totRow}>
                  <span className="l">Neto gravado</span>
                  <span className="v">{fmt(neto)}</span>
                </div>
                {r.letra === "A" ? (
                  [...ivaPorAlicuota.entries()]
                    .sort((a, b) => a[0] - b[0])
                    .map(([ali, monto]) => (
                      <div key={ali} className={`${s.totRow} iva`}>
                        <span className="l">IVA {ali}%</span>
                        <span className="v">{fmt(monto)}</span>
                      </div>
                    ))
                ) : r.letra === "B" ? (
                  <div className={`${s.totRow} iva`}>
                    <span className="l">IVA incluido</span>
                    <span className="v">{fmt(ivaTotal)}</span>
                  </div>
                ) : (
                  <div className={`${s.totRow} iva`}>
                    <span className="l">IVA</span>
                    <span className="v">
                      {r.exenta ? "Exento" : "No corresponde"}
                    </span>
                  </div>
                )}
                <div className={`${s.totRow} grand`}>
                  <span className="l">Total</span>
                  <span className="v">{fmt(total)}</span>
                </div>
              </div>
              <div className={s.curLine}>
                Moneda
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")}
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
                {moneda === "USD" ? (
                  <>
                    · TC
                    <input
                      value={cotizacion}
                      onChange={(e) => setCotizacion(e.target.value)}
                      placeholder="1245"
                    />
                  </>
                ) : null}
              </div>
            </div>

            <div className={s.asideActions}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void submit()}
                disabled={guardando || faltaCuit}
              >
                <ShieldCheckIcon />
                {guardando ? "Creando…" : "Crear borrador"}
              </button>
              <Link className="btn" href="/administracion/comprobantes">
                Cancelar
              </Link>
            </div>
            <div className={s.notaEmision}>
              Se crea como borrador: el número correlativo se asigna recién al
              emitirlo.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
