/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NotFoundException } from '@nestjs/common';
import {
  gatesOperativosPendientes,
  OrdenesTrabajoService,
} from '../ordenes-trabajo.service';

describe('gates operativos de producción', () => {
  const auth = {
    tenantId: 'tenant',
    userId: 'supervisor',
    email: 'supervisor@grafo.test',
  } as never;

  it('bloquea mientras cualquiera de las condiciones siga pendiente', () => {
    expect(
      gatesOperativosPendientes([
        { tipo: 'MATERIAL', estado: 'CUMPLIDO' },
        { tipo: 'CALIDAD', estado: 'PENDIENTE' },
      ]),
    ).toEqual([{ tipo: 'CALIDAD', estado: 'PENDIENTE' }]);
    expect(
      gatesOperativosPendientes([
        { tipo: 'MATERIAL', estado: 'CUMPLIDO' },
        { tipo: 'CALIDAD', estado: 'CUMPLIDO' },
      ]),
    ).toEqual([]);
  });

  it('confirma el gate y deja una auditoría sobre la OT', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'gate',
      tipo: 'MATERIAL',
      estado: 'CUMPLIDO',
      detalle: 'Bobina asignada',
      resueltoEl: new Date('2026-08-30T18:00:00.000Z'),
      resueltoPorNombre: 'supervisor@grafo.test',
    });
    const eventoCreate = jest.fn().mockResolvedValue({ id: 'evento' });
    const tx = {
      ordenTrabajoPasoGate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'gate',
          ordenId: 'orden',
          paso: { nombre: 'Impresión UV' },
        }),
        update,
      },
      ordenTrabajoEvento: { create: eventoCreate },
    };
    const service = Object.create(
      OrdenesTrabajoService.prototype,
    ) as OrdenesTrabajoService;
    (service as unknown as { prisma: unknown }).prisma = {
      $transaction: (callback: (cliente: typeof tx) => unknown) => callback(tx),
    };

    const resultado = await service.resolverGatePaso(auth, 'paso', {
      tipo: 'MATERIAL',
      estado: 'CUMPLIDO',
      detalle: ' Bobina asignada ',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'gate' },
      data: expect.objectContaining({
        estado: 'CUMPLIDO',
        detalle: 'Bobina asignada',
        resueltoPorId: 'supervisor',
      }),
    });
    expect(eventoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ordenId: 'orden',
        tipo: 'gate_operativo',
        datosJson: expect.objectContaining({ estado: 'CUMPLIDO' }),
      }),
    });
    expect(resultado.estado).toBe('CUMPLIDO');
  });

  it('no permite inventar un gate que la receta no declaró', async () => {
    const tx = {
      ordenTrabajoPasoGate: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = Object.create(
      OrdenesTrabajoService.prototype,
    ) as OrdenesTrabajoService;
    (service as unknown as { prisma: unknown }).prisma = {
      $transaction: (callback: (cliente: typeof tx) => unknown) => callback(tx),
    };

    await expect(
      service.resolverGatePaso(auth, 'paso', {
        tipo: 'CALIDAD',
        estado: 'CUMPLIDO',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
