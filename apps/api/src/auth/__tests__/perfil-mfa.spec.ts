import { PrismaClient, type User } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TOTP } from 'otpauth';
import sharp from 'sharp';
import { MfaService } from '../mfa.service';
import { PerfilService } from '../perfil.service';
import { AuthService } from '../auth.service';
import { SessionCacheService } from '../session-cache.service';
import { SecretosService } from '../../integraciones/cripto/secretos.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../auth.types';
import type { StorageDriver } from '../../archivos/storage/storage.driver';

// Jest fija DATABASE_URL a gdi_saas_test antes de importar este archivo.
const prisma = new PrismaClient();
const db = prisma as unknown as PrismaService;
const cache = new SessionCacheService();
const secretos = new SecretosService();
const mfa = new MfaService(db, secretos, cache);
const auth = new AuthService(
  db,
  new JwtService({ secret: 'test-perfil-mfa' }),
  cache,
  mfa,
);
const subir = jest.fn().mockResolvedValue(undefined);
const borrar = jest.fn().mockResolvedValue(undefined);
const firmarDescarga = jest
  .fn()
  .mockResolvedValue('https://storage.test/foto-firmada');
const perfil = new PerfilService(db, {
  subir,
  borrar,
  firmarDescarga,
} as unknown as StorageDriver);
const password = 'clave-de-prueba-mfa';
const claveAnterior = process.env.INTEGRACIONES_ENCRYPTION_KEY;
const usuarios: string[] = [];
const tenants: string[] = [];
let usuario: User;
let sesion: CurrentAuth;

function token(secret: string, offset = 0) {
  return new TOTP({
    secret,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  }).generate({ timestamp: Date.now() + offset });
}
async function activar() {
  const alta = await mfa.iniciar(sesion, password);
  const codigo = token(alta.secret);
  const { codigosRecuperacion } = await mfa.confirmar(
    sesion,
    alta.setupId,
    codigo,
  );
  return { alta, codigo, codigosRecuperacion };
}
async function desafio(plataforma = false) {
  const respuesta = plataforma
    ? await auth.loginPlataforma({ email: usuario.email, password })
    : await auth.login({ email: usuario.email, password });
  if (!('requiereMfa' in respuesta))
    throw new Error('Se esperaba segundo factor, no una sesión');
  expect(respuesta.accessToken).toBeNull();
  expect(respuesta).not.toHaveProperty('sessionId');
  return respuesta;
}

beforeAll(() => {
  process.env.INTEGRACIONES_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  secretos.onModuleInit();
});
beforeEach(async () => {
  jest.clearAllMocks();
  const tenant = await prisma.tenant.create({
    data: { nombre: 'Perfil QA', slug: `perfil-${randomUUID()}` },
  });
  tenants.push(tenant.id);
  usuario = await prisma.user.create({
    data: {
      email: `perfil-${randomUUID()}@test.local`,
      nombreCompleto: 'Persona QA',
      passwordHash: await bcrypt.hash(password, 4),
      rolPlataforma: 'SOPORTE',
    },
  });
  usuarios.push(usuario.id);
  const membership = await prisma.membership.create({
    data: { userId: usuario.id, tenantId: tenant.id, rol: 'ADMINISTRADOR' },
  });
  const session = await prisma.authSession.create({
    data: {
      userId: usuario.id,
      currentTenantId: tenant.id,
      currentMembershipId: membership.id,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  sesion = {
    userId: usuario.id,
    email: usuario.email,
    tenantId: tenant.id,
    membershipId: membership.id,
    sessionId: session.id,
    role: 'ADMINISTRADOR',
  };
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
  await prisma.$disconnect();
  if (claveAnterior === undefined)
    delete process.env.INTEGRACIONES_ENCRYPTION_KEY;
  else process.env.INTEGRACIONES_ENCRYPTION_KEY = claveAnterior;
});

describe('MFA de identidad: activación, login y recuperación', () => {
  it('requiere contraseña; el alta pendiente no activa MFA ni bloquea el login normal', async () => {
    await expect(mfa.iniciar(sesion, 'incorrecta')).rejects.toThrow(
      /contraseña/,
    );
    const alta = await mfa.iniciar(sesion, password);
    expect(alta.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const almacenado = await prisma.userMfa.findUniqueOrThrow({
      where: { userId: usuario.id },
    });
    expect(JSON.stringify(almacenado)).not.toContain(alta.secret);
    expect(almacenado.activatedAt).toBeNull();
    expect(
      (await auth.login({ email: usuario.email, password })).accessToken,
    ).toBeTruthy();
    await expect(
      mfa.confirmar(
        { ...sesion, sessionId: randomUUID() },
        alta.setupId,
        token(alta.secret),
      ),
    ).rejects.toThrow(/venció/);
    await mfa.cancelar(sesion);
    await expect(
      mfa.confirmar(sesion, alta.setupId, token(alta.secret)),
    ).rejects.toThrow(/venció/);
  });

  it('activa sólo al verificar, cifra el secreto, hashea códigos y revoca las otras sesiones', async () => {
    const otra = await prisma.authSession.create({
      data: { userId: usuario.id, expiresAt: new Date(Date.now() + 3600_000) },
    });
    cache.set({ ...sesion, sessionId: otra.id });
    const { alta, codigosRecuperacion } = await activar();
    const almacenado = await prisma.userMfa.findUniqueOrThrow({
      where: { userId: usuario.id },
    });
    expect(codigosRecuperacion).toHaveLength(10);
    expect(new Set(codigosRecuperacion).size).toBe(10);
    expect(JSON.stringify(almacenado)).not.toContain(alta.secret);
    expect(JSON.stringify(almacenado)).not.toContain(codigosRecuperacion[0]);
    expect(almacenado.pendingSecret).toBeNull();
    expect(
      (await prisma.authSession.findUniqueOrThrow({ where: { id: otra.id } }))
        .revokedAt,
    ).not.toBeNull();
    expect(
      (
        await prisma.authSession.findUniqueOrThrow({
          where: { id: sesion.sessionId },
        })
      ).revokedAt,
    ).toBeNull();
    expect(cache.get(otra.id)).toBeNull();
    expect(await mfa.estado(sesion)).toEqual(
      expect.objectContaining({ activo: true, codigosRestantes: 10 }),
    );
    await expect(mfa.iniciar(sesion, password)).rejects.toThrow(
      /ya está activa/,
    );
  });

  it('no emite sesión antes del segundo factor; acepta TOTP y rechaza su reutilización', async () => {
    const { alta, codigo } = await activar();
    const cantidad = await prisma.authSession.count({
      where: { userId: usuario.id },
    });
    const challenge = await desafio();
    expect(
      await prisma.authSession.count({ where: { userId: usuario.id } }),
    ).toBe(cantidad);
    await expect(
      auth.verificarMfa({ challengeToken: challenge.challengeToken, codigo }),
    ).rejects.toThrow(UnauthorizedException);
    const siguiente = token(alta.secret, 30_000);
    const respuesta = await auth.verificarMfa({
      challengeToken: challenge.challengeToken,
      codigo: siguiente,
    });
    expect(respuesta.accessToken).toBeTruthy();
    await expect(
      auth.verificarMfa({
        challengeToken: challenge.challengeToken,
        codigo: siguiente,
      }),
    ).rejects.toThrow();
    const nuevo = await desafio();
    await expect(
      auth.verificarMfa({
        challengeToken: nuevo.challengeToken,
        codigo: siguiente,
      }),
    ).rejects.toThrow();
  });

  it('un código de recuperación sólo emite una sesión aun con dos solicitudes simultáneas', async () => {
    const { codigosRecuperacion } = await activar();
    const a = await desafio();
    const b = await desafio();
    const resultados = await Promise.allSettled(
      [a, b].map((c) =>
        auth.verificarMfa({
          challengeToken: c.challengeToken,
          codigo: codigosRecuperacion[0],
        }),
      ),
    );
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await mfa.estado(sesion)).codigosRestantes).toBe(9);
  });

  it('persiste intentos inválidos y bloquea también desafíos nuevos al quinto error', async () => {
    await activar();
    const challenge = await desafio();
    for (let i = 0; i < 5; i++)
      await expect(
        auth.verificarMfa({
          challengeToken: challenge.challengeToken,
          codigo: 'wrong!',
        }),
      ).rejects.toThrow();
    const config = await prisma.userMfa.findUniqueOrThrow({
      where: { userId: usuario.id },
    });
    expect(config.failedAttempts).toBe(5);
    expect(config.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    await expect(
      auth.login({ email: usuario.email, password }),
    ).rejects.toThrow(/Demasiados intentos/);
  });

  it('rechaza desafíos vencidos y los emitidos antes de un cambio de contraseña', async () => {
    const { codigosRecuperacion } = await activar();
    const vencido = await desafio();
    await prisma.mfaChallenge.updateMany({
      where: { userId: usuario.id },
      data: { expiresAt: new Date(0) },
    });
    await expect(
      auth.verificarMfa({
        challengeToken: vencido.challengeToken,
        codigo: codigosRecuperacion[0],
      }),
    ).rejects.toThrow();
    const viejo = await desafio();
    await prisma.user.update({
      where: { id: usuario.id },
      data: { passwordHash: await bcrypt.hash('otra-clave', 4) },
    });
    await expect(
      auth.verificarMfa({
        challengeToken: viejo.challengeToken,
        codigo: codigosRecuperacion[0],
      }),
    ).rejects.toThrow();
    expect((await mfa.estado(sesion)).codigosRestantes).toBe(10);
  });

  it('revalida la empresa y sus restricciones de red al completar MFA', async () => {
    const { codigosRecuperacion } = await activar();
    const challenge = await desafio();
    await prisma.membership.update({
      where: { id: sesion.membershipId },
      data: { ipsPermitidas: ['192.0.2.1'] },
    });
    await expect(
      auth.verificarMfa(
        {
          challengeToken: challenge.challengeToken,
          codigo: codigosRecuperacion[0],
        },
        '192.0.2.2',
      ),
    ).rejects.toThrow(/red actual/);
    expect((await mfa.estado(sesion)).codigosRestantes).toBe(10);
    expect(
      (
        await auth.verificarMfa(
          {
            challengeToken: challenge.challengeToken,
            codigo: codigosRecuperacion[0],
          },
          '192.0.2.1',
        )
      ).accessToken,
    ).toBeTruthy();
  });

  it('el login de plataforma también exige MFA y revalida el rol', async () => {
    const { codigosRecuperacion } = await activar();
    const challenge = await desafio(true);
    await prisma.user.update({
      where: { id: usuario.id },
      data: { rolPlataforma: null },
    });
    await expect(
      auth.verificarMfa({
        challengeToken: challenge.challengeToken,
        codigo: codigosRecuperacion[0],
      }),
    ).rejects.toThrow(/equipo de Grafo/);
    await prisma.user.update({
      where: { id: usuario.id },
      data: { rolPlataforma: 'SOPORTE' },
    });
    const respuesta = await auth.verificarMfa({
      challengeToken: challenge.challengeToken,
      codigo: codigosRecuperacion[0],
    });
    expect('staff' in respuesta && respuesta.staff.rolPlataforma).toBe(
      'SOPORTE',
    );
  });

  it('renovar códigos invalida los anteriores; desactivar exige contraseña y un factor vigente', async () => {
    const { codigosRecuperacion } = await activar();
    await expect(
      mfa.gestionar(sesion, 'incorrecta', codigosRecuperacion[0], 'desactivar'),
    ).rejects.toThrow(/contraseña/);
    const nuevos = await mfa.gestionar(
      sesion,
      password,
      codigosRecuperacion[0],
      'regenerar',
    );
    await expect(
      mfa.gestionar(sesion, password, codigosRecuperacion[1], 'desactivar'),
    ).rejects.toThrow(/Código/);
    await mfa.gestionar(
      sesion,
      password,
      nuevos.codigosRecuperacion[0],
      'desactivar',
    );
    expect((await mfa.estado(sesion)).activo).toBe(false);
    expect(
      (
        await prisma.userMfa.findUniqueOrThrow({
          where: { userId: usuario.id },
        })
      ).secret,
    ).toBeNull();
    expect(
      (await auth.login({ email: usuario.email, password })).accessToken,
    ).toBeTruthy();
  });

  it('aceptar una invitación no elude MFA', async () => {
    await activar();
    const invitationToken = randomBytes(32).toString('hex');
    await prisma.invitation.create({
      data: {
        tenantId: sesion.tenantId,
        userId: usuario.id,
        email: usuario.email,
        rol: 'ADMINISTRADOR',
        tokenHash: createHash('sha256').update(invitationToken).digest('hex'),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const antes = await prisma.authSession.count({
      where: { userId: usuario.id },
    });
    expect(await auth.acceptInvitation(invitationToken, {})).toEqual({
      requiereLogin: true,
      accessToken: null,
    });
    expect(
      await prisma.authSession.count({ where: { userId: usuario.id } }),
    ).toBe(antes);
  });
});

describe('Perfil personal', () => {
  it('edita el nombre sin cambiar correo y lo devuelve en el contexto de sesión', async () => {
    await perfil.editar(sesion, '  Nuevo Nombre  ');
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: usuario.id },
    });
    expect(user.nombreCompleto).toBe('Nuevo Nombre');
    expect(user.email).toBe(usuario.email);
    const login = await auth.login({ email: usuario.email, password });
    expect('currentUser' in login && login.currentUser.nombreCompleto).toBe(
      'Nuevo Nombre',
    );
    await expect(perfil.editar(sesion, '   ')).rejects.toThrow();
  });

  it('recodifica la foto, publica una URL privada y limpia la versión reemplazada', async () => {
    const png = await sharp({
      create: { width: 32, height: 24, channels: 3, background: '#ff7546' },
    })
      .png()
      .toBuffer();
    const primera = await perfil.guardarFoto(sesion, png.toString('base64'));
    const [, bytes, contentType] = subir.mock.calls[0] as [
      string,
      Buffer,
      string,
    ];
    expect(contentType).toBe('image/webp');
    expect(await sharp(bytes).metadata()).toEqual(
      expect.objectContaining({ width: 512, height: 512, format: 'webp' }),
    );
    expect(await perfil.urlFoto(sesion)).toBe(
      'https://storage.test/foto-firmada',
    );
    expect(firmarDescarga).toHaveBeenCalledWith(
      `usuarios/${usuario.id}/perfil/${primera.fotoPerfilVersion}.webp`,
      expect.objectContaining({ expiraSegundos: 60 }),
    );
    const segunda = await perfil.guardarFoto(sesion, png.toString('base64'));
    expect(borrar).toHaveBeenCalledWith(
      `usuarios/${usuario.id}/perfil/${primera.fotoPerfilVersion}.webp`,
    );
    const login = await auth.login({ email: usuario.email, password });
    expect('currentUser' in login && login.currentUser.fotoPerfilVersion).toBe(
      segunda.fotoPerfilVersion,
    );
    await perfil.quitarFoto(sesion);
    expect(borrar).toHaveBeenCalledWith(
      `usuarios/${usuario.id}/perfil/${segunda.fotoPerfilVersion}.webp`,
    );
    await expect(perfil.urlFoto(sesion)).rejects.toThrow(/No hay foto/);
  });

  it('rechaza SVG, archivos inválidos y archivos demasiado grandes', async () => {
    for (const contenido of [
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      Buffer.from('no es una foto'),
      Buffer.alloc(512_001),
    ]) {
      await expect(
        perfil.guardarFoto(sesion, contenido.toString('base64')),
      ).rejects.toThrow();
    }
    expect(subir).not.toHaveBeenCalled();
  });

  it('una sesión MCP o de soporte impersonando no puede modificar identidad ni MFA', async () => {
    const variantes: CurrentAuth[] = [
      {
        ...sesion,
        mcp: { credencialId: randomUUID(), credencialNombre: 'QA' },
      },
      {
        ...sesion,
        impersonacion: {
          sesionId: randomUUID(),
          actorUserId: randomUUID(),
          actorNombre: 'Soporte',
        },
      },
    ];
    for (const contexto of variantes) {
      await expect(perfil.editar(contexto, 'No permitido')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(perfil.quitarFoto(contexto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(mfa.iniciar(contexto, password)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(mfa.estado(contexto)).rejects.toThrow(ForbiddenException);
    }
  });
});
