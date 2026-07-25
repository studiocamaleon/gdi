"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  crearUsuario,
  editarUsuario,
  getUsuarios,
  type ListadoUsuarios,
  type RolDelTenant,
  type UsuarioDelTenant,
} from "@/lib/usuarios-api";
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
  roles,
  empleados,
}: {
  inicial: ListadoUsuarios;
  roles: RolDelTenant[];
  empleados: EmpleadoOpcion[];
}) {
  const [datos, setDatos] = React.useState(inicial);
  const [invitando, setInvitando] = React.useState(false);
  const [aDesactivar, setADesactivar] = React.useState<UsuarioDelTenant | null>(
    null,
  );
  const [guardando, setGuardando] = React.useState<string | null>(null);

  const recargar = React.useCallback(async () => {
    try {
      setDatos(await getUsuarios());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar.");
    }
  }, []);

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
          de fábrica cubren una imprenta típica; los roles a medida llegan en la
          próxima entrega.
        </p>
      </div>
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
          </div>
        ))}
      </div>

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
  const [enviando, setEnviando] = React.useState(false);
  const [link, setLink] = React.useState<string | null>(null);

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
      });
      setLink(res.invitacionUrl);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(res.invitacionUrl);
        toast.success("Acceso creado. El link quedó copiado.");
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

  if (link) {
    return (
      <div className="usr-form">
        <div className="int-section-intro">
          <h3>Pasale este link</h3>
          <p>
            Ya tiene acceso; con el link elige su contraseña. Vence en 7 días y
            se puede volver a generar desde el listado.
          </p>
        </div>
        <code className="usr-link">{link}</code>
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

function nombreDe(u: UsuarioDelTenant): string {
  return u.nombreCompleto?.trim() || u.email;
}
