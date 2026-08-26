import { RolSistema } from '@prisma/client';

/**
 * Catálogo canónico de permisos de Grafo.
 *
 * Vive en código y no en la base, igual que el catálogo de plantillas de Wati:
 * los permisos son parte del producto, se revisan por pull request y no puede
 * haber dos tenants con claves distintas para lo mismo. Lo que el tenant
 * configura es el ROL —qué claves junta— no el catálogo.
 *
 * Granularidad: dos niveles por módulo, `ver` y `gestionar`. La versión CRUD
 * completa (ver/crear/editar/eliminar × 8 módulos) da 32 casillas y no la usa
 * nadie: en una imprenta de seis personas no existe "puede crear clientes pero
 * no editarlos". Ver docs/usuarios-roles-permisos-diseno.md
 */

/** Módulos del sistema, en el orden del sidebar. */
export const MODULOS = [
  /**
   * El home. Hoy está vacío —lo que vaya a mostrar se diseña aparte—, pero es
   * de todos: a diferencia del viejo `panel.ver`, que en realidad gateaba los
   * reportes y por eso el Operario no lo tenía, este lo tienen los cinco roles.
   */
  {
    clave: 'panel',
    label: 'Panel general',
    descripcion: 'La pantalla de inicio del sistema.',
  },
  {
    clave: 'comercial',
    label: 'Comercial',
    descripcion: 'Crear órdenes, presupuestos y órdenes de trabajo.',
  },
  {
    clave: 'crm',
    label: 'CRM',
    descripcion: 'Clientes, cupones y fidelización.',
  },
  {
    clave: 'registros',
    label: 'Registros',
    descripcion: 'Clientes, proveedores y empleados.',
  },
  {
    clave: 'costos',
    label: 'Costos',
    descripcion:
      'Centros de costo, maquinaria, gastos fijos, rutas y catálogo de productos.',
  },
  {
    clave: 'produccion',
    label: 'Producción',
    descripcion: 'Tablero, mesa de trabajo, simuladores y estaciones.',
  },
  {
    clave: 'administracion',
    label: 'Administración',
    descripcion: 'Cobros, comprobantes, facturación y deudores.',
  },
  {
    clave: 'reportes',
    label: 'Reportes',
    descripcion: 'Métricas del negocio, ventas y producción.',
  },
  {
    clave: 'inventario',
    label: 'Inventario',
    descripcion: 'Materiales y movimientos de stock.',
  },
  {
    clave: 'configuracion',
    label: 'Configuración',
    descripcion: 'Integraciones, usuarios, roles y suscripción.',
  },
] as const;

export type ModuloClave = (typeof MODULOS)[number]['clave'];

/**
 * El permiso que no pertenece a un módulo: ver la plata.
 *
 * Está aparte porque el margen no vive en un solo lugar — se filtra en el
 * cotizador (Comercial), en el desglose de la orden (Producción) y en Reportes.
 * Derivarlo de "acceso a Costos" no alcanza: el vendedor tiene
 * que poder cotizar sin ver cuánto gana la imprenta en cada renglón.
 */
export const PERMISOS_TRANSVERSALES = [
  {
    clave: 'finanzas.ver_margenes',
    label: 'Ver costos y márgenes',
    descripcion:
      'Costos unitarios, contribución, márgenes y precios de compra, en cualquier pantalla donde aparezcan.',
  },
  /**
   * Excepciones: acciones que pueden hacer MENOS personas que las que manejan
   * el módulo. Son las dos que en una imprenta se piden y las autoriza otro —
   * el vendedor cierra la venta, pero el descuento por debajo del margen
   * mínimo lo firma alguien más.
   */
  {
    clave: 'comercial.aprobar_descuento',
    label: 'Aprobar presupuestos bajo el margen mínimo',
    descripcion:
      'Autorizar un presupuesto cuyo margen quedó por debajo del piso configurado. Cotizar no alcanza.',
  },
  {
    clave: 'crm.configurar_fidelizacion',
    label: 'Configurar fidelización y ajustar puntos',
    descripcion:
      'Cambiar las reglas del programa y registrar ajustes manuales auditados.',
  },
  {
    clave: 'administracion.anular',
    label: 'Anular comprobantes y cobros',
    descripcion:
      'Descartar un comprobante o anular un cobro registrado. Es lo que deshace un movimiento de plata.',
  },
  /**
   * Tomar la seña es parte de cerrar la venta, no de manejar la caja: el
   * Vendedor cobra en el mostrador y el Administrativo concilia después. Sin
   * esta llave había que elegir entre darle al Vendedor la administración
   * entera —comprobantes, tesorería, cuentas— o que sus cobros fallaran con un
   * 403 al emitir la orden, que es lo que venía pasando.
   *
   * Deja cobrar y ver lo que el formulario necesita (métodos de pago y
   * cuentas). NO abre facturación, ni tesorería, ni anular.
   */
  {
    clave: 'administracion.cobrar',
    label: 'Registrar cobros de clientes',
    descripcion:
      'Tomar un pago o una seña contra una orden y emitir su recibo. No incluye facturar, mover fondos entre cuentas ni anular.',
  },
  /**
   * El Resumen ejecutivo es el reporte que junta TODO el negocio en una
   * pantalla —facturación, margen, punto de equilibrio, alertas—. Es la lectura
   * del dueño, no la del equipo: por eso se separa del resto de Reportes en vez
   * de entrar con `reportes.ver`. De fábrica lo tiene sólo el Administrador;
   * quien quiera dárselo a su encargado lo hace desde el editor de roles.
   */
  {
    clave: 'reportes.ver_resumen',
    label: 'Ver el Resumen ejecutivo',
    descripcion:
      'El tablero que resume el negocio entero: facturación, margen, punto de equilibrio y alertas. Ver los demás reportes no alcanza.',
  },
  {
    clave: 'registros.gestionar_empleados',
    label: 'Administrar legajos de empleados',
    descripcion:
      'Crear, editar, importar y dar de baja empleados. Gestionar clientes o proveedores no alcanza.',
  },
  {
    clave: 'registros.ver_comisiones',
    label: 'Ver y editar comisiones de empleados',
    descripcion:
      'Reglas de comisión y estimaciones por vendedor. Administrar legajos no alcanza.',
  },
  {
    clave: 'produccion.ejecutar',
    label: 'Ejecutar pasos de producción',
    descripcion:
      'Tomar trabajos de las estaciones habilitadas, iniciarlos, pausarlos y completarlos. No permite configurar el taller.',
  },
  {
    clave: 'produccion.supervisar',
    label: 'Supervisar la producción',
    descripcion:
      'Intervenir en cualquier estación, bloquear, desbloquear, reabrir y reasignar trabajos.',
  },
  {
    clave: 'produccion.configurar',
    label: 'Configurar el taller',
    descripcion:
      'Crear y editar estaciones, reglas de ruteo, capacidad, calendarios y feriados.',
  },
  /**
   * Los sueldos son el dato más sensible del sistema y el módulo que los aloja
   * es el más abierto: el Vendedor tiene `registros.gestionar` porque carga
   * clientes, y sin esta excepción vería lo que gana cada compañero.
   */
  /**
   * Datos fiscales y métodos de pago viven en Configuración porque se definen
   * una vez, pero son del dominio de quien cobra y factura. Sin esta llave, el
   * Administrativo tendría que pedirle a un administrador que corrija un CUIT
   * o cargue un medio de pago nuevo — y dársela entrando por `configuracion.ver`
   * le abriría también Usuarios, o sea crear cuentas y repartir roles.
   */
  {
    clave: 'administracion.configurar',
    label: 'Configurar la facturación y los medios de cobro',
    descripcion:
      'Datos fiscales del emisor, puntos de venta y catálogo de métodos de pago. No incluye el resto de Configuración.',
  },
] as const;

export type PermisoTransversal =
  (typeof PERMISOS_TRANSVERSALES)[number]['clave'];

/** Una clave del catálogo. Se llama así y no `Permiso` para no chocar con el
 *  decorador `@Permiso`, que es lo que se lee en los controllers. */
export type PermisoClave =
  | `${ModuloClave}.ver`
  | `${ModuloClave}.gestionar`
  | PermisoTransversal;

/** Todas las claves válidas. Lo que no está acá no existe. */
export const PERMISOS: PermisoClave[] = [
  ...MODULOS.flatMap((m) => [
    `${m.clave}.ver` as PermisoClave,
    `${m.clave}.gestionar` as PermisoClave,
  ]),
  ...PERMISOS_TRANSVERSALES.map((p) => p.clave),
];

const PERMISOS_SET = new Set<string>(PERMISOS);

export function esPermisoValido(clave: string): clave is PermisoClave {
  return PERMISOS_SET.has(clave);
}

/** Todo el catálogo: lo que tiene el rol Administrador. */
export function todosLosPermisos(): PermisoClave[] {
  return [...PERMISOS];
}

/**
 * `gestionar` implica `ver`: guardar los dos sería redundante y abriría la
 * puerta a un rol que edita un módulo que "no puede ver".
 */
export function expandir(permisos: string[]): Set<string> {
  const out = new Set<string>();
  for (const p of permisos) {
    if (!esPermisoValido(p)) continue; // clave retirada del catálogo: se ignora
    out.add(p);
    if (p.endsWith('.gestionar')) {
      out.add(`${p.slice(0, -'.gestionar'.length)}.ver`);
    }
    // Producción necesita separar la ejecución diaria de la configuración.
    // El permiso histórico `gestionar` conserva su significado de acceso total.
    if (p === 'produccion.gestionar') {
      out.add('produccion.ejecutar');
      out.add('produccion.supervisar');
      out.add('produccion.configurar');
    }
  }
  return out;
}

export function puede(permisos: Set<string>, requerido: PermisoClave): boolean {
  return permisos.has(requerido);
}

/**
 * Los cinco roles que se siembran en cada tenant.
 *
 * Son editables en permisos pero no se borran ni se renombran, y son la
 * plantilla esperada para hacerse uno propio: "duplicar Vendedor y agregarle
 * Inventario" es más fácil que armar una matriz de cero.
 */
export type RolPredefinido = {
  /** Clave estable: es la que usa el backfill y el seed. */
  codigo: string;
  nombre: string;
  descripcion: string;
  /** El rol del enum al que corresponde. Sostiene la transición. */
  rolBase: RolSistema;
  permisos: PermisoClave[];
};

export const ROLES_PREDEFINIDOS: RolPredefinido[] = [
  {
    codigo: 'administrador',
    nombre: 'Administrador',
    descripcion: 'Acceso total, incluida la configuración y la facturación.',
    rolBase: RolSistema.ADMINISTRADOR,
    permisos: todosLosPermisos(),
  },
  {
    codigo: 'jefe_produccion',
    nombre: 'Jefe de producción',
    descripcion:
      'Maneja el taller de punta a punta y ve los costos, sin tocar administración ni configuración.',
    rolBase: RolSistema.SUPERVISOR,
    permisos: [
      'panel.ver',
      'reportes.ver',
      'comercial.ver',
      'crm.ver',
      'registros.ver',
      'costos.ver',
      'produccion.gestionar',
      'inventario.gestionar',
      'finanzas.ver_margenes',
    ],
  },
  {
    codigo: 'vendedor',
    nombre: 'Vendedor',
    descripcion:
      'Cotiza y sigue sus trabajos. NO ve costos ni márgenes: cotiza sobre el precio, no sobre la ganancia.',
    rolBase: RolSistema.SUPERVISOR,
    permisos: [
      'panel.ver',
      'reportes.ver',
      'comercial.gestionar',
      'crm.gestionar',
      'registros.gestionar',
      'produccion.ver',
      // Cierra la venta con la seña en la mano: sin esto, los cobros que carga
      // en la ficha fallaban al emitir la orden.
      'administracion.cobrar',
    ],
  },
  {
    codigo: 'administrativo',
    nombre: 'Administrativo',
    descripcion:
      'Cobros, comprobantes y cuentas corrientes. Ve lo comercial pero no lo edita.',
    rolBase: RolSistema.SUPERVISOR,
    permisos: [
      'panel.ver',
      'reportes.ver',
      'comercial.ver',
      'crm.ver',
      'registros.ver',
      'produccion.ver',
      'administracion.gestionar',
      'finanzas.ver_margenes',
      // Quien maneja los cobros es quien corrige un cobro mal cargado.
      'administracion.anular',
      // ...y quien corrige el CUIT o carga un medio de pago nuevo, sin que eso
      // le abra Usuarios.
      'administracion.configurar',
    ],
  },
  {
    codigo: 'operario',
    nombre: 'Operario',
    descripcion:
      'Ve el tablero y ejecuta los pasos de sus estaciones. No ve precios, costos ni márgenes.',
    rolBase: RolSistema.OPERADOR,
    permisos: ['panel.ver', 'produccion.ver', 'produccion.ejecutar'],
  },
];

export const POR_CODIGO_ROL = new Map(
  ROLES_PREDEFINIDOS.map((r) => [r.codigo, r]),
);

/**
 * Permisos de un rol del enum, para las membresías que todavía no tienen
 * `rolId` (y para la impersonación del control plane, que no tiene membership).
 *
 * Es el fallback de la transición, no el camino: en cuanto el backfill corre,
 * toda membership apunta a un `Rol` de verdad.
 */
export function permisosDeRolBase(rol: RolSistema): PermisoClave[] {
  if (rol === RolSistema.ADMINISTRADOR) return todosLosPermisos();
  if (rol === RolSistema.SUPERVISOR) {
    return POR_CODIGO_ROL.get('jefe_produccion')!.permisos;
  }
  return POR_CODIGO_ROL.get('operario')!.permisos;
}
