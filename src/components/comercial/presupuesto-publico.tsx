"use client";

/**
 * Página pública del presupuesto (cliente final, mobile-first, co-branded
 * con el nombre del negocio — espíritu del tracking público de OT).
 * Aprobar/Rechazar sólo cuando está vigente; la decisión queda registrada.
 */

import * as React from "react";
import {
  decidirPresupuestoPublico,
  type PresupuestoPublico,
} from "@/lib/presupuestos-api";

const fmtMoneda = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const fmtFecha = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

const INK = "#14141a";
const MUTED = "#6e6e76";
const HAIRLINE = "#efece8";

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
      <Shell titulo="Presupuesto">
        <p style={{ color: MUTED, fontSize: 14 }}>
          No encontramos este presupuesto. Verificá el link o pedile uno nuevo a tu proveedor.
        </p>
      </Shell>
    );
  }

  const vigente = d.estado === "enviado";
  const decidido = d.estado === "aprobado" || d.estado === "rechazado" || d.estado === "convertido";

  return (
    <Shell titulo={d.negocio}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", color: MUTED }}>Presupuesto</div>
        <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: INK }}>{d.numero}</div>
      </div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>
        {d.cliente ? <>Para <strong style={{ color: INK }}>{d.cliente}</strong> · </> : null}
        {fmtFecha(d.fechaEmision)} · válido hasta <strong style={{ color: INK }}>{fmtFecha(d.fechaValidez)}</strong>
      </div>

      {d.estado === "vencido" ? (
        <Aviso color="#92929b" bg="rgba(20,20,26,.05)">
          Este presupuesto venció. Pedile a {d.negocio} una actualización — los precios pueden haber cambiado.
        </Aviso>
      ) : null}
      {d.estado === "aprobado" || d.estado === "convertido" ? (
        <Aviso color="#16794a" bg="rgba(22,121,74,.08)">
          ¡Gracias! El presupuesto quedó aprobado. {d.negocio} se va a contactar para coordinar el trabajo.
        </Aviso>
      ) : null}
      {d.estado === "rechazado" ? (
        <Aviso color="#c2410c" bg="rgba(194,65,12,.08)">
          Registramos que no vas a avanzar con este presupuesto. ¡Gracias por avisar!
        </Aviso>
      ) : null}

      <div style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
        {d.items.map((i, idx) => (
          <div key={idx} style={{ padding: "12px 14px", borderTop: idx > 0 ? `1px solid ${HAIRLINE}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: INK }}>{i.nombre}</div>
              <div className="mono" style={{ fontWeight: 600, fontSize: 14, color: INK, whiteSpace: "nowrap" }}>{fmtMoneda(i.total)}</div>
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>
              {i.cantidad.toLocaleString("es-AR")} {i.cantidadUnidad}
              {i.adicionales.length ? ` · con ${i.adicionales.join(", ")}` : ""}
            </div>
            {i.specs.length ? (
              <div style={{ fontSize: 11.5, color: "#92929b", marginTop: 2 }}>
                {i.specs.map((s) => `${s.etiqueta}: ${s.valor}`).join(" · ")}
              </div>
            ) : null}
          </div>
        ))}
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${HAIRLINE}`, background: "#fafaf9" }}>
          <FilaTotal label="Subtotal" valor={fmtMoneda(d.subtotal)} />
          {d.cargosDirectos > 0 ? <FilaTotal label="Cargos" valor={fmtMoneda(d.cargosDirectos)} /> : null}
          <FilaTotal label="Impuestos" valor={fmtMoneda(d.impuestos)} />
          <FilaTotal label="Total" valor={fmtMoneda(d.total)} grande />
        </div>
      </div>

      {d.senaSugeridaPct != null && d.senaSugeridaPct > 0 && !decidido ? (
        <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 14 }}>
          Condiciones: seña del {d.senaSugeridaPct.toLocaleString("es-AR")}% para iniciar el trabajo, saldo contra entrega.
        </div>
      ) : null}
      {d.observaciones ? (
        <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 14 }}>{d.observaciones}</div>
      ) : null}

      {vigente ? (
        <>
          {rechazando ? (
            <div style={{ marginBottom: 12 }}>
              <textarea
                placeholder="Contanos por qué (opcional): ¿precio, plazo, otra cosa?"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d4d2cd", fontSize: 13.5, resize: "vertical" }}
              />
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 10 }}>
            {rechazando ? (
              <>
                <Boton onClick={() => void decidir("rechazado")} disabled={decidiendo} tono="peligro">
                  {decidiendo ? "Enviando…" : "Confirmar rechazo"}
                </Boton>
                <Boton onClick={() => setRechazando(false)} disabled={decidiendo} tono="neutro">Volver</Boton>
              </>
            ) : (
              <>
                <Boton onClick={() => void decidir("aprobado")} disabled={decidiendo} tono="ok">
                  {decidiendo ? "Enviando…" : "Aprobar presupuesto"}
                </Boton>
                <Boton onClick={() => setRechazando(true)} disabled={decidiendo} tono="neutro">No avanzar</Boton>
              </>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: "#92929b", marginTop: 10 }}>
            Tu decisión queda registrada con fecha y hora para {d.negocio}.
          </div>
        </>
      ) : null}

      {error ? <div style={{ marginTop: 10, fontSize: 13, color: "#c2410c" }}>{error}</div> : null}
    </Shell>
  );
}

function Shell({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f6f5f3", padding: "28px 16px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: INK, marginBottom: 14 }}>{titulo}</div>
        <div style={{ background: "#fff", border: `1px solid ${HAIRLINE}`, borderRadius: 16, padding: "20px 20px 24px", boxShadow: "0 10px 30px rgba(20,20,26,.06)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Aviso({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return <div style={{ padding: "10px 14px", borderRadius: 10, background: bg, color, fontSize: 13.5, fontWeight: 500, marginBottom: 14 }}>{children}</div>;
}

function FilaTotal({ label, valor, grande }: { label: string; valor: string; grande?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: grande ? 15.5 : 12.5, fontWeight: grande ? 700 : 400, color: grande ? INK : MUTED, marginTop: grande ? 6 : 2 }}>
      <span>{label}</span>
      <span className="mono" style={{ color: INK }}>{valor}</span>
    </div>
  );
}

function Boton({ onClick, disabled, tono, children }: { onClick: () => void; disabled?: boolean; tono: "ok" | "neutro" | "peligro"; children: React.ReactNode }) {
  const estilos: Record<string, React.CSSProperties> = {
    ok: { background: "#16794a", color: "#fff", border: "1px solid #16794a" },
    peligro: { background: "#c2410c", color: "#fff", border: "1px solid #c2410c" },
    neutro: { background: "#fff", color: INK, border: "1px solid #d4d2cd" },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ flex: 1, padding: "12px 16px", borderRadius: 10, fontSize: 14.5, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, ...estilos[tono] }}>
      {children}
    </button>
  );
}
