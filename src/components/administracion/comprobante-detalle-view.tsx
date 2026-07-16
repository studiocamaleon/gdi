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

const fmt = (n: number) =>
  (n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("es-AR");

export function ComprobanteDetalleView({
  comprobante,
}: {
  comprobante: ComprobanteDetalle;
}) {
  const router = useRouter();
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
      className="acd-page"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "26px 28px 90px",
      }}
    >
      <div className="acd-wrap">
        <Link className="acd-crumb" href="/administracion/comprobantes">
          <ArrowLeftIcon />
          Comprobantes
        </Link>
        <div className="acd-head">
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

        <div className="acd-detail-head">
          <div className={`acd-tipo-badge ${COMPROBANTE_TIPO_SIGLA[c.tipo].toLowerCase()}`}>
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
            className={`acd-estado ${rechazado ? "rech" : emitido && c.cae ? "cae" : "pend"}`}
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

        <div className="acd-grid">
          <div className="acd-card">
            {rechazado && c.rechazo?.errores?.length ? (
              <div className="acd-card-sec">
                <div className="acd-rech-box">
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

            <div className="acd-card-sec">
              <div className="acd-sec-t">Datos del comprobante</div>
              <div className="acd-info-grid">
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
                <div className="acd-leyenda">{c.leyenda}</div>
              ) : null}
            </div>

            <div className="acd-card-sec">
              <div className="acd-sec-t">
                Ítems <span className="n">{c.items.length}</span>
              </div>
              <div className="acd-items-t">
                <div className="acd-it-th">
                  <span>Descripción</span>
                  <span className="r">Cant.</span>
                  <span className="r">Precio unit.</span>
                  <span className="r">Subtotal</span>
                </div>
                {c.items.map((it, i) => (
                  <div key={i} className="acd-it-r">
                    <span className="desc">{it.descripcion}</span>
                    <span className="r mono">{it.cantidad}</span>
                    <span className="r mono">{fmt(it.precioUnitarioSinIva)}</span>
                    <span className="r mono" style={{ fontWeight: 600 }}>
                      {fmt(it.cantidad * it.precioUnitarioSinIva)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {emitido ? (
              <div className="acd-card-sec">
                <div className="acd-sec-t">
                  Cobros imputados{" "}
                  <span className="n">{c.cobrosImputados.length}</span>
                </div>
                {c.cobrosImputados.length === 0 ? (
                  <div className="acd-vacio">
                    Todavía no se imputó ningún cobro a este comprobante.
                  </div>
                ) : (
                  c.cobrosImputados.map((i) => (
                    <div key={i.id} className="acd-cob-row">
                      <span className="acd-cob-badge">
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
                <div className="acd-saldo-box">
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
                  <div className="acd-cobrado-nota">
                    Cobrado {fmt(cobrado)} de {fmt(c.total)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="acd-aside">
            {emitido && c.cae ? (
              <div className="acd-cae-card">
                <div className="h">
                  <ShieldCheckIcon />
                  Autorizado por ARCA
                </div>
                <div className="acd-cae-body">
                  <div className="l">CAE</div>
                  <div className="acd-cae-num">{c.cae}</div>
                  <div className="acd-cae-venc">
                    <span className="l">Vencimiento CAE</span>
                    <span className="v">{c.caeVencimiento ?? "—"}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {emitido && !c.cae ? (
              <div className="acd-cae-pend">
                <div className="h">CAE pendiente</div>
                <p>
                  El comprobante está emitido con su número, pero todavía no
                  tiene CAE. Sacalo del portal de ARCA y cargalo acá.
                </p>
                {caeForm ? (
                  <>
                    <div className="acd-field">
                      <label>CAE</label>
                      <input
                        value={caeForm.cae}
                        onChange={(e) =>
                          setCaeForm({ ...caeForm, cae: e.target.value })
                        }
                        placeholder="74039288451120"
                      />
                    </div>
                    <div className="acd-field">
                      <label>Vencimiento del CAE</label>
                      <input
                        type="date"
                        value={caeForm.vto}
                        onChange={(e) =>
                          setCaeForm({ ...caeForm, vto: e.target.value })
                        }
                      />
                    </div>
                    <div className="acd-aside-actions">
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

            <div className="acd-aside-actions">
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
                  <button type="button" className="btn" disabled>
                    <DownloadIcon />
                    Descargar PDF
                  </button>
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
              <div className="acd-nota-emision">
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
