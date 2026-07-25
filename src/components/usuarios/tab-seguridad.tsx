"use client";

import * as React from "react";
import { toast } from "sonner";

import { cambiarIps, getMiIp, type UsuarioDelTenant } from "@/lib/usuarios-api";

/**
 * Seguridad: desde dónde puede entrar cada uno.
 *
 * La restricción se configura contra la IP PÚBLICA de la empresa —la que se ve
 * buscando "cuál es mi IP"—. Nada de esta pantalla habla de proxies ni de redes
 * internas: eso es un asunto del servidor y vive en su log de arranque.
 *
 * Ver docs/usuarios-roles-permisos-diseno.md
 */
export function TabSeguridad({
  usuarios,
  onCambio,
}: {
  usuarios: UsuarioDelTenant[];
  onCambio: () => Promise<void>;
}) {
  const [miIp, setMiIp] = React.useState<{
    ip: string;
    esPublica: boolean;
  } | null>(null);
  const [editando, setEditando] = React.useState<string | null>(null);
  const [borrador, setBorrador] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    void getMiIp()
      .then(setMiIp)
      .catch(() => setMiIp(null));
  }, []);

  const guardarIps = async (u: UsuarioDelTenant) => {
    setGuardando(true);
    try {
      const ips = borrador
        .split(/[\n,]/)
        .map((x) => x.trim())
        .filter(Boolean);
      await cambiarIps(u.id, ips);
      toast.success(
        ips.length === 0
          ? `${u.nombreCompleto || u.email} puede entrar desde cualquier lado.`
          : `${u.nombreCompleto || u.email} entra sólo desde ${ips.join(", ")}.`,
      );
      setEditando(null);
      await onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className="int-section-intro">
        <h3>Desde dónde puede entrar cada uno</h3>
        <p>
          Por defecto cada uno entra desde donde esté. Si querés, podés atar una
          cuenta a la IP pública de la empresa: desde cualquier otra conexión no
          entra, ni con la clave correcta.
          {miIp?.esPublica ? (
            <>
              {" "}
              Vos estás entrando desde <strong>{miIp.ip}</strong>.
            </>
          ) : null}
        </p>
      </div>

      <div className="int-tpl-list">
        {usuarios.map((u) => (
          <div className="usr-fila" key={u.id}>
            <div className="usr-quien">
              <div className="usr-nombre">{u.nombreCompleto || u.email}</div>
              <div className="usr-mail">
                {u.ipsPermitidas.length === 0
                  ? "Desde cualquier lugar"
                  : `Sólo desde ${u.ipsPermitidas.join(", ")}`}
              </div>
            </div>
            <div className="usr-estado">
              {u.ipsPermitidas.length > 0 ? (
                <span className="int-pill int-pill-ok">IP FIJA</span>
              ) : null}
            </div>
            <div />
            <div className="usr-acciones">
              <button
                className="btn ghost"
                onClick={() => {
                  setEditando(u.id);
                  setBorrador(u.ipsPermitidas.join(", "));
                }}
              >
                Cambiar
              </button>
            </div>
          </div>
        ))}
      </div>

      {editando &&
        (() => {
          const u = usuarios.find((x) => x.id === editando);
          if (!u) return null;
          return (
            <div className="usr-form" style={{ marginTop: 16 }}>
              <div className="int-section-intro">
                <h3>Desde dónde entra {u.nombreCompleto || u.email}</h3>
                <p>
                  Escribí la IP pública desde la que va a poder entrar. Si son
                  varias, una por línea. Dejalo vacío para que entre desde
                  cualquier lado.
                </p>
              </div>
              <textarea
                className="usr-ips"
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                rows={3}
                placeholder="193.186.4.250"
                autoFocus
              />
              <p className="usr-ayuda">
                ¿No sabés cuál es? Desde esa computadora, buscá{" "}
                <strong>cuál es mi IP</strong> en Google y copiá el número que
                aparece. Si la empresa tiene varias líneas, también se puede
                escribir el rango entero: <code>193.186.4.0/24</code>.
              </p>
              <div className="usr-form-acciones">
                {/* Sólo si es la pública de verdad: ofrecer una IP de red
                    interna sería ofrecer un dato que no sirve para esto. */}
                {miIp?.esPublica && (
                  <button
                    className="btn ghost"
                    onClick={() =>
                      setBorrador((b) =>
                        b.trim() ? `${b}, ${miIp.ip}` : miIp.ip,
                      )
                    }
                    title="Agrega la IP desde la que estás entrando ahora."
                  >
                    Usar esta ({miIp.ip})
                  </button>
                )}
                <button
                  className="btn ghost"
                  onClick={() => setEditando(null)}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button
                  className="btn primary"
                  onClick={() => void guardarIps(u)}
                  disabled={guardando}
                >
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          );
        })()}
    </>
  );
}
