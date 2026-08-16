import { BadRequestException } from '@nestjs/common';
import { PresupuestosService } from '../presupuestos.service';

const auth = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  userId: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb',
  role: 'ADMINISTRADOR',
  email: 'admin@grafo.test',
} as never;

function escenario(actualizadas = 1) {
  let actualizacionPersistida: unknown;
  const updateMany = jest.fn((args: unknown) => {
    actualizacionPersistida = args;
    return Promise.resolve({ count: actualizadas });
  });
  const tx = {
    cotizacionContador: {
      upsert: jest.fn().mockResolvedValue({ ultimo: 7 }),
    },
    cotizacion: { updateMany },
    cotizacionEvento: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    cotizacion: {
      findFirst: jest.fn().mockResolvedValue({ id: 'cot-1', numero: null }),
    },
    cliente: { findFirst: jest.fn().mockResolvedValue({ id: 'cli-1' }) },
    empleado: {
      findFirst: jest.fn().mockResolvedValue({ id: 'emp-1' }),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({ nombreCompleto: 'Admin' }),
    },
    configuracionPresupuestos: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn((fn: (arg: typeof tx) => unknown) =>
      Promise.resolve(fn(tx)),
    ),
  };
  const ordenes = {
    autorizarItemsCotizados: jest.fn().mockResolvedValue([
      {
        cotizacionItemId: '11111111-1111-4111-a111-111111111111',
        codigo: 'AUT',
        nombre: 'Autorizado',
        familia: 'Test',
        cantidad: 2,
        cantidadUnidad: 'u.',
        subtotal: 1_000,
        impuestos: 210,
        total: 1_210,
        descuentoMonto: 100,
      },
    ]),
    autorizarCargosCotizados: jest
      .fn()
      .mockResolvedValue([{ total: 121, montoNeto: 100, impuestoMonto: 21 }]),
  };
  const service = new PresupuestosService(
    prisma as never,
    ordenes as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  jest
    .spyOn(service, 'enviar')
    .mockResolvedValue({ estado: 'enviado' } as never);
  return {
    service,
    prisma,
    ordenes,
    actualizacionPersistida: () => actualizacionPersistida,
  };
}

describe('PresupuestosService.emitir', () => {
  const dto = {
    cotizacionId: 'cccccccc-cccc-4ccc-accc-cccccccccccc',
    clienteId: 'dddddddd-dddd-4ddd-addd-dddddddddddd',
    items: [
      {
        cotizacionItemId: '11111111-1111-4111-a111-111111111111',
        codigo: 'MANIPULADO',
        nombre: 'Manipulado',
        familia: 'Test',
        cantidad: 99,
        cantidadUnidad: 'u.',
        subtotal: 1,
        impuestos: 0,
        total: 1,
      },
    ],
    cargos: [],
  };

  it('persiste exclusivamente los importes autorizados por snapshots y catálogo', async () => {
    const { service, actualizacionPersistida, ordenes } = escenario();
    await service.emitir(auth, dto);

    expect(ordenes.autorizarItemsCotizados).toHaveBeenCalled();
    const llamada = actualizacionPersistida() as {
      data: {
        subtotal: number;
        impuestos: number;
        total: number;
        emisionJson: { items: Array<Record<string, unknown>> };
      };
    };
    const { data } = llamada;
    expect(data).toMatchObject({
      subtotal: 1_000,
      impuestos: 210,
      total: 1_331,
    });
    expect(data.emisionJson.items[0]).toMatchObject({
      codigo: 'AUT',
      cantidad: 2,
      subtotal: 1_000,
      impuestos: 210,
      total: 1_210,
    });
  });

  it('la actualización condicional evita emitir dos veces la misma cotización', async () => {
    const { service } = escenario(0);
    await expect(service.emitir(auth, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
