"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  DownloadIcon,
  PrinterIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import QRCode from "qrcode";

import type { FacturaDocumento } from "@/lib/administracion";
import { formatearMoneda, monedaDe } from "@/lib/moneda";

const fecha = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** El QR de la RG 4892: se dibuja del payload real, no es decorativo. */
function Qr({ url }: { url: string }) {
  const [svg, setSvg] = React.useState<string | null>(null);
  React.useEffect(() => {
    let vivo = true;
    QRCode.toString(url, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#14141a", light: "#0000" },
    })
      .then((s) => vivo && setSvg(s))
      .catch(() => vivo && setSvg(null));
    return () => {
      vivo = false;
    };
  }, [url]);

  if (!svg) return <div className="fx-qr-vacio" />;
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function FacturaView({
  doc,
  id,
}: {
  doc: FacturaDocumento;
  id: string;
}) {
  const d = doc;
  // Los importes van en la moneda DEL comprobante (una E puede ser USD) y
  // con 2 decimales siempre: lo fija la normativa, no la preferencia visual.
  const fmt = (n: number) =>
    formatearMoneda(n, monedaDe(d.moneda), { decimales: 2 });
  const ivaOrdenado = [...d.ivaPorAlicuota].sort(
    (a, b) => b.alicuota - a.alicuota,
  );

  return (
    <div
      className="fx-page"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "26px 28px 90px",
      }}
    >
      <div className="fx-wrap">
        <div className="fx-toolbar">
          <Link
            className="fx-crumb"
            href={`/administracion/comprobantes/${id}`}
          >
            <ArrowLeftIcon />
            Volver al comprobante
          </Link>
          {/* El PDF lo genera el server: es el mismo archivo que después
              va a salir por mail, no una impresión del navegador. */}
          <a
            className="btn btn-primary"
            href={`/api/backend/administracion/comprobantes/${id}/pdf`}
            target="_blank"
            rel="noopener"
            style={{ marginLeft: "auto" }}
          >
            <DownloadIcon />
            Descargar PDF
          </a>
          <button type="button" className="btn" onClick={() => window.print()}>
            <PrinterIcon />
            Imprimir
          </button>
        </div>

        {!d.cae ? (
          <div className="fx-aviso">
            <TriangleAlertIcon />
            <span>
              Este comprobante todavía no tiene CAE, así que{" "}
              <b>no lleva código QR y no es válido como factura</b>. Emitilo o
              cargale el CAE para que el documento quede completo.
            </span>
          </div>
        ) : null}

        <div className="fx-paper">
          <div className="fx-paper-pad">
            {/* Banda superior: emisor · letra · comprobante */}
            <div className="fx-top">
              <div className="fx-emisor">
                <div className="fx-logo">
                  <span className="mark">
                    {d.emisor.razonSocial.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="nm">{d.emisor.razonSocial}</span>
                </div>
                <div className="razon">{d.emisor.razonSocial}</div>
                <div className="fx-dl">
                  {d.emisor.domicilioFiscal ? (
                    <div className="r">
                      <span className="k">Domicilio comercial</span>
                      <span className="v">{d.emisor.domicilioFiscal}</span>
                    </div>
                  ) : null}
                  <div className="r">
                    <span className="k">Condición frente al IVA</span>
                    <span className="v">{d.emisor.condicionFiscal}</span>
                  </div>
                  <div className="r">
                    <span className="k">CUIT</span>
                    <span className="v mono">{d.emisor.cuit}</span>
                  </div>
                  {d.emisor.ingresosBrutos ? (
                    <div className="r">
                      <span className="k">Ingresos Brutos</span>
                      <span className="v mono">{d.emisor.ingresosBrutos}</span>
                    </div>
                  ) : null}
                  {d.emisor.inicioActividades ? (
                    <div className="r">
                      <span className="k">Inicio de actividades</span>
                      <span className="v mono">
                        {fecha(d.emisor.inicioActividades)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="fx-letra">
                <div className="big">{d.letra}</div>
                <div className="cod">COD. {d.codigoArca}</div>
              </div>

              <div className="fx-comp">
                <div className="tt">{d.tipoLabel}</div>
                <div className="no">
                  {d.puntoVenta} - {d.numero}
                </div>
                <div className="fx-fecha">
                  <div className="r">
                    <span className="k">Fecha de emisión</span>
                    <span className="v">{fecha(d.fecha)}</span>
                  </div>
                  {d.vencimientoPago ? (
                    <div className="r">
                      <span className="k">Venc. para el pago</span>
                      <span className="v">{fecha(d.vencimientoPago)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Receptor */}
            <div className="fx-sec">
              <div className="fx-sec-t">Receptor</div>
              <div className="fx-recep">
                <div className="r">
                  <span className="k">Razón social</span>
                  <span className="v">{d.receptor.razonSocial}</span>
                </div>
                <div className="r">
                  <span className="k">CUIT</span>
                  <span className="v mono">{d.receptor.cuit ?? "—"}</span>
                </div>
                <div className="r">
                  <span className="k">Domicilio</span>
                  <span className="v">{d.receptor.domicilio ?? "—"}</span>
                </div>
                <div className="r hl">
                  <span className="k">Condición frente al IVA</span>
                  <span className="v">{d.receptor.condicionFiscal}</span>
                </div>
              </div>
            </div>

            {/* Condición de venta */}
            <div className="fx-cond">
              <div className="r">
                <span className="k">Condición de venta</span>
                <span className="v">{d.condicionVenta}</span>
              </div>
              <div className="r">
                <span className="k">Moneda</span>
                <span className="v">{d.moneda}</span>
              </div>
            </div>

            {/* Ítems */}
            <table className="fx-items">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th className="c">Cant.</th>
                  <th className="r">Precio unit.</th>
                  {d.discriminaIva ? <th className="c">Alíc. IVA</th> : null}
                  <th className="r">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {d.items.map((it, i) => (
                  <tr key={i}>
                    <td className="desc">{it.descripcion}</td>
                    <td className="c mono">{it.cantidad}</td>
                    <td className="r mono">{fmt(it.precioUnitario)}</td>
                    {d.discriminaIva ? (
                      <td className="c mono">
                        {it.alicuota !== null ? `${it.alicuota}%` : "—"}
                      </td>
                    ) : null}
                    <td className="r mono">{fmt(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Abajo: tributos/transparencia a la izquierda, totales a la derecha */}
            <div className="fx-bottom">
              <div>
                {d.discriminaIva ? (
                  d.otrosTributos.length > 0 ? (
                    <div className="fx-tot-list" style={{ maxWidth: 280 }}>
                      <div className="fx-sec-t" style={{ marginBottom: 4 }}>
                        Otros tributos
                      </div>
                      {d.otrosTributos.map((t, i) => (
                        <div
                          key={i}
                          className="fx-tot-r"
                          style={{ fontSize: 12 }}
                        >
                          <span className="k">{t.descripcion}</span>
                          <span className="v">{fmt(t.monto)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null
                ) : (
                  /* RG 5614 (Ley 27.743): sin discriminar IVA, hay que informar
                     igual el que está contenido, con su importe. */
                  <div className="fx-transparencia">
                    <div className="tt">
                      Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)
                    </div>
                    <div className="r">
                      <span className="k">IVA Contenido</span>
                      <span className="v">{fmt(d.ivaContenido ?? 0)}</span>
                    </div>
                    <div className="r">
                      <span className="k">
                        Otros Impuestos Nacionales Indirectos
                      </span>
                      <span className="v">
                        {fmt(d.otrosImpuestosIndirectos ?? 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="fx-tot-list">
                <div className="fx-tot-r sub">
                  <span className="k">Subtotal</span>
                  <span className="v">{fmt(d.subtotal)}</span>
                </div>
                {d.discriminaIva
                  ? ivaOrdenado.map((l) => (
                      <div key={l.alicuota} className="fx-tot-r iva">
                        <span className="k">IVA {l.alicuota}%</span>
                        <span className="v">{fmt(l.monto)}</span>
                      </div>
                    ))
                  : null}
                {d.discriminaIva && d.otrosTributosTotal > 0 ? (
                  <div className="fx-tot-r">
                    <span className="k">Importe otros tributos</span>
                    <span className="v">{fmt(d.otrosTributosTotal)}</span>
                  </div>
                ) : null}
                <div className="fx-tot-r grand">
                  <span className="k">Total</span>
                  <span className="v">{fmt(d.total)}</span>
                </div>
              </div>
            </div>

            {/* Autorización: QR + CAE + leyendas */}
            <div className="fx-auth-sec">
              <div className="fx-auth">
                <div className="fx-qr-box">
                  {d.qrUrl ? (
                    <Qr url={d.qrUrl} />
                  ) : (
                    <div className="fx-qr-vacio" />
                  )}
                </div>
                <div className="fx-cae-block">
                  <div className="arca">
                    <ShieldCheckIcon />
                    {d.cae
                      ? "Comprobante autorizado — ARCA"
                      : "Sin autorización de ARCA"}
                  </div>
                  <div className="fx-cae-row">
                    <div className="c">
                      <div className="l">CAE N°</div>
                      <div className="v">{d.cae ?? "—"}</div>
                    </div>
                    <div className="c">
                      <div className="l">Vencimiento del CAE</div>
                      <div className="v">{fecha(d.caeVencimiento)}</div>
                    </div>
                  </div>

                  {d.leyendas.length > 0 ? (
                    <div className="fx-leyendas">
                      <div className="lt">
                        <TriangleAlertIcon />
                        Leyendas
                      </div>
                      {d.leyendas.map((l, i) => (
                        <div key={i} className="fx-ley-item">
                          {l.codigo ? (
                            <span className="cd">{l.codigo}</span>
                          ) : null}
                          <span>{l.texto}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
