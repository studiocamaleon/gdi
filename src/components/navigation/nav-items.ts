// Estructura de navegación del sidebar, compartida entre el sidebar y el
// buscador (command palette). Un solo lugar para las rutas del ERP.

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
};

export type NavItem =
  | {
      key: string;
      label: string;
      icon: NavIconKey;
      href: string;
      children?: never;
    }
  | {
      key: string;
      label: string;
      icon: NavIconKey;
      children: NavChild[];
      href?: never;
    };

export const NAV: NavItem[] = [
  { key: "panel", label: "Panel general", icon: "Grid", href: "/" },
  {
    key: "comercial",
    label: "Comercial",
    icon: "Briefcase",
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
    children: [
      {
        key: "integraciones",
        label: "Integraciones",
        href: "/configuracion/integraciones",
      },
      {
        key: "suscripcion",
        label: "Suscripción",
        href: "/configuracion/suscripcion",
      },
    ],
  },
];

export function hasChildren(
  item: NavItem,
): item is Extract<NavItem, { children: NavChild[] }> {
  return Array.isArray(item.children);
}

export type NavDestination = {
  key: string;
  label: string;
  href: string;
  /** Etiqueta del módulo padre, ej. "Costos". Vacío para ítems de primer nivel. */
  grupo: string;
};

/** Aplana el árbol de navegación a la lista de destinos navegables. */
export function flattenNavDestinations(): NavDestination[] {
  return NAV.flatMap((item) => {
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
