import { NotFoundException } from '@nestjs/common';
import { ProduccionService } from '../produccion.service';
import type { CurrentAuth } from '../../auth/auth.types';

const estructura = {
  tipoBastidor: 'doble',
  anchoM: 2.4,
  altoM: 1.2,
  profundidadM: 0.15,
};
const auth = { tenantId: 'empresa-ficticia' } as CurrentAuth;
function servicio(snapshot: unknown, esOrden = true) {
  const prisma = {
    ordenTrabajoItem: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          esOrden ? { trazabilidadSnapshotJson: snapshot } : null,
        ),
    },
    cotizacionItem: {
      findFirst: jest
        .fn()
        .mockResolvedValue(esOrden ? null : { trazabilidadJson: snapshot }),
    },
  };
  const service = Object.assign(
    Object.create(ProduccionService.prototype) as ProduccionService,
    { prisma },
  );
  return { service, prisma };
}

it.each([true, false])(
  'lee el bastidor del componente en snapshot de orden=%s',
  async (esOrden) => {
    const { service, prisma } = servicio(
      {
        pasos: [{ familiaCodigo: 'trabajo_manual' }],
        componentesFabricados: [
          { componentes: [{ pasos: [{ estructuraBastidor: estructura }] }] },
        ],
      },
      esOrden,
    );
    await expect(
      service.estructuraBastidor(auth, 'item-ficticio'),
    ).resolves.toEqual(estructura);
    expect(prisma.ordenTrabajoItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-ficticio', tenantId: 'empresa-ficticia' },
      }),
    );
    if (!esOrden)
      expect(prisma.cotizacionItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-ficticio', tenantId: 'empresa-ficticia' },
        }),
      );
  },
);

it('conserva el bastidor raíz y no reconstruye defaults si falta el snapshot', async () => {
  await expect(
    servicio({
      pasos: [{ estructuraBastidor: estructura }],
    }).service.estructuraBastidor(auth, 'item-ficticio'),
  ).resolves.toEqual(estructura);
  await expect(
    servicio({
      pasos: [{ estructuraBastidor: estructura, activado: false }],
    }).service.estructuraBastidor(auth, 'item-ficticio'),
  ).rejects.toBeInstanceOf(NotFoundException);
});
