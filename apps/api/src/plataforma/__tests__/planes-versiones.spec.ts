import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PROPUESTA_PLANES,
  type ContenidoPlan,
} from '../planes/catalogo-planes';
import { PlanesVersionesService } from '../planes/planes-versiones.service';
import {
  PlanesVersionesController,
  PublicarPlanDto,
  HistorialPlanesDto,
} from '../planes/planes-versiones.controller';
import { PlanesBorradoresService } from '../planes/planes-borradores.service';
import { PlataformaGuard } from '../plataforma.guard';
import { PlataformaAdminGuard } from '../plataforma-admin.guard';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';

const prisma = new PrismaClient();
afterAll(() => prisma.$disconnect());
const contenido = (): ContenidoPlan => ({
  ...structuredClone(PROPUESTA_PLANES[0].contenido),
  almacenamientoModo: 'limitado',
  almacenamientoGb: 10,
});
const solicitud = {
  revision: 1,
  catalogoVersion: 2,
  motivo: 'Propuesta inicial para validar',
};

// Las pruebas revierten la transacción completa: nunca borran ni alteran snapshots publicados.
async function escenario(
  fn: (ctx: {
    tx: Prisma.TransactionClient;
    service: PlanesVersionesService;
    borradores: PlanesBorradoresService;
    auth: CurrentAuth;
    id: string;
  }) => Promise<void>,
) {
  const rollback = new Error('rollback de la prueba');
  try {
    await prisma.$transaction(
      async (tx) => {
        const u = await tx.user.create({
          data: {
            email: `versiones-${randomUUID()}@test.local`,
            nombreCompleto: 'Admin de prueba',
            rolPlataforma: 'ADMIN',
          },
        });
        await tx.userMfa.create({
          data: {
            userId: u.id,
            activatedAt: new Date(1),
            recuperacionConfirmadaEl: new Date(2),
          },
        });
        const s = await tx.authSession.create({
          data: {
            userId: u.id,
            expiresAt: new Date(Date.now() + 3600000),
            mfaVerificadoEl: new Date(),
          },
        });
        const p = await tx.planBorrador.create({
          data: {
            codigo: `version-${randomUUID()}`,
            orden: 100,
            contenido: contenido() as unknown as Prisma.InputJsonValue,
          },
        });
        const db = new Proxy(tx, {
          get(target, key) {
            if (key === '$transaction')
              return (cb: (client: Prisma.TransactionClient) => unknown) =>
                cb(tx);
            return Reflect.get(target, key) as unknown;
          },
        }) as unknown as PrismaService;
        const auth: CurrentAuth = {
          userId: u.id,
          email: u.email,
          sessionId: s.id,
          esPlataforma: true,
          plataformaMfaPendiente: false,
          tenantId: '',
          membershipId: '',
          role: 'ADMINISTRADOR',
        };
        await fn({
          tx,
          service: new PlanesVersionesService(db),
          borradores: new PlanesBorradoresService(db),
          auth,
          id: p.id,
        });
        throw rollback;
      },
      { timeout: 20000 },
    );
  } catch (e) {
    if (e !== rollback) throw e;
  }
}

it('publica un snapshot completo con autor y auditoría, sin cambiar contratos ni precios', () =>
  escenario(async ({ tx, service, auth, id }) => {
    const planes = await tx.plan.findMany({ orderBy: { id: 'asc' } });
    const suscripciones = await tx.suscripcion.findMany({
      orderBy: { id: 'asc' },
    });
    const v = await service.publicar(auth, id, solicitud);
    expect(v).toMatchObject({
      numero: 1,
      revisionBorrador: 1,
      publicadoPorNombre: 'Admin de prueba',
      contenido: contenido(),
    });
    expect(v.catalogoSnapshot.capacidades).toHaveLength(66);
    expect(await service.detalle(v.id)).toEqual(v);
    expect(
      await tx.plataformaEvento.count({
        where: { staffUserId: auth.userId, tipo: 'plan_version_publicada' },
      }),
    ).toBe(1);
    expect(await tx.plan.findMany({ orderBy: { id: 'asc' } })).toEqual(planes);
    expect(await tx.suscripcion.findMany({ orderBy: { id: 'asc' } })).toEqual(
      suscripciones,
    );
  }));

it('editar el borrador mantiene el snapshot; reintentar una publicación es idempotente incluso después de editar', () =>
  escenario(async ({ tx, service, borradores, auth, id }) => {
    const v1 = await service.publicar(auth, id, solicitud);
    await borradores.guardar(auth, {
      catalogoVersion: 2,
      cambios: [
        {
          id,
          revision: 1,
          contenido: { ...contenido(), usuariosIncluidos: 4 },
        },
      ],
    });
    expect(await service.detalle(v1.id)).toEqual(v1);
    expect((await service.publicar(auth, id, solicitud)).id).toBe(v1.id);
    const v2 = await service.publicar(auth, id, { ...solicitud, revision: 2 });
    expect(v2.numero).toBe(2);
    expect(v2.contenido.usuariosIncluidos).toBe(4);
    expect((await service.listar(id)).versiones.map((v) => v.numero)).toEqual([
      2, 1,
    ]);
    expect(
      (await service.listar(id, 2)).versiones.map((v) => v.numero),
    ).toEqual([1]);
    expect(
      await tx.plataformaEvento.count({
        where: { staffUserId: auth.userId, tipo: 'plan_version_publicada' },
      }),
    ).toBe(2);
  }));

it('rechaza revisiones y catálogos desactualizados sin publicar otra selección', () =>
  escenario(async ({ tx, service, auth, id }) => {
    for (const dto of [
      { ...solicitud, revision: 2 },
      { ...solicitud, catalogoVersion: 1 },
    ])
      await expect(service.publicar(auth, id, dto)).rejects.toThrow(/cambió/);
    expect(await tx.planVersion.count({ where: { borradorId: id } })).toBe(0);
  }));

it('exige almacenamiento y respeta dependencias y pilotos antes de publicar', () =>
  escenario(async ({ tx, service, auth, id }) => {
    const planes = [
      PROPUESTA_PLANES[0].contenido,
      {
        ...contenido(),
        funciones: { ...contenido().funciones, centro_copiado: false },
      },
      {
        ...contenido(),
        funciones: { ...contenido().funciones, impresion_directa: true },
      },
    ];
    for (const p of planes) {
      await tx.planBorrador.update({
        where: { id },
        data: { contenido: p as unknown as Prisma.InputJsonValue },
      });
      await expect(service.publicar(auth, id, solicitud)).rejects.toThrow();
    }
    expect(await tx.planVersion.count({ where: { borradorId: id } })).toBe(0);
  }));

it('revalida rol, sesión, revocación y MFA dentro de la transacción', () =>
  escenario(async ({ tx, service, auth, id }) => {
    for (const a of [
      { ...auth, esPlataforma: false },
      { ...auth, plataformaMfaPendiente: true },
      { ...auth, sessionId: randomUUID() },
    ])
      await expect(service.publicar(a, id, solicitud)).rejects.toThrow(
        /administración/,
      );
    await tx.user.update({
      where: { id: auth.userId },
      data: { rolPlataforma: 'SOPORTE' },
    });
    await expect(service.publicar(auth, id, solicitud)).rejects.toThrow(
      /administración/,
    );
    await tx.user.update({
      where: { id: auth.userId },
      data: { rolPlataforma: 'ADMIN' },
    });
    await tx.authSession.update({
      where: { id: auth.sessionId },
      data: { revokedAt: new Date() },
    });
    await expect(service.publicar(auth, id, solicitud)).rejects.toThrow(
      /administración/,
    );
    expect(await tx.planVersion.count({ where: { borradorId: id } })).toBe(0);
  }));

it.each(['update', 'delete'] as const)(
  'la base impide %s sobre versiones publicadas',
  (operacion) =>
    escenario(async ({ tx, service, auth, id }) => {
      const v = await service.publicar(auth, id, solicitud);
      await tx.$executeRawUnsafe('SAVEPOINT prueba_inmutabilidad');
      await expect(
        operacion === 'update'
          ? tx.planVersion.update({
              where: { id: v.id },
              data: { motivo: 'Cambio prohibido' },
            })
          : tx.planVersion.delete({ where: { id: v.id } }),
      ).rejects.toThrow(/inmutables/);
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT prueba_inmutabilidad');
      expect(await service.detalle(v.id)).toEqual(v);
    }),
);

it('revierte la versión cuando falla la auditoría', () =>
  escenario(async ({ tx, auth, id }) => {
    const db = {
      $transaction: async (fn: (c: unknown) => Promise<unknown>) => {
        await tx.$executeRawUnsafe('SAVEPOINT prueba_auditoria');
        try {
          return await fn(
            new Proxy(tx, {
              get(target, key) {
                if (key === 'plataformaEvento')
                  return {
                    create: () => {
                      throw new Error('Auditoría indisponible');
                    },
                  };
                return Reflect.get(target, key) as unknown;
              },
            }),
          );
        } catch (e) {
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT prueba_auditoria');
          throw e;
        }
      },
    } as unknown as PrismaService;
    await expect(
      new PlanesVersionesService(db).publicar(auth, id, solicitud),
    ).rejects.toThrow('Auditoría');
    expect(await tx.planVersion.count({ where: { borradorId: id } })).toBe(0);
  }));

it('los DTO rechazan contenido inyectado y cursores inválidos; sólo ADMIN publica', async () => {
  expect(
    await validate(plainToInstance(PublicarPlanDto, solicitud), {
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  ).toHaveLength(0);
  expect(
    (
      await validate(
        plainToInstance(PublicarPlanDto, {
          ...solicitud,
          contenido: contenido(),
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      )
    ).length,
  ).toBeGreaterThan(0);
  expect(
    (await validate(plainToInstance(HistorialPlanesDto, { antes: '-1' })))
      .length,
  ).toBeGreaterThan(0);
  expect(
    Reflect.getMetadata('__guards__', PlanesVersionesController),
  ).toContain(PlataformaGuard);
  expect(
    Reflect.getMetadata(
      '__guards__',
      Object.getOwnPropertyDescriptor(
        PlanesVersionesController.prototype,
        'publicar',
      )!.value as object,
    ),
  ).toContain(PlataformaAdminGuard);
});
