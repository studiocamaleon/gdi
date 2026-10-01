import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { UsuariosService } from '../usuarios.service';
import { AuthService } from '../../auth/auth.service';
import { SessionCacheService } from '../../auth/session-cache.service';
import { MfaService } from '../../auth/mfa.service';
import { SecretosService } from '../../integraciones/cripto/secretos.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SuscripcionesService } from '../../suscripciones/suscripciones.service';
import type { CurrentAuth } from '../../auth/auth.types';

// Sólo usa la base descartable elegida por jest-setup-db.ts. Sin correo ni Meta.
const prisma = new PrismaClient();
const db = prisma as unknown as PrismaService;
const cache = new SessionCacheService();
const usuarios = new UsuariosService(db, cache, {} as SuscripcionesService);
const authService = new AuthService(
  db,
  new JwtService({ secret: 'identidad-compartida-test' }),
  cache,
  new MfaService(db, new SecretosService(), cache),
);
const empresas: string[] = [];
const identidades: string[] = [];
let auth: CurrentAuth;
let empresaAjena: string;
let rolId: string;
const clave = 'clave-ficticia-de-identidad';

beforeEach(async () => {
  const a = await prisma.tenant.create({
    data: { nombre: 'Empresa QA A', slug: randomUUID() },
  });
  const b = await prisma.tenant.create({
    data: { nombre: 'Empresa QA B', slug: randomUUID() },
  });
  empresas.push(a.id, b.id);
  empresaAjena = b.id;
  const admin = await prisma.user.create({
    data: { email: `${randomUUID()}@example.invalid` },
  });
  identidades.push(admin.id);
  const membership = await prisma.membership.create({
    data: { userId: admin.id, tenantId: a.id, rol: 'ADMINISTRADOR' },
  });
  const rol = await prisma.rol.create({
    data: {
      tenantId: a.id,
      nombre: 'Operario QA',
      permisos: ['produccion.ver'],
    },
  });
  rolId = rol.id;
  auth = {
    userId: admin.id,
    email: admin.email,
    tenantId: a.id,
    membershipId: membership.id,
    sessionId: randomUUID(),
    role: 'ADMINISTRADOR',
  };
});

async function persona(tenantId: string, staff = false) {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.invalid`,
      passwordHash: await bcrypt.hash(clave, 4),
      ...(staff ? { rolPlataforma: 'SOPORTE' as const } : {}),
    },
  });
  identidades.push(user.id);
  await prisma.membership.create({
    data: { userId: user.id, tenantId, rol: 'OPERADOR' },
  });
  return user;
}

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: empresas } } });
  await prisma.user.deleteMany({ where: { id: { in: identidades } } });
  await prisma.$disconnect();
});

it('vincular una cuenta existente conserva su contraseña y no entrega otra', async () => {
  const user = await persona(empresaAjena);
  const resultado = await usuarios.crear(auth, { email: user.email, rolId });
  expect(resultado.provisoria).toBeNull();
  expect(resultado.yaTeniaCuenta).toBe(true);
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
      .passwordHash,
  ).toBe(user.passwordHash);
});

it.each([true, false])(
  'un administrador no restablece una identidad de otra empresa (membresía activa=%s)',
  async (activa) => {
    const user = await persona(empresaAjena);
    await prisma.membership.updateMany({
      where: { userId: user.id, tenantId: empresaAjena },
      data: { activa },
    });
    await prisma.membership.create({
      data: { userId: user.id, tenantId: auth.tenantId, rol: 'OPERADOR' },
    });
    await expect(usuarios.restablecerPassword(auth, user.id)).rejects.toThrow(
      /titular|personal|otra empresa/i,
    );
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
        .passwordHash,
    ).toBe(user.passwordHash);
  },
);

it('una membresía no permite restablecer la contraseña del equipo de plataforma', async () => {
  const user = await persona(auth.tenantId, true);
  await expect(usuarios.restablecerPassword(auth, user.id)).rejects.toThrow(
    /titular|personal|plataforma/i,
  );
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
      .passwordHash,
  ).toBe(user.passwordHash);
});

it('una invitación no crea una sesión de una identidad existente sin demostrar su contraseña ni MFA', async () => {
  const user = await persona(empresaAjena);
  const token = randomBytes(32).toString('hex');
  await prisma.invitation.create({
    data: {
      tenantId: auth.tenantId,
      userId: user.id,
      email: user.email,
      rol: 'OPERADOR',
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 600_000),
    },
  });
  const resultado = await authService.acceptInvitation(token, {});
  expect(resultado).toEqual({ requiereLogin: true, accessToken: null });
  expect(await prisma.authSession.count({ where: { userId: user.id } })).toBe(
    0,
  );
});

it('la cuenta exclusiva de la empresa conserva el restablecimiento y revoca sus sesiones', async () => {
  const user = await persona(auth.tenantId);
  const membership = await prisma.membership.findFirstOrThrow({
    where: { userId: user.id, tenantId: auth.tenantId },
  });
  const session = await prisma.authSession.create({
    data: {
      userId: user.id,
      currentTenantId: auth.tenantId,
      currentMembershipId: membership.id,
      expiresAt: new Date(Date.now() + 600_000),
    },
  });
  const r = await usuarios.restablecerPassword(auth, user.id);
  const actual = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
  });
  expect(await bcrypt.compare(r.provisoria, actual.passwordHash!)).toBe(true);
  expect(
    (await prisma.authSession.findUniqueOrThrow({ where: { id: session.id } }))
      .revokedAt,
  ).not.toBeNull();
});

it.each([false, true])(
  'una invitación de empresa no activa una identidad preexistente pendiente (staff=%s)',
  async (staff) => {
    const user = await persona(empresaAjena, staff);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: null },
    });
    const token = randomBytes(32).toString('hex');
    const invitacion = await prisma.invitation.create({
      data: {
        tenantId: auth.tenantId,
        userId: user.id,
        email: user.email,
        rol: 'OPERADOR',
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 600_000),
      },
    });
    await expect(
      authService.acceptInvitation(token, { password: clave }),
    ).rejects.toThrow(/activación|titular/i);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
        .passwordHash,
    ).toBeNull();
    expect(
      (
        await prisma.invitation.findUniqueOrThrow({
          where: { id: invitacion.id },
        })
      ).acceptedAt,
    ).toBeNull();
    expect(await prisma.authSession.count({ where: { userId: user.id } })).toBe(
      0,
    );
  },
);

it('la invitación de una identidad nueva sí permite su primera activación', async () => {
  const email = `${randomUUID()}@example.invalid`;
  const token = randomBytes(32).toString('hex');
  await prisma.invitation.create({
    data: {
      tenantId: auth.tenantId,
      email,
      rol: 'OPERADOR',
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 600_000),
    },
  });
  try {
    const resultado = await authService.acceptInvitation(token, {
      password: clave,
    });
    expect(resultado.accessToken).toEqual(expect.any(String));
    const usuario = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await bcrypt.compare(clave, usuario.passwordHash!)).toBe(true);
  } finally {
    const usuario = await prisma.user.findUnique({ where: { email } });
    if (usuario) identidades.push(usuario.id);
  }
});
