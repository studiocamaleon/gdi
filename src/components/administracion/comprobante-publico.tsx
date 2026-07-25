import {
  comprobanteLogoUrl,
  comprobantePdfUrl,
  type ComprobantePublico,
} from "@/lib/comprobantes-publicos";
import { fechaCorta, money } from "@/lib/recibos";

/**
 * El comprobante fiscal que ve el cliente por el link de WhatsApp (`/f/<token>`).
 *
 * Muestra la cabecera legal, el detalle y los totales, y baja el PDF —que es el
 * documento oficial, con el QR de ARCA— con un botón. No replica el PDF entero
 * a propósito: el papel fiscal lo fija la normativa y ya está dibujado una vez;
 * duplicarlo en HTML es garantizar que en algún momento digan cosas distintas.
 *
 * Reusa la hoja `rc-*` del recibo: es el mismo objeto —un documento que el
 * cliente abre desde el teléfono— y no hay razón para dos hojas que se ven
 * igual. Lo propio del comprobante fiscal va prefijado `cp-`.
 *
 * Server component: no hay estado ni interacción, sólo el link al PDF.
 */
export function ComprobantePublicoView({
  token,
  datos,
  tieneLogo,
}: {
  token: string;
  datos: ComprobantePublico;
  tieneLogo: boolean;
}) {
  const { emisor, receptor } = datos;
  const iniciales = inicialesDe(emisor.razonSocial);

  return (
    <div className="rc-page">
      <div className="rc-sheet">
        <div className="rc-hd">
          <div className="rc-tenant">
            {tieneLogo ? (
              // Va por el proxy BFF, que reenvía el 302 a la URL firmada. El
              // endpoint es @Public: acá el cliente no tiene sesión.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="rc-logo rc-logo-img"
                src={comprobanteLogoUrl(token)}
                alt={emisor.razonSocial}
              />
            ) : (
              <span className="rc-logo">{iniciales}</span>
            )}
            <div>
              <div className="rc-tn">{emisor.razonSocial}</div>
              <div className="rc-ts">
                CUIT {emisor.cuit} · {emisor.condicionFiscal}
              </div>
            </div>
          </div>
          <div className="rc-doc">
            <div className="rc-lbl">{datos.tipoLabel}</div>
            <div className="rc-num">
              {datos.puntoVenta}-{datos.numero}
            </div>
            {datos.cae ? (
              <div className="rc-valid">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Autorizada por ARCA
              </div>
            ) : null}
          </div>
        </div>

        <div className="rc-meta">
          <div className="rc-m">
            <div className="rc-mk">Cliente</div>
            <div className="rc-mv">{receptor.razonSocial}</div>
          </div>
          <div className="rc-m">
            <div className="rc-mk">Fecha de emisión</div>
            <div className="rc-mv rc-mono">{fechaCorta(datos.fecha)}</div>
          </div>
          <div className="rc-m">
            <div className="rc-mk">CUIT / DNI</div>
            <div className="rc-mv rc-mono">{receptor.cuit ?? "—"}</div>
          </div>
          <div className="rc-m">
            <div className="rc-mk">Condición de venta</div>
            <div className="rc-mv">{datos.condicionVenta}</div>
          </div>
        </div>

        <div className="rc-body">
          <div className="rc-hero">
            <div>
              <div className="rc-hl">Importe total</div>
              <div className="rc-amt">{money(datos.total)}</div>
              <div className="rc-words">
                {datos.moneda}
                {datos.ordenNumero ? ` · Orden ${datos.ordenNumero}` : ""}
              </div>
            </div>
            {/* El recuadro de la letra con su código es el que exige la
                norma para identificar el tipo de comprobante. */}
            <div className="cp-letra">
              <span className="cp-letra-l">{datos.letra}</span>
              <span className="cp-letra-c">{datos.codigoArca}</span>
            </div>
          </div>

          <div className="cp-detalle">
            <h3 className="rc-sec-t">Detalle</h3>
            <div className="cp-items">
              {datos.items.map((item, i) => (
                <div className="cp-item" key={`${item.codigo ?? ""}-${i}`}>
                  <div className="cp-item-d">
                    <div className="cp-item-n">{item.descripcion}</div>
                    <div className="cp-item-q">
                      {item.cantidad} × {money(item.precioUnitario)}
                      {item.alicuota !== null ? ` · IVA ${item.alicuota}%` : ""}
                    </div>
                  </div>
                  <div className="cp-item-v">{money(item.subtotal)}</div>
                </div>
              ))}
            </div>

            <div className="cp-tot">
              {datos.discriminaIva ? (
                <>
                  <div className="cp-tr">
                    <span className="cp-l">Subtotal</span>
                    <span className="cp-v">{money(datos.subtotal)}</span>
                  </div>
                  {datos.ivaPorAlicuota.map((iva) => (
                    <div className="cp-tr" key={iva.alicuota}>
                      <span className="cp-l">IVA {iva.alicuota}%</span>
                      <span className="cp-v">{money(iva.monto)}</span>
                    </div>
                  ))}
                </>
              ) : null}
              {datos.otrosTributos.map((t) => (
                <div className="cp-tr" key={t.descripcion}>
                  <span className="cp-l">{t.descripcion}</span>
                  <span className="cp-v">{money(t.monto)}</span>
                </div>
              ))}
              <div className="cp-tr cp-total">
                <span className="cp-l">Total</span>
                <span className="cp-v">{money(datos.total)}</span>
              </div>
              {/* RG 5614: sin discriminar, el IVA contenido igual se informa. */}
              {datos.ivaContenido !== null ? (
                <div className="cp-tr cp-nota">
                  <span className="cp-l">
                    IVA contenido en el precio (Ley 27.743)
                  </span>
                  <span className="cp-v">{money(datos.ivaContenido)}</span>
                </div>
              ) : null}
            </div>
          </div>

          <a className="rc-dl" href={comprobantePdfUrl(token)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M12 3v12" />
              <path d="M7 12l5 5 5-5" />
              <path d="M4 20h16" />
            </svg>
            Descargar el comprobante en PDF
          </a>
        </div>

        <div className="rc-foot">
          {datos.cae ? (
            <div className="cp-cae">
              <div>
                <div className="rc-mk">CAE N°</div>
                <div className="rc-mv rc-mono">{datos.cae}</div>
              </div>
              <div>
                <div className="rc-mk">Vencimiento del CAE</div>
                <div className="rc-mv rc-mono">
                  {datos.caeVencimiento
                    ? fechaCorta(datos.caeVencimiento)
                    : "—"}
                </div>
              </div>
            </div>
          ) : null}

          {datos.leyendas.length > 0 ? (
            <div className="rc-cond">
              <span className="rc-ci">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8h.01M11 12h1v4h1" />
                </svg>
              </span>
              <div className="rc-ct">
                {datos.leyendas.map((l, i) => (
                  <p className="cp-ley" key={i}>
                    {l.codigo ? <b>[{l.codigo}] </b> : null}
                    {l.texto}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rc-sign">
            <span>Gracias por confiar en {emisor.razonSocial}.</span>
            <span className="rc-g">
              <span className="rc-gm">G</span>Generado con Grafoprint
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Estado vacío: token inválido, revocado o comprobante inexistente. */
export function ComprobanteNoEncontrado() {
  return (
    <div className="rc-page">
      <div className="rc-notfound">
        <div className="rc-mark">?</div>
        <h1>No encontramos ese comprobante</h1>
        <p>
          El link puede ser incorrecto o el comprobante ya no está disponible.
          Revisá el enlace que te compartieron.
        </p>
      </div>
    </div>
  );
}

/** Las del recibo salen del backend; acá sólo hay razón social. */
function inicialesDe(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
