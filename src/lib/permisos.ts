import type { CurrentUser } from "@/lib/auth";

/**
 * Permisos del lado del navegador: sirven para no mostrar lo que el API va a
 * rechazar igual.
 *
 * Es cortesía, NO seguridad. La autorización vive en el API y cada pantalla la
 * vuelve a pedir; esto sólo evita el sidebar lleno de puertas cerradas.
 * Espejo de apps/api/src/auth/permisos.ts — si allá se agrega un módulo, acá
 * también. Ver docs/usuarios-roles-permisos-diseno.md
 */

export const MODULOS = [
  "panel",
  "comercial",
  "registros",
  "costos",
  "produccion",
  "administracion",
  "reportes",
  "inventario",
  "configuracion",
] as const;

export type ModuloClave = (typeof MODULOS)[number];

export type PermisoClave =
  | `${ModuloClave}.ver`
  | `${ModuloClave}.gestionar`
  | "finanzas.ver_margenes"
  // El Resumen ejecutivo se separa del resto de Reportes: es la lectura del
  // dueño (facturación, margen, punto de equilibrio, alertas) y de fábrica lo
  // tiene sólo el Administrador.
  | "reportes.ver_resumen"
  | "registros.gestionar_empleados"
  | "registros.ver_comisiones"
  // Los sueldos de los legajos. Registros es un módulo abierto —el vendedor
  // carga clientes ahí—, así que la remuneración pide su propio permiso.
  // Datos fiscales y métodos de pago: viven en Configuración pero son del
  // dominio de quien cobra y factura. Sin esta llave suelta, dárselos
  // implicaría abrirle también Usuarios.
  | "administracion.configurar"
  // Tomar la seña es parte de cerrar la venta: el Vendedor cobra sin que eso
  // le abra facturación ni tesorería.
  | "administracion.cobrar"
  // Anular un comprobante o un cobro: lo que deshace un movimiento de plata.
  | "administracion.anular";

/**
 * Los permisos del usuario en la empresa donde está parado.
 *
 * Sin la lista (sesión vieja, respuesta de una versión anterior del API) se
 * asume que puede todo: el API lo va a frenar si no, y una UI vacía por un
 * campo que falta es peor que una que ofrece de más.
 */
export function permisosDe(user: CurrentUser | null | undefined): Set<string> | null {
  const lista = user?.tenantActual?.permisos;
  if (!lista) return null;
  return new Set(lista);
}

export function puede(
  user: CurrentUser | null | undefined,
  permiso: PermisoClave,
): boolean {
  const permisos = permisosDe(user);
  return permisos === null || permisos.has(permiso);
}
