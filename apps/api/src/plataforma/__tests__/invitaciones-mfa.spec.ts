import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TOTP } from 'otpauth';
import { EquipoPlataformaService } from '../equipo.service';
import { AuthService } from '../../auth/auth.service';
import { AuthGuard } from '../../auth/auth.guard';
import { MfaService } from '../../auth/mfa.service';
import { SessionCacheService } from '../../auth/session-cache.service';
import { SecretosService } from '../../integraciones/cripto/secretos.service';
import { SIN_TENANT_KEY } from '../../common/sin-tenant.decorator';
import { ENROLAMIENTO_PLATAFORMA } from '../../auth/enrolamiento-plataforma';
import type { CurrentAuth, JwtPayload } from '../../auth/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';

const prisma = new PrismaClient();
const db = prisma as unknown as PrismaService;
const cache = new SessionCacheService();
const secretos = new SecretosService();
const mfa = new MfaService(db, secretos, cache);
const jwt = new JwtService({ secret: process.env.JWT_SECRET });
const auth = new AuthService(db, jwt, cache, mfa);
const equipo = new EquipoPlataformaService(db, cache);
const originalKey = process.env.INTEGRACIONES_ENCRYPTION_KEY;
const sufijo = randomUUID();
const emails: string[] = [];
const password = 'Prueba-equipo-seguro-123';
let admin: CurrentAuth;
function correo() {
  const email = `inv-${randomUUID()}-${sufijo}@test.local`;
  emails.push(email);
  return email;
}
function sesion(payload: JwtPayload): CurrentAuth {
  return {
    userId: payload.sub,
    sessionId: payload.sessionId,
    tenantId: '',
    membershipId: '',
    email: payload.email,
    role: 'ADMINISTRADOR',
    esPlataforma: true,
  };
}
const token = (url: string) =>
  new URLSearchParams(new URL(url).hash.slice(1)).get('token')!;
beforeAll(() => {
  process.env.INTEGRACIONES_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  secretos.onModuleInit();
});
beforeEach(async () => {
  const user = await prisma.user.create({
    data: {
      email: correo(),
      passwordHash: await bcrypt.hash(password, 4),
      rolPlataforma: 'ADMIN',
      mfa: {
        create: {
          activatedAt: new Date(0),
          recuperacionConfirmadaEl: new Date(1),
        },
      },
    },
  });
  const s = await prisma.authSession.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + 3600000),
      mfaVerificadoEl: new Date(),
    },
  });
  admin = {
    userId: user.id,
    email: user.email,
    sessionId: s.id,
    tenantId: '',
    membershipId: '',
    role: 'ADMINISTRADOR',
    esPlataforma: true,
    plataformaMfaPendiente: false,
  };
});
afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await prisma.plataformaEvento.deleteMany({
    where: { staffUserId: { in: ids } },
  });
  await prisma.invitacionPlataforma.deleteMany({
    where: { email: { in: emails } },
  });
  await prisma.invitacionPlataforma.deleteMany({
    where: { invitadorId: { in: ids } },
  });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
  if (originalKey === undefined)
    delete process.env.INTEGRACIONES_ENCRYPTION_KEY;
  else process.env.INTEGRACIONES_ENCRYPTION_KEY = originalKey;
});

async function proteger(current: CurrentAuth) {
  const alta = await mfa.iniciar(current, password);
  const codigo = new TOTP({
    secret: alta.secret,
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  }).generate();
  const resultado = await mfa.confirmar(current, alta.setupId, codigo);
  return { alta, ...resultado };
}
async function entradaNueva() {
  const email = correo();
  const enlace = await equipo.invitar(
    admin,
    email,
    'SOPORTE',
    'Incorporación de soporte',
  );
  const r = await auth.aceptarInvitacionPlataforma({
    token: token(enlace.url),
    nombre: 'Integrante nuevo',
    password,
  });
  if (!r.accessToken) throw new Error('Se esperaba sesión limitada');
  return {
    enlace,
    email,
    r,
    current: sesion(jwt.verify<JwtPayload>(r.accessToken)),
  };
}
function contexto(tokenSesion: string, enrolar: boolean): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization: `Bearer ${tokenSesion}` },
      }),
    }),
    getHandler: () => ({ enrolar }),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}
const reflector = {
  getAllAndOverride: (clave: string, targets: Array<{ enrolar?: boolean }>) =>
    clave === SIN_TENANT_KEY
      ? true
      : clave === ENROLAMIENTO_PLATAFORMA
        ? !!targets[0].enrolar
        : false,
} as unknown as Reflector;
const guard = new AuthGuard(reflector, jwt, db, cache);

it('guarda sólo el hash, no otorga acceso al invitar y no expone tokens en directorio o auditoría', async () => {
  const email = correo();
  const enlace = await equipo.invitar(
    admin,
    email,
    'SOPORTE',
    'Nuevo integrante',
  );
  expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  const fila = await prisma.invitacionPlataforma.findUniqueOrThrow({
    where: { id: enlace.id },
  });
  expect(fila.tokenHash).not.toBe(token(enlace.url));
  expect(enlace.url).toContain('#token=');
  expect(JSON.stringify(await equipo.invitaciones(1, 100))).not.toContain(
    token(enlace.url),
  );
  const historial = await prisma.plataformaEvento.findMany({
    where: { staffUserId: admin.userId },
  });
  expect(JSON.stringify(historial)).not.toContain(token(enlace.url));
  await expect(
    equipo.invitar(admin, email, 'ADMIN', 'Duplicar invitación'),
  ).rejects.toThrow('pendiente');
});
it('nuevo integrante acepta una vez y sólo opera tras activar MFA y confirmar recuperación en esa sesión', async () => {
  const { enlace, r, current } = await entradaNueva();
  await expect(
    guard.canActivate(contexto(r.accessToken, false)),
  ).rejects.toThrow(ForbiddenException);
  await expect(guard.canActivate(contexto(r.accessToken, true))).resolves.toBe(
    true,
  );
  const protegida = await proteger(current);
  await expect(
    guard.canActivate(contexto(r.accessToken, false)),
  ).rejects.toThrow(ForbiddenException);
  await expect(
    mfa.confirmarRecuperacion(
      { ...current, sessionId: randomUUID() },
      protegida.versionRecuperacion,
    ),
  ).rejects.toThrow('sesión');
  await expect(
    mfa.confirmarRecuperacion(current, protegida.versionRecuperacion + 1),
  ).rejects.toThrow('corresponden');
  await mfa.confirmarRecuperacion(current, protegida.versionRecuperacion);
  await expect(guard.canActivate(contexto(r.accessToken, false))).resolves.toBe(
    true,
  );
  await expect(
    auth.aceptarInvitacionPlataforma({
      token: token(enlace.url),
      password,
      nombre: 'Otra persona',
    }),
  ).rejects.toThrow('invitación');
  await expect(
    mfa.gestionar(
      current,
      password,
      protegida.codigosRecuperacion[0],
      'desactivar',
    ),
  ).rejects.toThrow('obligatoria');
});
it('no toma una cuenta existente con sólo poseer el enlace ni reemplaza su contraseña o nombre', async () => {
  const email = correo();
  const user = await prisma.user.create({
    data: {
      email,
      nombreCompleto: 'Nombre original',
      passwordHash: await bcrypt.hash(password, 4),
    },
  });
  const enlace = await equipo.invitar(
    admin,
    email,
    'SOPORTE',
    'Incorporar cuenta existente',
  );
  await expect(
    auth.aceptarInvitacionPlataforma({
      token: token(enlace.url),
      password: 'otra-clave-inventada',
      nombre: 'Reemplazo',
    }),
  ).rejects.toThrow('contraseña');
  await auth.aceptarInvitacionPlataforma({
    token: token(enlace.url),
    password,
    nombre: 'Reemplazo',
  });
  const despues = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
  });
  expect(despues.passwordHash).toBe(user.passwordHash);
  expect(despues.nombreCompleto).toBe('Nombre original');
});
it('una cuenta con MFA debe superar su segundo factor antes de obtener el rol invitado', async () => {
  const email = correo();
  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 4) },
  });
  const session = await prisma.authSession.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 3600000) },
  });
  const current = { ...admin, userId: user.id, email, sessionId: session.id };
  const protegida = await proteger(current);
  await mfa.confirmarRecuperacion(current, protegida.versionRecuperacion);
  const enlace = await equipo.invitar(
    admin,
    email,
    'ADMIN',
    'Incorporar administrador',
  );
  const r = await auth.aceptarInvitacionPlataforma({
    token: token(enlace.url),
    password,
  });
  if (!('requiereMfa' in r)) throw new Error('Se esperaba MFA');
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
      .rolPlataforma,
  ).toBeNull();
  const aceptada = await auth.verificarMfa({
    challengeToken: r.challengeToken,
    codigo: protegida.codigosRecuperacion[0],
  });
  expect(aceptada.accessToken).toBeTruthy();
  await expect(
    guard.canActivate(contexto(aceptada.accessToken!, false)),
  ).resolves.toBe(true);
});
it('renovar invalida el enlace anterior y cancelar bloquea el nuevo', async () => {
  const email = correo();
  const enlace = await equipo.invitar(
    admin,
    email,
    'SOPORTE',
    'Alta de prueba',
  );
  const renovada = await equipo.gestionarInvitacion(
    admin,
    enlace.id,
    'renovar',
    'El enlace se perdió',
  );
  if (!('url' in renovada)) throw new Error('Falta nuevo enlace');
  expect(renovada.id).not.toBe(enlace.id);
  await expect(
    auth.consultarInvitacionPlataforma(token(enlace.url)),
  ).rejects.toThrow('invitación');
  expect(
    (await auth.consultarInvitacionPlataforma(token(renovada.url))).email,
  ).toBe(email);
  await equipo.gestionarInvitacion(
    admin,
    renovada.id,
    'cancelar',
    'Ya no se incorpora',
  );
  await expect(
    auth.aceptarInvitacionPlataforma({
      token: token(renovada.url),
      nombre: 'QA',
      password,
    }),
  ).rejects.toThrow('invitación');
});
it('cancelar mientras espera el segundo factor impide aceptar la invitación', async () => {
  const email = correo();
  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 4) },
  });
  const s = await prisma.authSession.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 3600000) },
  });
  const p = await proteger({
    ...admin,
    userId: user.id,
    email,
    sessionId: s.id,
  });
  const enlace = await equipo.invitar(admin, email, 'SOPORTE', 'Alta con MFA');
  const r = await auth.aceptarInvitacionPlataforma({
    token: token(enlace.url),
    password,
  });
  if (!('requiereMfa' in r)) throw new Error('Falta desafío');
  await equipo.gestionarInvitacion(
    admin,
    enlace.id,
    'cancelar',
    'Cancelar antes de aceptar',
  );
  await expect(
    auth.verificarMfa({
      challengeToken: r.challengeToken,
      codigo: p.codigosRecuperacion[0],
    }),
  ).rejects.toThrow('invitación');
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
      .rolPlataforma,
  ).toBeNull();
});
it('vencimiento y pérdida del permiso del invitador invalidan el enlace', async () => {
  const enlace = await equipo.invitar(
    admin,
    correo(),
    'SOPORTE',
    'Invitación con vencimiento',
  );
  await prisma.invitacionPlataforma.update({
    where: { id: enlace.id },
    data: { venceEl: new Date(0) },
  });
  await expect(
    auth.consultarInvitacionPlataforma(token(enlace.url)),
  ).rejects.toThrow('invitación');
  const otro = await equipo.invitar(
    admin,
    correo(),
    'ADMIN',
    'Otro integrante',
  );
  await prisma.user.update({
    where: { id: admin.userId },
    data: { rolPlataforma: 'SOPORTE' },
  });
  await expect(
    auth.consultarInvitacionPlataforma(token(otro.url)),
  ).rejects.toThrow('invitación');
});
it('dos aceptaciones concurrentes no crean dos identidades ni dos sesiones válidas', async () => {
  const email = correo();
  const enlace = await equipo.invitar(
    admin,
    email,
    'SOPORTE',
    'Prueba concurrente',
  );
  const dto = {
    token: token(enlace.url),
    nombre: 'Una sola persona',
    password,
  };
  const resultados = await Promise.allSettled([
    auth.aceptarInvitacionPlataforma(dto),
    auth.aceptarInvitacionPlataforma(dto),
  ]);
  expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(await prisma.authSession.count({ where: { userId: user.id } })).toBe(
    1,
  );
});
it('una sesión vieja sin prueba MFA no queda habilitada por tener MFA activa en la identidad', async () => {
  const { current, r } = await entradaNueva();
  const p = await proteger(current);
  await mfa.confirmarRecuperacion(current, p.versionRecuperacion);
  await prisma.authSession.update({
    where: { id: current.sessionId },
    data: { mfaVerificadoEl: null },
  });
  await expect(
    guard.canActivate(contexto(r.accessToken, false)),
  ).rejects.toThrow(ForbiddenException);
});
