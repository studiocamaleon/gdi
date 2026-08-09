"use client";

import * as React from "react";
import { toast } from "sonner";

import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { useFecha } from "@/components/navigation/config-regional-provider";
import {
  crearCredencialMcp,
  getCredencialesMcp,
  revocarCredencialMcp,
  type CredencialMcp,
} from "@/lib/credenciales-mcp-api";
import s from "./credenciales-mcp.module.css";

/**
 * "Tu IA (MCP)" — misma anatomía que el resto de integraciones: una int-card
 * en su sección (clases compartidas del sistema, no nuevas) que abre el panel
 * de gestión de credenciales.
 *
 * El token se muestra UNA sola vez (en la base vive hasheado). Revocar es
 * inmediato y sin deshacer: ConfirmacionDestructiva, nunca confirm() nativo.
 *
 * `mcpUrl` llega del SERVER component (env API_URL): calcularla acá con
 * window.location fue el bug de hidratación (SSR renderiza "" y el cliente
 * el origin) y además apuntaba al front (3000) en vez del API (3001).
 */
export function CredencialesMcp({
  inicial,
  mcpUrl,
}: {
  inicial: CredencialMcp[];
  mcpUrl: string;
}) {
  const { fechaHora } = useFecha();
  const [credenciales, setCredenciales] = React.useState(inicial);
  const [abierto, setAbierto] = React.useState(false);
  const [nombre, setNombre] = React.useState("");
  const [creando, setCreando] = React.useState(false);
  const [tokenNuevo, setTokenNuevo] = React.useState<{
    nombre: string;
    token: string;
  } | null>(null);
  const [aRevocar, setARevocar] = React.useState<CredencialMcp | null>(null);

  const activas = credenciales.filter((c) => !c.revocadoEl);
  const revocadas = credenciales.filter((c) => c.revocadoEl);

  const recargar = React.useCallback(async () => {
    try {
      setCredenciales(await getCredencialesMcp());
    } catch {
      /* la lista vieja sigue siendo útil */
    }
  }, []);

  const crear = async () => {
    const limpio = nombre.trim();
    if (limpio.length < 3) {
      toast.error("Poné un nombre de al menos 3 letras (ej: “Claude de Lucas”).");
      return;
    }
    setCreando(true);
    try {
      const creada = await crearCredencialMcp(limpio);
      setTokenNuevo({ nombre: creada.nombre, token: creada.token });
      setNombre("");
      await recargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la credencial.");
    } finally {
      setCreando(false);
    }
  };

  const copiarToken = async () => {
    if (!tokenNuevo) return;
    await navigator.clipboard.writeText(tokenNuevo.token);
    toast.success("Token copiado. Guardalo: no se vuelve a mostrar.");
  };

  const revocar = async () => {
    if (!aRevocar) return;
    try {
      await revocarCredencialMcp(aRevocar.id);
      toast.success(`Credencial “${aRevocar.nombre}” revocada.`);
      setARevocar(null);
      await recargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo revocar.");
    }
  };

  return (
    <div className="int-section">
      <div className="int-section-head">
        <h3>Tu IA</h3>
        <span className="rule" />
        <span className="ct">1</span>
      </div>
      <div className="int-grid">
        <div
          className={`int-card ${activas.length ? "status-connected" : "status-available"}`}
          role="button"
          tabIndex={0}
          onClick={() => setAbierto((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setAbierto((v) => !v);
            }
          }}
        >
          <div className="int-card-head">
            <div
              className="int-logo"
              style={{ width: 40, height: 40, background: "#14141a" }}
            >
              <IconoIA />
            </div>
            <div className="int-card-titles">
              <div className="nm">Conectá tu IA (MCP)</div>
              <div className="cat">Cotización conversando</div>
            </div>
            {activas.length > 0 && (
              <span className="int-status ok">
                <span className="dot" />
                {activas.length === 1 ? "1 activa" : `${activas.length} activas`}
              </span>
            )}
          </div>
          <div className="int-card-desc">
            Tu asistente (Claude, ChatGPT u otro compatible con MCP) cotiza
            productos de tu catálogo conversando. Ve precios de venta; nunca
            costos ni márgenes.
          </div>
          <div className="int-card-foot">
            <span className="installs">
              {activas.length
                ? "Conectada"
                : "Creá un token para conectar"}
            </span>
            <span className="cta">
              {abierto ? "Cerrar" : activas.length ? "Administrar" : "Conectar"}
              <Flecha />
            </span>
          </div>
        </div>
      </div>

      {abierto ? (
        <div className={s.panel}>
          <div className={s.formCrear}>
            <input
              className={`field ${s.inputNombre}`}
              placeholder="Nombre de la credencial (ej: Claude de Lucas)"
              value={nombre}
              maxLength={80}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !creando && crear()}
            />
            <button className="btn btn-primary" onClick={crear} disabled={creando}>
              {creando ? "Creando…" : "Crear token"}
            </button>
          </div>

          {tokenNuevo ? (
            <div className={s.tokenBox}>
              <strong>Token de “{tokenNuevo.nombre}” — copialo ahora:</strong>
              <code className={s.tokenValor}>{tokenNuevo.token}</code>
              <div className={s.tokenAcciones}>
                <button className="btn btn-sm" onClick={copiarToken}>
                  Copiar token
                </button>
                <button className="btn btn-sm" onClick={() => setTokenNuevo(null)}>
                  Ya lo guardé
                </button>
              </div>
              <p className={s.tokenAviso}>
                Por seguridad no se vuelve a mostrar: si se pierde, revocá esta
                credencial y creá otra.
              </p>
            </div>
          ) : null}

          {activas.length === 0 && revocadas.length === 0 ? (
            <p className={s.vacio}>Todavía no hay credenciales.</p>
          ) : (
            <div className={s.lista}>
              {[...activas, ...revocadas].map((c) => (
                <div
                  key={c.id}
                  className={`${s.fila} ${c.revocadoEl ? s.filaRevocada : ""}`}
                >
                  <div className={s.filaInfo}>
                    <span className={s.filaNombre}>
                      {c.nombre} <span className={s.pista}>(…{c.pista})</span>
                    </span>
                    <span className={s.filaMeta}>
                      {c.revocadoEl
                        ? `Revocada el ${fechaHora(c.revocadoEl)}`
                        : c.ultimoUsoEl
                          ? `Último uso: ${fechaHora(c.ultimoUsoEl)}`
                          : "Sin uso todavía"}
                      {" · "}de {c.usuario}
                    </span>
                  </div>
                  {!c.revocadoEl ? (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => setARevocar(c)}
                    >
                      Revocar
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <p className={s.instrucciones}>
            Conectá el asistente a <code>{mcpUrl}</code> con el token como{" "}
            <code>Authorization: Bearer</code>. En Claude Code:{" "}
            <code>
              claude mcp add grafo --transport http {mcpUrl} --header
              {' "Authorization: Bearer <token>"'}
            </code>
            .
          </p>
        </div>
      ) : null}

      <ConfirmacionDestructiva
        open={aRevocar !== null}
        onOpenChange={(open) => !open && setARevocar(null)}
        titulo={`Revocar “${aRevocar?.nombre ?? ""}”`}
        descripcion="La IA que usa este token pierde el acceso de inmediato. No se puede deshacer: si hace falta de nuevo, se crea otro token."
        requiereTipear={false}
        accionLabel="Revocar credencial"
        onConfirmar={revocar}
      />
    </div>
  );
}

/** Chip/spark de IA, blanco sobre el logo oscuro (mismo trato que Ico.*). */
function IconoIA() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="10" width="16" height="13" rx="3" />
      <path d="M16 10V6M12 6h8" />
      <circle cx="12.5" cy="16" r="0.5" fill="#fff" />
      <circle cx="19.5" cy="16" r="0.5" fill="#fff" />
      <path d="M12.5 20h7M5 15v3M27 15v3" />
    </svg>
  );
}

function Flecha() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
