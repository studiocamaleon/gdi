import { ConfiguracionNav } from "@/components/configuracion/configuracion-nav";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";

/**
 * Puerta del módulo. El sidebar ya lo esconde para quien no lo tiene, pero una
 * URL pegada en un chat o un favorito viejo no pasa por el sidebar: sin esto la
 * pantalla cargaba vacía y con errores de red, como si el sistema estuviera
 * roto.
 *
 * Deja pasar con CUALQUIERA de las dos llaves y no decide más nada: adentro
 * conviven pantallas de dueño (Usuarios, Integraciones) con dos que son del
 * que cobra y factura (Datos fiscales, Métodos de pago). Cada página pone su
 * propia guarda; si esta puerta exigiera `configuracion.ver`, la llave suelta
 * del Administrativo no serviría para nada.
 * Ver docs/usuarios-roles-permisos-diseno.md
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [config, facturacion] = await Promise.all([
    tienePermiso("configuracion.ver"),
    tienePermiso("administracion.configurar"),
  ]);
  if (!config && !facturacion) {
    return <SinPermiso modulo="Configuración" />;
  }
  // La columna de secciones vive acá y no en cada página: es el menú del
  // módulo, sobrevive a la navegación entre secciones y el `<main>` del
  // dashboard ya es un flex row, así que entra como hermana del contenido —que
  // sigue trayendo su propio scroll.
  return (
    <>
      <ConfiguracionNav />
      {children}
    </>
  );
}
