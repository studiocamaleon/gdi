// Estructura de navegación del sidebar, compartida entre el sidebar y el
// buscador (command palette). Un solo lugar para las rutas del ERP.
//
// Cada entrada declara el permiso que pide. Un módulo que el usuario no puede
// ver NO se muestra —no se muestra deshabilitado—: la lista de lo que no podés
// hacer es información que no hace falta dar. Ver docs/usuarios-roles-permisos-diseno.md

import type { PermisoClave } from "@/lib/permisos";

export type NavIconKey =
  | "Chart"
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
  /**
   * Sólo se muestra si el país del tenant coincide (`"AR"` para el circuito
   * fiscal ARCA: comprobantes, facturación, datos fiscales). Sin declarar =
   * para todos. Ver multi-moneda-zona-horaria D14.
   */
  soloPais?: string;
};

export type NavItem =
  | {
      key: string;
      label: string;
      icon: NavIconKey;
      href: string;
      permiso: PermisoClave;
      children?: never;
      /**
       * Palabras extra por las que el buscador del sidebar encuentra la
       * entrada. Para un módulo que adentro tiene varias pantallas pero en el
       * menú ocupa una sola línea: escribir "embudo" sigue llevando a Reportes.
       */
      buscar?: string[];
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
  // El home. Vacío por ahora: qué muestra —y para quién— se diseña aparte.
  // Lo tienen todos los roles, incluido el Operario.
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
        soloPais: "AR",
      },
      {
        key: "facturacion",
        label: "Facturación",
        href: "/administracion/facturacion",
        soloPais: "AR",
      },
      {
        key: "deudores",
        label: "Deudores",
        href: "/administracion/deudores",
      },
    ],
  },
  // Reportes fue durante un tiempo el "Panel general": nueve vistas como tabs de
  // la home, sin URL propia. Como tabs no se podían linkear ni compartir, y el
  // buscador —que come de este árbol— no las encontraba. Cada reporte quedó como
  // ruta propia, pero en el sidebar Reportes es UNA línea: adentro la tira de
  // reportes ya es la navegación (ver reportes-shell.tsx) y repetirla como nueve
  // hijos sólo cargaba el menú. `/reportes` manda al primero que la persona
  // puede ver, y `buscar` sostiene lo que los hijos daban gratis: escribir
  // "embudo" o "costo laboral" sigue encontrando el módulo.
  //
  // Ojo: el permiso de acá es sólo el del módulo. Qué reporte ve cada uno lo
  // deciden la tira (reportes-shell.tsx) y el gate de cada página.
  {
    key: "reportes",
    label: "Reportes",
    icon: "Chart",
    permiso: "reportes.ver",
    href: "/reportes",
    buscar: [
      "Resumen ejecutivo",
      "Comercial",
      "Embudo",
      "Clientes",
      "Producción",
      "Equipo",
      "Finanzas",
      "Ventas & Producto",
      "Costo laboral",
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
  // Configuración NO está en esta lista: es el ancla del pie del sidebar,
  // debajo de la card del plan, y sus secciones son la columna de su propia
  // vista. Viven en components/configuracion/configuracion-nav.tsx —incluido
  // qué permiso pide cada una—, que es de donde salen tanto el pie como el
  // redirect de /configuracion.
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
export function navPara(
  permisos: Set<string> | null,
  pais: string = "AR",
): NavItem[] {
  // El filtro por país corre SIEMPRE, incluso sin permisos: un tenant chileno
  // sin lista de permisos no tiene por qué ver el circuito fiscal argentino.
  const porPais = (c: NavChild) => !c.soloPais || c.soloPais === pais;
  if (!permisos) {
    return NAV.flatMap<NavItem>((item) => {
      if (!hasChildren(item)) return [item];
      const children = item.children.filter(porPais);
      return children.length ? [{ ...item, children }] : [];
    });
  }
  return NAV.flatMap<NavItem>((item) => {
    if (!hasChildren(item)) {
      return permisos.has(item.permiso) ? [item] : [];
    }
    // El permiso del hijo REEMPLAZA al del grupo, no se suma: un hijo que
    // declara el suyo se sostiene solo (Datos fiscales con
    // `administracion.configurar` aunque no tengas Configuración entera) y
    // también se restringe solo (el Resumen ejecutivo NO se abre por tener
    // Reportes). El grupo aparece si le queda al menos un hijo.
    const children = item.children.filter(
      (c) => permisos.has(c.permiso ?? item.permiso) && porPais(c),
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

