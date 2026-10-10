import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { PermisosGuard } from '../permisos.guard';
import { RolesGuard } from '../roles.guard';
import { expandir } from '../permisos';
import { MargenesInterceptor } from '../margenes.interceptor';
import { AdministracionController } from '../../administracion/administracion.controller';
import { PresupuestosController } from '../../presupuestos/presupuestos.controller';
import { ProduccionController } from '../../produccion/produccion.controller';
import { OrdenesTrabajoController } from '../../ordenes-trabajo/ordenes-trabajo.controller';
import { MetaInboxController } from '../../integraciones/meta/meta-inbox.controller';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { EmpleadosController } from '../../empleados/empleados.controller';
import { ReportesController } from '../../reportes/reportes.controller';
import { SolicitudesAltaController } from '../../clientes/solicitudes-alta.controller';

type Controlador = { prototype: object };
type Caso = { vista?: string; rutas: [Controlador, string][] };
const recorridos: Record<string, Caso> = {
  'crm.aprobar_altas': {
    rutas: ['enlace', 'habilitar', 'renovar', 'deshabilitar', 'listar', 'detalle', 'decidir'].map((m) => [SolicitudesAltaController, m]),
  },
  'tesoreria.arquear': {
    vista: 'administracion.tesoreria.ver',
    rutas: [[AdministracionController, 'arqueo']],
  },
  'tesoreria.transferir': {
    vista: 'administracion.tesoreria.ver',
    rutas: [[AdministracionController, 'transferir']],
  },
  'inbox.atender': {
    rutas: [
      'consultar',
      'stream',
      'asignar',
      'nota',
      'estado',
      'lectura',
      'abrirAdjunto',
      'enviarTexto',
      'iniciarCarga',
      'cancelarCarga',
      'enviarMedio',
      'plantillas',
      'enviarPlantilla',
    ].map((m) => [MetaInboxController, m]),
  },
  'finanzas.ver_margenes': {
    vista: 'reportes.finanzas.ver',
    rutas: [[ReportesController, 'finanzas']],
  },
  'comercial.aprobar_descuento': {
    vista: 'comercial.presupuestos.ver',
    rutas: [[PresupuestosController, 'resolverAprobacion']],
  },
  'administracion.anular': {
    vista: 'administracion.cobrar.ver',
    rutas: [[AdministracionController, 'anularCobro']],
  },
  'administracion.cobrar': {
    rutas: [
      'crearCobro',
      'findAllMetodos',
      'listarCuentas',
      'pdfRecibo',
      'enlaceRecibo',
    ].map((m) => [AdministracionController, m]),
  },
  // Además de esta lectura, el servicio poda comisiones y exige el extra al guardarlas.
  'registros.ver_comisiones': {
    vista: 'registros.empleados.gestionar',
    rutas: [
      [EmpleadosController, 'findOne'],
      [EmpleadosController, 'update'],
    ],
  },
  'produccion.ejecutar': {
    vista: 'produccion.estaciones.ver',
    rutas: ['mesaPaso', 'autoPausa', 'accionPaso'].map((m) => [
      OrdenesTrabajoController,
      m,
    ]),
  },
  'produccion.supervisar': {
    vista: 'produccion.estaciones.ver',
    rutas: ['resolverGatePaso', 'avanzarCompra', 'accionPaso'].map((m) => [
      OrdenesTrabajoController,
      m,
    ]),
  },
  'produccion.configurar': {
    vista: 'produccion.estaciones.ver',
    rutas: [
      'recursosEstaciones',
      'createEstacion',
      'updateEstacion',
      'deleteEstacion',
      'actualizarConfiguracion',
      'crearDiaNoLaborable',
      'eliminarDiaNoLaborable',
    ].map((m) => [ProduccionController, m]),
  },
};
function contexto(
  c: Controlador,
  metodo: string,
  permisos: string[],
): ExecutionContext {
  const handler = (c.prototype as Record<string, object>)[metodo];
  expect(handler).toBeDefined();
  return {
    getClass: () => c,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        auth: {
          tenantId: 'empresa-ficticia',
          role: 'OPERADOR',
          permisos: expandir(['acceso.por_vista', ...permisos]),
        },
      }),
    }),
  } as ExecutionContext;
}
function acceso(c: Controlador, m: string, permisos: string[]) {
  const ctx = contexto(c, m, permisos),
    reflector = new Reflector();
  return (
    new RolesGuard(reflector).canActivate(ctx) &&
    new PermisosGuard(reflector).canActivate(ctx)
  );
}
describe('Todos los permisos de Aparte de los módulos', () => {
  it('incluye exactamente las opciones que recibe el editor, sin confundir permisos históricos retirados', async () => {
    const catalogo = await UsuariosService.prototype.catalogo.call(
      { suscripciones: { feature: async () => true } } as never,
      { tenantId: 'empresa-ficticia' } as never,
    );
    expect(catalogo.transversales.map((p) => p.clave).sort()).toEqual(
      Object.keys(recorridos).sort(),
    );
  });
  it.each(Object.entries(recorridos))(
    '%s permite su recorrido delegado sin depender del enum del rol',
    (permiso, caso) => {
      for (const [c, m] of caso.rutas)
        expect(
          acceso(c, m, [permiso, ...(caso.vista ? [caso.vista] : [])]),
        ).toBe(true);
    },
  );
  it.each(
    Object.entries(recorridos).filter(
      ([p]) => p !== 'registros.ver_comisiones',
    ),
  )('%s no concede su acción al quitar el permiso', (_permiso, caso) => {
    // Métodos y recibos pueden leerse por otros accesos; aquí sólo se concede la vista mínima.
    for (const [c, m] of caso.rutas)
      expect(() => acceso(c, m, caso.vista ? [caso.vista] : [])).toThrow(
        ForbiddenException,
      );
  });
  it.each(Object.entries(recorridos).filter(([, c]) => c.vista))(
    '%s no reemplaza el acceso a su vista',
    (permiso, caso) => {
      for (const [c, m] of caso.rutas)
        expect(() => acceso(c, m, [permiso])).toThrow(ForbiddenException);
    },
  );
  it.each(['produccion.ejecutar', 'produccion.supervisar'])(
    '%s funciona también al operar desde Colas',
    (p) => {
      expect(
        acceso(OrdenesTrabajoController, 'accionPaso', [
          p,
          'produccion.colas.ver',
        ]),
      ).toBe(true);
    },
  );
  it('anular una factura exige su vista fiscal, además del permiso transversal', () => {
    expect(
      acceso(AdministracionController, 'notaCreditoOrden', [
        'administracion.anular',
        'administracion.facturacion.ver',
      ]),
    ).toBe(true);
    expect(() =>
      acceso(AdministracionController, 'notaCreditoOrden', [
        'administracion.anular',
        'administracion.cobrar.ver',
      ]),
    ).toThrow(ForbiddenException);
    expect(() =>
      acceso(AdministracionController, 'notaCreditoOrden', [
        'administracion.facturacion.ver',
      ]),
    ).toThrow(ForbiddenException);
  });
  it('el cobrador de mostrador obtiene las consultas de una OT y no abre otros módulos', () => {
    const permisos = ['administracion.cobrar', 'comercial.ordenes.gestionar'];
    for (const [c, m] of [
      [OrdenesTrabajoController, 'findOne'],
      [AdministracionController, 'cobros'],
      ...recorridos['administracion.cobrar'].rutas,
    ] as [Controlador, string][])
      expect(acceso(c, m, permisos)).toBe(true);
    for (const m of [
      'deudores',
      'resumenTesoreria',
      'facturarOrden',
      'createMetodo',
      'anularCobro',
    ])
      expect(() => acceso(AdministracionController, m, permisos)).toThrow(
        ForbiddenException,
      );
  });
  it.each([false, true])(
    'el dato de costos respeta el permiso, sin ocultar el precio de venta: %s',
    async (habilitado) => {
      const ctx = contexto(OrdenesTrabajoController, 'findOne', [
        'comercial.ordenes.ver',
        ...(habilitado ? ['finanzas.ver_margenes'] : []),
      ]);
      const resultado = await lastValueFrom(
        new MargenesInterceptor(new Reflector()).intercept(ctx, {
          handle: () => of({ total: 121, costoTotal: 50 }),
        }),
      );
      expect(resultado).toEqual(
        habilitado ? { total: 121, costoTotal: 50 } : { total: 121 },
      );
    },
  );
});
