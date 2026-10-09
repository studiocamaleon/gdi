import { ProductosServiciosController } from '../productos-servicios.controller';
import { OrdenesTrabajoService } from '../../ordenes-trabajo/ordenes-trabajo.service';

const cargo = {
  id: 'cargo-ficticio',
  tenantId: 'empresa-ficticia',
  codigo: 'envio',
  nombre: 'Envío de prueba',
  descripcion: null,
  modoCalculo: 'MONTO_FIJO_PLANO',
  modosActivacionSoportados: ['OPCIONAL'],
  activo: true,
  aplicaMargen: true,
  costoInternoFuturo: 999,
};

async function consultar(configJson: Record<string, unknown>) {
  const listarCargosDirectos = jest
    .fn()
    .mockResolvedValue([{ ...cargo, configJson }]);
  const controller = Object.assign(
    Object.create(ProductosServiciosController.prototype),
    {
      service: { listarCargosDirectos },
    },
  ) as ProductosServiciosController;
  const resultado = await controller.cargosCotizacion({
    auth: {
      tenantId: cargo.tenantId,
      permisos: ['comercial.presupuestos.ver'],
    },
  } as never);
  expect(listarCargosDirectos).toHaveBeenCalledWith(cargo.tenantId, true);
  return resultado;
}

describe('cargos comerciales para órdenes y presupuestos', () => {
  it('conserva zonas y tarifas de venta sin exponer configuración interna', async () => {
    expect(
      await consultar({
        zonas: [
          {
            codigo: 'CENTRO',
            nombre: 'Centro',
            monto: 1500,
            costo: 700,
            proveedorId: 'privado',
          },
        ],
        margen: 30,
        secretoFuturo: 'privado',
      }),
    ).toEqual([
      {
        id: cargo.id,
        codigo: cargo.codigo,
        nombre: cargo.nombre,
        descripcion: null,
        modoCalculo: cargo.modoCalculo,
        modosActivacionSoportados: ['OPCIONAL'],
        activo: true,
        configJson: {
          zonas: [{ codigo: 'CENTRO', nombre: 'Centro', monto: 1500 }],
        },
      },
    ]);
  });

  it.each([
    { monto: 1500 },
    { porcentaje: 5, porcentajeDefault: 3 },
    {
      precioPorUnidad: 50,
      inputCantidad: 'distanciaKm',
      unidad: 'km',
      cantidadDefault: 2,
    },
  ])('conserva los valores comerciales sugeridos %j', async (config) => {
    expect(await consultar(config)).toEqual([
      expect.objectContaining({ configJson: config }),
    ]);
  });

  it('no publica objetos arbitrarios dentro de campos comerciales escalares', async () => {
    expect(
      await consultar({
        monto: { costo: 700 },
        unidad: { secreto: 'privado' },
      }),
    ).toEqual([expect.objectContaining({ configJson: {} })]);
  });

  it('autoriza la zona mostrada y recalcula desde el catálogo aunque alteren el importe', async () => {
    const configJson = {
      zonas: [{ codigo: 'CENTRO', nombre: 'Centro', monto: 1500 }],
    };
    const [publicado] = await consultar(configJson);
    const zona = (publicado.configJson.zonas as Array<{ codigo: string }>)[0];
    const findMany = jest.fn().mockResolvedValue([{ ...cargo, configJson }]);
    const service = Object.assign(
      Object.create(OrdenesTrabajoService.prototype),
      {
        prisma: { cargoDirectoCatalogo: { findMany } },
      },
    );
    const [resultado] = await service.cargosAutorizados(
      cargo.tenantId,
      [
        {
          cargoDirectoCatalogoId: cargo.id,
          configInput: { zonaAplicada: { ...zona, monto: 1 } },
          montoNeto: 1,
        },
      ],
      5000,
      2,
    );
    expect(resultado).toMatchObject({
      montoNeto: 1500,
      impuestoMonto: 315,
      total: 1815,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: cargo.tenantId,
          id: { in: [cargo.id] },
          activo: true,
        },
      }),
    );
  });

  it.each([{}, { zonaAplicada: { codigo: 'INEXISTENTE' } }])(
    'rechaza una zona ausente o inválida aunque el importe coincida: %j',
    async (configInput) => {
      const service = Object.assign(
        Object.create(OrdenesTrabajoService.prototype),
        {
          prisma: {
            cargoDirectoCatalogo: {
              findMany: jest.fn().mockResolvedValue([
                {
                  ...cargo,
                  configJson: { zonas: [{ codigo: 'CENTRO', monto: 1500 }] },
                },
              ]),
            },
          },
        },
      );
      await expect(
        service.cargosAutorizados(
          cargo.tenantId,
          [
            {
              cargoDirectoCatalogoId: cargo.id,
              configInput,
              montoNeto: 1500,
            },
          ],
          5000,
          2,
        ),
      ).rejects.toThrow('Elegí una zona válida');
    },
  );
});
