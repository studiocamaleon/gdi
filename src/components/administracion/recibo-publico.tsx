import {
  fechaCorta,
  money,
  reciboLogoUrl,
  reciboPdfUrl,
  type ReciboPublico,
} from "@/lib/recibos";
import { monedaDe } from "@/lib/moneda";

/**
 * El recibo de pago que ve el cliente por el link de WhatsApp (`/c/<token>`).
 *
 * Es el mismo documento que el PDF, no un resumen: el cliente tiene que poder
 * leerlo en el teléfono sin bajar nada. El diseño ya trae sus reglas
 * responsive, así que la hoja A4 se convierte en una columna en mobile.
 *
 * Server component a propósito: no hay estado ni interacción — sólo un link
 * al PDF. Ver docs/recibos-pago-diseno.md
 */
export function ReciboPublicoView({
  token,
  datos,
  tieneLogo,
}: {
  token: string;
  datos: ReciboPublico;
  tieneLogo: boolean;
}) {
  const { orden } = datos;
  const moneda = monedaDe(datos.monedaCodigo);

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
                src={reciboLogoUrl(token)}
                alt={datos.negocio}
              />
            ) : (
              <span className="rc-logo">{datos.iniciales}</span>
            )}
            <div>
              <div className="rc-tn">{datos.negocio}</div>
              <div className="rc-ts">Comprobante de pago</div>
            </div>
          </div>
          <div className="rc-doc">
            <div className="rc-lbl">Recibo de pago</div>
            <div className="rc-num">{datos.numero}</div>
            <div className="rc-valid">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Pago registrado
            </div>
          </div>
        </div>

        <div className="rc-meta">
          <div className="rc-m">
            <div className="rc-mk">Recibido de</div>
            <div className="rc-mv">{datos.clienteNombre ?? "—"}</div>
          </div>
          <div className="rc-m">
            <div className="rc-mk">Fecha de pago</div>
            <div className="rc-mv rc-mono">{fechaCorta(datos.fecha)}</div>
          </div>
          <div className="rc-m">
            <div className="rc-mk">Registrado por</div>
            <div className="rc-mv">{datos.registradoPor ?? "—"}</div>
          </div>
          <div className="rc-m">
            <div className="rc-mk">N° de operación</div>
            <div className="rc-mv rc-mono">{datos.referencia ?? "—"}</div>
          </div>
        </div>

        <div className="rc-body">
          <div className="rc-hero">
            <div>
              <div className="rc-hl">Recibimos la suma de</div>
              <div className="rc-amt">{money(datos.monto, moneda)}</div>
              <div className="rc-words">{datos.montoEnLetras}</div>
            </div>
            <div className="rc-method">
              <div className="rc-mk">Medio de pago</div>
              <div className="rc-mv">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <rect x="2" y="5" width="20" height="14" rx="2.5" />
                  <path d="M2 10h20" />
                </svg>
                {datos.metodoNombre}
              </div>
              {datos.cuentaTexto ? (
                <div className="rc-ref">{datos.cuentaTexto}</div>
              ) : null}
            </div>
          </div>

          {orden ? (
            <div className="rc-apply">
              <h3 className="rc-sec-t">Aplicado a</h3>
              <div className="rc-applied">
                <div className="rc-ai">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
                    <path d="M14 4v6h6" />
                  </svg>
                </div>
                <div className="rc-at">
                  <div className="rc-an">
                    Orden {orden.numero}
                    {orden.detalle ? ` · ${orden.detalle}` : ""}
                  </div>
                  {orden.subtitulo ? (
                    <div className="rc-ad">{orden.subtitulo}</div>
                  ) : null}
                </div>
                <div className="rc-ar">
                  Total del trabajo
                  <br />
                  {money(orden.total, moneda)}
                </div>
              </div>

              <div className="rc-bal">
                <div className="rc-br">
                  <span className="rc-l">Total del trabajo</span>
                  <span className="rc-v">{money(orden.total, moneda)}</span>
                </div>
                <div className="rc-br">
                  <span className="rc-l">Pagos anteriores</span>
                  <span className="rc-v">{money(orden.pagosAnteriores, moneda)}</span>
                </div>
                <div className="rc-br rc-pay">
                  <span className="rc-l">Este pago</span>
                  <span className="rc-v">{money(datos.monto, moneda)}</span>
                </div>
                <div className="rc-br rc-due">
                  <span className="rc-l">Saldo pendiente</span>
                  <span className="rc-v">{money(orden.saldoPendiente, moneda)}</span>
                </div>
                <div className="rc-prog">
                  <div className="rc-track">
                    <div
                      className="rc-fill"
                      style={{ width: `${Math.round(orden.pctAbonado)}%` }}
                    />
                  </div>
                  <div className="rc-plabels">
                    <span>
                      <b>{Math.round(orden.pctAbonado)}%</b> abonado
                    </span>
                    <span>
                      {orden.saldoPendiente > 0
                        ? "Saldo contra entrega"
                        : "Trabajo saldado"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rc-apply">
              <h3 className="rc-sec-t">Aplicado a</h3>
              <div className="rc-acuenta">
                <div className="rc-an">Pago a cuenta</div>
                <div className="rc-ad">
                  No se aplicó a una orden puntual: queda a favor en tu cuenta.
                </div>
              </div>
            </div>
          )}

          <a className="rc-dl" href={reciboPdfUrl(token)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M12 3v12" />
              <path d="M7 12l5 5 5-5" />
              <path d="M4 20h16" />
            </svg>
            Descargar el recibo en PDF
          </a>
        </div>

        <div className="rc-foot">
          <div className="rc-cond">
            <span className="rc-ci">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8h.01M11 12h1v4h1" />
              </svg>
            </span>
            <div className="rc-ct">
              <b>Este documento no es un comprobante fiscal.</b> Es un recibo
              interno que certifica el pago registrado entre el cliente y{" "}
              {datos.negocio}. La factura correspondiente se emite por separado.
            </div>
          </div>
          <div className="rc-sign">
            <span>Gracias por confiar en {datos.negocio}.</span>
            <span className="rc-g">
              <span className="rc-gm">G</span>Generado con Grafoprint
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Estado vacío: token inválido, revocado o cobro anulado. */
export function ReciboNoEncontrado() {
  return (
    <div className="rc-page">
      <div className="rc-notfound">
        <div className="rc-mark">?</div>
        <h1>No encontramos ese recibo</h1>
        <p>
          El link puede ser incorrecto o el pago ya no está disponible. Revisá
          el enlace que te compartieron.
        </p>
      </div>
    </div>
  );
}
