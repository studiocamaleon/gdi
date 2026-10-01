/** Catálogo de vistas. Mantener idéntico al espejo de la otra aplicación. */
export const VISTAS = [
  {
    clave: 'comercial.presupuestos',
    modulo: 'comercial',
    label: 'Presupuestos',
    lecturaAnterior: 'comercial.ver',
    gestionAnterior: 'comercial.gestionar',
    extras: [],
  },
  {
    clave: 'comercial.campanas',
    modulo: 'comercial',
    label: 'Campañas',
    lecturaAnterior: 'comercial.ver',
    gestionAnterior: 'comercial.gestionar',
    extras: [],
  },
  {
    clave: 'comercial.ordenes',
    modulo: 'comercial',
    label: 'Órdenes de trabajo y creación',
    lecturaAnterior: 'comercial.ver',
    gestionAnterior: 'comercial.gestionar',
    extras: [],
  },
  {
    clave: 'comercial.copiado',
    modulo: 'comercial',
    label: 'Centro de Copiado',
    lecturaAnterior: 'comercial.ver',
    gestionAnterior: 'comercial.gestionar',
    extras: [],
  },
  {
    clave: 'crm.clientes',
    modulo: 'crm',
    label: 'Clientes',
    lecturaAnterior: 'crm.ver',
    gestionAnterior: 'crm.gestionar',
    extras: [],
  },
  {
    clave: 'crm.cupones',
    modulo: 'crm',
    label: 'Cupones',
    lecturaAnterior: 'crm.ver',
    gestionAnterior: 'comercial.aprobar_descuento',
    extras: [],
  },
  {
    clave: 'crm.fidelizacion',
    modulo: 'crm',
    label: 'Fidelización',
    lecturaAnterior: 'crm.ver',
    gestionAnterior: 'crm.configurar_fidelizacion',
    extras: [],
  },
  {
    clave: 'registros.proveedores',
    modulo: 'registros',
    label: 'Proveedores',
    lecturaAnterior: 'registros.ver',
    gestionAnterior: 'registros.gestionar',
    extras: [],
  },
  {
    clave: 'registros.empleados',
    modulo: 'registros',
    label: 'Empleados',
    lecturaAnterior: 'registros.ver',
    gestionAnterior: 'registros.gestionar_empleados',
    extras: [],
  },
  {
    clave: 'costos.centros',
    modulo: 'costos',
    label: 'Centros de costo',
    lecturaAnterior: 'costos.ver',
    gestionAnterior: 'costos.gestionar',
    extras: [],
  },
  {
    clave: 'costos.maquinaria',
    modulo: 'costos',
    label: 'Maquinaria',
    lecturaAnterior: 'costos.ver',
    gestionAnterior: 'costos.gestionar',
    extras: [],
  },
  {
    clave: 'costos.nodos',
    modulo: 'costos',
    label: 'Nodos de producción',
    lecturaAnterior: 'costos.ver',
    gestionAnterior: 'costos.gestionar',
    extras: [],
  },
  {
    clave: 'costos.flujos',
    modulo: 'costos',
    label: 'Flujos de producción',
    lecturaAnterior: 'costos.ver',
    gestionAnterior: 'costos.gestionar',
    extras: [],
  },
  {
    clave: 'costos.catalogo',
    modulo: 'costos',
    label: 'Catálogo de productos',
    lecturaAnterior: 'costos.ver',
    gestionAnterior: 'costos.gestionar',
    extras: [],
  },
  {
    clave: 'costos.cargos',
    modulo: 'costos',
    label: 'Cargos directos',
    lecturaAnterior: 'costos.ver',
    gestionAnterior: 'costos.gestionar',
    extras: [],
  },
  {
    clave: 'produccion.tablero',
    modulo: 'produccion',
    label: 'Operación diaria',
    lecturaAnterior: 'produccion.ver',
    gestionAnterior: 'produccion.gestionar',
    extras: [],
  },
  {
    clave: 'produccion.planificacion',
    modulo: 'produccion',
    label: 'Planificación',
    lecturaAnterior: 'produccion.ver',
    gestionAnterior: 'produccion.gestionar',
    extras: [],
  },
  {
    clave: 'produccion.colas',
    modulo: 'produccion',
    label: 'Colas de trabajo',
    lecturaAnterior: 'produccion.ver',
    gestionAnterior: 'produccion.gestionar',
    extras: [],
  },
  {
    clave: 'produccion.estaciones',
    modulo: 'produccion',
    label: 'Estaciones',
    lecturaAnterior: 'produccion.ver',
    gestionAnterior: 'produccion.gestionar',
    extras: [],
  },
  {
    clave: 'administracion.tesoreria',
    modulo: 'administracion',
    label: 'Tesorería',
    lecturaAnterior: 'administracion.ver',
    gestionAnterior: 'administracion.gestionar',
    extras: [],
  },
  {
    clave: 'administracion.cobrar',
    modulo: 'administracion',
    label: 'Cuentas por cobrar',
    lecturaAnterior: 'administracion.ver',
    gestionAnterior: 'administracion.gestionar',
    extras: [],
  },
  {
    clave: 'administracion.pagar',
    modulo: 'administracion',
    label: 'Cuentas por pagar',
    lecturaAnterior: 'administracion.ver',
    gestionAnterior: 'administracion.gestionar',
    extras: [],
  },
  {
    clave: 'administracion.egresos',
    modulo: 'administracion',
    label: 'Registro de egresos',
    lecturaAnterior: 'administracion.ver',
    gestionAnterior: 'administracion.gestionar',
    extras: [],
  },
  {
    clave: 'administracion.gastos',
    modulo: 'administracion',
    label: 'Gastos fijos',
    lecturaAnterior: 'administracion.configurar',
    gestionAnterior: 'administracion.configurar',
    extras: [],
  },
  {
    clave: 'administracion.comprobantes',
    modulo: 'administracion',
    label: 'Comprobantes',
    lecturaAnterior: 'administracion.ver',
    gestionAnterior: 'administracion.gestionar',
    extras: [],
  },
  {
    clave: 'administracion.facturacion',
    modulo: 'administracion',
    label: 'Facturación',
    lecturaAnterior: 'administracion.ver',
    gestionAnterior: 'administracion.gestionar',
    extras: [],
  },
  {
    clave: 'inventario.materiales',
    modulo: 'inventario',
    label: 'Materiales',
    lecturaAnterior: 'inventario.ver',
    gestionAnterior: 'inventario.gestionar',
    extras: [],
  },
  {
    clave: 'inventario.stock',
    modulo: 'inventario',
    label: 'Stock',
    lecturaAnterior: 'inventario.ver',
    gestionAnterior: 'inventario.gestionar',
    extras: [],
  },
  {
    clave: 'inventario.compras',
    modulo: 'inventario',
    label: 'Compras y abastecimiento',
    lecturaAnterior: 'inventario.ver',
    gestionAnterior: 'inventario.gestionar',
    extras: [],
  },
  {
    clave: 'inventario.movimientos',
    modulo: 'inventario',
    label: 'Movimientos',
    lecturaAnterior: 'inventario.ver',
    gestionAnterior: 'inventario.gestionar',
    extras: [],
  },
  {
    clave: 'reportes.resumen',
    modulo: 'reportes',
    label: 'Resumen ejecutivo',
    lecturaAnterior: 'reportes.ver',
    gestionAnterior: null,
    extras: ['reportes.ver_resumen'],
  },
  {
    clave: 'reportes.comercial',
    modulo: 'reportes',
    label: 'Comercial',
    lecturaAnterior: 'reportes.ver',
    gestionAnterior: null,
    extras: [],
  },
  {
    clave: 'reportes.embudo',
    modulo: 'reportes',
    label: 'Embudo',
    lecturaAnterior: 'reportes.ver',
    gestionAnterior: null,
    extras: [],
  },
  {
    clave: 'reportes.clientes',
    modulo: 'reportes',
    label: 'Clientes',
    lecturaAnterior: 'reportes.ver',
    gestionAnterior: null,
    extras: [],
  },
  {
    clave: 'reportes.produccion',
    modulo: 'reportes',
    label: 'Produccion',
    lecturaAnterior: 'reportes.ver',
    gestionAnterior: null,
    extras: [],
  },
  {
    clave: 'reportes.salud_eta',
    modulo: 'reportes',
    label: 'Salud del ETA',
    lecturaAnterior: 'reportes.ver',
    gestionAnterior: null,
    extras: [],
  },
  {
    clave: 'reportes.equipo',
    modulo: 'reportes',
    label: 'Equipo',
    lecturaAnterior: 'reportes.ver',
    gestionAnterior: null,
    extras: [],
  },
  {
    clave: 'reportes.finanzas',
    modulo: 'reportes',
    label: 'Finanzas',
    lecturaAnterior: 'reportes.ver',
    gestionAnterior: null,
    extras: ['finanzas.ver_margenes'],
  },
  {
    clave: 'reportes.producto',
    modulo: 'reportes',
    label: 'Ventas y producto',
    lecturaAnterior: 'reportes.ver',
    gestionAnterior: null,
    extras: [],
  },
  {
    clave: 'configuracion.empresa',
    modulo: 'configuracion',
    label: 'Empresa',
    lecturaAnterior: 'configuracion.ver',
    gestionAnterior: 'configuracion.gestionar',
    extras: [],
  },
  {
    clave: 'configuracion.usuarios',
    modulo: 'configuracion',
    label: 'Usuarios y roles',
    lecturaAnterior: 'configuracion.ver',
    gestionAnterior: 'configuracion.gestionar',
    extras: [],
  },
  {
    clave: 'configuracion.fiscal',
    modulo: 'configuracion',
    label: 'Datos fiscales',
    lecturaAnterior: 'administracion.ver',
    gestionAnterior: 'administracion.gestionar',
    extras: [],
  },
  {
    clave: 'configuracion.metodos',
    modulo: 'configuracion',
    label: 'Métodos de pago',
    lecturaAnterior: 'administracion.ver',
    gestionAnterior: 'administracion.gestionar',
    extras: [],
  },
  {
    clave: 'configuracion.impuestos',
    modulo: 'configuracion',
    label: 'Impuestos',
    lecturaAnterior: 'costos.ver',
    gestionAnterior: 'costos.gestionar',
    extras: [],
  },
  {
    clave: 'configuracion.comisiones',
    modulo: 'configuracion',
    label: 'Comisiones',
    lecturaAnterior: 'costos.ver',
    gestionAnterior: 'costos.gestionar',
    extras: [],
  },
  {
    clave: 'configuracion.copiado',
    modulo: 'configuracion',
    label: 'Configuración del Centro de Copiado',
    lecturaAnterior: 'costos.gestionar',
    gestionAnterior: 'costos.gestionar',
    extras: [],
  },
  {
    clave: 'configuracion.impresoras',
    modulo: 'configuracion',
    label: 'Impresoras',
    lecturaAnterior: 'configuracion.ver',
    gestionAnterior: 'configuracion.gestionar',
    extras: [],
  },
  {
    clave: 'configuracion.almacenamiento',
    modulo: 'configuracion',
    label: 'Almacenamiento',
    lecturaAnterior: 'configuracion.ver',
    gestionAnterior: 'configuracion.gestionar',
    extras: [],
  },
  {
    clave: 'configuracion.integraciones',
    modulo: 'configuracion',
    label: 'Integraciones',
    lecturaAnterior: 'configuracion.ver',
    gestionAnterior: 'configuracion.gestionar',
    extras: [],
  },
  {
    clave: 'configuracion.suscripcion',
    modulo: 'configuracion',
    label: 'Suscripción',
    lecturaAnterior: 'configuracion.ver',
    gestionAnterior: 'configuracion.gestionar',
    extras: [],
  },
] as const;
export type VistaClave = (typeof VISTAS)[number]['clave'];
export type PermisoVista = `${VistaClave}.ver` | `${VistaClave}.gestionar`;

/** Compatibilidad en lectura: nunca modifica filas ni convierte un acceso
 * específico en el permiso global de su sección. */
export function expandirVistas(permisos: Iterable<string>): Set<string> {
  const out = new Set(permisos);
  for (const p of [...out]) {
    if (p.endsWith('.gestionar')) out.add(`${p.slice(0, -10)}.ver`);
  }
  if (
    out.has('administracion.tesoreria.gestionar') ||
    (!out.has('acceso.por_vista') && out.has('administracion.gestionar'))
  ) {
    out.add('tesoreria.arquear');
    out.add('tesoreria.transferir');
  }
  if (!out.has('acceso.por_vista') && out.has('produccion.gestionar')) {
    out.add('produccion.ejecutar');
    out.add('produccion.supervisar');
    out.add('produccion.configurar');
  }
  if (out.has('acceso.por_vista')) return out;
  for (const v of VISTAS) {
    if (out.has(`${v.clave}.gestionar`)) out.add(`${v.clave}.ver`);
    if (out.has(v.lecturaAnterior) && v.extras.every((p) => out.has(p)))
      out.add(`${v.clave}.ver`);
    if (v.gestionAnterior && out.has(v.gestionAnterior)) {
      out.add(`${v.clave}.gestionar`);
      out.add(`${v.clave}.ver`);
    }
  }
  return out;
}
