import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";

/**
 * Puerta del módulo. El sidebar ya lo esconde para quien no lo tiene, pero una
 * URL pegada en un chat o un favorito viejo no pasa por el sidebar: sin esto la
 * pantalla cargaba vacía y con errores de red, como si el sistema estuviera
 * roto. Ver docs/usuarios-roles-permisos-diseno.md
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await tienePermiso("registros.ver"))) {
    return <SinPermiso modulo="Empleados" />;
  }
  return <>{children}</>;
}
