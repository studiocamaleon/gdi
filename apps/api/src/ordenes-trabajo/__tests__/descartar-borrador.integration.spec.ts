import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { referenciaBorrador } from '../numero-orden';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';
import type { CurrentAuth } from '../../auth/auth.types';

// Sólo datos propios y ficticios; la cancelación y su auditoría usan PostgreSQL real.
describe('descartar borradores de OT', () => {
  const db = new PrismaClient();
  const tenantId = randomUUID(),
    userId = randomUUID();
  const auth = {
    tenantId,
    userId,
    email: 'comercial@example.invalid',
  } as CurrentAuth;
  const servicio = Object.assign(
    Object.create(OrdenesTrabajoService.prototype),
    {
      prisma: db,
      capacidades: { exigirOperacionTx: jest.fn() },
      enlaces: { revocar: jest.fn() },
      fidelizacion: {
        liberarReservas: jest.fn(),
        revertirCanjeOrden: jest.fn(),
        reconciliarOrden: jest.fn(),
      },
      descartarPromesasEta: jest.fn(),
      findOne: async (_a: CurrentAuth, id: string) =>
        db.ordenTrabajo.findUniqueOrThrow({ where: { id } }),
    },
  ) as OrdenesTrabajoService;
  const descartar = (id: string, actor = auth) =>
    servicio.cancelar(
      actor,
      id,
      { motivo: 'Borrador descartado.', emitirNotaCredito: false },
      true,
    );
  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'))
      throw Error('Sólo test.');
    await db.tenant.create({
      data: {
        id: tenantId,
        nombre: 'QA descarte',
        slug: `descarte-${tenantId}`,
      },
    });
    await db.user.create({
      data: { id: userId, email: `${userId}@example.invalid` },
    });
  });
  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });
  it('retira el borrador, conserva autor e historial y no consume número de OT', async () => {
    const orden = await db.ordenTrabajo.create({
      data: { tenantId, estado: 'borrador', numero: referenciaBorrador() },
    });
    const contador = await db.ordenTrabajoContador.findMany({
      where: { tenantId },
    });
    const resultado = await descartar(orden.id);
    expect(resultado).toMatchObject({
      estado: 'cancelada',
      numero: orden.numero,
      canceladaPorId: userId,
    });
    expect(
      await db.ordenTrabajoContador.findMany({ where: { tenantId } }),
    ).toEqual(contador);
    expect(
      await db.ordenTrabajoEvento.findFirst({
        where: { ordenId: orden.id, tipo: 'borrador_descartado' },
      }),
    ).toMatchObject({ usuarioId: userId, origen: 'usuario' });
  });
  it.each(['pendiente', 'produccion', 'finalizada', 'entregada'])(
    'nunca descarta una OT en %s',
    async (estado) => {
      const orden = await db.ordenTrabajo.create({
        data: { tenantId, estado, numero: `OT-QA-${randomUUID()}` },
      });
      await expect(descartar(orden.id)).rejects.toThrow('ya fue emitido');
      expect(
        (await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } }))
          .estado,
      ).toBe(estado);
    },
  );
  it('no permite descartar el borrador de otra empresa', async () => {
    const orden = await db.ordenTrabajo.create({
      data: { tenantId, estado: 'borrador', numero: referenciaBorrador() },
    });
    await expect(
      descartar(orden.id, { ...auth, tenantId: randomUUID() }),
    ).rejects.toThrow('No se encontró');
    expect(
      (await db.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } }))
        .estado,
    ).toBe('borrador');
  });
});
