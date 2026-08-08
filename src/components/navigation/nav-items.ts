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
      {
        key: "cupones",
        label: "Cupones",
        href: "/comercial/cupones",
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
        key: "pasos",
        label: "Pasos de producción",
        href: "/productos-servicios/pasos",
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
      // Impuestos y Comisiones se mudaron a Configuración (no son costos
      // técnicos, se tocan una vez): ver configuracion-secciones.ts.
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
        // La ruta sigue siendo /deudores: renombrar la URL rompería links
        // guardados sin que nadie gane nada. "Deudores" nombraba al sujeto;
        // lo que la vista muestra es la CUENTA (el derecho de cobro por
        // órdenes ya entregadas), que es como se llama en contabilidad.
        key: "deudores",
        label: "Cuentas por cobrar",
        href: "/administracion/deudores",
      },
      {
        // El espejo de Cuentas por cobrar, y va pegado a él a propósito: las
        // dos preguntas son la misma de cada lado del mostrador. Es el MISMO
        // módulo que Egresos con otro filtro (ver `ModoEgresos`), no una
        // pantalla aparte: un gasto de contado nunca fue una cuenta por pagar
        // y por eso no aparece acá.
        key: "cuentas-por-pagar",
        label: "Cuentas por pagar",
        href: "/administracion/cuentas-por-pagar",
      },
      {
        // Todo lo que sale de la caja, deuda o no: el registro completo, el
        // análisis de en qué se va la plata y las plantillas recurrentes.
        key: "egresos",
        label: "Egresos",
        href: "/administracion/egresos",
      },
      {
        // Vivía en Costos, y el motivo era falso: NINGÚN precio los usa —el
        // cotizador no lee esa tabla y las tarifas de máquina salen de los
        // centros de costo—. Lo que hay acá es lo que gasta la empresa por
        // mes: nómina, alquiler, contador. Es administrativo.
        //
        // Permiso PROPIO y no el del grupo: adentro está la masa salarial, así
        // que lo ven sólo el Administrador y el Administrativo. Con
        // `administracion.ver` lo habría visto cualquiera que entre a
        // Administración; con el de Costos lo veía el Jefe de producción y NO
        // lo veía el Administrativo, que es quien carga estos números.
        key: "gastos-fijos",
        label: "Gastos fijos",
        href: "/administracion/gastos-fijos",
        permiso: "administracion.configurar",
      },
      // El circuito fiscal va al final: es el paso opcional que viene DESPUÉS
      // del movimiento de plata, y sólo para el tenant que emite. Arriba queda
      // lo que se usa todos los días (tesorería, cuentas, egresos).
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

