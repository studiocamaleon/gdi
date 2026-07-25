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
  {
    clave: 'panel',
    label: 'Panel general',
    descripcion: 'Métricas del negocio, ventas y producción.',
  },
  {
    clave: 'comercial',
    label: 'Comercial',
    descripcion: 'Crear órdenes, presupuestos y órdenes de trabajo.',
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
 * cotizador (Comercial), en el desglose de la orden (Producción), en el panel y
 * en los reportes. Derivarlo de "acceso a Costos" no alcanza: el vendedor tiene
 * que poder cotizar sin ver cuánto gana la imprenta en cada renglón.
 */
export const PERMISOS_TRANSVERSALES = [
  {
    clave: 'finanzas.ver_margenes',
    label: 'Ver costos y márgenes',
    descripcion:
      'Costos unitarios, contribución, márgenes y precios de compra, en cualquier pantalla donde aparezcan.',
  },
] as const;

export type PermisoTransversal = (typeof PERMISOS_TRANSVERSALES)[number]['clave'];

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
      'comercial.ver',
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
      'comercial.gestionar',
      'registros.gestionar',
      'produccion.ver',
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
      'comercial.ver',
      'registros.ver',
      'administracion.gestionar',
      'finanzas.ver_margenes',
    ],
  },
  {
    codigo: 'operario',
    nombre: 'Operario',
    descripcion:
      'La mesa de trabajo y su propio desempeño. No ve precios, costos ni clientes.',
    rolBase: RolSistema.OPERADOR,
    // `gestionar` y no `ver`: el operario no mira producción, la ejecuta —
    // reclama pasos en la mesa, los inicia y los completa. Lo que lo acota no
    // es el permiso sino el tablero, que sólo le deja tocar el paso activo.
    permisos: ['produccion.gestionar'],
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
