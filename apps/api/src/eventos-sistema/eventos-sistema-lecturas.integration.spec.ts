import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { EventosSistemaService } from './eventos-sistema.service';

describe('Registro de lecturas (PostgreSQL local)', () => {
  const prisma = new PrismaService();
  const service = new EventosSistemaService(prisma);
  const tenants: string[] = [],
    usuarios: string[] = [];
  let tenantId: string, otroTenantId: string;
  let alex: CurrentAuth, marina: CurrentAuth, externo: CurrentAuth;
  let validada = false;

  const crearAuth = (userId: string, empresa: string): CurrentAuth => ({
    userId,
    tenantId: empresa,
    sessionId: 'qa',
    membershipId: 'qa',
    role: 'OPERADOR',
    email: `${userId}@example.invalid`,
    permisos: new Set(['panel.ver']),
  });
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Requiere base local de test con aislamiento activo.');
    validada = true;
    await prisma.$connect();
  });
  beforeEach(async () => {
    tenantId = randomUUID();
    otroTenantId = randomUUID();
    tenants.push(tenantId, otroTenantId);
    await prisma.tenant.createMany({
      data: [tenantId, otroTenantId].map((id) => ({
        id,
        nombre: 'Empresa ficticia',
        slug: `qa-lecturas-${id}`,
      })),
    });
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    usuarios.push(...ids);
    await prisma.user.createMany({
      data: ids.map((id, i) => ({
        id,
        email: `${id}@example.invalid`,
        nombreCompleto: ['Alex Demo', 'Marina Demo', 'Usuario externo'][i],
      })),
    });
    alex = crearAuth(ids[0], tenantId);
    marina = crearAuth(ids[1], tenantId);
    externo = crearAuth(ids[2], otroTenantId);
    await prisma.membership.createMany({
      data: [alex, marina, externo].map((a) => ({
        userId: a.userId,
        tenantId: a.tenantId,
        rol: 'OPERADOR',
      })),
    });
  });
  afterAll(async () => {
    if (validada) {
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
    }
    await prisma.$disconnect();
  });
  async function aviso() {
    const evento = await service.publicar({
      tenantId,
      actorNombre: 'Sistema',
      tipo: 'qa.aviso',
      entidadTipo: 'qa',
      titulo: 'Presupuesto ficticio aprobado',
      mensaje: 'Datos de prueba',
      topicos: ['qa'],
      destinatariosUserId: [alex.userId, marina.userId],
    });
    const filas = await prisma.notificacionInterna.findMany({
      where: { tenantId, eventoId: evento.id },
    });
    return {
      evento,
      a: filas.find((n) => n.userId === alex.userId)!,
      m: filas.find((n) => n.userId === marina.userId)!,
    };
  }

  it('comparte nombres y primera fecha sin marcar la bandeja del compañero ni duplicar avisos', async () => {
    const { evento, a, m } = await aviso();
    await service.marcarLeida(alex, a.id);
    const primera = (await service.listarNotificaciones(marina))[0];
    expect(primera.leidaEl).toBeNull();
    expect(primera.lecturas).toEqual([
      expect.objectContaining({
        nombre: 'Alex Demo',
        leidaEl: expect.any(String),
      }),
    ]);
    expect(await service.contarNoLeidas(marina)).toEqual({ cantidad: 1 });
    expect(await service.contarNoLeidas(alex)).toEqual({ cantidad: 0 });
    await service.marcarLeida(alex, a.id);
    expect((await service.listarNotificaciones(marina))[0].lecturas).toEqual(
      primera.lecturas,
    );
    await service.marcarLeida(marina, m.id);
    expect(
      (await service.listarNotificaciones(alex))[0].lecturas.map(
        (l) => l.nombre,
      ),
    ).toEqual(['Alex Demo', 'Marina Demo']);
    expect(
      await prisma.notificacionInterna.count({ where: { tenantId } }),
    ).toBe(2);
    const cambios = await service.cambiosDesde(marina, evento.id.toString());
    expect(cambios.cambios.map((c) => c.tipo)).toEqual([
      'notificaciones.lectura_registrada',
      'notificaciones.lectura_registrada',
    ]);
    expect(JSON.stringify(cambios)).not.toMatch(
      /Alex Demo|Marina Demo|lectorUserId/,
    );
    expect(
      (await service.cambiosDesde(externo, evento.id.toString())).cambios,
    ).toEqual([]);
  });

  it('resiste doble clic y marcar todas simultáneamente: una firma por destinatario', async () => {
    const { a } = await aviso();
    await aviso();
    await Promise.all([
      service.marcarLeida(alex, a.id),
      service.marcarLeida(alex, a.id),
      service.marcarTodasLeidas(alex),
    ]);
    expect(
      await prisma.eventoSistemaLectura.count({ where: { tenantId } }),
    ).toBe(2);
    expect(await service.contarNoLeidas(alex)).toEqual({ cantidad: 0 });
    expect(await service.contarNoLeidas(marina)).toEqual({ cantidad: 2 });
    expect(await service.marcarTodasLeidas(alex)).toEqual({ actualizadas: 0 });
  });

  it('rechaza avisos de otro destinatario/tenant y archivados, incluso con IDs conocidos', async () => {
    const { a, m } = await aviso();
    await expect(service.marcarLeida(alex, m.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.marcarLeida(externo, a.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.marcarLeida({ ...alex, tenantId: otroTenantId }, a.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.listarNotificaciones(externo)).toEqual([]);
    await prisma.notificacionInterna.update({
      where: { id: a.id },
      data: { archivadaEl: new Date() },
    });
    await expect(service.marcarLeida(alex, a.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await service.marcarTodasLeidas(alex)).toEqual({ actualizadas: 0 });
    expect(
      await prisma.eventoSistemaLectura.count({ where: { tenantId } }),
    ).toBe(0);
  });

  it('marcar todas conserva la primera lectura y no firma lecturas históricas sin autor', async () => {
    const { a } = await aviso();
    const antigua = new Date('2026-01-01T15:00:00Z');
    await prisma.notificacionInterna.update({
      where: { id: a.id },
      data: { leidaEl: antigua },
    });
    await aviso();
    await service.marcarLeida(alex, a.id);
    expect(await service.marcarTodasLeidas(alex)).toEqual({ actualizadas: 1 });
    const filas = await service.listarNotificaciones(alex);
    expect(filas.find((f) => f.id === a.id)).toMatchObject({
      leidaEl: antigua.toISOString(),
      lecturas: [],
    });
    expect(
      await prisma.eventoSistemaLectura.count({ where: { tenantId } }),
    ).toBe(1);
  });

  it('conserva la firma y fecha al renombrar, desactivar y borrar al lector', async () => {
    const { a } = await aviso();
    await service.marcarLeida(alex, a.id);
    const inicial = (await service.listarNotificaciones(marina))[0].lecturas;
    await prisma.user.update({
      where: { id: alex.userId },
      data: { nombreCompleto: 'Nombre cambiado', activo: false },
    });
    expect((await service.listarNotificaciones(marina))[0].lecturas).toEqual(
      inicial,
    );
    await prisma.user.delete({ where: { id: alex.userId } });
    expect((await service.listarNotificaciones(marina))[0].lecturas).toEqual(
      inicial,
    );
    expect(
      await prisma.eventoSistemaLectura.findFirst({ where: { tenantId } }),
    ).toMatchObject({
      lectorUserId: null,
      notificacionId: null,
      lectorNombre: 'Alex Demo',
    });
  });

  it('firma al actor de soporte en una impersonación, sin atribuirlo al empleado', async () => {
    const { a } = await aviso();
    await service.marcarLeida(
      {
        ...alex,
        impersonacion: {
          sesionId: 'qa',
          actorUserId: externo.userId,
          actorNombre: 'Soporte Grafo (Prueba)',
        },
      },
      a.id,
    );
    expect(
      (await service.listarNotificaciones(marina))[0].lecturas[0].nombre,
    ).toBe('Soporte Grafo (Prueba)');
    expect(
      await prisma.eventoSistemaLectura.findFirst({ where: { tenantId } }),
    ).toMatchObject({ lectorUserId: externo.userId });
  });

  it('distingue una lectura mediante asistente de una lectura humana', async () => {
    const { a } = await aviso();
    await service.marcarLeida(
      {
        ...alex,
        mcp: { credencialId: 'qa', credencialNombre: 'Asistente ficticio' },
      },
      a.id,
    );
    expect(
      (await service.listarNotificaciones(marina))[0].lecturas[0].nombre,
    ).toBe('Alex Demo · Asistente: Asistente ficticio');
  });

  it('revierte el leído si falla el guardado de la firma', async () => {
    const { a } = await aviso();
    const inexistente = {
      ...alex,
      impersonacion: {
        sesionId: 'qa',
        actorUserId: randomUUID(),
        actorNombre: 'Soporte ficticio inexistente',
      },
    };
    await expect(service.marcarLeida(inexistente, a.id)).rejects.toThrow();
    expect(await service.contarNoLeidas(alex)).toEqual({ cantidad: 1 });
    expect(
      await prisma.eventoSistemaLectura.count({ where: { tenantId } }),
    ).toBe(0);
  });
});
