"use client";

/**
 * Página pública del presupuesto — portada del rediseño DesignSync
 * "Presupuesto (rediseño).html" (vista 2 · Online): brand co-branded,
 * card con chips de specs, totales con total destacado, condiciones y
 * decisión en un tap. Clases pp-* en globals.css.
 */

import * as React from "react";
import {
  decidirPresupuestoPublico,
  type PresupuestoPublico,
} from "@/lib/presupuestos-api";
import { formatearMonedaDoc, monedaDe, type Moneda } from "@/lib/moneda";

// Documento que cruza fronteras: símbolo desambiguado y sin decimales (como antes).
const fmtMoneda = (n: number, moneda: Moneda) =>
  formatearMonedaDoc(n, moneda, { decimales: 0 });
const fmtFecha = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const inicialesDe = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

function diasHastaVencer(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const hoy = new Date();
  const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - hoyMid.getTime()) / 86_400_000);
}

const IconoReloj = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const IconoEscudo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /></svg>
);
const IconoCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 6L9 17l-5-5" /></svg>
);
const IconoCandado = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);

export function PresupuestoPublicoView({
  token,
  initial,
}: {
  token: string;
  initial: PresupuestoPublico | null;
}) {
  const [d, setD] = React.useState(initial);
  const [decidiendo, setDecidiendo] = React.useState(false);
  const [comentario, setComentario] = React.useState("");
  const [rechazando, setRechazando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const decidir = async (decision: "aprobado" | "rechazado") => {
    setDecidiendo(true);
    setError(null);
    try {
      await decidirPresupuestoPublico(token, {
        decision,
        comentario: comentario.trim() || undefined,
      });
      setD((prev) => (prev ? { ...prev, estado: decision } : prev));
      setRechazando(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar tu decisión.");
    } finally {
      setDecidiendo(false);
    }
  };

  if (!d) {
    return (
      <div className="pp-online-bg">
        <div className="pp-olcard">
          <div className="pp-ol-sheet" style={{ padding: 24, fontSize: 14, color: "var(--muted-text)" }}>
            No encontramos este presupuesto. Verificá el link o pedile uno nuevo a tu proveedor.
          </div>
        </div>
      </div>
    );
  }

  const vigente = d.estado === "enviado";
  const dias = diasHastaVencer(d.fechaValidez);
  const moneda = monedaDe(d.monedaCodigo);

  return (
    <div className="pp-online-bg">
      <div className="pp-olcard">
        <div className="pp-ol-brand">
          <div className="pp-tlogo">{inicialesDe(d.negocio)}</div>
          <div>
            <div className="tn">{d.negocio}</div>
            <div className="tsub">Presupuesto para vos</div>
          </div>
          <div className="powered"><span className="pp-gmark">G</span>con tecnología Grafo</div>
        </div>

        <div className="pp-ol-sheet">
          <div className="pp-ol-head">
            <div className="lbl">Presupuesto</div>
            <div className="row">
              <span className="num">{d.numero}</span>
              {vigente && dias != null ? (
                <span className="pp-ol-valid"><IconoReloj />{dias <= 0 ? "Vence hoy" : `Vence en ${dias} día${dias === 1 ? "" : "s"}`}</span>
              ) : null}
            </div>
            <div className="for">
              {d.cliente ? <>Para <b>{d.cliente}</b> · </> : null}emitido {fmtFecha(d.fechaEmision)}
            </div>
          </div>

          {d.estado === "vencido" ? (
            <div className="pp-ol-aviso" style={{ background: "rgba(20,20,26,.05)", color: "var(--muted-text)" }}>
              Este presupuesto venció. Pedile a {d.negocio} una actualización — los precios pueden haber cambiado.
            </div>
          ) : null}
          {d.estado === "aprobado" || d.estado === "convertido" ? (
            <div className="pp-ol-aviso" style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>
              ¡Gracias! El presupuesto quedó aprobado. {d.negocio} se va a contactar para coordinar el trabajo.
            </div>
          ) : null}
          {d.estado === "rechazado" ? (
            <div className="pp-ol-aviso" style={{ background: "#fef2f2", color: "#b91c1c" }}>
              Registramos que no vas a avanzar con este presupuesto. ¡Gracias por avisar!
            </div>
          ) : null}

          {d.items.map((i, idx) => (
            <div key={idx} className="pp-ol-item">
              <div className="it-top">
                <div>
                  <div className="it-nm">{i.nombre}</div>
                  <div className="it-qty">{i.cantidad.toLocaleString("es-AR")} {i.cantidadUnidad}</div>
                </div>
                <div className="it-price">{fmtMoneda(i.total, moneda)}</div>
              </div>
              {i.specs.length ? (
                <div className="pp-chips" style={{ marginTop: 13 }}>
                  {i.specs.map((s) => (
                    <span key={s.etiqueta} className="pp-chip"><span className="k">{s.etiqueta}</span>{s.valor}</span>
                  ))}
                </div>
              ) : null}
              {i.adicionales.length ? (
                <div className="pp-opt">
                  <div className="pp-opt-lbl">Opcionales incluidos</div>
                  <div className="pp-chips">
                    {i.adicionales.map((a) => (
                      <span key={a} className="pp-chip opt">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          <div className="pp-ol-tot">
            <div className="tr"><span>Subtotal</span><span className="v">{fmtMoneda(d.subtotal, moneda)}</span></div>
            {d.cargosDirectos > 0 ? <div className="tr"><span>Cargos</span><span className="v">{fmtMoneda(d.cargosDirectos, moneda)}</span></div> : null}
            <div className="tr"><span>Impuestos</span><span className="v">{fmtMoneda(d.impuestos, moneda)}</span></div>
            <div className="tr grand"><span className="l">Total</span><span className="v">{fmtMoneda(d.total, moneda)}</span></div>
          </div>

          {d.senaSugeridaPct != null && d.senaSugeridaPct > 0 ? (
            <div className="pp-ol-cond">
              <IconoEscudo />
              <span>Seña del {d.senaSugeridaPct.toLocaleString("es-AR")}% para iniciar el trabajo, saldo contra entrega.</span>
            </div>
          ) : null}
          {d.observaciones ? (
            <div className="pp-ol-cond"><span style={{ width: 14 }} /><span>{d.observaciones}</span></div>
          ) : null}

          {vigente ? (
            <>
              {rechazando ? (
                <div style={{ padding: "6px 22px 0" }}>
                  <textarea
                    className="pp-ol-textarea"
                    placeholder="Contanos por qué (opcional): ¿precio, plazo, otra cosa?"
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={3}
                  />
                </div>
              ) : null}
              <div className="pp-ol-actions">
                {rechazando ? (
                  <>
                    <button type="button" className="pp-ol-btn" style={{ background: "#b91c1c", color: "#fff", borderColor: "#b91c1c" }} onClick={() => void decidir("rechazado")} disabled={decidiendo}>
                      {decidiendo ? "Enviando…" : "Confirmar rechazo"}
                    </button>
                    <button type="button" className="pp-ol-btn" onClick={() => setRechazando(false)} disabled={decidiendo}>Volver</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="pp-ol-btn approve" onClick={() => void decidir("aprobado")} disabled={decidiendo}>
                      <IconoCheck />
                      {decidiendo ? "Enviando…" : "Aprobar presupuesto"}
                    </button>
                    <button type="button" className="pp-ol-btn" onClick={() => setRechazando(true)} disabled={decidiendo}>No avanzar</button>
                  </>
                )}
              </div>
              <div className="pp-ol-foot"><IconoCandado />Tu decisión queda registrada con fecha y hora.</div>
            </>
          ) : (
            <div style={{ height: 18 }} />
          )}

          {error ? <div style={{ padding: "0 22px 16px", fontSize: 13, color: "#b91c1c" }}>{error}</div> : null}
        </div>
      </div>
    </div>
  );
}
