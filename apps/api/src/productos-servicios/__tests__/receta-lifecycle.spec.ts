import { BadRequestException } from '@nestjs/common';
import { EstadoProductoRecetaRevision } from '@prisma/client';
import { RecetasProductoService } from '../recetas-producto.service';

const auth = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  email: 'lucas@example.com',
} as never;

function fixture(estado = EstadoProductoRecetaRevision.PUBLICADA) {
  const revision = {
    id: 'revision-1',
    tenantId: 'tenant-1',
    recetaId: 'receta-1',
    numero: 2,
    estado,
    cambios: 'V2',
    updatedAt: new Date('2026-08-30T02:00:00.000Z'),
    receta: {
      revisionPublicadaId: 'revision-1',
      productoId: 'producto-1',
      producto: { nombre: 'Exhibidor' },
    },
  };
  const tx = {
    productoRecetaRevision: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    productoReceta: { update: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    productoRecetaRevision: {
      findFirst: jest.fn().mockResolvedValue(revision),
      findFirstOrThrow: jest.fn().mockResolvedValue({ ...revision, documentos: [] }),
    },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ nombreCompleto: 'Lucas', email: 'lucas@example.com' }),
    },
    $transaction: jest.fn(async (callback: (db: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const eventos = { publicar: jest.fn().mockResolvedValue(undefined) };
  return {
    servicio: new RecetasProductoService(
      prisma as never,
      {} as never,
      {} as never,
      eventos as never,
    ),
    prisma,
    tx,
    eventos,
  };
}

describe('ciclo de vida de receta', () => {
  it('depreca la vigente con optimistic locking y retira el puntero actual', async () => {
    const { servicio, tx, eventos } = fixture();

    await servicio.deprecar(auth, 'revision-1', {
      expectedUpdatedAt: '2026-08-30T02:00:00.000Z',
      motivo: 'Reemplazo técnico',
    });

    expect(tx.productoRecetaRevision.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: EstadoProductoRecetaRevision.DEPRECADA,
          cambios: 'Reemplazo técnico',
        }),
      }),
    );
    expect(tx.productoReceta.update).toHaveBeenCalledWith({
      where: { id: 'receta-1' },
      data: { revisionPublicadaId: null },
    });
    expect(eventos.publicar).toHaveBeenCalled();
  });

  it('no permite deprecar un borrador', async () => {
    const { servicio } = fixture(EstadoProductoRecetaRevision.BORRADOR);

    await expect(
      servicio.deprecar(auth, 'revision-1', {
        expectedUpdatedAt: '2026-08-30T02:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
