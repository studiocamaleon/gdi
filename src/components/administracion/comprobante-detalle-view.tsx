"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckIcon,
  DownloadIcon,
  PlusIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  COMPROBANTE_TIPO_SIGLA,
  CONDICION_VENTA_LABELS,
  formatCuitODash,
  type ComprobanteDetalle,
  type CondicionVenta,
} from "@/lib/administracion";
import { cargarCae, emitirComprobante } from "@/lib/administracion-api";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda } from "@/lib/moneda";
import s from "./comprobante.module.css";

export function ComprobanteDetalleView({
  comprobante,
}: {
  comprobante: ComprobanteDetalle;
}) {
  const router = useRouter();
  const { moneda } = useConfigRegional();
  const fmt = (n: number) => formatearMoneda(n, moneda, { decimales: 0 });
  const c = comprobante;
  const [trabajando, setTrabajando] = React.useState(false);
  const [caeForm, setCaeForm] = React.useState<{
    cae: string;
    vto: string;
  } | null>(null);

  const rechazado = c.estado === "rechazado";
  const emitido = c.estado === "emitido";
  const cobrado = c.cobrosImputados.reduce((s, i) => s + i.monto, 0);

  const emitir = async () => {
    setTrabajando(true);
    try {
      const r = await emitirComprobante(c.id);
      toast.success(
        r.estado === "emitido"
          ? `Comprobante ${r.numeroCompleto} emitido. Cargale el CAE que te dé ARCA.`
          : "El comprobante quedó en cola.",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo emitir.",
      );
    } finally {
      setTrabajando(false);
    }
  };

  const guardarCae = async () => {
    if (!caeForm?.cae.trim() || !caeForm.vto) {
      toast.error("Cargá el CAE y su vencimiento.");
      return;
    }
    setTrabajando(true);
    try {
      await cargarCae(c.id, { cae: caeForm.cae, caeVencimiento: caeForm.vto });
      toast.success("CAE cargado.");
      setCaeForm(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cargar el CAE.",
      );
    } finally {
      setTrabajando(false);
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
            <h1>Comprobante {c.numeroCompleto}</h1>
            <div className="sub">
              {c.clienteNombre}
              {c.estado === "borrador"
                ? " · borrador sin emitir"
                : ` · ${c.estado === "emitido" ? "emitido" : c.estado} el ${c.fecha}`}
            </div>
          </div>
        </div>

        <div className={s.detailHead}>
          <div className={`${s.tipoBadge} ${COMPROBANTE_TIPO_SIGLA[c.tipo].toLowerCase()}`}>
            {c.letra}
          </div>
          <div>
            <div className="num">{c.numeroCompleto}</div>
            <div className="meta">
              {c.clienteNombre} · CUIT {formatCuitODash(c.clienteCuit)}
              {c.ordenNumero ? (
                <>
                  {" · "}
                  <Link href={`/produccion/ordenes/${c.ordenId}`}>
                    {c.ordenNumero}
                  </Link>
                </>
              ) : null}
            </div>
          </div>
          <span
            className={`${s.estado} ${rechazado ? "rech" : emitido && c.cae ? "cae" : "pend"}`}
          >
            <span className="d" />
            {rechazado
              ? "Rechazado por ARCA"
              : emitido && c.cae
                ? "Con CAE"
                : emitido
                  ? "Emitido · sin CAE"
                  : "Borrador"}
          </span>
        </div>

        <div className={s.grid}>
          <div className={s.card}>
            {rechazado && c.rechazo?.errores?.length ? (
              <div className={s.cardSec}>
                <div className={s.rechBox}>
                  <TriangleAlertIcon />
                  <div>
                    <div className="t">ARCA rechazó el comprobante</div>
                    <div className="m">
                      {c.rechazo.errores.map((e, i) => (
                        <div key={i}>{e}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className={s.cardSec}>
              <div className={s.secT}>Datos del comprobante</div>
              <div className={s.infoGrid}>
                <div className="c">
                  <div className="l">Fecha de emisión</div>
                  <div className="v mono">{c.fecha}</div>
                </div>
                <div className="c">
                  <div className="l">Punto de venta</div>
                  <div className="v mono">{c.puntoVentaNumero}</div>
                </div>
                <div className="c">
                  <div className="l">Neto gravado</div>
                  <div className="v mono">{fmt(c.netoGravado)}</div>
                </div>
                <div className="c">
                  <div className="l">
                    IVA{" "}
                    {c.ivaPorAlicuota.length === 1
                      ? `${c.ivaPorAlicuota[0].alicuota}%`
                      : ""}
                  </div>
                  <div className="v mono">
                    {c.ivaTotal > 0 ? fmt(c.ivaTotal) : "—"}
                  </div>
                </div>
                <div className="c">
                  <div className="l">Total</div>
                  <div className="v mono">{fmt(c.total)}</div>
                </div>
                <div className="c">
                  <div className="l">Condición de venta</div>
                  <div className="v">
                    {CONDICION_VENTA_LABELS[
                      (c.condicionVenta ?? "contado") as CondicionVenta
                    ] ?? c.condicionVenta}
                    {c.vencimiento ? ` · vence ${c.vencimiento}` : ""}
                  </div>
                </div>
              </div>
              {c.leyenda ? (
                <div className={s.leyenda}>{c.leyenda}</div>
              ) : null}
            </div>

            <div className={s.cardSec}>
              <div className={s.secT}>
                Ítems <span className="n">{c.items.length}</span>
              </div>
              <div className={s.itemsT}>
                <div className={s.itTh}>
                  <span>Descripción</span>
                  <span className="r">Cant.</span>
                  <span className="r">Precio unit.</span>
                  <span className="r">Subtotal</span>
                </div>
                {c.items.map((it, i) => {
                  // Línea con bonificación (descuento comercial expresado):
                  // el precio unitario es el de LISTA y el subtotal va
                  // bonificado, así las líneas suman el total del comprobante.
                  const bonif = it.bonificacionPct ?? 0;
                  return (
                    <div key={i} className={s.itR}>
                      <span className="desc">
                        {it.descripcion}
                        {bonif > 0 ? (
                          <small style={{ color: "#b91c1c", marginLeft: 6 }}>
                            bonif −
                            {(Math.round(bonif * 100) / 100).toLocaleString(
                              "es-AR",
                            )}
                            %
                          </small>
                        ) : null}
                      </span>
                      <span className="r mono">{it.cantidad}</span>
                      <span className="r mono">
                        {fmt(it.precioUnitarioSinIva)}
                      </span>
                      <span className="r mono" style={{ fontWeight: 600 }}>
                        {fmt(
                          it.cantidad *
                            it.precioUnitarioSinIva *
                            (1 - bonif / 100),
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {emitido ? (
              <div className={s.cardSec}>
                <div className={s.secT}>
                  Cobros imputados{" "}
                  <span className="n">{c.cobrosImputados.length}</span>
                </div>
                {c.cobrosImputados.length === 0 ? (
                  <div className={s.vacio}>
                    Todavía no se imputó ningún cobro a este comprobante.
                  </div>
                ) : (
                  c.cobrosImputados.map((i) => (
                    <div key={i.id} className={s.cobRow}>
                      <span className={s.cobBadge}>
                        {i.metodoNombre.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="c">
                        <div>{i.metodoNombre}</div>
                        <div className="d">
                          {i.fecha} · {i.cuentaNombre}
                        </div>
                      </div>
                      <span className="m">{fmt(i.monto)}</span>
                    </div>
                  ))
                )}
                <div className={s.saldoBox}>
                  <span className="l">
                    {c.saldoPendiente > 0
                      ? "Saldo pendiente de cobro"
                      : "Comprobante cobrado"}
                  </span>
                  <span className={`v ${c.saldoPendiente > 0 ? "" : "ok"}`}>
                    {fmt(c.saldoPendiente)}
                  </span>
                </div>
                {cobrado > 0 ? (
                  <div className={s.cobradoNota}>
                    Cobrado {fmt(cobrado)} de {fmt(c.total)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className={s.aside}>
            {emitido && c.cae ? (
              <div className={s.caeCard}>
                <div className="h">
                  <ShieldCheckIcon />
                  Autorizado por ARCA
                </div>
                <div className={s.caeBody}>
                  <div className="l">CAE</div>
                  <div className={s.caeNum}>{c.cae}</div>
                  <div className={s.caeVenc}>
                    <span className="l">Vencimiento CAE</span>
                    <span className="v">{c.caeVencimiento ?? "—"}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {emitido && !c.cae ? (
              <div className={s.caePend}>
                <div className="h">CAE pendiente</div>
                <p>
                  El comprobante está emitido con su número, pero todavía no
                  tiene CAE. Sacalo del portal de ARCA y cargalo acá.
                </p>
                {caeForm ? (
                  <>
                    <div className={s.field}>
                      <label>CAE</label>
                      <input
                        value={caeForm.cae}
                        onChange={(e) =>
                          setCaeForm({ ...caeForm, cae: e.target.value })
                        }
                        placeholder="74039288451120"
                      />
                    </div>
                    <div className={s.field}>
                      <label>Vencimiento del CAE</label>
                      <input
                        type="date"
                        value={caeForm.vto}
                        onChange={(e) =>
                          setCaeForm({ ...caeForm, vto: e.target.value })
                        }
                      />
                    </div>
                    <div className={s.asideActions}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => void guardarCae()}
                        disabled={trabajando}
                      >
                        <CheckIcon />
                        Guardar CAE
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setCaeForm(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => setCaeForm({ cae: "", vto: "" })}
                  >
                    <PlusIcon />
                    Cargar CAE
                  </button>
                )}
              </div>
            ) : null}

            <div className={s.asideActions}>
              {c.estado === "borrador" ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void emitir()}
                  disabled={trabajando}
                >
                  <ShieldCheckIcon />
                  {trabajando ? "Emitiendo…" : "Emitir comprobante"}
                </button>
              ) : null}
              {emitido ? (
                <>
                  <Link
                    className="btn"
                    href={`/administracion/comprobantes/${c.id}/factura`}
                  >
                    <DownloadIcon />
                    Ver factura / PDF
                  </Link>
                  <Link
                    className="btn"
                    href={`/administracion/comprobantes/nuevo?origen=${c.id}`}
                  >
                    <PlusIcon />
                    Nota de crédito / débito
                  </Link>
                </>
              ) : null}
            </div>

            {c.estado === "borrador" ? (
              <div className={s.notaEmision}>
                Al emitir se le asigna el número correlativo del punto de
                venta. El CAE se carga después, a mano, desde el portal de
                ARCA.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
