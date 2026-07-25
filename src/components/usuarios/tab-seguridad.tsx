"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  cambiarIps,
  cerrarSesiones,
  getMiIp,
  getSesiones,
  type SesionAbierta,
  type UsuarioDelTenant,
} from "@/lib/usuarios-api";

/**
 * Seguridad: por ahora, quién está conectado.
 *
 * Las sesiones existen desde siempre y no las veía nadie — para saber si al
 * empleado que se fue le quedó algo abierto había que entrar a la base. Es lo
 * primero que corresponde mostrar acá, y el lugar donde después van las
 * políticas (vigencia, segundo factor, de dónde se puede entrar).
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
  const [sesiones, setSesiones] = React.useState<SesionAbierta[] | null>(null);
  const [miIp, setMiIp] = React.useState<{
    ip: string;
    esPublica: boolean;
  } | null>(null);
  const [editando, setEditando] = React.useState<string | null>(null);
  const [borrador, setBorrador] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cerrando, setCerrando] = React.useState<string | null>(null);

  const cargar = React.useCallback(async () => {
    setError(null);
    try {
      setSesiones(await getSesiones());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar.");
    }
  }, []);

  React.useEffect(() => {
    void cargar();
    void getMiIp()
      .then(setMiIp)
      .catch(() => setMiIp(null));
  }, [cargar]);

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

  const cerrar = async (s: SesionAbierta) => {
    setCerrando(s.usuarioId);
    try {
      const { cerradas } = await cerrarSesiones(s.usuarioId);
      toast.success(
        cerradas === 1
          ? `${s.usuarioNombre} quedó desconectado.`
          : `Se cerraron ${cerradas} sesiones de ${s.usuarioNombre}.`,
      );
      await cargar();
      await onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cerrar.");
    } finally {
      setCerrando(null);
    }
  };

  if (error) {
    return (
      <div className="int-section">
        <p style={{ color: "var(--danger, #b91c1c)", fontSize: 13 }}>{error}</p>
        <button className="btn ghost" onClick={() => void cargar()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="int-section-intro">
        <h3>Sesiones abiertas</h3>
        <p>
          Quién está conectado a esta empresa en este momento. Cerrar una sesión
          lo desconecta de todos sus dispositivos al instante; para sacarlo del
          sistema del todo, quitale el acceso desde Usuarios.
        </p>
      </div>

      <div className="int-tpl-list" style={{ marginBottom: 26 }}>
        {sesiones === null ? (
          <div className="int-nt-vacio">Cargando…</div>
        ) : sesiones.length === 0 ? (
          <div className="int-nt-vacio">No hay nadie conectado ahora mismo.</div>
        ) : (
          sesiones.map((s) => (
            <div className="usr-fila" key={s.id}>
              <div className="usr-quien">
                <div className="usr-nombre">
                  {s.usuarioNombre}
                  {s.esLaMia ? <span className="int-pill">ESTA SESIÓN</span> : null}
                  {s.esImpersonacion ? (
                    <span
                      className="int-pill int-pill-warn"
                      title="Soporte de Grafo operando dentro de tu empresa."
                    >
                      SOPORTE
                    </span>
                  ) : null}
                </div>
                <div className="usr-mail">{s.email}</div>
              </div>
              <div className="usr-estado usr-mail" suppressHydrationWarning>
                Desde {fechaHora(s.desde)}
              </div>
              <div />
              <div className="usr-acciones">
                {/* La propia no: cerrarla desde acá sería desloguearse por un
                    botón que dice otra cosa. Para eso está "Cerrar sesión". */}
                {!s.esLaMia && (
                  <button
                    className="btn ghost"
                    disabled={cerrando === s.usuarioId}
                    onClick={() => void cerrar(s)}
                  >
                    Cerrar sesión
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="int-section-intro">
        <h3>Desde dónde puede entrar cada uno</h3>
        <p>
          Por defecto se entra desde cualquier lado. Si la empresa tiene IP fija,
          podés atar una cuenta a esa IP: desde otra red no la deja entrar, ni
          con la clave correcta.{" "}
          {miIp ? (
            <>
              Vos estás entrando desde <strong>{miIp.ip}</strong>.
            </>
          ) : null}
        </p>
      </div>

      {/* La señal de que el servidor no está viendo el origen real. Restringir
          contra una IP interna no protege: no coincide nunca con un cliente de
          verdad, o coincide con todos. */}
      {miIp && !miIp.esPublica && (
        <div className="usr-aviso">
          <strong>Ojo: {miIp.ip} es una IP interna, no la pública.</strong> Si
          estás probando en tu máquina es normal. Si esto pasa en el sistema
          instalado, el servidor no está viendo de dónde viene la gente y hay
          que configurarle <code>TRUST_PROXY</code> antes de que restringir sirva
          de algo.
        </div>
      )}

      <div className="int-tpl-list" style={{ marginBottom: 26 }}>
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
            <div className="usr-form">
              <div className="int-section-intro">
                <h3>Desde dónde entra {u.nombreCompleto || u.email}</h3>
                <p>
                  La IP <strong>pública</strong> de la empresa —la que se ve en
                  &ldquo;cuál es mi IP&rdquo;—, una por línea o separadas por
                  coma. Vacío = desde cualquier lado. También se puede escribir
                  el rango entero de la oficina, como <code>190.1.2.0/24</code>.
                </p>
              </div>
              <textarea
                className="usr-ips"
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                rows={3}
                placeholder="190.1.2.3"
                autoFocus
              />
              <div className="usr-form-acciones">
                {miIp && (
                  <button
                    className="btn ghost"
                    onClick={() =>
                      setBorrador((b) =>
                        b.trim() ? `${b}, ${miIp.ip}` : miIp.ip,
                      )
                    }
                    title={
                      miIp.esPublica
                        ? "Agrega la IP desde la que estás mirando ahora."
                        : "Es una IP interna: sirve para probar, no para proteger."
                    }
                  >
                    Usar mi IP ({miIp.ip})
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

      <div className="int-section-intro">
        <h3>Lo que viene</h3>
        <p>
          Vigencia de las sesiones y segundo factor. Todavía no están: cuando
          los trabajemos, viven acá.
        </p>
      </div>
    </>
  );
}

/** 24 horas: con am/pm, Node y el navegador escriben espacios distintos. */
function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
