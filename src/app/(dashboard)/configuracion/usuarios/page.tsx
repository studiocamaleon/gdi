import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { UsuariosView } from "@/components/usuarios/usuarios-view";
import { getEmpleados } from "@/lib/empleados-api";
import {
  getCatalogoPermisos,
  getHistorialAccesos,
  getRoles,
  getUsuarios,
  type CatalogoPermisos,
  type EventoAcceso,
  type ListadoUsuarios,
  type RolDelTenant,
} from "@/lib/usuarios-api";

export const dynamic = "force-dynamic";

const VACIO: ListadoUsuarios = { usuarios: [], limite: null, enUso: 0 };

/**
 * Configuración → Usuarios. Ver docs/usuarios-roles-permisos-diseno.md
 *
 * Los empleados se piden acá para el select de vinculación. Si falla, el resto
 * de la pantalla funciona igual: vincular es opcional.
 */
export default async function UsuariosPage() {
  if (!(await tienePermiso("configuracion.ver"))) {
    return <SinPermiso modulo="Usuarios" />;
  }

  const [usuarios, roles, catalogo, empleados, historial] = await Promise.all([
    getUsuarios().catch(() => VACIO),
    getRoles().catch(() => [] as RolDelTenant[]),
    // Sin catálogo la pantalla sigue sirviendo para lo principal —ver quién
    // entra y cambiarle el rol—; lo único que se apaga es el editor.
    getCatalogoPermisos().catch(() => null as CatalogoPermisos | null),
    getEmpleados().catch(() => []),
    getHistorialAccesos().catch(() => [] as EventoAcceso[]),
  ]);

  return (
    <UsuariosView
      inicial={usuarios}
      roles={roles}
      catalogo={catalogo}
      historial={historial}
      empleados={empleados.map((e) => ({
        id: e.id,
        nombreCompleto: e.nombreCompleto,
      }))}
    />
  );
}
