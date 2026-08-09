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
 * "Conectá tu IA" — credenciales MCP del tenant.
 *
 * El token se muestra UNA sola vez (en la base vive hasheado): el bloque
 * amarillo post-creación es la única oportunidad de copiarlo. Revocar es
 * inmediato (≤30 s en otras réplicas) y no tiene deshacer: por eso pasa por
 * ConfirmacionDestructiva, nunca un confirm() nativo.
 */
export function CredencialesMcp({ inicial }: { inicial: CredencialMcp[] }) {
  const { fechaHora } = useFecha();
  const [credenciales, setCredenciales] = React.useState(inicial);
  const [nombre, setNombre] = React.useState("");
  const [creando, setCreando] = React.useState(false);
  const [tokenNuevo, setTokenNuevo] = React.useState<{
    nombre: string;
    token: string;
  } | null>(null);
  const [aRevocar, setARevocar] = React.useState<CredencialMcp | null>(null);

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

  const activas = credenciales.filter((c) => !c.revocadoEl);
  const revocadas = credenciales.filter((c) => c.revocadoEl);

  return (
    <section className={s.wrap}>
      <div className={s.head}>
        <div>
          <h2 className={s.titulo}>Conectá tu IA (MCP)</h2>
          <p className={s.bajada}>
            Creá un token para que tu asistente de IA (Claude, ChatGPT u otro
            compatible con MCP) pueda <strong>cotizar productos de tu catálogo
            conversando</strong>. La IA ve precios de venta; nunca costos ni
            márgenes.
          </p>
        </div>
      </div>

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
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
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
        Conectá el asistente a{" "}
        <code>{`${typeof window !== "undefined" ? window.location.origin : ""}/api/mcp`}</code>{" "}
        con el token como <code>Authorization: Bearer</code>. En Claude Code:{" "}
        <code>claude mcp add grafo --transport http {"<URL>"} --header
        {' "Authorization: Bearer <token>"'}</code>.
      </p>

      <ConfirmacionDestructiva
        open={aRevocar !== null}
        onOpenChange={(open) => !open && setARevocar(null)}
        titulo={`Revocar “${aRevocar?.nombre ?? ""}”`}
        descripcion="La IA que usa este token pierde el acceso de inmediato. No se puede deshacer: si hace falta de nuevo, se crea otro token."
        requiereTipear={false}
        accionLabel="Revocar credencial"
        onConfirmar={revocar}
      />
    </section>
  );
}
