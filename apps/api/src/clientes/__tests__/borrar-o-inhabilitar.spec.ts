import { BadRequestException } from '@nestjs/common';
import { RolSistema } from '@prisma/client';

import { ClientesService } from '../clientes.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';

/**
 * Un cliente que ya operó no se borra.
 *
 * Borrarlo dejaba las órdenes SIN CLIENTE en silencio: las relaciones a Cliente
 * son opcionales, así que Postgres pone null y la orden sigue ahí —con su plata
 * y su producción— sin saber de quién era. Pasó de verdad: 4 órdenes, 5
 * cotizaciones y 5 comprobantes huérfanos.
 */

const AUTH: CurrentAuth = {
  userId: 'u1',
  sessionId: 's1',
  tenantId: 't1',
  membershipId: 'm1',
  role: RolSistema.ADMINISTRADOR,
  email: 'admin@imprenta.test',
};

function armar(rastro: {
  ordenes?: number;
  cotizaciones?: number;
  comprobantes?: number;
  cobros?: number;
  activo?: boolean;
}) {
  const cliente = {
    id: 'c1',
    nombre: 'Cliente RI de prueba',
    activo: rastro.activo ?? true,
    contactos: [],
    direcciones: [],
  };
  const del = jest.fn().mockResolvedValue(cliente);
  const update = jest.fn().mockResolvedValue({ ...cliente, activo: !cliente.activo });

  const prisma = {
    cliente: {
      findFirst: jest.fn().mockResolvedValue(cliente),
      delete: del,
      update,
    },
    ordenTrabajo: { count: jest.fn().mockResolvedValue(rastro.ordenes ?? 0) },
    cotizacion: { count: jest.fn().mockResolvedValue(rastro.cotizaciones ?? 0) },
    comprobante: { count: jest.fn().mockResolvedValue(rastro.comprobantes ?? 0) },
    cobro: { count: jest.fn().mockResolvedValue(rastro.cobros ?? 0) },
  } as unknown as PrismaService;

  return { service: new ClientesService(prisma), del, update };
}

describe('borrar o inhabilitar un cliente', () => {
  describe('con historia, no se borra', () => {
    it.each([
      ['órdenes de trabajo', { ordenes: 4 }],
      ['presupuestos', { cotizaciones: 5 }],
      ['comprobantes', { comprobantes: 5 }],
      ['cobros', { cobros: 1 }],
    ])('lo frena si tiene %s', async (_caso, rastro) => {
      const { service, del } = armar(rastro);

      await expect(service.remove(AUTH, 'c1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(del).not.toHaveBeenCalled();
    });

    /** El mensaje tiene que decir QUÉ lo frena y qué hacer en su lugar. */
    it('dice cuánto hay y ofrece inhabilitar', async () => {
      const { service } = armar({ ordenes: 4, comprobantes: 5 });

      await expect(service.remove(AUTH, 'c1')).rejects.toThrow(
        /4 órdenes de trabajo, 5 comprobantes/,
      );
      await expect(service.remove(AUTH, 'c1')).rejects.toThrow(/Inhabilitalo/);
    });

    it('singular cuando es uno solo', async () => {
      const { service } = armar({ ordenes: 1 });
      await expect(service.remove(AUTH, 'c1')).rejects.toThrow(
        /1 orden de trabajo/,
      );
    });
  });

  /** El que se cargó por error y nunca operó sí se borra: no rompe nada. */
  it('sin historia se borra de verdad', async () => {
    const { service, del } = armar({});
    await service.remove(AUTH, 'c1');
    expect(del).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  describe('inhabilitar', () => {
    it('apaga al activo', async () => {
      const { service, update } = armar({ activo: true, ordenes: 4 });
      await service.alternarActivo(AUTH, 'c1');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { activo: false } }),
      );
    });

    it('vuelve a encender al inhabilitado', async () => {
      const { service, update } = armar({ activo: false });
      await service.alternarActivo(AUTH, 'c1');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { activo: true } }),
      );
    });
  });
});
