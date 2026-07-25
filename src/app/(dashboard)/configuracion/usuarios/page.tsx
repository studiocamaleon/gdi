import { UsuariosView } from "@/components/usuarios/usuarios-view";
import { getEmpleados } from "@/lib/empleados-api";
import {
  getRoles,
  getUsuarios,
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
  const [usuarios, roles, empleados] = await Promise.all([
    getUsuarios().catch(() => VACIO),
    getRoles().catch(() => [] as RolDelTenant[]),
    getEmpleados().catch(() => []),
  ]);

  return (
    <UsuariosView
      inicial={usuarios}
      roles={roles}
      empleados={empleados.map((e) => ({
        id: e.id,
        nombreCompleto: e.nombreCompleto,
      }))}
    />
  );
}
