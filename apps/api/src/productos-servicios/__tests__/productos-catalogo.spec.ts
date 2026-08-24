/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import { BadRequestException } from '@nestjs/common';
import { OrdenProductosDto } from '../dto/list-productos-query.dto';
import { ProductosService } from '../productos.service';
import { ProductosServiciosService } from '../productos-servicios.service';

describe('Catálogo de productos', () => {
  it('crea productos como borrador aunque el default de Prisma sea activo', async () => {
    const create = jest
      .fn()
      .mockImplementation(({ data }) => ({ id: 'nuevo', ...data }));
    const prisma = {
      productoSubcategoriaComercial: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sub-1', activo: true }),
      },
      producto: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    };
    const service = new ProductosService(prisma as never);

    await service.crearProducto('tenant-1', {
      nombre: 'Producto de prueba',
      subcategoriaComercialCodigo: 'producto_a_medida',
      unidadComercial: 'unidad',
      modoMedidas: 'FIJA',
      medidasPredefinidasJson: [],
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ activo: false }),
      }),
    );
  });

  it('aplica filtros y ordenamiento en el servidor y deriva el estado real', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'p1',
        activo: true,
        precioConfigJson: { metodoCalculo: 'por_margen' },
        rutasAlternativas: [
          {
            rutaVersion: 2,
            ruta: { pasos: [{ id: 'paso-v2', version: 2 }] },
            configPasos: [
              { id: 'c1', rutaPasoId: 'paso-v2', tercerizado: false },
            ],
          },
        ],
      },
    ]);
    const prisma = {
      producto: { findMany, count: jest.fn().mockResolvedValue(1) },
      $transaction: jest
        .fn()
        .mockImplementation((promises) => Promise.all(promises)),
    };
    const service = new ProductosService(prisma as never);

    const result = await service.listarProductos('tenant-1', {
      pagination: { page: 1, limit: 25, skip: 0 } as never,
      unidadComercial: 'm2',
      subcategoriaCodigo: 'vinilos_impresos',
      orden: OrdenProductosDto.nombre_desc,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          unidadComercial: 'm2',
          subcategoriaComercial: { codigo: 'vinilos_impresos' },
        }),
        orderBy: { nombre: 'desc' },
      }),
    );
    expect(result.data[0]).toMatchObject({
      listoParaCotizar: true,
      estadoCatalogo: 'activo',
    });
  });

  it('filtra productos por categoría comercial', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      producto: { findMany, count: jest.fn().mockResolvedValue(0) },
      $transaction: jest
        .fn()
        .mockImplementation((promises) => Promise.all(promises)),
    };
    const service = new ProductosService(prisma as never);

    await service.listarProductos('tenant-1', {
      pagination: { page: 1, limit: 25, skip: 0 } as never,
      categoriaCodigo: 'gran_formato_flexible',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subcategoriaComercial: {
            categoria: { codigo: 'gran_formato_flexible' },
          },
        }),
      }),
    );
  });

  it('bloquea publicación inválida y mantiene el producto como borrador', async () => {
    const actualizarProducto = jest.fn().mockResolvedValue({ id: 'p1' });
    const facade = new ProductosServiciosService(
      { actualizarProducto } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        validarProducto: jest.fn().mockResolvedValue({
          exitoso: false,
          errores: [
            { severidad: 'ERROR', codigo: 'sin_ruta', mensaje: 'Sin ruta' },
          ],
        }),
      } as never,
    );

    await expect(
      facade.actualizarProducto('tenant-1', 'p1', { activo: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(actualizarProducto).toHaveBeenLastCalledWith('tenant-1', 'p1', {
      activo: false,
    });
  });

  it('duplica fiscalidad, tercerización, matrices y asociación de pasos extra', async () => {
    const origen = {
      id: 'original',
      subcategoriaComercialId: 'sub-1',
      codigo: 'ORIGINAL',
      nombre: 'Original',
      descripcion: null,
      unidadComercial: 'unidad',
      modoMedidas: 'FIJA',
      minimoComercialPolitica: 'NONE',
      minimoComercialCantidad: null,
      minimoComercialBase: 'cantidad_comercial',
      medidaDefaultAnchoMm: null,
      medidaDefaultAltoMm: null,
      medidasPredefinidasJson: null,
      personalizacionesJson: null,
      precioConfigJson: { metodoCalculo: 'por_margen' },
      atributosComercialesJson: null,
      categoriaFiscal: 'exento',
      rutasAlternativas: [
        {
          id: 'ruta-original',
          rutaId: 'ruta-base',
          rutaVersion: 1,
          nombre: 'Principal',
          esPreferida: true,
          reglaAutoSeleccionJson: null,
          orden: 0,
          activo: true,
          configPasos: [
            {
              id: 'config-original',
              rutaPasoId: 'paso-1',
              modoActivacion: 'OBLIGATORIO',
              condicionActivacionJson: null,
              modoTiempo: 'T-1',
              mecanismoCantidad: null,
              mecanismoCantidadConfigJson: null,
              multiplicadoresActivos: [],
              paramsPasoJson: null,
              nombreVisible: 'Impresión externa',
              maquinaM1Id: null,
              perfilM1Id: null,
              centroCostoId: null,
              setupOverrideMin: null,
              cleanupOverrideMin: null,
              tiempoFijoOverrideMin: null,
              dotacionOperarios: 1,
              tercerizado: true,
              proveedorId: 'proveedor-1',
              fuenteCostoTercerizado: 'matriz',
              tercerizadoConfigJson: { ejes: [] },
              plazoProveedorDias: 4,
              requiereRutaPasoIds: [],
              activo: true,
              slotsMateriales: [],
              maquinasCandidatas: [],
              cargosDirectosPaso: [],
              tercerizadoEntradas: [
                {
                  valoresJson: { tamaño: 'A4' },
                  claveMatch: 'A4',
                  cantidad: 100,
                  costo: 500,
                  activo: true,
                },
              ],
            },
          ],
        },
      ],
      pasosExtras: [
        {
          rutaAlternativaId: 'ruta-original',
          insertarDespuesDeRutaPasoId: 'paso-1',
          ordenInterno: 1,
          familiaCodigo: 'embalaje',
          nombreVisible: 'Empaque especial',
          modoActivacion: 'OPCIONAL',
          condicionActivacionJson: null,
          modoTiempo: 'T-1',
          mecanismoCantidad: null,
          mecanismoCantidadConfigJson: null,
          multiplicadoresActivos: [],
          setupOverrideMin: 2,
          cleanupOverrideMin: 3,
          tiempoFijoOverrideMin: 4,
          paramsPasoJson: null,
          maquinaM1Id: null,
          perfilM1Id: null,
          centroCostoId: 'cc-1',
          configSlotsMaterialesJson: null,
          configMaquinasCandidatasJson: null,
          configCargosDirectosJson: null,
          activo: true,
        },
      ],
      cargosDirectosCotizacion: [],
      impuestosAplicados: [],
      comisionesAplicadas: [],
      preciosEspecialesClientes: [],
    };
    const productoCreate = jest.fn().mockResolvedValue({ id: 'copia' });
    const configCreate = jest.fn().mockResolvedValue({ id: 'config-copia' });
    const tercerizadoCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const extraCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      producto: { create: productoCreate },
      productoRutaAlternativa: {
        create: jest.fn().mockResolvedValue({ id: 'ruta-copia' }),
      },
      productoConfigPaso: { create: configCreate },
      productoConfigPasoSlotMaterial: { create: jest.fn() },
      productoConfigPasoSlotMaterialCandidato: { create: jest.fn() },
      productoConfigPasoSlotMaterialCandidatoVariante: {
        createMany: jest.fn(),
      },
      productoConfigPasoMaquinaCandidata: { createMany: jest.fn() },
      productoCargoDirectoPaso: { createMany: jest.fn() },
      pasoTercerizadoEntrada: { createMany: tercerizadoCreateMany },
      productoPasoExtra: { createMany: extraCreateMany },
      productoCargoDirectoCotizacion: { createMany: jest.fn() },
      productoImpuestoAplicado: { createMany: jest.fn() },
      productoComisionAplicada: { createMany: jest.fn() },
      productoPrecioEspecialClienteV2: { createMany: jest.fn() },
    };
    const prisma = {
      producto: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(origen)
          .mockResolvedValueOnce(null),
      },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    const service = new ProductosService(prisma as never);

    await service.duplicarProducto('tenant-1', 'original', { nombre: 'Copia' });

    expect(productoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoriaFiscal: 'exento',
          activo: false,
        }),
      }),
    );
    expect(configCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tercerizado: true,
          proveedorId: 'proveedor-1',
          fuenteCostoTercerizado: 'matriz',
          plazoProveedorDias: 4,
        }),
      }),
    );
    expect(tercerizadoCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            productoConfigPasoId: 'config-copia',
            claveMatch: 'A4',
          }),
        ],
      }),
    );
    expect(extraCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            rutaAlternativaId: 'ruta-copia',
            nombreVisible: 'Empaque especial',
            centroCostoId: 'cc-1',
          }),
        ],
      }),
    );
  });
});
