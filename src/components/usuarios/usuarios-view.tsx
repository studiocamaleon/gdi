"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  crearUsuario,
  editarUsuario,
  eliminarRol,
  getHistorialAccesos,
  getRoles,
  getUsuarios,
  reenviarInvitacion,
  restablecerPassword,
  type CatalogoPermisos,
  type EventoAcceso,
  type ListadoUsuarios,
  type ModoAcceso,
  type RolDelTenant,
  type UsuarioDelTenant,
} from "@/lib/usuarios-api";
import { RolEditor } from "@/components/usuarios/rol-editor";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";

type EmpleadoOpcion = { id: string; nombreCompleto: string };

/**
 * Configuración → Usuarios: quién entra al sistema y con qué rol.
 *
 * Reemplaza al formulario de invitación que vivía en la ficha del empleado. No
 * es una mudanza: un usuario NO es un empleado —el contador externo entra y no
 * tiene legajo, el 90% del taller tiene legajo y no entra— y tenerlo colgado
 * del legajo hacía imposible lo primero.
 *
 * Ver docs/usuarios-roles-permisos-diseno.md
 */
export function UsuariosView({
  inicial,
  roles: rolesIniciales,
  catalogo,
  empleados,
  historial: historialInicial,
}: {
  inicial: ListadoUsuarios;
  roles: RolDelTenant[];
  catalogo: CatalogoPermisos | null;
  empleados: EmpleadoOpcion[];
  historial: EventoAcceso[];
}) {
  const [datos, setDatos] = React.useState(inicial);
  const [roles, setRoles] = React.useState(rolesIniciales);
  const [historial, setHistorial] = React.useState(historialInicial);
  /** null = cerrado; { rol: null } = rol nuevo. */
  const [editando, setEditando] = React.useState<{
    rol: RolDelTenant | null;
  } | null>(null);
  const [aBorrar, setABorrar] = React.useState<RolDelTenant | null>(null);
  /** La provisoria recién generada: se muestra una vez y no vuelve. */
  const [provisoria, setProvisoria] = React.useState<{
    email: string;
    clave: string;
  } | null>(null);
  const [destinoBorrado, setDestinoBorrado] = React.useState("");
  const [invitando, setInvitando] = React.useState(false);
  const [aDesactivar, setADesactivar] = React.useState<UsuarioDelTenant | null>(
    null,
  );
  const [guardando, setGuardando] = React.useState<string | null>(null);

  const recargar = React.useCallback(async () => {
    try {
      const [u, r, h] = await Promise.all([
        getUsuarios(),
        getRoles(),
        getHistorialAccesos().catch(() => historialInicial),
      ]);
      setDatos(u);
      setRoles(r);
      setHistorial(h);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar.");
    }
  }, [historialInicial]);

  const reenviar = async (usuario: UsuarioDelTenant) => {
    setGuardando(usuario.id);
    try {
      const { invitacionUrl } = await reenviarInvitacion(usuario.id);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(invitacionUrl);
        toast.success("Link nuevo copiado. El anterior dejó de servir.");
      } else {
        toast.success("Link nuevo generado.");
      }
      await recargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el link.");
    } finally {
      setGuardando(null);
    }
  };

  const restablecer = async (usuario: UsuarioDelTenant) => {
    setGuardando(usuario.id);
    try {
      const r = await restablecerPassword(usuario.id);
      setProvisoria({ email: r.email, clave: r.provisoria });
      await recargar();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo restablecer la clave.",
      );
    } finally {
      setGuardando(null);
    }
  };

  const borrarRol = async () => {
    if (!aBorrar) return;
    try {
      await eliminarRol(aBorrar.id, destinoBorrado || undefined);
      toast.success(`Rol "${aBorrar.nombre}" eliminado.`);
      setABorrar(null);
      setDestinoBorrado("");
      await recargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
  };

  const cambiarRol = async (usuario: UsuarioDelTenant, rolId: string) => {
    if (rolId === usuario.rolId) return;
    setGuardando(usuario.id);
    try {
      await editarUsuario(usuario.id, { rolId });
      toast.success(
        `${nombreDe(usuario)} ahora es ${roles.find((r) => r.id === rolId)?.nombre ?? "otro rol"}.`,
      );
      await recargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el rol.");
    } finally {
      setGuardando(null);
    }
  };

  const cambiarAcceso = async (usuario: UsuarioDelTenant, activa: boolean) => {
    setGuardando(usuario.id);
    try {
      await editarUsuario(usuario.id, { activa });
      toast.success(
        activa
          ? `${nombreDe(usuario)} vuelve a tener acceso.`
          : `${nombreDe(usuario)} ya no puede entrar.`,
      );
      await recargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(null);
      setADesactivar(null);
    }
  };

  const sinCupo =
    datos.limite !== null && datos.enUso >= datos.limite;

  return (
    <div className="int-page">
      <div className="page-head">
        <div className="title-block">
          <h1>Usuarios</h1>
          <div className="sub">
            Quién entra al sistema y qué puede hacer. Dar acceso no es lo mismo
            que cargar un empleado: acá viven las cuentas, en Empleados los
            legajos.
          </div>
        </div>
        <button
          className="btn primary"
          onClick={() => setInvitando(true)}
          disabled={invitando || sinCupo}
          title={
            sinCupo
              ? `Tu plan incluye ${datos.limite} usuarios y ya los estás usando.`
              : undefined
          }
        >
          Dar acceso a alguien
        </button>
      </div>

      {datos.limite !== null && (
        <div className="usr-cupo">
          <strong>
            {datos.enUso} de {datos.limite}
          </strong>{" "}
          usuarios con acceso en tu plan.
          {sinCupo
            ? " Para sumar otro, desactivá uno o pasá a un plan mayor."
            : ""}
        </div>
      )}

      {provisoria && (
        <div className="usr-form">
          <div className="int-section-intro">
            <h3>Clave provisoria de {provisoria.email}</h3>
            <p>
              Dictásela o pasásela por donde puedas. Cuando entre con ella, el
              sistema le va a pedir que elija una propia — vos no vas a saber
              cuál. No se muestra de nuevo: si se pierde, generá otra.
            </p>
          </div>
          <code className="usr-link">{provisoria.clave}</code>
          <div className="usr-form-acciones">
            <button
              className="btn ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(provisoria.clave);
                toast.success("Copiada.");
              }}
            >
              Copiar
            </button>
            <button className="btn primary" onClick={() => setProvisoria(null)}>
              Listo
            </button>
          </div>
        </div>
      )}

      {invitando && (
        <FormularioInvitacion
          roles={roles}
          empleados={empleados}
          onCancelar={() => setInvitando(false)}
          onCreado={async () => {
            setInvitando(false);
            await recargar();
          }}
        />
      )}

      <div className="int-tpl-list" style={{ marginBottom: 26 }}>
        {datos.usuarios.map((u) => (
          <div className="usr-fila" key={u.id}>
            <div className="usr-quien">
              <div className="usr-nombre">
                {nombreDe(u)}
                {u.esYo ? <span className="int-pill">VOS</span> : null}
              </div>
              <div className="usr-mail">{u.email}</div>
              {u.empleado ? (
                <div className="usr-legajo">
                  Legajo: {u.empleado.nombreCompleto}
                </div>
              ) : null}
            </div>

            <div className="usr-estado">
              <PillEstado usuario={u} />
            </div>

            <select
              className="usr-rol"
              value={u.rolId ?? ""}
              disabled={u.esYo || !u.activa || guardando === u.id}
              onChange={(e) => void cambiarRol(u, e.target.value)}
              title={
                u.esYo
                  ? "No podés cambiarte el rol a vos mismo."
                  : undefined
              }
            >
              {u.rolId === null && (
                <option value="">{u.rolNombre} (sin rol asignado)</option>
              )}
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>

            <div className="usr-acciones">
              {/* Sólo mientras no fijó su clave: después el link no sirve para
                  nada y ofrecerlo confunde. */}
              {u.activa && u.estado === "pendiente" ? (
                <button
                  className="btn ghost"
                  disabled={guardando === u.id}
                  onClick={() => void reenviar(u)}
                  title="Genera un link nuevo y copia al portapapeles. El anterior deja de servir."
                >
                  Link de acceso
                </button>
              ) : null}
              {/* Vale para los dos casos: al que nunca entró se le DA una
                  clave (si el link no le llegó o no lo abre) y al que la
                  olvidó se le RESTABLECE. Es la misma operación. */}
              {u.activa ? (
                <button
                  className="btn ghost"
                  disabled={guardando === u.id}
                  onClick={() => void restablecer(u)}
                  title="Le genera una clave para dictarle. La cambia al entrar."
                >
                  {u.estado === "pendiente" ? "Darle una clave" : "Restablecer clave"}
                </button>
              ) : null}
              {u.activa ? (
                <button
                  className="btn ghost"
                  disabled={u.esYo || guardando === u.id}
                  onClick={() => setADesactivar(u)}
                >
                  Quitar acceso
                </button>
              ) : (
                <button
                  className="btn ghost"
                  disabled={guardando === u.id}
                  onClick={() => void cambiarAcceso(u, true)}
                >
                  Devolver acceso
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="int-section-intro">
        <h3>Roles</h3>
        <p>
          Cada rol junta los permisos de los módulos que puede usar. Los cinco
          de fábrica cubren una imprenta típica; si te falta uno, duplicá el que
          más se parezca y ajustalo.
        </p>
      </div>

      {editando && catalogo ? (
        <RolEditor
          rol={editando.rol}
          catalogo={catalogo}
          onCerrar={() => setEditando(null)}
          onGuardado={recargar}
        />
      ) : (
        <div className="usr-roles-top">
          <button
            className="btn ghost"
            onClick={() => setEditando({ rol: null })}
            disabled={!catalogo}
            title={
              catalogo
                ? undefined
                : "No se pudo cargar el catálogo de permisos."
            }
          >
            Crear un rol
          </button>
        </div>
      )}

      <div className="int-tpl-list">
        {roles.map((r) => (
          <div className="usr-rol-fila" key={r.id}>
            <div>
              <div className="usr-nombre">
                {r.nombre}
                {r.esDelSistema ? (
                  <span className="int-pill">DE FÁBRICA</span>
                ) : null}
              </div>
              <div className="usr-mail">{r.descripcion}</div>
            </div>
            <div className="usr-rol-cuenta">
              {r.usuarios === 0
                ? "Sin usuarios"
                : r.usuarios === 1
                  ? "1 usuario"
                  : `${r.usuarios} usuarios`}
            </div>
            <div className="usr-acciones">
              <button
                className="btn ghost"
                disabled={!catalogo}
                onClick={() => setEditando({ rol: r })}
              >
                {r.esDelSistema ? "Ajustar permisos" : "Editar"}
              </button>
              {!r.esDelSistema && (
                <button className="btn ghost" onClick={() => setABorrar(r)}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="int-section-intro" style={{ marginTop: 26 }}>
        <h3>Qué pasó con los accesos</h3>
        <p>
          Quién le dio, le cambió o le quitó el acceso a quién. Es la respuesta
          a &ldquo;¿quién lo habilitó?&rdquo;, que hasta ahora no la tenía
          nadie.
        </p>
      </div>
      <div className="int-tpl-list" style={{ marginBottom: 26 }}>
        {historial.length === 0 ? (
          <div className="int-nt-vacio">
            Todavía no se registró ningún cambio de acceso.
          </div>
        ) : (
          historial.map((e) => (
            <div className="int-nt-log-fila" key={e.id}>
              {/* suppressHydrationWarning: la hora se muestra en la zona de
                  quien mira, y el servidor no está en la misma que él. La
                  diferencia es esperada, no un bug — sin esto React tira el
                  árbol entero para regenerarlo. */}
              <span className="int-nt-log-fecha" suppressHydrationWarning>
                {fechaCorta(e.createdAt)}
              </span>
              <div>
                <div>{e.descripcion}</div>
                <div className="int-nt-log-motivo">{e.actorNombre}</div>
              </div>
              <span className="int-pill">{e.tipo.replace(/_/g, " ")}</span>
            </div>
          ))
        )}
      </div>

      {/* Borrar un rol con gente adentro exige decir a dónde van: dejarlos sin
          rol los tiraría al fallback del enum, que es un permiso distinto del
          que el admin cree estar sacando. */}
      {aBorrar && (
        <div className="usr-form">
          <div className="int-section-intro">
            <h3>Eliminar &ldquo;{aBorrar.nombre}&rdquo;</h3>
            <p>
              {aBorrar.usuarios === 0
                ? "No lo tiene nadie asignado, así que no cambia el acceso de ninguna persona."
                : `Lo tienen ${aBorrar.usuarios} ${aBorrar.usuarios === 1 ? "usuario" : "usuarios"}. Elegí con qué rol siguen trabajando.`}
            </p>
          </div>
          {aBorrar.usuarios > 0 && (
            <label className="usr-campo" style={{ maxWidth: 320 }}>
              <span>Pasan a</span>
              <select
                value={destinoBorrado}
                onChange={(e) => setDestinoBorrado(e.target.value)}
              >
                <option value="">Elegí un rol…</option>
                {roles
                  .filter((r) => r.id !== aBorrar.id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="usr-form-acciones">
            <button
              className="btn ghost"
              onClick={() => {
                setABorrar(null);
                setDestinoBorrado("");
              }}
            >
              Cancelar
            </button>
            <button
              className="btn primary"
              disabled={aBorrar.usuarios > 0 && !destinoBorrado}
              onClick={() => void borrarRol()}
            >
              Eliminar el rol
            </button>
          </div>
        </div>
      )}

      <ConfirmacionDestructiva
        open={aDesactivar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setADesactivar(null);
        }}
        titulo="Quitarle el acceso"
        descripcion={
          aDesactivar
            ? `${nombreDe(aDesactivar)} no va a poder entrar más al sistema y se le cierran las sesiones abiertas.`
            : ""
        }
        impacto={[
          'Sus sesiones abiertas se cierran en el momento',
          'Su historial queda intacto: lo que produjo, cotizó o cobró no se toca',
          'Se le puede devolver el acceso cuando quieras',
        ]}
        nombreItem={aDesactivar ? nombreDe(aDesactivar) : undefined}
        // Sin copy-name: es reversible de un click y el diálogo ya explica todo.
        // Pedir que tipee un nombre para algo que se deshace igual es fricción.
        requiereTipear={false}
        accionLabel="Quitar acceso"
        onConfirmar={async () => {
          if (aDesactivar) await cambiarAcceso(aDesactivar, false);
        }}
      />
    </div>
  );
}

function PillEstado({ usuario }: { usuario: UsuarioDelTenant }) {
  if (!usuario.activa) {
    return <span className="int-pill">SIN ACCESO</span>;
  }
  if (usuario.estado === "pendiente") {
    return (
      <span
        className="int-pill int-pill-warn"
        title="Ya tiene acceso: le falta abrir el link y elegir su contraseña."
      >
        FALTA SU CLAVE
      </span>
    );
  }
  return <span className="int-pill int-pill-ok">ACTIVO</span>;
}

/**
 * El alta. Devuelve el link porque todavía no se manda solo: mientras eso no
 * exista, esconder el link dejaría al admin sin forma de hacer entrar a nadie.
 */
function FormularioInvitacion({
  roles,
  empleados,
  onCancelar,
  onCreado,
}: {
  roles: RolDelTenant[];
  empleados: EmpleadoOpcion[];
  onCancelar: () => void;
  onCreado: () => Promise<void>;
}) {
  const [email, setEmail] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [rolId, setRolId] = React.useState(
    roles.find((r) => r.codigo === "operario")?.id ?? roles[0]?.id ?? "",
  );
  const [empleadoId, setEmpleadoId] = React.useState("");
  const [modo, setModo] = React.useState<ModoAcceso>("link");
  const [enviando, setEnviando] = React.useState(false);
  const [entregado, setEntregado] = React.useState<{
    link: string | null;
    clave: string | null;
  } | null>(null);

  const enviar = async () => {
    if (!email.trim() || !rolId) {
      toast.error("Falta el email o el rol.");
      return;
    }
    setEnviando(true);
    try {
      const res = await crearUsuario({
        email: email.trim(),
        nombreCompleto: nombre.trim() || undefined,
        rolId,
        empleadoId: empleadoId || undefined,
        modo,
      });
      setEntregado({ link: res.invitacionUrl, clave: res.provisoria });
      const aCopiar = res.invitacionUrl ?? res.provisoria;
      if (aCopiar && navigator.clipboard) {
        await navigator.clipboard.writeText(aCopiar);
        toast.success(
          res.invitacionUrl
            ? "Acceso creado. El link quedó copiado."
            : "Acceso creado. La clave quedó copiada.",
        );
      } else {
        toast.success("Acceso creado.");
      }
      await onCreado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo dar el acceso.");
    } finally {
      setEnviando(false);
    }
  };

  if (entregado) {
    const esLink = entregado.link !== null;
    return (
      <div className="usr-form">
        <div className="int-section-intro">
          <h3>{esLink ? "Pasale este link" : "Dictale esta clave"}</h3>
          <p>
            {esLink
              ? "Ya tiene acceso; con el link elige su contraseña. Vence en 7 días y se puede volver a generar desde el listado."
              : "Con esta clave entra una vez y el sistema le pide que elija una propia — vos no vas a saber cuál. No se muestra de nuevo: si se pierde, se genera otra desde el listado."}
          </p>
        </div>
        <code className="usr-link">{entregado.link ?? entregado.clave}</code>
        <div className="usr-form-acciones">
          <button className="btn primary" onClick={onCancelar}>
            Listo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="usr-form">
      <div className="usr-form-grid">
        <label className="usr-campo">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@empresa.com"
            autoFocus
          />
        </label>
        <label className="usr-campo">
          <span>Nombre y apellido</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Opcional"
          />
        </label>
        <label className="usr-campo">
          <span>Rol</span>
          <select value={rolId} onChange={(e) => setRolId(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="usr-campo">
          <span>Empleado (opcional)</span>
          <select
            value={empleadoId}
            onChange={(e) => setEmpleadoId(e.target.value)}
          >
            <option value="">Sin vincular</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombreCompleto}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="usr-modo">
        <span className="usr-modo-lbl">Cómo entra la primera vez</span>
        <div className="usr-niveles">
          <button
            type="button"
            className={`usr-nivel${modo === "link" ? " on" : ""}`}
            onClick={() => setModo("link")}
          >
            Le mando un link
          </button>
          <button
            type="button"
            className={`usr-nivel${modo === "clave" ? " on" : ""}`}
            onClick={() => setModo("clave")}
          >
            Le dicto una clave
          </button>
        </div>
        <p className="usr-ayuda" style={{ marginTop: 8 }}>
          {modo === "link"
            ? "Elige su propia clave desde el link: nadie más la sabe nunca."
            : "El sistema genera una clave para dictarle. La cambia al entrar, así que tampoco vas a saber la definitiva."}
        </p>
      </div>

      <p className="usr-ayuda">
        {descripcionDelRol(roles, rolId)} Vincular con un empleado sirve para la
        mesa de trabajo y las comisiones: quien no es del taller no lo necesita.
      </p>
      <div className="usr-form-acciones">
        <button className="btn ghost" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
        <button className="btn primary" onClick={() => void enviar()} disabled={enviando}>
          {enviando ? "Creando…" : "Crear acceso"}
        </button>
      </div>
    </div>
  );
}

function descripcionDelRol(roles: RolDelTenant[], rolId: string): string {
  return roles.find((r) => r.id === rolId)?.descripcion ?? "";
}

/**
 * dd/mm hh:mm en la zona de quien mira.
 *
 * En 24 horas a propósito: con am/pm, Node escribe un espacio finito antes y
 * Chrome uno normal, y React ve dos textos distintos donde hay la misma hora.
 * El `suppressHydrationWarning` del span cubre lo que queda —la zona horaria,
 * que sí puede diferir de verdad entre servidor y navegador—.
 */
function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function nombreDe(u: UsuarioDelTenant): string {
  return u.nombreCompleto?.trim() || u.email;
}
