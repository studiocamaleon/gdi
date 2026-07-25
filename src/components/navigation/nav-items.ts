// Estructura de navegación del sidebar, compartida entre el sidebar y el
// buscador (command palette). Un solo lugar para las rutas del ERP.
//
// Cada entrada declara el permiso que pide. Un módulo que el usuario no puede
// ver NO se muestra —no se muestra deshabilitado—: la lista de lo que no podés
// hacer es información que no hace falta dar. Ver docs/usuarios-roles-permisos-diseno.md

import type { PermisoClave } from "@/lib/permisos";

export type NavIconKey =
  | "Grid"
  | "Briefcase"
  | "Users"
  | "Coin"
  | "Factory"
  | "Wallet"
  | "Cube"
  | "Cog";

export type NavChild = {
  key: string;
  label: string;
  href: string;
  /** Permiso que hace falta para verlo. Hereda el del grupo si no lo declara. */
  permiso?: PermisoClave;
};

export type NavItem =
  | {
      key: string;
      label: string;
      icon: NavIconKey;
      href: string;
      permiso: PermisoClave;
      children?: never;
    }
  | {
      key: string;
      label: string;
      icon: NavIconKey;
      /** Permiso del grupo: lo heredan los hijos que no declaren el suyo. */
      permiso: PermisoClave;
      children: NavChild[];
      href?: never;
    };

export const NAV: NavItem[] = [
  { key: "panel", label: "Panel general", icon: "Grid",
    permiso: "panel.ver", href: "/" },
  {
    key: "comercial",
    label: "Comercial",
    icon: "Briefcase",
    permiso: "comercial.ver",
    children: [
      {
        key: "crear-propuesta",
        label: "Crear orden",
        href: "/comercial/crear-propuesta",
      },
      {
        key: "presupuestos",
        label: "Presupuestos",
        href: "/comercial/presupuestos",
      },
      // Vive en Comercial (sigue el flujo propuesta → presupuesto → OT) aunque
      // la ruta siga bajo /produccion/ordenes.
      {
        key: "ordenes-trabajo",
        label: "Órdenes de trabajo",
        href: "/produccion/ordenes",
      },
    ],
  },
  {
    key: "registros",
    label: "Registros",
    icon: "Users",
    permiso: "registros.ver",
    children: [
      { key: "clientes", label: "Clientes", href: "/clientes" },
      { key: "proveedores", label: "Proveedores", href: "/proveedores" },
      { key: "empleados", label: "Empleados", href: "/empleados" },
    ],
  },
  {
    key: "costos",
    label: "Costos",
    icon: "Coin",
    permiso: "costos.ver",
    children: [
      {
        key: "centros",
        label: "Centros de costo",
        href: "/costos/centros-de-costo",
      },
      { key: "maquinaria", label: "Maquinaria", href: "/costos/maquinaria" },
      {
        key: "gastos-fijos",
        label: "Gastos fijos",
        href: "/costos/gastos-fijos",
      },
      {
        key: "rutas",
        label: "Rutas de producción",
        href: "/productos-servicios/rutas",
      },
      {
        key: "catalogo",
        label: "Catálogo de productos",
        href: "/productos-servicios",
      },
      {
        key: "cargos",
        label: "Cargos directos",
        href: "/productos-servicios/cargos-directos",
      },
      {
        key: "impuestos",
        label: "Impuestos",
        href: "/productos-servicios/impuestos-catalogo",
      },
      {
        key: "comisiones",
        label: "Comisiones",
        href: "/productos-servicios/comisiones-catalogo",
      },
    ],
  },
  {
    key: "produccion",
    label: "Producción",
    icon: "Factory",
    permiso: "produccion.ver",
    children: [
      {
        key: "tablero-produccion",
        label: "Tablero de producción",
        href: "/produccion/tablero",
      },
      {
        key: "simulador",
        label: "Simulador gran formato",
        href: "/produccion/simulador",
      },
      {
        key: "simulador-laser",
        label: "Simulador impresión láser",
        href: "/produccion/simulador-laser",
      },
      { key: "estaciones", label: "Estaciones", href: "/produccion/estaciones" },
      { key: "salud-eta", label: "Salud del ETA", href: "/produccion/eta" },
    ],
  },
  {
    key: "administracion",
    label: "Administración",
    icon: "Wallet",
    permiso: "administracion.ver",
    children: [
      {
        key: "tesoreria",
        label: "Tesorería",
        href: "/administracion/tesoreria",
      },
      {
        key: "comprobantes",
        label: "Comprobantes",
        href: "/administracion/comprobantes",
      },
      {
        key: "facturacion",
        label: "Facturación",
        href: "/administracion/facturacion",
      },
      {
        key: "deudores",
        label: "Deudores",
        href: "/administracion/deudores",
      },
      {
        key: "metodos-pago",
        label: "Métodos de pago",
        href: "/administracion/metodos-pago",
      },
      {
        key: "datos-fiscales",
        label: "Datos fiscales",
        href: "/administracion/datos-fiscales",
      },
    ],
  },
  {
    key: "inventario",
    label: "Inventario",
    icon: "Cube",
    permiso: "inventario.ver",
    children: [
      {
        key: "materiales",
        label: "Materiales",
        href: "/inventario/materias-primas",
      },
      { key: "movimientos", label: "Movimientos", href: "/inventario/movimientos" },
    ],
  },
  {
    key: "configuracion",
    label: "Configuración",
    icon: "Cog",
    permiso: "configuracion.ver",
    children: [
      {
        key: "usuarios",
        label: "Usuarios",
        href: "/configuracion/usuarios",
      },
      {
        key: "integraciones",
        label: "Integraciones",
        href: "/configuracion/integraciones",
      },
    ],
  },
];

export function hasChildren(
  item: NavItem,
): item is Extract<NavItem, { children: NavChild[] }> {
  return Array.isArray(item.children);
}

/**
 * El árbol que le corresponde a estos permisos.
 *
 * `permisos === null` (sesión que no los trae) devuelve todo: el API frena lo
 * que no corresponda y un sidebar vacío por un campo que falta es peor que uno
 * que ofrece de más. Un grupo que se queda sin hijos desaparece.
 */
export function navPara(permisos: Set<string> | null): NavItem[] {
  if (!permisos) return NAV;
  return NAV.flatMap<NavItem>((item) => {
    if (!permisos.has(item.permiso)) return [];
    if (!hasChildren(item)) return [item];
    const children = item.children.filter(
      (c) => !c.permiso || permisos.has(c.permiso),
    );
    return children.length ? [{ ...item, children }] : [];
  });
}

export type NavDestination = {
  key: string;
  label: string;
  href: string;
  /** Etiqueta del módulo padre, ej. "Costos". Vacío para ítems de primer nivel. */
  grupo: string;
};

/** Aplana el árbol de navegación a la lista de destinos navegables. */
export function flattenNavDestinations(
  permisos: Set<string> | null = null,
): NavDestination[] {
  return navPara(permisos).flatMap((item) => {
    if (hasChildren(item)) {
      return item.children.map((child) => ({
        key: child.key,
        label: child.label,
        href: child.href,
        grupo: item.label,
      }));
    }
    return [{ key: item.key, label: item.label, href: item.href, grupo: "" }];
  });
}
