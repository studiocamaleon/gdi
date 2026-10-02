import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISO_KEY } from '../permiso.decorator';
import { PermisosGuard } from '../permisos.guard';
import { RolesGuard } from '../roles.guard';
import { expandir } from '../permisos';
import { VISTAS, type VistaClave } from '../vistas';
import { AdministracionController } from '../../administracion/administracion.controller';
import { ArchivosController } from '../../archivos/archivos.controller';
import { CampanasController } from '../../campanas/campanas.controller';
import { CentroCopiadoController } from '../../centro-copiado/centro-copiado.controller';
import { ClientesController } from '../../clientes/clientes.controller';
import { ColasProduccionController } from '../../produccion/colas/colas.controller';
import { ComisionesCatalogoController } from '../../productos-servicios/precio/catalogos/comisiones-catalogo.controller';
import { ComprasController } from '../../compras/compras.controller';
import { CostosController } from '../../costos/costos.controller';
import { CuponesController } from '../../cupones/cupones.controller';
import { EgresosController } from '../../egresos/egresos.controller';
import { EmpleadosController } from '../../empleados/empleados.controller';
import { EtaController } from '../../eta/eta.controller';
import { FidelizacionController } from '../../fidelizacion/fidelizacion.controller';
import { GastosFijosController } from '../../gastos-fijos/gastos-fijos.controller';
import { ImpresionController } from '../../impresion/impresion.controller';
import { ImpuestosCatalogoController } from '../../productos-servicios/precio/catalogos/impuestos-catalogo.controller';
import { IntegracionesController } from '../../integraciones/integraciones.controller';
import { InventarioController } from '../../inventario/inventario.controller';
import { InventarioStockController } from '../../inventario/inventario-stock.controller';
import { MaquinariaController } from '../../maquinaria/maquinaria.controller';
import { OrdenesTrabajoController } from '../../ordenes-trabajo/ordenes-trabajo.controller';
import { PresupuestosController } from '../../presupuestos/presupuestos.controller';
import { ProduccionController } from '../../produccion/produccion.controller';
import { ProductosServiciosController } from '../../productos-servicios/productos-servicios.controller';
import { ProveedoresController } from '../../proveedores/proveedores.controller';
import { ReportesController } from '../../reportes/reportes.controller';
import { SuscripcionController } from '../../suscripciones/suscripcion.controller';
import { TenantsController } from '../../tenants/tenants.controller';
import { UsuariosController } from '../../usuarios/usuarios.controller';

type Controlador = { prototype: object };
type Consulta = [Controlador, string];
/** Contratos de las pantallas: consultas principales y auxiliares indispensables.
 * No sustituye los ensayos HTTP/UI ni concede acceso a fichas hermanas. */
const RECORRIDOS: Record<VistaClave, Consulta[]> = {
  'comercial.presupuestos': [
    [PresupuestosController, 'listado'],
    [ClientesController, 'opciones'],
    [ClientesController, 'porDocumento'],
    [CampanasController, 'opciones'],
    [ProductosServiciosController, 'listarProductosCotizacion'],
    [ProductosServiciosController, 'productoCotizacion'],
    [ProductosServiciosController, 'cargosCotizacion'],
    [ProductosServiciosController, 'listarFamilias'],
    [EtaController, 'contextoPrevision'],
  ],
  'comercial.campanas': [
    [CampanasController, 'listar'],
    [ClientesController, 'opciones'],
    [EmpleadosController, 'opciones'],
  ],
  'comercial.ordenes': [
    [OrdenesTrabajoController, 'findAll'],
    [ClientesController, 'opciones'],
    [ClientesController, 'porDocumento'],
    [CampanasController, 'opciones'],
    [ProductosServiciosController, 'listarProductosCotizacion'],
    [ProductosServiciosController, 'productoCotizacion'],
    [ProductosServiciosController, 'cargosCotizacion'],
    [ProductosServiciosController, 'listarFamilias'],
    [EtaController, 'contextoPrevision'],
    [AdministracionController, 'cobros'],
  ],
  'comercial.copiado': [[CentroCopiadoController, 'estado']],
  'crm.clientes': [[ClientesController, 'findAll']],
  'crm.cupones': [[CuponesController, 'listar']],
  'crm.fidelizacion': [[FidelizacionController, 'resumen']],
  'registros.proveedores': [[ProveedoresController, 'findAll']],
  'registros.empleados': [[EmpleadosController, 'findAll']],
  'costos.centros': [[CostosController, 'findCentros']],
  'costos.maquinaria': [
    [MaquinariaController, 'findAll'],
    [InventarioController, 'opcionesMaquinaria'],
    [CostosController, 'findPlantas'],
    [CostosController, 'findCentros'],
  ],
  'costos.nodos': [
    [ProductosServiciosController, 'listarPasosTenant'],
    [ProductosServiciosController, 'listarFamilias'],
    [ProductosServiciosController, 'listarLookupsConfigPaso'],
    [ProductosServiciosController, 'buscarMateriasPrimas'],
  ],
  'costos.flujos': [
    [ProductosServiciosController, 'listarRutas'],
    [ProductosServiciosController, 'listarFamilias'],
  ],
  'costos.catalogo': [
    [ProductosServiciosController, 'listarProductos'],
    [ProductosServiciosController, 'listarRutas'],
    [ProductosServiciosController, 'listarFamilias'],
    [ProductosServiciosController, 'listarLookupsConfigPaso'],
    [ProductosServiciosController, 'listarCargosDirectos'],
    [ImpuestosCatalogoController, 'listar'],
    [ComisionesCatalogoController, 'listar'],
    [ProveedoresController, 'opciones'],
  ],
  'costos.cargos': [[ProductosServiciosController, 'listarCargosDirectos']],
  'produccion.tablero': [
    [OrdenesTrabajoController, 'tablero'],
    [ProduccionController, 'findEstaciones'],
    [ProduccionController, 'findDuracionesFamilias'],
    [ProduccionController, 'getConfiguracion'],
    [ProduccionController, 'findDiasNoLaborables'],
  ],
  'produccion.planificacion': [
    [OrdenesTrabajoController, 'tablero'],
    [ProduccionController, 'findEstaciones'],
    [ProduccionController, 'findDuracionesFamilias'],
    [ProduccionController, 'getConfiguracion'],
    [ProduccionController, 'findDiasNoLaborables'],
    [EtaController, 'contextoPrevision'],
  ],
  'produccion.colas': [[ColasProduccionController, 'maquinas']],
  'produccion.estaciones': [
    [ProduccionController, 'findEstaciones'],
    [OrdenesTrabajoController, 'tablero'],
    [ProduccionController, 'findDuracionesFamilias'],
    [ProduccionController, 'getConfiguracion'],
    [ProduccionController, 'findDiasNoLaborables'],
  ],
  'administracion.tesoreria': [[AdministracionController, 'resumenTesoreria']],
  'administracion.cobrar': [[AdministracionController, 'deudores']],
  'administracion.pagar': [
    [EgresosController, 'listar'],
    [EgresosController, 'resumen'],
    [EgresosController, 'categorias'],
    [EgresosController, 'saldosPorProveedor'],
    [EgresosController, 'pagosDeEgreso'],
    [ProveedoresController, 'opciones'],
    [AdministracionController, 'findAllMetodos'],
    [AdministracionController, 'listarCuentas'],
  ],
  'administracion.egresos': [
    [EgresosController, 'listar'],
    [EgresosController, 'categorias'],
    [EgresosController, 'pagosDeEgreso'],
    [ProveedoresController, 'opciones'],
    [AdministracionController, 'findAllMetodos'],
    [AdministracionController, 'listarCuentas'],
  ],
  'administracion.gastos': [
    [GastosFijosController, 'listar'],
    [EgresosController, 'listarRecurrentes'],
    [EgresosController, 'categorias'],
    [ProveedoresController, 'opciones'],
  ],
  'administracion.comprobantes': [
    [AdministracionController, 'listarComprobantes'],
  ],
  'administracion.facturacion': [
    [AdministracionController, 'pendientesFacturacion'],
  ],
  'inventario.materiales': [
    [InventarioController, 'findAll'],
    [ProveedoresController, 'opciones'],
    [MaquinariaController, 'opciones'],
  ],
  'inventario.stock': [
    [InventarioStockController, 'getStockPage'],
    [InventarioStockController, 'getAlmacenes'],
    [InventarioController, 'opcionesStock'],
  ],
  'inventario.compras': [[ComprasController, 'listar']],
  'inventario.movimientos': [
    [InventarioStockController, 'getKardex'],
    [InventarioStockController, 'getAlmacenes'],
    [InventarioController, 'opcionesStock'],
  ],
  'reportes.resumen': [[ReportesController, 'resumen']],
  'reportes.comercial': [[ReportesController, 'comercial']],
  'reportes.embudo': [[ReportesController, 'embudo']],
  'reportes.clientes': [[ReportesController, 'clientes']],
  'reportes.produccion': [[ReportesController, 'produccion']],
  'reportes.salud_eta': [[ReportesController, 'saludEta']],
  'reportes.equipo': [[ReportesController, 'equipo']],
  'reportes.finanzas': [[ReportesController, 'finanzas']],
  'reportes.producto': [[ReportesController, 'producto']],
  'configuracion.empresa': [[TenantsController, 'datosEmpresa']],
  'configuracion.usuarios': [
    [UsuariosController, 'listar'],
    [UsuariosController, 'roles'],
    [UsuariosController, 'catalogo'],
    [EmpleadosController, 'opciones'],
    [UsuariosController, 'historial'],
  ],
  'configuracion.fiscal': [
    [AdministracionController, 'obtenerConfiguracionFiscal'],
  ],
  'configuracion.metodos': [
    [AdministracionController, 'findAllMetodos'],
    [AdministracionController, 'listarCuentas'],
  ],
  'configuracion.impuestos': [[ImpuestosCatalogoController, 'listar']],
  'configuracion.comisiones': [[ComisionesCatalogoController, 'listar']],
  'configuracion.copiado': [[CentroCopiadoController, 'getConfig']],
  'configuracion.impresoras': [[ImpresionController, 'configuracionPerfiles']],
  'configuracion.almacenamiento': [[ArchivosController, 'uso']],
  'configuracion.integraciones': [[IntegracionesController, 'listar']],
  'configuracion.suscripcion': [[SuscripcionController, 'estado']],
};
function acceso(controlador: Controlador, metodo: string, permisos: string[]) {
  const handler = (controlador.prototype as Record<string, object>)[metodo];
  expect(handler).toBeDefined();
  const ctx = {
    getClass: () => controlador,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        auth: {
          tenantId: 'empresa-ficticia',
          role: 'OPERADOR',
          permisos: expandir(permisos),
        },
      }),
    }),
  } as ExecutionContext;
  return (
    new RolesGuard(new Reflector()).canActivate(ctx) &&
    new PermisosGuard(new Reflector()).canActivate(ctx)
  );
}
describe('Contrato de permisos de todas las vistas', () => {
  it('incluye cada vista del editor de roles', () => {
    expect(Object.keys(RECORRIDOS).sort()).toEqual(
      VISTAS.map((v) => v.clave).sort(),
    );
  });
  it.each(VISTAS)(
    '$clave puede hacer sus consultas con acceso sólo de lectura',
    (vista) => {
      for (const [controller, metodo] of RECORRIDOS[vista.clave]) {
        expect(() =>
          acceso(controller, metodo, [
            'acceso.por_vista',
            `${vista.clave}.ver`,
            ...vista.extras,
          ]),
        ).not.toThrow();
      }
    },
  );
  it.each(VISTAS)(
    '$clave en sólo lectura no modifica recursos de ninguna vista',
    (vista) => {
      const permisos = [
        'acceso.por_vista',
        `${vista.clave}.ver`,
        ...vista.extras,
      ];
      const clases = new Set(
        Object.values(RECORRIDOS).flatMap((r) => r.map(([c]) => c)),
      );
      let comprobadas = 0;
      for (const clase of clases) {
        for (const metodo of Object.getOwnPropertyNames(clase.prototype)) {
          if (metodo === 'constructor') continue;
          const handler = (clase.prototype as Record<string, object>)[metodo];
          const requeridos = Reflect.getMetadata(PERMISO_KEY, handler) as
            | string[]
            | undefined;
          if (
            !requeridos?.length ||
            !requeridos.every((p) => p.endsWith('.gestionar'))
          )
            continue;
          expect(() => acceso(clase, metodo, permisos)).toThrow(
            ForbiddenException,
          );
          comprobadas++;
        }
      }
      expect(comprobadas).toBeGreaterThan(50);
    },
  );
  it.each([
    [
      'comercial.ordenes.gestionar',
      ProductosServiciosController,
      'obtenerProducto',
    ],
    [
      'comercial.presupuestos.gestionar',
      ProductosServiciosController,
      'listarProductos',
    ],
    ['comercial.campanas.gestionar', EmpleadosController, 'findOne'],
    ['configuracion.usuarios.gestionar', EmpleadosController, 'findOne'],
    ['inventario.materiales.gestionar', MaquinariaController, 'findOne'],
    ['inventario.materiales.gestionar', ProveedoresController, 'findOne'],
    ['inventario.stock.gestionar', InventarioController, 'findOne'],
    ['inventario.movimientos.gestionar', InventarioController, 'update'],
    ['costos.catalogo.gestionar', ProductosServiciosController, 'obtenerRuta'],
    ['administracion.pagar.gestionar', EgresosController, 'crear'],
    ['administracion.egresos.gestionar', EgresosController, 'registrarPago'],
  ] as [string, Controlador, string][])(
    '%s no abre una ficha o acción ajena (%s.%s)',
    (permiso, clase, metodo) => {
      expect(() =>
        acceso(clase, metodo, ['acceso.por_vista', permiso]),
      ).toThrow(ForbiddenException);
    },
  );
});
