import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SinTenant } from '../../common/sin-tenant.decorator';
import type { Server } from 'node:http';
import {
  Controller,
  Get,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { TOTP } from 'otpauth';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretosService } from '../../integraciones/cripto/secretos.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { AuthGuard } from '../auth.guard';
import { MfaService } from '../mfa.service';
import { SessionCacheService } from '../session-cache.service';
import { CurrentSession } from '../current-auth.decorator';
import { Permiso, SoloAutenticado } from '../permiso.decorator';
import { PermisosGuard } from '../permisos.guard';
import { RolesGuard } from '../roles.guard';
import { Roles } from '../roles.decorator';
import { todosLosPermisos } from '../permisos';
import { hashTokenMcp } from '../credencial-mcp.util';
import type { CurrentAuth } from '../auth.types';
import { RegistroService } from '../../registro/registro.service';
import { TenantProvisioningService } from '../../provisionamiento/tenant-provisioning.service';

/** Dos aplicaciones HTTP con servicios separados sobre la misma base real.
 * Las rutas de sonda sólo permiten observar la autorización; las operaciones
 * de logout, clave y MFA usan los servicios de la aplicación. Sin red externa. */
@Controller('sonda')
class SondaController {
  @Get('plataforma')
  @SinTenant()
  plataforma() {
    return { ok: true };
  }

  @Get()
  @SoloAutenticado()
  acceso(@CurrentSession() auth: CurrentAuth) {
    return { role: auth.role, tenantId: auth.tenantId };
  }

  @Get('administracion')
  @Permiso('configuracion.gestionar')
  administrar() {
    return { ok: true };
  }

  @Get('rol-admin')
  @SoloAutenticado()
  @Roles('ADMINISTRADOR')
  rolAdmin() {
    return { ok: true };
  }
}

describe('Revocación efectiva entre instancias de la API', () => {
  const prisma = new PrismaService();
  const jwt = new JwtService({ secret: randomUUID() });
  const secretoAnterior = process.env.JWT_SECRET;
  const cifradoAnterior = process.env.INTEGRACIONES_ENCRYPTION_KEY;
  const secreto = randomUUID();
  const password = 'Clave ficticia de prueba 123';
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  const apps: INestApplication<Server>[] = [];
  const servicios: AuthService[] = [];
  const mfas: MfaService[] = [];
  let baseValidada = false;
  let auth: CurrentAuth;
  let otra: CurrentAuth;
  let rolId: string;

  const bearer = (sesion: CurrentAuth) =>
    jwt.sign(
      {
        sub: sesion.userId,
        sessionId: sesion.sessionId,
        tenantId: sesion.tenantId,
        membershipId: sesion.membershipId,
        email: sesion.email,
        role: sesion.role,
      },
      { secret: secreto },
    );
  const acceder = (
    instancia: number,
    sesion: CurrentAuth | string,
    ruta = '/sonda',
  ) =>
    request(apps[instancia].getHttpServer())
      .get(ruta)
      .set(
        'Authorization',
        `Bearer ${typeof sesion === 'string' ? sesion : bearer(sesion)}`,
      );

  async function sesion(contexto: CurrentAuth): Promise<CurrentAuth> {
    const row = await prisma.authSession.create({
      data: {
        userId: contexto.userId,
        currentTenantId: contexto.tenantId,
        currentMembershipId: contexto.membershipId,
        expiresAt: new Date(Date.now() + 6 * 3_600_000),
      },
    });
    return { ...contexto, sessionId: row.id };
  }

  async function credencial() {
    const token = `grafo_mcp_${randomBytes(32).toString('hex')}`;
    const row = await prisma.credencialMcp.create({
      data: {
        tenantId: auth.tenantId,
        membershipId: auth.membershipId,
        nombre: 'Integración ficticia',
        tokenHash: hashTokenMcp(token),
        pista: token.slice(-4),
        creadaPorId: auth.userId,
      },
    });
    return { token, id: row.id };
  }

  async function baja(origen: 'empleado' | 'usuario', db = prisma) {
    const user = await prisma.user.create({
      data: { email: `qa-admin-${randomUUID()}@example.invalid` },
    });
    userIds.push(user.id);
    const miembro = await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId: auth.tenantId,
        rol: 'ADMINISTRADOR',
      },
    });
    const administrador = await sesion({
      ...auth,
      userId: user.id,
      email: user.email,
      membershipId: miembro.id,
    });
    if (origen === 'usuario') {
      return new UsuariosService(
        db,
        new SessionCacheService(),
        {} as never,
      ).editar(administrador, auth.userId, { activa: false });
    }
    const empleado = await prisma.empleado.create({
      data: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        nombreCompleto: 'Empleado ficticio',
        emailPrincipal: auth.email,
        telefonoCodigo: '+54',
        telefonoNumero: '0000000000',
        sector: 'Pruebas',
        fechaIngreso: new Date('2026-01-01'),
      },
    });
    return new AuthService(
      db,
      jwt,
      new SessionCacheService(),
      mfas[0],
    ).revokeEmployeeAccess(administrador, empleado.id);
  }

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Requiere base local de test y aislamiento activo');
    baseValidada = true;
    process.env.JWT_SECRET = secreto;
    process.env.INTEGRACIONES_ENCRYPTION_KEY =
      randomBytes(32).toString('base64');
    await prisma.$connect();
    for (let i = 0; i < 2; i++) {
      const cache = new SessionCacheService();
      const secretos = new SecretosService();
      secretos.onModuleInit();
      const mfa = new MfaService(prisma, secretos, cache);
      const servicio = new AuthService(prisma, jwt, cache, mfa);
      const capacidades = capacidadesDePrueba();
      const plan = await capacidades.actual('empresa-ficticia');
      plan.contrato.funciones.mcp = true;
      jest.spyOn(capacidades, 'actual').mockImplementation((tenantId) =>
        Promise.resolve({
          ...plan,
          empresa: { ...plan.empresa, id: tenantId },
        }),
      );
      const module = await Test.createTestingModule({
        controllers: [SondaController, AuthController],
        providers: [
          AuthGuard,
          { provide: PrismaService, useValue: prisma },
          { provide: JwtService, useValue: jwt },
          { provide: SessionCacheService, useValue: cache },
          { provide: CapacidadesEmpresaService, useValue: capacidades },
          { provide: AuthService, useValue: servicio },
        ],
      }).compile();
      const app = module.createNestApplication<INestApplication<Server>>();
      const reflector = app.get(Reflector);
      app.useGlobalGuards(
        app.get(AuthGuard),
        new RolesGuard(reflector),
        new PermisosGuard(reflector),
      );
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();
      apps.push(app);
      servicios.push(servicio);
      mfas.push(mfa);
    }
  });

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        nombre: 'Empresa ficticia de seguridad',
        slug: `qa-revocacion-${randomUUID()}`,
      },
    });
    tenantIds.push(tenant.id);
    const user = await prisma.user.create({
      data: {
        email: `qa-revocacion-${randomUUID()}@example.invalid`,
        passwordHash: await bcrypt.hash(password, 4),
      },
    });
    userIds.push(user.id);
    const rol = await prisma.rol.create({
      data: {
        tenantId: tenant.id,
        nombre: 'Administración ficticia',
        permisos: todosLosPermisos(),
      },
    });
    rolId = rol.id;
    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        rol: 'ADMINISTRADOR',
        rolId,
      },
    });
    auth = await sesion({
      userId: user.id,
      email: user.email,
      sessionId: '',
      tenantId: tenant.id,
      membershipId: membership.id,
      role: 'ADMINISTRADOR',
    });
    otra = await sesion(auth);
  });

  afterAll(async () => {
    for (const app of apps) await app.close();
    if (baseValidada) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await prisma.$disconnect();
    if (secretoAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretoAnterior;
    if (cifradoAnterior === undefined)
      delete process.env.INTEGRACIONES_ENCRYPTION_KEY;
    else process.env.INTEGRACIONES_ENCRYPTION_KEY = cifradoAnterior;
  });

  it('logout corta el mismo token en la otra instancia en la siguiente solicitud', async () => {
    await acceder(1, auth).expect(200);
    await request(apps[0].getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${bearer(auth)}`)
      .expect(204);
    await acceder(1, auth).expect(401);
    await acceder(1, otra).expect(200);
  });

  it('cambiar la clave cierra los accesos anteriores y entrega una sesión renovada', async () => {
    await acceder(0, otra).expect(200);
    await acceder(1, otra).expect(200);
    const cambio = await request(apps[0].getHttpServer())
      .post('/auth/password')
      .set('Authorization', `Bearer ${bearer(auth)}`)
      .send({ actual: password, nueva: 'Otra clave ficticia 456' })
      .expect(201);
    await acceder(0, otra).expect(401);
    await acceder(1, otra).expect(401);
    await acceder(1, auth).expect(401);
    await acceder(1, cambio.headers['x-grafoprint-sesion-renovada']).expect(
      200,
    );
  });

  it('una copia del token de la sesión que cambió la clave deja de servir', async () => {
    const tokenAnterior = bearer(auth);
    const original = await prisma.authSession.findUniqueOrThrow({
      where: { id: auth.sessionId },
    });
    const respuesta = await request(apps[0].getHttpServer())
      .post('/auth/password')
      .set('Authorization', `Bearer ${tokenAnterior}`)
      .send({ actual: password, nueva: 'Cambio seguro ficticio 987' })
      .expect(201);
    await acceder(1, tokenAnterior).expect(401);
    const nuevo = respuesta.headers['x-grafoprint-sesion-renovada'];
    expect(nuevo).toEqual(expect.any(String));
    expect(nuevo).not.toBe(tokenAnterior);
    expect(respuesta.body).toEqual({ ok: true });
    await acceder(1, nuevo).expect(200);
    const payload = jwt.verify<{ sessionId: string }>(nuevo, {
      secret: secreto,
    });
    const renovada = await prisma.authSession.findUniqueOrThrow({
      where: { id: payload.sessionId },
    });
    expect(renovada.createdAt).toEqual(original.createdAt);
    expect(renovada.expiresAt).toEqual(original.expiresAt);
  });

  it.each([true, false])(
    'rotar una sesión de plataforma conserva MFA verificada=%s, sin concederla',
    async (verificada) => {
      const activada = new Date(Date.now() - 60000);
      const factor = verificada ? new Date() : null;
      await prisma.user.update({
        where: { id: auth.userId },
        data: { rolPlataforma: 'ADMIN' },
      });
      await prisma.userMfa.create({
        data: {
          userId: auth.userId,
          activatedAt: activada,
          recuperacionConfirmadaEl: activada,
        },
      });
      const plataforma = await prisma.authSession.create({
        data: {
          userId: auth.userId,
          mfaVerificadoEl: factor,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      const anterior = jwt.sign(
        {
          sub: auth.userId,
          sessionId: plataforma.id,
          plat: true,
          email: auth.email,
          role: 'ADMINISTRADOR',
        },
        { secret: secreto },
      );
      const cambio = await request(apps[0].getHttpServer())
        .post('/auth/password')
        .set('Authorization', `Bearer ${anterior}`)
        .send({ actual: password, nueva: 'Nueva clave staff ficticia 789' })
        .expect(201);
      const nuevo = cambio.headers['x-grafoprint-sesion-renovada'];
      await acceder(1, anterior, '/sonda/plataforma').expect(401);
      await acceder(1, nuevo, '/sonda/plataforma').expect(
        verificada ? 200 : 403,
      );
      await acceder(1, nuevo, '/sonda').expect(401);
      const payload = jwt.verify<{ sessionId: string; plat: boolean }>(nuevo, {
        secret: secreto,
      });
      expect(payload.plat).toBe(true);
      const nueva = await prisma.authSession.findUniqueOrThrow({
        where: { id: payload.sessionId },
      });
      expect(nueva.mfaVerificadoEl).toEqual(factor);
      expect(nueva.currentTenantId).toBeNull();
      expect(nueva.currentMembershipId).toBeNull();
    },
  );

  it('si no se puede firmar el nuevo acceso, revierte también la clave y las sesiones', async () => {
    const anterior = await prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
    });
    const sesiones = await prisma.authSession.findMany({
      where: { userId: auth.userId },
      orderBy: { id: 'asc' },
    });
    const falla = jest
      .spyOn(jwt, 'signAsync')
      .mockRejectedValueOnce(new Error('Firma no disponible en ensayo'));
    try {
      await expect(
        servicios[0].cambiarPassword(auth, {
          actual: password,
          nueva: 'No persistir esta clave 123',
        }),
      ).rejects.toThrow('Firma no disponible en ensayo');
    } finally {
      falla.mockRestore();
    }
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: auth.userId } }),
    ).toEqual(anterior);
    expect(
      await prisma.authSession.findMany({
        where: { userId: auth.userId },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(sesiones);
    await acceder(1, auth).expect(200);
    await acceder(1, otra).expect(200);
  });

  it.each([
    'sesion',
    'usuario',
    'empresa',
    'membresia',
    'vencimiento',
  ] as const)(
    'consulta la revocación o inhabilitación de %s aunque el token ya se haya usado',
    async (tipo) => {
      await acceder(1, auth).expect(200);
      if (tipo === 'sesion')
        await prisma.authSession.update({
          where: { id: auth.sessionId },
          data: { revokedAt: new Date() },
        });
      if (tipo === 'usuario')
        await prisma.user.update({
          where: { id: auth.userId },
          data: { activo: false },
        });
      if (tipo === 'empresa')
        await prisma.tenant.update({
          where: { id: auth.tenantId },
          data: { activo: false },
        });
      if (tipo === 'membresia')
        await prisma.membership.update({
          where: { id: auth.membershipId },
          data: { activa: false },
        });
      if (tipo === 'vencimiento')
        await prisma.authSession.update({
          where: { id: auth.sessionId },
          data: { expiresAt: new Date(Date.now() - 1_000) },
        });
      await acceder(1, auth).expect(401);
    },
  );

  it('aplica permisos modificados al siguiente request en otra instancia', async () => {
    await acceder(1, auth, '/sonda/administracion').expect(200);
    await prisma.rol.update({
      where: { id: rolId },
      data: { permisos: ['registros.ver'] },
    });
    await acceder(1, auth, '/sonda/administracion').expect(403);
    await acceder(1, auth).expect(200);
  });

  it('el rol vigente reemplaza al antiguo del JWT incluso en una instancia sin caché', async () => {
    const token = bearer(auth);
    await acceder(1, token, '/sonda/rol-admin').expect(200);
    await prisma.membership.update({
      where: { id: auth.membershipId },
      data: { rol: 'OPERADOR', rolId: null },
    });
    await acceder(0, token, '/sonda/rol-admin').expect(403);
    await acceder(1, token, '/sonda/rol-admin').expect(403);
  });

  it('cambiar de empresa invalida el contexto anterior en todas las instancias', async () => {
    await acceder(1, auth).expect(200);
    const tenant = await prisma.tenant.create({
      data: {
        nombre: 'Otra empresa ficticia',
        slug: `qa-switch-${randomUUID()}`,
      },
    });
    tenantIds.push(tenant.id);
    await prisma.membership.create({
      data: { userId: auth.userId, tenantId: tenant.id, rol: 'OPERADOR' },
    });
    const siguiente = await servicios[0].switchTenant(auth, tenant.id);
    await acceder(1, auth).expect(401);
    await acceder(1, siguiente.accessToken!).expect(200);
  });

  it.each(['revocada', 'vencida'] as const)(
    'cambiar empresa no emite otro token si la sesión quedó %s después de autorizar la solicitud',
    async (estado) => {
      await prisma.authSession.update({
        where: { id: auth.sessionId },
        data:
          estado === 'revocada'
            ? { revokedAt: new Date() }
            : { expiresAt: new Date(Date.now() - 1000) },
      });
      const antes = await prisma.authSession.findUniqueOrThrow({
        where: { id: auth.sessionId },
      });
      await expect(
        servicios[0].switchTenant(auth, auth.tenantId),
      ).rejects.toThrow();
      expect(
        await prisma.authSession.findUniqueOrThrow({
          where: { id: auth.sessionId },
        }),
      ).toEqual(antes);
    },
  );

  it.each(['mcp', 'impersonacion', 'plataforma'] as const)(
    'el cambio de empresa requiere una sesión personal, no %s',
    async (origen) => {
      const contextual: CurrentAuth = {
        ...auth,
        ...(origen === 'mcp'
          ? { mcp: { credencialId: randomUUID(), credencialNombre: 'QA' } }
          : {}),
        ...(origen === 'impersonacion'
          ? {
              impersonacion: {
                sesionId: randomUUID(),
                actorUserId: auth.userId,
                actorNombre: 'Soporte ficticio',
              },
            }
          : {}),
        ...(origen === 'plataforma' ? { esPlataforma: true } : {}),
      };
      await expect(
        servicios[0].switchTenant(contextual, auth.tenantId),
      ).rejects.toThrow();
    },
  );

  it('una restricción de red nueva no conserva la autorización anterior', async () => {
    await acceder(1, auth).expect(200);
    await prisma.membership.update({
      where: { id: auth.membershipId },
      data: { ipsPermitidas: ['203.0.113.10'] },
    });
    await acceder(1, auth).expect(401);
  });

  it.each(['revocada', 'vencida', 'membresia', 'scopes'] as const)(
    'revalida una credencial MCP %s después de haberla aceptado',
    async (tipo) => {
      const mcp = await credencial();
      await acceder(1, mcp.token, '/sonda/administracion').expect(200);
      if (tipo === 'revocada')
        await prisma.credencialMcp.update({
          where: { id: mcp.id },
          data: { revocadoEl: new Date() },
        });
      if (tipo === 'vencida')
        await prisma.credencialMcp.update({
          where: { id: mcp.id },
          data: { expiraEl: new Date(Date.now() - 1_000) },
        });
      if (tipo === 'membresia')
        await prisma.membership.update({
          where: { id: auth.membershipId },
          data: { activa: false },
        });
      if (tipo === 'scopes')
        await prisma.credencialMcp.update({
          where: { id: mcp.id },
          data: { scopes: ['registros.ver'] },
        });
      await acceder(1, mcp.token, '/sonda/administracion').expect(
        tipo === 'scopes' ? 403 : 401,
      );
    },
  );

  it('activar MFA invalida las sesiones anteriores también en la otra instancia', async () => {
    await acceder(1, otra).expect(200);
    const alta = await mfas[0].iniciar(auth, password);
    const codigo = new TOTP({
      secret: alta.secret,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    }).generate();
    await mfas[0].confirmar(auth, alta.setupId, codigo);
    await acceder(1, otra).expect(401);
    await acceder(1, auth).expect(200);
  });

  it.each(['sin-verificar', 'verificacion-anterior'] as const)(
    'ninguna instancia acepta una sesión con MFA %s aunque no figure revocada',
    async (estado) => {
      const activadoEl = new Date();
      await prisma.userMfa.create({
        data: { userId: auth.userId, activatedAt: activadoEl },
      });
      await prisma.authSession.update({
        where: { id: auth.sessionId },
        data: {
          mfaVerificadoEl:
            estado === 'sin-verificar'
              ? null
              : new Date(activadoEl.getTime() - 1_000),
        },
      });
      await acceder(0, auth).expect(401);
      await acceder(1, auth).expect(401);
    },
  );

  it('conserva una sesión de empresa que verificó la versión vigente de MFA', async () => {
    const activadoEl = new Date();
    await prisma.userMfa.create({
      data: { userId: auth.userId, activatedAt: activadoEl },
    });
    await prisma.authSession.update({
      where: { id: auth.sessionId },
      data: { mfaVerificadoEl: activadoEl },
    });
    await acceder(0, auth).expect(200);
    await acceder(1, auth).expect(200);
  });

  it('agregar una empresa conserva la sesión personal y su verificación MFA', async () => {
    const factor = new Date();
    await prisma.userMfa.create({
      data: { userId: auth.userId, activatedAt: factor },
    });
    await prisma.authSession.update({
      where: { id: auth.sessionId },
      data: { mfaVerificadoEl: factor },
    });
    const plan = await prisma.plan.create({
      data: {
        codigo: `qa-mfa-registro-${randomUUID()}`,
        nombre: 'Plan ficticio',
        precioMensual: 0,
        featuresJson: {},
      },
    });
    const token = randomUUID();
    const registro = await prisma.registroTenant.create({
      data: {
        email: auth.email,
        nombreCompleto: 'Persona ficticia',
        empresaNombre: 'Segunda empresa ficticia',
        planId: plan.id,
        paisCodigo: 'AR',
        zonaHoraria: 'America/Argentina/Buenos_Aires',
        tokenHash: createHash('sha256').update(token).digest('hex'),
        tokenExpiraEl: new Date(Date.now() + 60000),
        terminosVersion: 'qa',
        terminosAceptadosEl: new Date(),
      },
    });
    try {
      const cantidad = await prisma.authSession.count({
        where: { userId: auth.userId },
      });
      const service = new RegistroService(
        prisma,
        {} as never,
        new TenantProvisioningService(),
        servicios[0],
      );
      const resultado = await service.completarExistente(token, auth);
      expect(resultado.sessionId).toBe(auth.sessionId);
      expect(
        await prisma.authSession.count({ where: { userId: auth.userId } }),
      ).toBe(cantidad);
      expect(
        (
          await prisma.authSession.findUniqueOrThrow({
            where: { id: resultado.sessionId },
          })
        ).mfaVerificadoEl,
      ).toEqual(factor);
      await acceder(1, resultado.accessToken!).expect(200);
      await acceder(1, auth).expect(401);
    } finally {
      const creado = await prisma.registroTenant.findUniqueOrThrow({
        where: { id: registro.id },
      });
      await prisma.registroTenant.delete({ where: { id: registro.id } });
      if (creado.tenantCreadoId)
        await prisma.tenant.delete({ where: { id: creado.tenantCreadoId } });
      await prisma.plan.delete({ where: { id: plan.id } });
    }
  });

  it('dos cambios simultáneos con la clave anterior sólo permiten un ganador', async () => {
    const cambios = await Promise.allSettled([
      servicios[0].cambiarPassword(auth, {
        actual: password,
        nueva: 'Nueva ficticia A 123',
      }),
      servicios[1].cambiarPassword(auth, {
        actual: password,
        nueva: 'Nueva ficticia B 456',
      }),
    ]);
    expect(cambios.filter((c) => c.status === 'fulfilled')).toHaveLength(1);
    expect(cambios.filter((c) => c.status === 'rejected')).toHaveLength(1);
    await acceder(1, auth).expect(401);
    const ganador = cambios.find((c) => c.status === 'fulfilled');
    if (ganador?.status !== 'fulfilled')
      throw new Error('Falta cambio exitoso');
    await acceder(1, ganador.value.accessToken).expect(200);
    await acceder(1, otra).expect(401);
  });

  it('si falla la revocación, tampoco confirma la nueva contraseña', async () => {
    // Inyección de un fallo en la consulta de revocación; el resto, incluidos
    // los commits y el rollback, los resuelve PostgreSQL real.
    const db = prisma.$extends({
      query: {
        authSession: {
          updateMany() {
            throw new Error('Fallo de revocación simulado');
          },
        },
      },
    }) as unknown as PrismaService;
    const servicio = new AuthService(
      db,
      jwt,
      new SessionCacheService(),
      mfas[0],
    );
    await expect(
      servicio.cambiarPassword(auth, {
        actual: password,
        nueva: 'Clave ficticia que no debe persistir',
      }),
    ).rejects.toThrow('Fallo de revocación simulado');
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
    });
    expect(await bcrypt.compare(password, user.passwordHash!)).toBe(true);
    await acceder(1, otra).expect(200);
  });

  it('una sesión revocada no cambia la clave aunque su request hubiese pasado el guard antes', async () => {
    await prisma.authSession.update({
      where: { id: auth.sessionId },
      data: { revokedAt: new Date() },
    });
    await expect(
      servicios[0].cambiarPassword(auth, {
        actual: password,
        nueva: 'Cambio ficticio tardío 123',
      }),
    ).rejects.toThrow();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
    });
    expect(await bcrypt.compare(password, user.passwordHash!)).toBe(true);
  });

  it.each(['empleado', 'usuario'] as const)(
    'rehabilitar un %s no resucita ninguna de sus sesiones anteriores',
    async (origen) => {
      await acceder(1, auth).expect(200);
      // La misma identidad conserva su sesión legítima en otra empresa.
      const tenant = await prisma.tenant.create({
        data: {
          nombre: 'Empresa ajena a la baja',
          slug: `qa-otra-${randomUUID()}`,
        },
      });
      tenantIds.push(tenant.id);
      const miembro = await prisma.membership.create({
        data: { userId: auth.userId, tenantId: tenant.id, rol: 'OPERADOR' },
      });
      const ajena = await sesion({
        ...auth,
        tenantId: tenant.id,
        membershipId: miembro.id,
        role: 'OPERADOR',
      });
      await baja(origen);
      await acceder(1, auth).expect(401);
      await prisma.membership.update({
        where: { id: auth.membershipId },
        data: { activa: true },
      });
      await acceder(1, auth).expect(401);
      await acceder(1, otra).expect(401);
      await acceder(1, ajena).expect(200);
      // Puede obtener un acceso nuevo; los anteriores siguen revocados.
      await acceder(1, await sesion(auth)).expect(200);
    },
  );

  it.each(['empleado', 'usuario'] as const)(
    'rehabilitar un %s tampoco resucita sus credenciales MCP',
    async (origen) => {
      const mcp = await credencial();
      await acceder(1, mcp.token).expect(200);
      await baja(origen);
      await prisma.membership.update({
        where: { id: auth.membershipId },
        data: { activa: true },
      });
      await acceder(1, mcp.token).expect(401);
    },
  );

  it.each(['empleado', 'usuario'] as const)(
    'un fallo revocando MCP revierte la baja completa de %s',
    async (origen) => {
      const db = prisma.$extends({
        query: {
          credencialMcp: {
            updateMany() {
              throw new Error('Fallo MCP simulado');
            },
          },
        },
      }) as unknown as PrismaService;
      await expect(baja(origen, db)).rejects.toThrow('Fallo MCP simulado');
      const miembro = await prisma.membership.findUniqueOrThrow({
        where: { id: auth.membershipId },
      });
      expect(miembro.activa).toBe(true);
      await acceder(1, auth).expect(200);
    },
  );

  it('una clave provisoria permite elegir la propia, pero no operar en la empresa', async () => {
    await acceder(1, auth).expect(200);
    await prisma.user.update({
      where: { id: auth.userId },
      data: { debeCambiarPassword: true },
    });
    await acceder(1, auth).expect(403);
    const contexto = await acceder(1, auth, '/auth/me').expect(200);
    expect(
      (contexto.body as { currentUser: { debeCambiarPassword: boolean } })
        .currentUser.debeCambiarPassword,
    ).toBe(true);
    const cambio = await request(apps[0].getHttpServer())
      .post('/auth/password')
      .set('Authorization', `Bearer ${bearer(auth)}`)
      .send({ actual: password, nueva: 'Clave personal ficticia 456' })
      .expect(201);
    await acceder(1, cambio.headers['x-grafoprint-sesion-renovada']).expect(
      200,
    );
  });

  it('se puede cerrar una sesión pendiente de elegir clave personal', async () => {
    await prisma.user.update({
      where: { id: auth.userId },
      data: { debeCambiarPassword: true },
    });
    await request(apps[0].getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${bearer(auth)}`)
      .expect(204);
    await acceder(1, auth).expect(401);
  });

  it('una credencial MCP no elude el cambio obligatorio de contraseña', async () => {
    const mcp = await credencial();
    await acceder(1, mcp.token).expect(200);
    await prisma.user.update({
      where: { id: auth.userId },
      data: { debeCambiarPassword: true },
    });
    await acceder(1, mcp.token).expect(401);
  });

  it('un código de recuperación sólo sirve una vez con desafíos distintos en dos servidores', async () => {
    const alta = await mfas[0].iniciar(auth, password);
    const codigo = new TOTP({
      secret: alta.secret,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    }).generate();
    const recovery = await mfas[0].confirmar(auth, alta.setupId, codigo);
    const desafios = await Promise.all(
      apps.map((app) =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: auth.email, password })
          .expect(201),
      ),
    );
    const resultados = await Promise.all(
      apps.map((app, i) =>
        request(app.getHttpServer())
          .post('/auth/mfa/verificar')
          .send({
            challengeToken: (desafios[i].body as { challengeToken: string })
              .challengeToken,
            codigo: recovery.codigosRecuperacion[0],
          }),
      ),
    );
    expect(resultados.map((r) => r.status).sort()).toEqual([201, 401]);
    const ganador = resultados.find((r) => r.status === 201)!;
    await acceder(
      1,
      (ganador.body as { accessToken: string }).accessToken,
    ).expect(200);
  });

  it('cambiar la clave invalida un desafío MFA que ya estaba abierto en otro servidor', async () => {
    const alta = await mfas[0].iniciar(auth, password);
    const codigo = new TOTP({
      secret: alta.secret,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    }).generate();
    const recovery = await mfas[0].confirmar(auth, alta.setupId, codigo);
    const desafio = await request(apps[1].getHttpServer())
      .post('/auth/login')
      .send({ email: auth.email, password })
      .expect(201);
    await servicios[0].cambiarPassword(auth, {
      actual: password,
      nueva: 'Clave personal ficticia 789',
    });
    await request(apps[1].getHttpServer())
      .post('/auth/mfa/verificar')
      .send({
        challengeToken: (desafio.body as { challengeToken: string })
          .challengeToken,
        codigo: recovery.codigosRecuperacion[0],
      })
      .expect(401);
  });
});
