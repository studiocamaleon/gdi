import { CapacidadesEmpresaService } from '../capacidades-empresa.service';
import { contratoCompatible } from '../evaluador-capacidades';
import { resolverAccesoEmpresa } from '../acceso-empresa';
import type { ClaveCapacidad } from '../evaluador-capacidades';
import type { CurrentAuth } from '../../auth/auth.types';
import { RecetasProductoService } from '../../productos-servicios/recetas-producto.service';
import { ClientesService } from '../../clientes/clientes.service';
import { EmpleadosService } from '../../empleados/empleados.service';
import { InventarioService } from '../../inventario/inventario.service';
import { InventarioBibliotecaService } from '../../inventario/inventario-biblioteca.service';
import { MaquinariaService } from '../../maquinaria/maquinaria.service';
import { CostosCatalogoService } from '../../costos/costos-catalogo.service';
import { CostosConfiguracionPeriodoService } from '../../costos/costos-configuracion-periodo.service';
import { CostosTarifasService } from '../../costos/costos-tarifas.service';
import { ProductosService } from '../../productos-servicios/productos.service';
import { RutasProduccionService } from '../../productos-servicios/rutas-produccion.service';
import { ProductoRutasService } from '../../productos-servicios/producto-rutas.service';
import { ConfigPasosService } from '../../productos-servicios/config-pasos.service';
import { PasosTenantService } from '../../productos-servicios/pasos-tenant.service';
import { CargosDirectosProductoService } from '../../productos-servicios/cargos-directos-producto.service';
import { ImpuestosCatalogoService } from '../../productos-servicios/precio/catalogos/impuestos-catalogo.service';
import { ComisionesCatalogoService } from '../../productos-servicios/precio/catalogos/comisiones-catalogo.service';
import { PrecioAplicacionesService } from '../../productos-servicios/precio/aplicaciones/precio-aplicaciones.service';
import { TipoCambioService } from '../../cotizaciones/tipo-cambio.service';

const auth = { tenantId: 'empresa', userId: 'usuario' } as CurrentAuth;
function capacidades(excluidas: string[]) {
  const caps = new CapacidadesEmpresaService({} as never);
  const contrato = contratoCompatible(null);
  for (const clave of excluidas)
    contrato.funciones[clave as ClaveCapacidad] = false;
  jest.spyOn(caps, 'actual').mockResolvedValue({
    empresa: { id: 'empresa', nombre: 'Prueba' },
    contrato,
    acceso: resolverAccesoEmpresa(true, null),
    almacenamientoAjustadoBytes: null,
  });
  return caps;
}
// No se proveen delegates de escritura: estas operaciones deben denegarse
// antes de abrir transacciones, importar filas, publicar tarifas o modificar referencias.
const entradas = [
  {
    claves: ['clientes'],
    nombre: 'ClientesService',
    crear: (caps: CapacidadesEmpresaService) =>
      new ClientesService({} as never, caps),
    metodos: [
      'create',
      'importar',
      'altaPorDocumento',
      'update',
      'remove',
      'fijarActivo',
    ],
    primerArgumento: auth,
  },
  {
    claves: ['empleados'],
    nombre: 'EmpleadosService',
    crear: (caps: CapacidadesEmpresaService) =>
      new EmpleadosService({} as never, {} as never, caps),
    metodos: [
      'create',
      'importar',
      'update',
      'remove',
      'fijarActivo',
      'fijarEstadoMuchos',
    ],
    primerArgumento: auth,
  },
  {
    claves: ['materiales'],
    nombre: 'InventarioService',
    crear: (caps: CapacidadesEmpresaService) =>
      new InventarioService({} as never, {} as never, caps),
    metodos: [
      'createMateriaPrima',
      'updateMateriaPrima',
      'toggleMateriaPrima',
      'updateVariantePrecioReferencia',
      'bulkUpdateCostos',
    ],
    primerArgumento: auth,
  },
  {
    claves: ['materiales'],
    nombre: 'InventarioBibliotecaService',
    crear: (caps: CapacidadesEmpresaService) =>
      new InventarioBibliotecaService({} as never, caps),
    metodos: ['instalar'],
    primerArgumento: auth,
  },
  {
    claves: ['maquinaria'],
    nombre: 'MaquinariaService',
    crear: (caps: CapacidadesEmpresaService) =>
      new MaquinariaService({} as never, caps),
    metodos: ['create', 'update', 'toggle', 'setActivo'],
    primerArgumento: auth,
  },
  {
    claves: ['centros_costo'],
    nombre: 'CostosCatalogoService',
    crear: (caps: CapacidadesEmpresaService) =>
      new CostosCatalogoService({} as never, {} as never, {} as never, caps),
    metodos: [
      'createPlanta',
      'updatePlanta',
      'togglePlanta',
      'createCentro',
      'updateCentro',
      'toggleCentro',
      'eliminarCentro',
    ],
    primerArgumento: auth,
  },
  {
    claves: ['centros_costo'],
    nombre: 'CostosConfiguracionPeriodoService',
    crear: (caps: CapacidadesEmpresaService) =>
      new CostosConfiguracionPeriodoService(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        caps,
      ),
    metodos: [
      'guardarCentroPlanilla',
      'toggleCentro',
      'replaceCentroLineas',
      'upsertCentroCapacidad',
    ],
    primerArgumento: auth,
  },
  {
    claves: ['centros_costo'],
    nombre: 'CostosTarifasService',
    crear: (caps: CapacidadesEmpresaService) =>
      new CostosTarifasService(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        caps,
      ),
    metodos: [
      'calcularTarifaCentro',
      'publicarTarifaCentro',
      'recalcularYPublicarPeriodo',
      'recalcularYPublicarPeriodoEnTx',
    ],
    primerArgumento: auth,
  },
  {
    claves: ['productos'],
    nombre: 'ProductosService',
    crear: (caps: CapacidadesEmpresaService) =>
      new ProductosService({} as never, caps),
    metodos: [
      'crearProducto',
      'actualizarProducto',
      'duplicarProducto',
      'eliminarProducto',
    ],
    primerArgumento: auth.tenantId,
  },
  {
    claves: ['procesos'],
    nombre: 'RutasProduccionService',
    crear: (caps: CapacidadesEmpresaService) =>
      new RutasProduccionService({} as never, {} as never, caps),
    metodos: [
      'crearRuta',
      'actualizarRuta',
      'duplicarRuta',
      'migrarProductosAVersionActual',
      'eliminarRuta',
    ],
    primerArgumento: auth.tenantId,
  },
  {
    claves: ['productos', 'procesos'],
    nombre: 'ProductoRutasService',
    crear: (caps: CapacidadesEmpresaService) =>
      new ProductoRutasService({} as never, {} as never, caps),
    metodos: [
      'crearProductoRutaAlternativa',
      'actualizarProductoRutaAlternativa',
      'reordenarPasosRutaAlternativa',
      'duplicarProductoRutaAlternativa',
      'eliminarProductoRutaAlternativa',
    ],
    primerArgumento: auth.tenantId,
  },
  {
    claves: ['productos', 'procesos'],
    nombre: 'ConfigPasosService',
    crear: (caps: CapacidadesEmpresaService) =>
      new ConfigPasosService({} as never, {} as never, caps),
    metodos: ['upsertConfigPaso'],
    primerArgumento: auth.tenantId,
  },
  {
    claves: ['procesos'],
    nombre: 'PasosTenantService',
    crear: (caps: CapacidadesEmpresaService) =>
      new PasosTenantService({} as never, {} as never, caps),
    metodos: [
      'crear',
      'actualizar',
      'actualizarConfiguracionBase',
      'actualizarConfiguracionBaseSistema',
      'eliminar',
    ],
    primerArgumento: auth.tenantId,
  },
  {
    claves: ['reglas_precio'],
    nombre: 'CargosDirectosProductoService',
    crear: (caps: CapacidadesEmpresaService) =>
      new CargosDirectosProductoService({} as never, {} as never, caps),
    metodos: [
      'crearCargoDirecto',
      'actualizarCargoDirecto',
      'eliminarCargoDirecto',
      'asociarCargoCotizacion',
      'actualizarCargoCotizacion',
      'desasociarCargoCotizacion',
      'asociarCargoPaso',
      'actualizarCargoPaso',
      'desasociarCargoPaso',
      'distribuirCargoPasoPorNiveles',
    ],
    primerArgumento: auth.tenantId,
  },
  {
    claves: ['productos', 'procesos'],
    nombre: 'CargosDirectosProductoService',
    crear: (caps: CapacidadesEmpresaService) =>
      new CargosDirectosProductoService({} as never, {} as never, caps),
    metodos: ['agregarPasoExtra', 'actualizarPasoExtra', 'eliminarPasoExtra'],
    primerArgumento: auth.tenantId,
  },
  {
    claves: ['reglas_precio'],
    nombre: 'ImpuestosCatalogoService',
    crear: (caps: CapacidadesEmpresaService) =>
      new ImpuestosCatalogoService({} as never, caps),
    metodos: ['crear', 'actualizar', 'eliminar'],
    primerArgumento: auth.tenantId,
  },
  {
    claves: ['reglas_precio'],
    nombre: 'ComisionesCatalogoService',
    crear: (caps: CapacidadesEmpresaService) =>
      new ComisionesCatalogoService({} as never, caps),
    metodos: ['crear', 'actualizar', 'eliminar'],
    primerArgumento: auth.tenantId,
  },
  {
    claves: ['productos', 'reglas_precio'],
    nombre: 'PrecioAplicacionesService',
    crear: (caps: CapacidadesEmpresaService) =>
      new PrecioAplicacionesService({} as never, caps),
    metodos: [
      'setImpuestos',
      'setComisiones',
      'quitarImpuesto',
      'quitarComision',
      'setCategoriaFiscal',
    ],
    primerArgumento: auth.tenantId,
  },
  {
    claves: ['reglas_precio'],
    nombre: 'TipoCambioService',
    crear: (caps: CapacidadesEmpresaService) =>
      new TipoCambioService({} as never, {} as never, caps),
    metodos: ['guardarConfiguracion'],
    primerArgumento: auth.tenantId,
  },
];
describe('Configuración de catálogos por plan', () => {
  for (const entrada of entradas)
    for (const clave of entrada.claves) {
      it(
        entrada.nombre + ': deniega mutaciones si falta ' + clave,
        async () => {
          const service = entrada.crear(
            capacidades([clave]),
          ) as unknown as Record<
            string,
            (...args: unknown[]) => Promise<unknown>
          >;
          for (const metodo of entrada.metodos) {
            await expect(
              service[metodo](entrada.primerArgumento, {}, {}, {}),
            ).rejects.toMatchObject({
              status: 403,
              response: { capacidad: clave },
            });
          }
        },
      );
    }
  it('el alta de un compuesto y su clonación no eluden la capacidad de composición', async () => {
    const caps = capacidades(['productos_compuestos']);
    const service = new ProductosService(
      {
        producto: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ estructuraProducto: 'COMPUESTO' }),
        },
      } as never,
      caps,
    );
    await expect(
      service.crearProducto(auth.tenantId, {
        estructuraProducto: 'COMPUESTO',
      } as never),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.duplicarProducto(auth.tenantId, 'producto', {}),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.actualizarProducto(auth.tenantId, 'producto', {
        estructuraProducto: 'SIMPLE',
      } as never),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('cambiar el precio por el PATCH general del producto también exige reglas de precio', async () => {
    const caps = capacidades(['reglas_precio']);
    const service = new ProductosService(
      {
        producto: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ precioConfigJson: { margen: 10 } }),
        },
      } as never,
      caps,
    );
    await expect(
      service.actualizarProducto(auth.tenantId, 'producto', {
        precioConfigJson: { margen: 20 },
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: { capacidad: 'reglas_precio' },
    });
  });
  it('el editor explícito de recetas se deniega antes de publicar también sus componentes', async () => {
    const service = new RecetasProductoService(
      {
        producto: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ estructuraProducto: 'COMPUESTO' }),
        },
        productoRecetaRevision: {
          findFirst: jest
            .fn()
            .mockResolvedValue({
              receta: { productoId: 'producto' },
              _count: { componentes: 1 },
            }),
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      undefined,
      capacidades(['productos_compuestos']),
    );
    for (const ejecutar of [
      () =>
        service.guardarConPublicacionAutomatica(auth, 'producto', {} as never),
      () => service.guardarBorrador(auth, 'producto', {} as never),
      () => service.publicar(auth, 'revision', {} as never),
      () => service.descartarBorrador(auth, 'revision', {} as never),
      () => service.deprecar(auth, 'revision', {} as never),
    ])
      await expect(ejecutar()).rejects.toMatchObject({ status: 403 });
  });
  it('los impuestos guardados siguen disponibles para calcular sin abrir su configuración', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ id: 'iva', porcentaje: 21 }]);
    const service = new ImpuestosCatalogoService(
      { productoImpuestoCatalogo: { findMany } } as never,
      capacidades(['reglas_precio']),
    );
    await expect(service.listar(auth.tenantId)).resolves.toEqual([
      { id: 'iva', porcentaje: 21 },
    ]);
    const consulta: unknown = findMany.mock.calls[0]?.[0];
    expect(consulta).toMatchObject({ where: { tenantId: auth.tenantId } });
  });
});
