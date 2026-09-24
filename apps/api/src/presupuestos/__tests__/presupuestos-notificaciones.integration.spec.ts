import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EventosSistemaService } from '../../eventos-sistema/eventos-sistema.service';
import { PresupuestosService } from '../presupuestos.service';

describe('decisiones de presupuestos y buzón (PostgreSQL de test)', () => {
  const prisma = new PrismaService();
  const eventos = new EventosSistemaService(prisma);
  const avisos = { sincronizar: jest.fn().mockResolvedValue(undefined) };
  const enlaces = { resolver: jest.fn() };
  const service = new PresupuestosService(
    prisma,
    {} as never,
    {} as never,
    {} as never,
    avisos as never,
    enlaces as never,
    {} as never,
    { liberarReservasPresupuesto: jest.fn() } as never,
    { liberarReservas: jest.fn() } as never,
    {} as never,
    undefined,
    eventos,
  );
  const tenantId = randomUUID();
  const otroTenantId = randomUUID();
  const usuarios = Array.from({ length: 5 }, () => randomUUID());
  let cotizacionId: string;

  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test')) {
      throw new Error('Esta prueba requiere una base de test.');
    }
    await prisma.$connect();
    await prisma.tenant.createMany({
      data: [tenantId, otroTenantId].map((id) => ({
        id,
        nombre: 'QA notificaciones presupuestos',
        slug: `qa-buzon-${id}`,
      })),
    });
    await prisma.user.createMany({
      data: usuarios.map((id, i) => ({
        id,
        email: `qa-${id}@example.test`,
        activo: i !== 2,
      })),
    });
    await prisma.membership.createMany({
      data: [
        ...usuarios.map((userId, i) => ({
          userId,
          tenantId: i === 4 ? otroTenantId : tenantId,
          rol: 'OPERADOR' as const,
          activa: i !== 3,
        })),
        {
          userId: usuarios[0],
          tenantId: otroTenantId,
          rol: 'ADMINISTRADOR' as const,
        },
      ],
    });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    cotizacionId = (
      await prisma.cotizacion.create({
        data: {
          tenantId,
          numero: `PRES-${randomUUID()}`,
          estado: 'enviado',
          fechaValidez: new Date('2099-01-01'),
        },
      })
    ).id;
    enlaces.resolver.mockResolvedValue({ tenantId, entidadId: cotizacionId });
  });

  afterEach(async () => {
    await prisma.eventoSistema.deleteMany({ where: { tenantId } });
    await prisma.cotizacion.deleteMany({ where: { tenantId } });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otroTenantId] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });

  it.each(['aprobado', 'rechazado'] as const)(
    'notifica %s una sola vez por usuario activo, sin cruzar empresas, y conserva la lectura individual',
    async (decision) => {
      const comentario = 'x'.repeat(500);
      await service.decisionPublica('token', { decision, comentario });
      const notificaciones = await prisma.notificacionInterna.findMany({
        where: { evento: { entidadId: cotizacionId } },
        include: { evento: true },
      });
      expect(notificaciones.map((n) => n.userId).sort()).toEqual(
        usuarios.slice(0, 2).sort(),
      );
      expect(notificaciones.every((n) => n.tenantId === tenantId)).toBe(true);
      expect(notificaciones[0].evento.href).toBe(
        `/comercial/presupuestos/${cotizacionId}`,
      );
      const historial = await prisma.cotizacionEvento.findMany({
        where: { cotizacionId },
      });
      expect(historial).toHaveLength(1);
      expect(historial[0].datosJson).toEqual({ comentario });
      const auth = { tenantId, userId: usuarios[0] } as never;
      const aviso = notificaciones.find((n) => n.userId === usuarios[0])!;
      await eventos.marcarLeida(auth, aviso.id);
      expect(await eventos.contarNoLeidas(auth)).toEqual({ cantidad: 0 });
      expect(
        await eventos.contarNoLeidas({
          tenantId,
          userId: usuarios[1],
        } as never),
      ).toEqual({ cantidad: 1 });
      expect(
        await eventos.listarNotificaciones({
          tenantId: otroTenantId,
          userId: usuarios[0],
        } as never),
      ).toEqual([]);
      await expect(
        service.decisionPublica('token', { decision }),
      ).rejects.toThrow();
      expect(
        await prisma.eventoSistema.count({
          where: { entidadId: cotizacionId },
        }),
      ).toBe(1);
    },
  );

  it('dos decisiones simultáneas producen una única decisión y un único aviso por usuario', async () => {
    const resultados = await Promise.allSettled([
      service.decisionPublica('token', { decision: 'aprobado' }),
      service.decisionPublica('token', { decision: 'rechazado' }),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await prisma.eventoSistema.count({ where: { entidadId: cotizacionId } }),
    ).toBe(1);
    expect(
      await prisma.cotizacionEvento.count({ where: { cotizacionId } }),
    ).toBe(1);
    expect(
      await prisma.notificacionInterna.count({
        where: { evento: { entidadId: cotizacionId } },
      }),
    ).toBe(2);
  });

  it('si falla la persistencia del aviso se revierte la decisión y el historial, y puede reintentarse', async () => {
    const publicar = jest
      .spyOn(eventos, 'publicar')
      .mockRejectedValueOnce(new Error('Fallo de persistencia'));
    try {
      await expect(
        service.decisionPublica('token', { decision: 'aprobado' }),
      ).rejects.toThrow('Fallo de persistencia');
      expect(
        await prisma.cotizacion.findUnique({ where: { id: cotizacionId } }),
      ).toMatchObject({ estado: 'enviado', fechaResuelto: null });
      expect(
        await prisma.cotizacionEvento.count({ where: { cotizacionId } }),
      ).toBe(0);
      expect(avisos.sincronizar).not.toHaveBeenCalled();
      await service.decisionPublica('token', { decision: 'aprobado' });
      expect(
        await prisma.notificacionInterna.count({
          where: { evento: { entidadId: cotizacionId } },
        }),
      ).toBe(2);
    } finally {
      publicar.mockRestore();
    }
  });
});
