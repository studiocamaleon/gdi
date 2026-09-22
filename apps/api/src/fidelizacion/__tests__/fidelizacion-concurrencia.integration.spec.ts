import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { FidelizacionService } from '../fidelizacion.service';

const db = new PrismaService();
afterAll(() => db.$disconnect());
beforeAll(async () => {
  const [fila] = await db.$queryRaw<
    Array<{ nombre: string }>
  >`SELECT current_database() AS nombre`;
  if (!fila.nombre.endsWith('_test')) throw new Error('Sólo base de pruebas.');
});
async function escenario(
  fn: (f: {
    tenantId: string;
    clienteId: string;
    ordenId: string;
    auth: CurrentAuth;
    service: FidelizacionService;
  }) => Promise<void>,
) {
  const tenant = await db.tenant.create({
    data: { nombre: 'Puntos concurrentes', slug: `puntos-${randomUUID()}` },
  });
  try {
    const cliente = await db.cliente.create({
      data: {
        tenantId: tenant.id,
        nombre: 'Cliente QA',
        telefonoCodigo: '54',
        telefonoNumero: '',
        paisCodigo: 'AR',
      },
    });
    const orden = await db.ordenTrabajo.create({
      data: {
        tenantId: tenant.id,
        clienteId: cliente.id,
        numero: 'OT-QA',
        estado: 'entregada',
        fechaEmision: new Date(),
        total: 0,
        fidelizacionPuntosEstimados: 20,
      },
    });
    await fn({
      tenantId: tenant.id,
      clienteId: cliente.id,
      ordenId: orden.id,
      auth: { tenantId: tenant.id, email: 'qa@example.test' } as CurrentAuth,
      service: new FidelizacionService(db),
    });
  } finally {
    // Las reversiones tienen FK restrictiva: limpiar primero las referencias.
    await db.fidelizacionMovimiento.deleteMany({
      where: { tenantId: tenant.id, reversionDeId: { not: null } },
    });
    await db.tenant.delete({ where: { id: tenant.id } });
  }
}

it('dos liberaciones que leyeron la misma reserva descuentan una sola vez', async () => {
  await escenario(async (f) => {
    await f.service.ajustar(f.auth, f.clienteId, {
      tipo: 'CREDITO',
      puntos: 100,
      motivo: 'QA inicial',
    });
    await db.$transaction((tx) =>
      f.service.reservar(tx, {
        tenantId: f.tenantId,
        clienteId: f.clienteId,
        ordenId: f.ordenId,
        puntos: 30,
      }),
    );
    let liberar!: () => void;
    const leidas = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    let lecturas = 0;
    const liberarUna = () =>
      db.$transaction(async (tx) => {
        const cliente = new Proxy(tx, {
          get(target, prop) {
            if (prop === 'fidelizacionReserva')
              return new Proxy(target.fidelizacionReserva, {
                get(delegate, metodo) {
                  if (metodo === 'findMany')
                    return async (
                      args: Prisma.FidelizacionReservaFindManyArgs,
                    ) => {
                      const rows = await delegate.findMany(args);
                      if (++lecturas === 2) liberar();
                      await leidas;
                      return rows;
                    };
                  return Reflect.get(delegate, metodo) as unknown;
                },
              });
            return Reflect.get(target, prop) as unknown;
          },
        });
        await f.service.liberarReservas(
          cliente,
          f.tenantId,
          { ordenId: f.ordenId },
          'Cancelación QA',
        );
      });
    await Promise.all([liberarUna(), liberarUna()]);
    const cuenta = await f.service.cuenta(f.auth, f.clienteId);
    expect(cuenta.reservadosPuntos).toBe(0);
    expect(cuenta.saldoPuntos).toBe(100);
  });
});

it('dos acreditaciones simultáneas crean una cuenta y una sola ganancia', async () => {
  await escenario(async (f) => {
    await Promise.all([
      db.$transaction((tx) =>
        f.service.reconciliarOrden(tx, f.tenantId, f.ordenId),
      ),
      db.$transaction((tx) =>
        f.service.reconciliarOrden(tx, f.tenantId, f.ordenId),
      ),
    ]);
    const cuenta = await f.service.cuenta(f.auth, f.clienteId);
    expect(cuenta.saldoPuntos).toBe(20);
    expect(cuenta.movimientos).toHaveLength(1);
  });
});

it.each([20, 60])(
  'la liberación pendiente relee una reserva transferida a una OT (%i puntos)',
  async (puntos) => {
    await escenario(async (f) => {
      await f.service.ajustar(f.auth, f.clienteId, {
        tipo: 'CREDITO',
        puntos: 100,
        motivo: 'QA inicial',
      });
      const cotizacion = await db.cotizacion.create({
        data: { tenantId: f.tenantId, estado: 'aprobado' },
      });
      await db.$transaction((tx) =>
        f.service.reservar(tx, {
          tenantId: f.tenantId,
          clienteId: f.clienteId,
          cotizacionId: cotizacion.id,
          puntos: 60,
        }),
      );
      let leida!: () => void, continuar!: () => void;
      const lectura = new Promise<void>((r) => {
        leida = r;
      });
      const permiso = new Promise<void>((r) => {
        continuar = r;
      });
      const liberando = db.$transaction(async (tx) => {
        const cliente = new Proxy(tx, {
          get(target, prop) {
            if (prop === 'fidelizacionReserva')
              return new Proxy(target.fidelizacionReserva, {
                get(delegate, metodo) {
                  if (metodo === 'findMany')
                    return async (
                      args: Prisma.FidelizacionReservaFindManyArgs,
                    ) => {
                      const rows = await delegate.findMany(args);
                      leida();
                      await permiso;
                      return rows;
                    };
                  return Reflect.get(delegate, metodo) as unknown;
                },
              });
            return Reflect.get(target, prop) as unknown;
          },
        });
        await f.service.liberarReservas(
          cliente,
          f.tenantId,
          { cotizacionId: cotizacion.id },
          'Cancelar remanente',
        );
      });
      try {
        await Promise.race([
          lectura,
          liberando.then(() => {
            throw new Error('No leyó la reserva');
          }),
        ]);
        await db.$transaction((tx) =>
          f.service.reservarParaOrden(tx, {
            tenantId: f.tenantId,
            clienteId: f.clienteId,
            cotizacionId: cotizacion.id,
            ordenId: f.ordenId,
            puntos,
          }),
        );
      } finally {
        continuar();
        await liberando;
      }
      expect(await f.service.cuenta(f.auth, f.clienteId)).toMatchObject({
        saldoPuntos: 100,
        reservadosPuntos: puntos,
      });
      expect(
        await db.fidelizacionReserva.findFirst({
          where: { tenantId: f.tenantId, ordenId: f.ordenId },
        }),
      ).toMatchObject({ estado: 'RESERVADA', puntos });
    });
  },
);
