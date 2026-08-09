"use client";

import * as React from "react";
import { toast } from "sonner";

import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { useFecha } from "@/components/navigation/config-regional-provider";
import {
  crearCredencialMcp,
  revocarCredencialMcp,
  type CredencialMcp,
} from "@/lib/credenciales-mcp-api";
import s from "./credenciales-mcp.module.css";

/**
 * "Conectá tu IA (MCP)" — misma anatomía que el resto de integraciones:
 * una int-card en la grilla (McpCard) que abre una VISTA DE DETALLE aparte
 * (McpDetalle), igual que Wati/AFIP. El estado de apertura y la lista viven
 * en IntegracionesView, que es quien alterna grilla ↔ detalle.
 *
 * El token se muestra UNA sola vez (en la base vive hasheado). Revocar es
 * inmediato y sin deshacer: ConfirmacionDestructiva, nunca confirm() nativo.
 *
 * `mcpUrl` llega del SERVER component (env API_URL): calcularla acá con
 * window.location fue el bug de hidratación y encima apuntaba al front.
 */

export function McpCard({
  activas,
  onAbrir,
}: {
  activas: number;
  onAbrir: () => void;
}) {
  return (
    <div
      className={`int-card ${activas ? "status-connected" : "status-available"}`}
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
    >
      <div className="int-card-head">
        <div
          className="int-logo"
          style={{ width: 40, height: 40, background: "#14141a" }}
        >
          <IconoIA size={22} />
        </div>
        <div className="int-card-titles">
          <div className="nm">Conectá tu IA (MCP)</div>
          <div className="cat">Cotización conversando</div>
        </div>
        {activas > 0 && (
          <span className="int-status ok">
            <span className="dot" />
            {activas === 1 ? "1 activa" : `${activas} activas`}
          </span>
        )}
      </div>
      <div className="int-card-desc">
        Tu asistente (Claude, ChatGPT u otro compatible con MCP) cotiza
        productos de tu catálogo conversando. Ve precios de venta; nunca costos
        ni márgenes.
      </div>
      <div className="int-card-foot">
        <span className="installs">
          {activas ? "Conectada" : "Creá un token para conectar"}
        </span>
        <span className="cta">
          {activas ? "Administrar" : "Conectar"}
          <Flecha />
        </span>
      </div>
    </div>
  );
}

export function McpDetalle({
  credenciales,
  mcpUrl,
  onVolver,
  onCambio,
}: {
  credenciales: CredencialMcp[];
  mcpUrl: string;
  onVolver: () => void;
  onCambio: () => Promise<void>;
}) {
  const { fechaHora } = useFecha();
  const [nombre, setNombre] = React.useState("");
  const [creando, setCreando] = React.useState(false);
  const [tokenNuevo, setTokenNuevo] = React.useState<{
    nombre: string;
    token: string;
  } | null>(null);
  const [aRevocar, setARevocar] = React.useState<CredencialMcp | null>(null);

  const activas = credenciales.filter((c) => !c.revocadoEl);
  const revocadas = credenciales.filter((c) => c.revocadoEl);

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
      await onCambio();
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
      await onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo revocar.");
    }
  };

  return (
    <div className="int-detail">
      <div className="int-detail-top">
        <button className="btn ghost" onClick={onVolver}>
          <FlechaVolver /> Integraciones
        </button>
      </div>

      <div className="int-hero">
        <div
          className="int-logo"
          style={{ width: 64, height: 64, background: "#14141a" }}
        >
          <IconoIA size={34} />
        </div>
        <div className="int-hero-body">
          <div className="eyebrow">
            <span>Inteligencia artificial</span>
            <span className="sep">·</span>
            <span>Protocolo MCP</span>
          </div>
          <h1>
            Conectá tu IA{" "}
            <span style={{ color: "var(--muted-text)", fontWeight: 500 }}>
              · cotización conversando
            </span>
          </h1>
          <div className="sub">
            Creá un token para que tu asistente (Claude, ChatGPT u otro
            compatible con MCP) cotice productos de tu catálogo charlando con
            vos. La IA ve precios de venta; nunca costos ni márgenes.
          </div>
        </div>
      </div>

      <div className="int-section">
        <div className="int-section-head">
          <h3>Credenciales</h3>
          <span className="rule" />
          <span className="ct">{activas.length}</span>
        </div>

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
        </div>
      </div>

      <div className="int-section">
        <div className="int-section-head">
          <h3>Cómo conectar</h3>
          <span className="rule" />
        </div>
        <div className={s.panel}>
          <p className={s.instrucciones} style={{ marginTop: 0 }}>
            Conectá el asistente a <code>{mcpUrl}</code> con el token como{" "}
            <code>Authorization: Bearer</code>.
          </p>
          <p className={s.instrucciones}>
            En Claude Code:{" "}
            <code>
              claude mcp add grafo --transport http {mcpUrl} --header
              {' "Authorization: Bearer <token>"'}
            </code>
          </p>
          <p className={s.instrucciones}>
            En Claude Desktop (Configuración → Desarrollador → Editar
            configuración):{" "}
            <code>
              {`{"mcpServers": {"grafo": {"command": "npx", "args": ["-y", "mcp-remote", "${mcpUrl}", "--header", "Authorization: Bearer <token>"]}}}`}
            </code>
          </p>
          <p className={s.instrucciones}>
            Los conectores de claude.ai se conectan desde la nube: necesitan
            una URL pública con HTTPS e inicio de sesión OAuth. Está en la hoja
            de ruta; por ahora usá Claude Code o Claude Desktop.
          </p>
        </div>
      </div>

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
function IconoIA({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

function FlechaVolver() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}
