import { ProveedoresService } from '../../proveedores/proveedores.service';
import { EmpleadosService } from '../../empleados/empleados.service';
import { MaquinariaService } from '../../maquinaria/maquinaria.service';
import { InventarioService } from '../../inventario/inventario.service';
import { EgresosController } from '../../egresos/egresos.controller';
import { InventarioController } from '../../inventario/inventario.controller';
import { EtaController } from '../../eta/eta.controller';
import { ProductosService } from '../../productos-servicios/productos.service';
import { ListMateriasPrimasQueryDto } from '../../inventario/dto/list-materias-primas-query.dto';
import type { CurrentAuth } from '../auth.types';
import { expandir } from '../permisos';
import { PaginationDto } from '../../common/dto/pagination.dto';
const auth = (...permisos: string[]) =>
  ({
    tenantId: 'empresa-ficticia',
    permisos: expandir(['acceso.por_vista', ...permisos]),
  }) as CurrentAuth;
it('los selectores de campañas/usuarios no consultan legajos ni remuneraciones', async () => {
  const findMany = jest.fn(async () => []);
  await EmpleadosService.prototype.opciones.call(
    { prisma: { empleado: { findMany } } } as never,
    auth('comercial.campanas.ver'),
  );
  expect(findMany).toHaveBeenCalledWith({
    where: { tenantId: 'empresa-ficticia', activo: true },
    select: { id: true, nombreCompleto: true, sector: true, ocupacion: true },
    orderBy: { nombreCompleto: 'asc' },
  });
});
it('el selector de compatibilidad no consulta costos ni historial de máquinas', async () => {
  const findMany = jest.fn(async () => []);
  await MaquinariaService.prototype.opciones.call(
    { prisma: { maquina: { findMany } } } as never,
    auth('inventario.materiales.ver'),
  );
  expect(findMany).toHaveBeenCalledWith({
    where: { tenantId: 'empresa-ficticia', activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });
});
it.each([
  'inventario.materiales.ver',
  'costos.catalogo.ver',
  'administracion.gastos.ver',
])(
  '%s no consulta cuentas bancarias en el selector de proveedores',
  async (permiso) => {
    const findMany = jest.fn(async (_q: unknown) => []);
    await new ProveedoresService({ proveedor: { findMany } } as never).opciones(
      auth(permiso),
    );
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { tenantId: 'empresa-ficticia' },
      select: { cbuAlias: false },
    });
  },
);
it('Stock y Kardex consultan unidades y variantes sin proveedores ni datos administrativos', async () => {
  const findMany = jest.fn(async (_q: unknown) => []);
  const service = new InventarioService({
    $transaction: (q: unknown[]) => Promise.all(q),
    materiaPrima: { findMany, count: async () => 0 },
  } as never);
  await service.opcionesStock(
    auth('inventario.stock.ver'),
    new PaginationDto(),
  );
  const query = findMany.mock.calls[0][0] as {
    where: unknown;
    select: { variantes: { select: object } };
  };
  expect(query.where).toEqual({ tenantId: 'empresa-ficticia' });
  expect(query.select.variantes.select).not.toHaveProperty(
    'proveedorReferencia',
  );
  expect(query.select.variantes.select).not.toHaveProperty(
    'proveedorReferenciaId',
  );
  expect(query.select).not.toHaveProperty('atributosTecnicosJson');
});
it.each([undefined, 'false', 'true'])(
  'Cuentas por pagar fuerza pendientes aunque se altere el filtro %s',
  async (filtro) => {
    const listar = jest.fn(async () => []);
    const c = new EgresosController({ listar } as never, {} as never);
    const a = auth('administracion.pagar.ver');
    await c.listar(
      a,
      'pagado',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      filtro,
    );
    expect(listar).toHaveBeenCalledWith(
      a,
      expect.objectContaining({ soloPendientes: 'true' }),
    );
  },
);

it('el selector de materiales de maquinaria no entrega la identidad del proveedor', async () => {
  const findAllMateriasPrimas = jest.fn(async () => ({
    data: [
      {
        id: 'material-ficticio',
        variantes: [
          {
            id: 'variante-ficticia',
            precioReferencia: 25,
            proveedorReferenciaId: 'proveedor-ficticio',
            proveedorReferenciaNombre: 'Proveedor ficticio',
          },
        ],
      },
    ],
    total: 1,
    page: 1,
    pages: 1,
    limit: 20,
  }));
  const c = new InventarioController(
    { findAllMateriasPrimas } as never,
    {} as never,
  );
  const resultado = await c.opcionesMaquinaria(
    auth('costos.maquinaria.ver'),
    new ListMateriasPrimasQueryDto(),
  );
  expect(resultado.data[0].variantes[0]).toEqual({
    id: 'variante-ficticia',
    precioReferencia: 25,
  });
});

it.each(['comercial.presupuestos.ver', 'comercial.ordenes.ver'])(
  '%s estima fechas sin identificar los trabajos de planificación',
  async (permiso) => {
    const contextoSimulacion = jest.fn(async () => ({
      items: [
        {
          id: 'item-ficticio',
          nombre: 'Trabajo de prueba',
          ordenNumero: 'OT-PRUEBA',
        },
      ],
      ahora: new Date('2026-10-02T12:00:00Z'),
      medianas: new Map(),
      noLaborables: new Set(),
    }));
    const c = new EtaController({ contextoSimulacion } as never);
    const resultado = await c.contextoPrevision(auth(permiso));
    expect(contextoSimulacion).toHaveBeenCalledWith('empresa-ficticia');
    expect(resultado.items[0]).toMatchObject({
      nombre: 'Trabajo programado',
      ordenNumero: '',
    });
    const planificacion = await c.contextoPrevision(
      auth('produccion.planificacion.ver'),
    );
    expect(planificacion.items[0]).toMatchObject({
      nombre: 'Trabajo de prueba',
      ordenNumero: 'OT-PRUEBA',
    });
  },
);

it('el catálogo sólo reutiliza originales de producto, no diseños de cotizaciones', async () => {
  const findMany = jest.fn(async (_q: unknown) => []);
  const service = new ProductosService({ geometriaProducto: { findMany } } as never);
  const atributos = { geometriasComerciales: { version: 1, modo: 'VECTORIAL', fuentes: [{
    id: 'principal', nombre: 'Pieza', requerida: true,
    predeterminada: { procedencia: { geometriaId: 'geometria-ficticia' } },
  }] } };
  await expect(service['hidratarGeometrias']('empresa-ficticia', atributos)).rejects.toThrow('no pertenece');
  expect(findMany).toHaveBeenCalledWith({ where: {
    tenantId: 'empresa-ficticia', id: { in: ['geometria-ficticia'] }, archivo: { scope: 'PRODUCTO' },
  } });
});
