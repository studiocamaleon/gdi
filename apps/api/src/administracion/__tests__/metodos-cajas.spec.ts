import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { MetodosPagoService } from '../metodos-pago.service';
import type { CurrentAuth } from '../../auth/auth.types';

describe('Métodos de pago y cuentas asignadas', () => {
  const propia = randomUUID(),
    destino = randomUUID();
  const auth = { tenantId: randomUUID(), userId: randomUUID() } as CurrentAuth;
  function caso() {
    const db = {
      membership: {
        findFirst: jest.fn().mockResolvedValue({
          cuentasRestringidas: true,
          cuentasOperablesIds: [propia],
          cuentasDestinoIds: [destino],
        }),
      },
      metodoPago: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: randomUUID(),
            cuentaDestinoId: propia,
            cuentaDestino: { id: propia, nombre: 'Caja operable' },
          },
          {
            id: randomUUID(),
            cuentaDestinoId: destino,
            cuentaDestino: { id: destino, nombre: 'Destino reservado' },
          },
        ]),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const capacidades = { exigir: jest.fn() };
    return {
      db,
      capacidades,
      service: new MetodosPagoService(db as never, capacidades as never),
    };
  }
  it('el catálogo no revela cuentas ajenas ni convierte un destino en cuenta de cobro', async () => {
    const c = caso(),
      lista = await c.service.findAll(auth);
    expect(lista[0]).toMatchObject({
      cuentaDestinoId: propia,
      cuentaDestinoNombre: 'Caja operable',
    });
    expect(lista[1]).toMatchObject({
      cuentaDestinoId: null,
      cuentaDestinoNombre: null,
    });
    expect(c.db.metodoPago.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: auth.tenantId } }),
    );
  });
  it('el operador restringido no cambia el catálogo compartido aunque invoque el servicio directamente', async () => {
    const c = caso();
    await expect(c.service.create(auth, {} as never)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      c.service.update(auth, randomUUID(), {} as never),
    ).rejects.toThrow(ForbiddenException);
    await expect(c.service.toggle(auth, randomUUID())).rejects.toThrow(
      ForbiddenException,
    );
    await expect(c.service.instalarCatalogo(auth)).rejects.toThrow(
      ForbiddenException,
    );
    expect(c.db.metodoPago.create).not.toHaveBeenCalled();
    expect(c.db.metodoPago.update).not.toHaveBeenCalled();
    expect(c.capacidades.exigir).not.toHaveBeenCalled();
  });
});
