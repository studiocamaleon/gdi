import { BadRequestException } from '@nestjs/common';
import { ProductoRutasService } from '../producto-rutas.service';

function alternativaFixture(requiereRutaPasoIds: string[] = []) {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    rutaVersion: 1,
    ruta: {
      pasos: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          version: 1,
          activo: true,
          familiaCodigo: 'pre_prensa',
          nombreVisible: 'Pre-prensa',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          version: 1,
          activo: true,
          familiaCodigo: 'impresion_por_hoja',
          nombreVisible: 'Impresión',
        },
      ],
    },
    configPasos: [
      {
        rutaPasoId: '11111111-1111-4111-8111-111111111111',
        requiereRutaPasoIds: [],
      },
      {
        rutaPasoId: '22222222-2222-4222-8222-222222222222',
        requiereRutaPasoIds,
      },
    ],
    pasosExtras: [{ id: '33333333-3333-4333-8333-333333333333' }],
  };
}

describe('ProductoRutasService.reordenarPasosRutaAlternativa', () => {
  it('guarda un orden unificado para pasos base y extras', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const updateExtra = jest.fn().mockResolvedValue({});
    const prisma = {
      productoRutaAlternativa: {
        findFirst: jest.fn().mockResolvedValue(alternativaFixture()),
      },
      productoConfigPaso: { updateMany },
      productoPasoExtra: { update: updateExtra },
      $transaction: jest.fn(async (operaciones: Promise<unknown>[]) =>
        Promise.all(operaciones),
      ),
    };
    const service = new ProductoRutasService(prisma as never, null as never);
    const pasoIds = [
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      '22222222-2222-4222-8222-222222222222',
    ];

    await service.reordenarPasosRutaAlternativa('tenant', 'ruta', {
      pasoIds,
    });

    expect(updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: { ordenFlujo: 0 } }),
    );
    expect(updateExtra).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ordenFlujo: 1 } }),
    );
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: { ordenFlujo: 2 } }),
    );
  });

  it('rechaza mover un paso antes de su dependencia explícita', async () => {
    const requerido = '11111111-1111-4111-8111-111111111111';
    const prisma = {
      productoRutaAlternativa: {
        findFirst: jest.fn().mockResolvedValue(alternativaFixture([requerido])),
      },
    };
    const service = new ProductoRutasService(prisma as never, null as never);

    await expect(
      service.reordenarPasosRutaAlternativa('tenant', 'ruta', {
        pasoIds: [
          '22222222-2222-4222-8222-222222222222',
          requerido,
          '33333333-3333-4333-8333-333333333333',
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
