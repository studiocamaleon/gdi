import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EquipoPlataformaService } from '../equipo.service';
import {
  AgregarEquipoDto,
  ActualizarEquipoDto,
  EquipoPlataformaController,
} from '../equipo.controller';
import { PlataformaGuard } from '../plataforma.guard';
import { PlataformaAdminGuard } from '../plataforma-admin.guard';
import { SessionCacheService } from '../../auth/session-cache.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';

const prisma = new PrismaClient();
const cache = new SessionCacheService();
const equipo = new EquipoPlataformaService(
  prisma as unknown as PrismaService,
  cache,
);
const ids: string[] = [];
const tenants: string[] = [];
const futuro = () => new Date(Date.now() + 60 * 60_000);
let admin: CurrentAuth;
let soporte: CurrentAuth;
let destino: string;

async function usuario(rol: 'ADMIN' | 'SOPORTE' | null) {
  const user = await prisma.user.create({
    data: {
      email: `equipo-${randomUUID()}@test.local`,
      nombreCompleto: 'Equipo test',
      passwordHash: 'hash-no-utilizado-en-login',
      rolPlataforma: rol,
    },
  });
  ids.push(user.id);
  if (rol === 'ADMIN')
    await prisma.userMfa.create({
      data: {
        userId: user.id,
        activatedAt: new Date(0),
        recuperacionConfirmadaEl: new Date(1),
      },
    });
  const sesion = await prisma.authSession.create({
    data: { userId: user.id, expiresAt: futuro(), mfaVerificadoEl: new Date() },
  });
  return {
    userId: user.id,
    email: user.email,
    sessionId: sesion.id,
    esPlataforma: true,
    plataformaMfaPendiente: false,
    tenantId: '',
    membershipId: '',
    role: 'ADMINISTRADOR',
  } satisfies CurrentAuth;
}
beforeEach(async () => {
  admin = await usuario('ADMIN');
  soporte = await usuario('SOPORTE');
  destino = (await usuario(null)).userId;
});
afterEach(async () => {
  await prisma.plataformaEvento.deleteMany({
    where: { staffUserId: { in: ids } },
  });
  await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.sesionImpersonacion.deleteMany({
    where: { staffUserId: { in: ids } },
  });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
  ids.length = 0;
  tenants.length = 0;
});
afterAll(async () => {
  await prisma.$disconnect();
});

it('el controlador exige rol de Plataforma y las escrituras requieren administración', () => {
  expect(
    Reflect.getMetadata('__guards__', EquipoPlataformaController),
  ).toContain(PlataformaGuard);
  for (const metodo of ['agregar', 'actualizar'] as const)
    expect(
      Reflect.getMetadata(
        '__guards__',
        EquipoPlataformaController.prototype[metodo],
      ),
    ).toContain(PlataformaAdminGuard);
});
it('valida correo, rol, motivo y rechaza campos ajenos al DTO', async () => {
  expect(
    await validate(
      plainToInstance(AgregarEquipoDto, {
        email: 'invalido',
        rol: 'OWNER',
        motivo: '  ',
        tenantId: randomUUID(),
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    ),
  ).toHaveLength(4);
  expect(
    await validate(
      plainToInstance(ActualizarEquipoDto, {
        accion: 'rol',
        rolActual: 'ADMIN',
        rol: 'SOPORTE',
        motivo: ' Cambio de funciones ',
      }),
    ),
  ).toHaveLength(0);
});
it('soporte no puede otorgarse ni otorgar permisos, incluso llamando directamente al servicio', async () => {
  await expect(
    equipo.agregar(soporte, soporte.email, 'ADMIN', 'Escalar permiso'),
  ).rejects.toThrow('administración');
  await expect(
    equipo.actualizar(
      soporte,
      soporte.userId,
      'rol',
      'SOPORTE',
      'ADMIN',
      'Escalar permiso',
    ),
  ).rejects.toThrow('administración');
  expect(
    await prisma.plataformaEvento.count({
      where: { staffUserId: soporte.userId },
    }),
  ).toBe(0);
});
it('exige sesión personal de backoffice vigente para cambiar el equipo', async () => {
  for (const auth of [
    { ...admin, esPlataforma: false },
    { ...admin, mcp: { credencialId: 'x', credencialNombre: 'x' } },
    {
      ...admin,
      impersonacion: {
        sesionId: 'x',
        actorUserId: admin.userId,
        actorNombre: 'x',
      },
    },
  ]) {
    await expect(
      equipo.actualizar(
        auth,
        soporte.userId,
        'revocar',
        'SOPORTE',
        undefined,
        'Baja de prueba',
      ),
    ).rejects.toThrow('personal');
  }
  await prisma.authSession.update({
    where: { id: admin.sessionId },
    data: { revokedAt: new Date() },
  });
  await expect(
    equipo.actualizar(
      admin,
      soporte.userId,
      'revocar',
      'SOPORTE',
      undefined,
      'Baja de prueba',
    ),
  ).rejects.toThrow('vigente');
});
it('otorga acceso a una cuenta existente, audita actor y motivo y no duplica altas', async () => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: destino } });
  await equipo.agregar(
    admin,
    user.email.toUpperCase(),
    'SOPORTE',
    '  Incorporación a soporte  ',
  );
  await expect(
    equipo.agregar(admin, user.email, 'ADMIN', 'Otra incorporación'),
  ).rejects.toThrow('ya pertenece');
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: destino } }))
      .rolPlataforma,
  ).toBe('SOPORTE');
  const eventos = await prisma.plataformaEvento.findMany({
    where: { staffUserId: admin.userId },
  });
  expect(eventos).toHaveLength(1);
  expect(eventos[0].datosJson).toMatchObject({
    usuarioId: destino,
    antes: null,
    despues: 'SOPORTE',
    motivo: 'Incorporación a soporte',
  });
});
it('no habilita cuentas inactivas o sin contraseña configurada', async () => {
  const user = await prisma.user.update({
    where: { id: destino },
    data: { passwordHash: null },
  });
  await expect(
    equipo.agregar(admin, user.email, 'ADMIN', 'Nuevo integrante'),
  ).rejects.toThrow('contraseña');
  await prisma.user.update({
    where: { id: destino },
    data: { passwordHash: 'hash', activo: false },
  });
  await expect(
    equipo.agregar(admin, user.email, 'ADMIN', 'Nuevo integrante'),
  ).rejects.toThrow('activa');
});
it('lista sólo integrantes, pagina y no expone contraseñas ni secretos MFA', async () => {
  await prisma.userMfa.create({
    data: {
      userId: soporte.userId,
      secret: { dato: 'SECRETO' },
      recoveryHashes: ['HASH-RECUPERACION'],
      activatedAt: new Date(),
    },
  });
  const datos = await equipo.listar(admin, 1, 1, soporte.email);
  expect(datos.total).toBe(1);
  expect(datos.usuarios[0]).toMatchObject({
    id: soporte.userId,
    mfaActivo: true,
    esPropio: false,
    sesionesActivas: 1,
  });
  const json = JSON.stringify(datos);
  for (const secreto of [
    'SECRETO',
    'HASH-RECUPERACION',
    'passwordHash',
    'recoveryHashes',
  ])
    expect(json).not.toContain(secreto);
  expect(
    (await equipo.listar(admin, 2, 1, soporte.email)).usuarios,
  ).toHaveLength(0);
});
it('una baja cierra backoffice e impersonación y conserva membresías y sesiones propias de empresa', async () => {
  const tenant = await prisma.tenant.create({
    data: { nombre: 'Equipo test', slug: `equipo-${randomUUID()}` },
  });
  tenants.push(tenant.id);
  const membership = await prisma.membership.create({
    data: { userId: soporte.userId, tenantId: tenant.id, rol: 'ADMINISTRADOR' },
  });
  const propia = await prisma.authSession.create({
    data: {
      userId: soporte.userId,
      currentTenantId: tenant.id,
      currentMembershipId: membership.id,
      expiresAt: futuro(),
    },
  });
  const imp = await prisma.sesionImpersonacion.create({
    data: {
      staffUserId: soporte.userId,
      tenantId: tenant.id,
      motivo: 'QA',
      expiraEl: futuro(),
    },
  });
  const sesionImp = await prisma.authSession.create({
    data: {
      userId: soporte.userId,
      currentTenantId: tenant.id,
      impersonacionId: imp.id,
      expiresAt: futuro(),
    },
  });
  await equipo.actualizar(
    admin,
    soporte.userId,
    'revocar',
    'SOPORTE',
    undefined,
    'Fin de colaboración',
  );
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: soporte.userId } }))
      .rolPlataforma,
  ).toBeNull();
  expect(
    (
      await prisma.authSession.findUniqueOrThrow({
        where: { id: soporte.sessionId },
      })
    ).revokedAt,
  ).not.toBeNull();
  expect(
    (
      await prisma.authSession.findUniqueOrThrow({
        where: { id: sesionImp.id },
      })
    ).revokedAt,
  ).not.toBeNull();
  expect(
    (
      await prisma.sesionImpersonacion.findUniqueOrThrow({
        where: { id: imp.id },
      })
    ).cerradaEl,
  ).not.toBeNull();
  expect(
    (await prisma.authSession.findUniqueOrThrow({ where: { id: propia.id } }))
      .revokedAt,
  ).toBeNull();
  expect(
    (
      await prisma.membership.findUniqueOrThrow({
        where: { id: membership.id },
      })
    ).activa,
  ).toBe(true);
});
it('cerrar mis otras sesiones conserva la actual y audita el alcance', async () => {
  const otra = await prisma.authSession.create({
    data: { userId: admin.userId, expiresAt: futuro() },
  });
  const r = await equipo.actualizar(
    admin,
    admin.userId,
    'sesiones',
    'ADMIN',
    undefined,
    'Revisión de accesos',
  );
  expect(r.sesionActualCerrada).toBe(false);
  expect(
    (
      await prisma.authSession.findUniqueOrThrow({
        where: { id: admin.sessionId },
      })
    ).revokedAt,
  ).toBeNull();
  expect(
    (await prisma.authSession.findUniqueOrThrow({ where: { id: otra.id } }))
      .revokedAt,
  ).not.toBeNull();
  expect(
    (await equipo.historial(1, 25)).eventos.some((e) =>
      e.descripcion.includes(admin.email),
    ),
  ).toBe(true);
});
it('rechaza un cambio basado en un rol obsoleto', async () => {
  await expect(
    equipo.actualizar(
      admin,
      soporte.userId,
      'revocar',
      'ADMIN',
      undefined,
      'Baja de soporte',
    ),
  ).rejects.toThrow('rol cambió');
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: soporte.userId } }))
      .rolPlataforma,
  ).toBe('SOPORTE');
});
it('serializa administradores que intentan degradarse entre sí; el perdedor pierde autorización', async () => {
  const segundo = await usuario('ADMIN');
  const resultados = await Promise.allSettled([
    equipo.actualizar(
      admin,
      segundo.userId,
      'rol',
      'ADMIN',
      'SOPORTE',
      'Reorganizar equipo',
    ),
    equipo.actualizar(
      segundo,
      admin.userId,
      'rol',
      'ADMIN',
      'SOPORTE',
      'Reorganizar equipo',
    ),
  ]);
  expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(
    await prisma.user.count({
      where: {
        id: { in: [admin.userId, segundo.userId] },
        rolPlataforma: 'ADMIN',
      },
    }),
  ).toBe(1);
});
it('impide quitar al último administrador utilizable y no escribe una baja', async () => {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: admin.userId,
        email: admin.email,
        activo: true,
        rolPlataforma: 'ADMIN',
        mfa: {
          activatedAt: new Date(0),
          recuperacionConfirmadaEl: new Date(1),
        },
      }),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    authSession: {
      findFirst: jest.fn().mockResolvedValue({
        id: admin.sessionId,
        mfaVerificadoEl: new Date(),
      }),
    },
  };
  const mockDb = {
    $transaction: (run: (db: typeof tx) => Promise<unknown>) => run(tx),
  } as unknown as PrismaService;
  await expect(
    new EquipoPlataformaService(mockDb, cache).actualizar(
      admin,
      admin.userId,
      'revocar',
      'ADMIN',
      undefined,
      'Baja de prueba',
    ),
  ).rejects.toThrow('al menos un administrador');
  expect(tx.user.update).not.toHaveBeenCalled();
  expect(tx.user.count).toHaveBeenCalledWith({
    where: {
      id: { not: admin.userId },
      activo: true,
      passwordHash: { not: null },
      rolPlataforma: 'ADMIN',
      mfa: {
        is: {
          activatedAt: { not: null },
          recuperacionConfirmadaEl: { not: null },
        },
      },
    },
  });
});
