"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  cerrarSesiones,
  getSesiones,
  type SesionAbierta,
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
export function TabSeguridad({ onCambio }: { onCambio: () => Promise<void> }) {
  const [sesiones, setSesiones] = React.useState<SesionAbierta[] | null>(null);
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
  }, [cargar]);

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
        <h3>Lo que viene</h3>
        <p>
          Vigencia de las sesiones, segundo factor y desde dónde se puede
          entrar. Todavía no está: cuando lo trabajemos, vive acá.
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
