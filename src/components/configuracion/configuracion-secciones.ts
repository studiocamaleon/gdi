/**
 * Las secciones del módulo Configuración: la única lista que existe.
 *
 * Configuración salió de la lista del sidebar —es lo que se toca una vez y
 * después casi nunca, y ocupaba seis líneas del menú compitiendo con los
 * módulos del día a día—. Ahora es un ancla al pie, debajo de la card del plan
 * (plan y ajustes son la misma visita), y estas secciones son la columna de su
 * propia vista.
 *
 * De acá comen tres lugares: el pie del sidebar (si mostrar el ancla y qué
 * encuentra el buscador), el redirect de `/configuracion` —que es servidor, por
 * eso este archivo es datos puros y sin `"use client"`— y la columna
 * (`configuracion-nav.tsx`), que le pone los iconos.
 */

import type { PermisoClave } from "@/lib/permisos";

export type SeccionConfig = {
  /** Con qué icono la dibuja la columna. */
  key: string;
  href: string;
  label: string;
  /** Qué se toca ahí, en una línea. Es la ayuda de la columna. */
  detalle: string;
  /** Sin él, la sección no se ofrece. */
  permiso: PermisoClave;
  /** Sólo para el país del tenant (el circuito fiscal ARCA es argentino). */
  soloPais?: string;
};

export const SECCIONES_CONFIG: SeccionConfig[] = [
  {
    key: "empresa",
    href: "/configuracion/empresa",
    label: "Empresa",
    detalle: "Nombre, logo y datos de contacto",
    permiso: "configuracion.ver",
  },
  {
    key: "usuarios",
    href: "/configuracion/usuarios",
    label: "Usuarios",
    detalle: "Quién entra y con qué rol",
    permiso: "configuracion.ver",
  },
  // Datos fiscales y Métodos de pago son del que cobra y factura, no del dueño:
  // se sostienen con su propia llave. Por eso el Administrativo llega a
  // Configuración sin tener `configuracion.ver` —y sin que eso le abra Usuarios,
  // o sea crear cuentas y repartir roles.
  {
    key: "datos-fiscales",
    href: "/configuracion/datos-fiscales",
    label: "Datos fiscales",
    detalle: "Quién factura y desde qué punto de venta",
    permiso: "administracion.configurar",
    soloPais: "AR",
  },
  {
    key: "metodos-pago",
    href: "/configuracion/metodos-pago",
    label: "Métodos de pago",
    detalle: "Qué medios acepta el taller y con qué comisión",
    permiso: "administracion.configurar",
  },
  {
    key: "almacenamiento",
    href: "/configuracion/almacenamiento",
    label: "Almacenamiento",
    detalle: "Los archivos del taller y la cuota del plan",
    permiso: "configuracion.ver",
  },
  {
    key: "integraciones",
    href: "/configuracion/integraciones",
    label: "Integraciones",
    detalle: "WhatsApp, facturación y demás servicios",
    permiso: "configuracion.ver",
  },
];

/**
 * Las secciones que esta persona puede abrir. Si no queda ninguna, el módulo
 * entero no se ofrece — mismo criterio que un grupo del sidebar sin hijos.
 */
export function seccionesConfigVisibles(
  puede: (permiso: PermisoClave) => boolean,
  pais: string,
): SeccionConfig[] {
  return SECCIONES_CONFIG.filter(
    (s) => puede(s.permiso) && (!s.soloPais || s.soloPais === pais),
  );
}

/** Lo que el buscador del sidebar tiene que encontrar sin los hijos del menú. */
export const PALABRAS_CONFIG = SECCIONES_CONFIG.map((s) => s.label);
