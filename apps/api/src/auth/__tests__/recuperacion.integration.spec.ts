import { AuthService } from '../auth.service';
import { MfaService } from '../mfa.service';
import { SessionCacheService } from '../session-cache.service';
import { randomBytes, randomUUID, createHash, createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretosService } from '../../integraciones/cripto/secretos.service';
import { CorreoTransaccionalService } from '../../registro/correo-transaccional.service';
import type { DatosCorreoAcceso } from '../../registro/plantillas/acceso';
import { RecuperacionController } from '../recuperacion.controller';
import { RecuperacionService } from '../recuperacion.service';
import { AuthGuard } from '../auth.guard';
import { PermisosGuard } from '../permisos.guard';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import type { CurrentAuth } from '../auth.types';

describe('Recuperación de identidad, HTTP y PostgreSQL aislado', () => {
  const prisma = new PrismaService();
  const secretos = new SecretosService();
  const secret = randomUUID();
  const jwt = new JwtService({ secret });
  const prefijo = `qa-rec-${randomUUID().slice(0, 8)}`;
  const clavesEnv = [
    'JWT_SECRET',
    'INTEGRACIONES_ENCRYPTION_KEY',
    'RECUPERACION_ACCESO_HABILITADA',
    'RECUPERACION_ACCESO_URL',
  ] as const;
  const env = Object.fromEntries(clavesEnv.map((k) => [k, process.env[k]]));
  const userIds: string[] = [],
    tenantIds: string[] = [],
    correoIds = new Set<string>(),
    cuotas = new Set<string>();
  const correo = {
    accesoDisponible: true,
    enviarAcceso: jest.fn<Promise<void>, [DatosCorreoAcceso, string]>(),
  };
  const db = prisma.$extends({
    query: {
      accesoCorreo: {
        async create({ args, query }) {
          const row = await query(args);
          if (!row.id)
            throw new Error(
              'El ensayo necesita el ID para limpiar sólo sus correos',
            );
          correoIds.add(row.id);
          return row;
        },
      },
    },
  }) as unknown as PrismaService;
  const servicios = [
    new RecuperacionService(
      db,
      secretos,
      correo as unknown as CorreoTransaccionalService,
    ),
    new RecuperacionService(
      db,
      secretos,
      correo as unknown as CorreoTransaccionalService,
    ),
  ];
  let app: INestApplication<Server>;
  let auth: CurrentAuth;
  let email: string, ip: string, bearer: string;
  const password = 'Ficticia anterior 123';
  function cuota(ambito: string, valor: string) {
    const key = createHmac('sha256', secret)
      .update(`${ambito}:${valor}`)
      .digest('hex');
    cuotas.add(key);
    return key;
  }
  const llamar = (ruta: string, datos: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post(`/auth/recuperacion/${ruta}`)
      .set('Authorization', `Bearer ${bearer}`)
      .send(datos);
  async function verificada() {
    await prisma.user.update({
      where: { id: auth.userId },
      data: { emailVerificado: email, emailVerificadoEl: new Date() },
    });
  }
  async function pedir() {
    await verificada();
    await servicios[0].solicitar(email, ip);
    await habilitarCola();
    await servicios[0].procesarPendientes();
    return ultimoToken();
  }
  async function habilitarCola() {
    // El reloj del contenedor PostgreSQL puede adelantar milisegundos al de Node.
    await prisma.accesoCorreo.updateMany({
      where: { id: { in: [...correoIds] }, estado: 'pendiente' },
      data: { proximoEl: new Date(0) },
    });
  }
  function ultimoToken() {
    const mensaje = correo.enviarAcceso.mock.calls
      .filter(([d]) => d.url)
      .at(-1)?.[0];
    if (!mensaje?.url) throw new Error('Falta correo de prueba');
    return new URLSearchParams(new URL(mensaje.url).hash.slice(1)).get(
      'token',
    )!;
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw new Error('Sólo base local ficticia _test');
    process.env.JWT_SECRET = secret;
    process.env.INTEGRACIONES_ENCRYPTION_KEY =
      randomBytes(32).toString('base64');
    process.env.RECUPERACION_ACCESO_HABILITADA = 'true';
    process.env.RECUPERACION_ACCESO_URL = 'https://acceso.example.invalid';
    secretos.onModuleInit();
    await prisma.$connect();
    const module = await Test.createTestingModule({
      controllers: [RecuperacionController],
      providers: [
        AuthGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: CapacidadesEmpresaService, useValue: capacidadesDePrueba() },
        { provide: RecuperacionService, useValue: servicios[0] },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.useGlobalGuards(
      app.get(AuthGuard),
      new PermisosGuard(app.get(Reflector)),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  beforeEach(async () => {
    correo.enviarAcceso.mockReset().mockResolvedValue();
    correo.accesoDisponible = true;
    process.env.RECUPERACION_ACCESO_HABILITADA = 'true';
    process.env.RECUPERACION_ACCESO_URL = 'https://acceso.example.invalid';
    email = `${prefijo}-${randomUUID()}@example.invalid`;
    ip = randomUUID();
    const t = await prisma.tenant.create({
      data: {
        nombre: 'Empresa ficticia recuperación',
        slug: `recuperacion-${randomUUID()}`,
      },
    });
    tenantIds.push(t.id);
    const u = await prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(password, 4) },
    });
    userIds.push(u.id);
    const m = await prisma.membership.create({
      data: { userId: u.id, tenantId: t.id, rol: 'ADMINISTRADOR' },
    });
    const s = await prisma.authSession.create({
      data: {
        userId: u.id,
        currentTenantId: t.id,
        currentMembershipId: m.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    auth = {
      userId: u.id,
      tenantId: t.id,
      membershipId: m.id,
      sessionId: s.id,
      email,
      role: 'ADMINISTRADOR',
    };
    bearer = jwt.sign({
      sub: u.id,
      sessionId: s.id,
      tenantId: t.id,
      membershipId: m.id,
      email,
      role: 'ADMINISTRADOR',
    });
    for (const scope of ['solicitud-ip', 'verificacion-ip', 'consumir-ip'])
      for (const val of [ip, '::ffff:127.0.0.1', '127.0.0.1', '::1'])
        cuota(scope, val);
    cuota('solicitud-correo', email);
    cuota('verificacion-usuario', u.id);
    await prisma.accesoLimite.deleteMany({
      where: { clave: { in: [...cuotas] } },
    });
  });
  afterEach(async () => {
    await prisma.accesoCorreo.deleteMany({
      where: { id: { in: [...correoIds] } },
    });
  });
  afterAll(async () => {
    await app?.close();
    await prisma.accesoCorreo.deleteMany({
      where: { id: { in: [...correoIds] } },
    });
    await prisma.accesoLimite.deleteMany({
      where: { clave: { in: [...cuotas] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
    for (const k of clavesEnv) {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    }
  });

  it('verificar correo requiere sesión personal y contraseña; el enlace no crea sesiones', async () => {
    await request(app.getHttpServer())
      .post('/auth/recuperacion/verificar/solicitar')
      .send({ password })
      .expect(401);
    await llamar('verificar/solicitar', { password: 'errónea' }).expect(400);
    await llamar('verificar/solicitar', {
      password,
      email: 'otro@example.invalid',
    }).expect(400);
    await llamar('verificar/solicitar', { password }).expect(201);
    expect(correo.enviarAcceso).not.toHaveBeenCalled();
    await habilitarCola();
    await servicios[0].procesarPendientes();
    const token = ultimoToken();
    await llamar('verificar', { token }).expect(201);
    const estado = await request(app.getHttpServer())
      .get('/auth/recuperacion/estado')
      .set('Authorization', `Bearer ${bearer}`)
      .expect(200);
    expect(estado.body).toMatchObject({ email, verificado: true });
    expect(
      await prisma.authSession.count({ where: { userId: auth.userId } }),
    ).toBe(1);
    await llamar('verificar', { token }).expect(400);
  });
  it('no acredita correos históricos ni deja recuperar uno sin verificar', async () => {
    const resp = await llamar('solicitar', { email }).expect(201);
    expect(resp.body).toMatchObject({ ok: true });
    await habilitarCola();
    await servicios[0].procesarPendientes();
    expect(correo.enviarAcceso).not.toHaveBeenCalled();
    expect(
      await prisma.accesoToken.count({ where: { userId: auth.userId } }),
    ).toBe(0);
  });
  it('responde igual a cuentas verificadas, desconocidas e inactivas sin esperar al correo', async () => {
    await verificada();
    const inexistente = `${prefijo}-ausente@example.invalid`;
    cuota('solicitud-correo', inexistente);
    const a = await llamar('solicitar', { email }).expect(201);
    const b = await llamar('solicitar', { email: inexistente }).expect(201);
    await prisma.user.update({
      where: { id: auth.userId },
      data: { activo: false },
    });
    const c = await llamar('solicitar', { email }).expect(201);
    expect(a.body).toEqual(b.body);
    expect(a.body).toEqual(c.body);
    expect(correo.enviarAcceso).not.toHaveBeenCalled();
    await habilitarCola();
    await servicios[0].procesarPendientes();
    expect(correo.enviarAcceso).not.toHaveBeenCalled();
  });
  it('cambia la clave, cierra todas las sesiones y conserva MFA y membresías', async () => {
    const token = await pedir();
    await prisma.userMfa.create({
      data: {
        userId: auth.userId,
        activatedAt: new Date(),
        recuperacionConfirmadaEl: new Date(),
        recoveryHashes: ['huella-ficticia'],
      },
    });
    const mfa = await prisma.userMfa.findUnique({
      where: { userId: auth.userId },
    });
    const membresias = await prisma.membership.findMany({
      where: { userId: auth.userId },
    });
    await prisma.authSession.create({
      data: { userId: auth.userId, expiresAt: new Date(Date.now() + 3600000) },
    });
    const r = await llamar('restablecer', {
      token,
      nueva: 'Mi nueva ficticia 456',
    }).expect(201);
    expect(r.body).toEqual({ ok: true });
    expect(r.headers['set-cookie']).toBeUndefined();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
    });
    expect(
      await bcrypt.compare('Mi nueva ficticia 456', user.passwordHash!),
    ).toBe(true);
    expect(
      await prisma.authSession.count({
        where: { userId: auth.userId, revokedAt: null },
      }),
    ).toBe(0);
    expect(
      await prisma.userMfa.findUnique({ where: { userId: auth.userId } }),
    ).toEqual(mfa);
    expect(
      await prisma.membership.findMany({ where: { userId: auth.userId } }),
    ).toEqual(membresias);
    await request(app.getHttpServer())
      .get('/auth/recuperacion/estado')
      .set('Authorization', `Bearer ${bearer}`)
      .expect(401);
    await habilitarCola();
    await servicios[0].procesarPendientes();
    expect(correo.enviarAcceso.mock.calls.at(-1)?.[0].tipo).toBe('aviso');
  });
  it('recuperar una identidad compartida o de Plataforma no altera sus roles y sigue pidiendo MFA', async () => {
    const t = await prisma.tenant.create({
      data: { nombre: 'Segunda empresa ficticia', slug: `rec-${randomUUID()}` },
    });
    tenantIds.push(t.id);
    await prisma.membership.create({
      data: { userId: auth.userId, tenantId: t.id, rol: 'OPERADOR' },
    });
    await prisma.user.update({
      where: { id: auth.userId },
      data: { rolPlataforma: 'ADMIN' },
    });
    await prisma.userMfa.create({
      data: {
        userId: auth.userId,
        activatedAt: new Date(),
        recuperacionConfirmadaEl: new Date(),
        recoveryHashes: ['respaldo-ficticio'],
      },
    });
    await prisma.mfaDispositivo.create({
      data: {
        userId: auth.userId,
        tokenHash: randomUUID(),
        alcance: 'plataforma',
        passwordStamp: 'ficticia',
        mfaVersion: 1,
        venceEl: new Date(Date.now() + 3600000),
      },
    });
    await prisma.mfaChallenge.create({
      data: {
        userId: auth.userId,
        tokenHash: randomUUID(),
        destination: 'plataforma',
        passwordStamp: 'ficticia',
        mfaVersion: 1,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const roles = await prisma.membership.findMany({
      where: { userId: auth.userId },
    });
    const token = await pedir();
    await servicios[0].confirmar(
      token,
      'restablecer',
      ip,
      'Clave global nueva 123',
    );
    expect(
      await prisma.membership.findMany({ where: { userId: auth.userId } }),
    ).toEqual(roles);
    expect(
      await prisma.user.findUnique({ where: { id: auth.userId } }),
    ).toMatchObject({ rolPlataforma: 'ADMIN' });
    expect(
      await prisma.mfaChallenge.count({ where: { userId: auth.userId } }),
    ).toBe(0);
    expect(
      await prisma.mfaDispositivo.count({
        where: { userId: auth.userId, revocadoEl: null },
      }),
    ).toBe(0);
    const cache = new SessionCacheService();
    const servicio = new AuthService(
      prisma,
      jwt,
      cache,
      new MfaService(prisma, secretos, cache),
    );
    const login = await servicio.login({
      email,
      password: 'Clave global nueva 123',
    });
    expect(login).toMatchObject({ requiereMfa: true, accessToken: null });
  });

  it('bloquea entrada antes de calcular un hash excesivo y no acepta otro usuario en el cuerpo', async () => {
    const token = await pedir();
    await llamar('restablecer', { token, nueva: 'a'.repeat(73) }).expect(400);
    await llamar('restablecer', { token, nueva: 'á'.repeat(40) }).expect(400);
    await llamar('restablecer', {
      token,
      nueva: 'Válida ficticia 123',
      userId: randomUUID(),
    }).expect(400);
  });

  it('una sesión revocada no puede pedir la acreditación aunque conociera la clave', async () => {
    await prisma.authSession.update({
      where: { id: auth.sessionId },
      data: { revokedAt: new Date() },
    });
    await expect(
      servicios[0].pedirVerificacion(auth, password, ip),
    ).rejects.toThrow('ingresar');
    expect(
      await prisma.accesoToken.count({ where: { userId: auth.userId } }),
    ).toBe(0);
  });

  it('verificar el correo no usa un enlace emitido antes de cambiar la contraseña', async () => {
    await servicios[0].pedirVerificacion(auth, password, ip);
    await habilitarCola();
    await servicios[0].procesarPendientes();
    const token = ultimoToken();
    await prisma.user.update({
      where: { id: auth.userId },
      data: { passwordHash: await bcrypt.hash('Nueva ficticia', 4) },
    });
    await llamar('verificar', { token }).expect(400);
    expect(
      await prisma.user.findUnique({ where: { id: auth.userId } }),
    ).toMatchObject({ emailVerificadoEl: null });
  });

  it.each([
    'vencido',
    'reutilizado',
    'alterado',
    'contraseña',
    'correo',
    'desactivado',
    'verificacion-retirada',
  ] as const)('rechaza enlace %s sin cambiar la cuenta', async (caso) => {
    let token = await pedir();
    if (caso === 'vencido')
      await prisma.accesoToken.updateMany({
        where: { userId: auth.userId },
        data: { venceEl: new Date(0) },
      });
    if (caso === 'reutilizado')
      await servicios[0].confirmar(
        token,
        'restablecer',
        ip,
        'Ya cambiada ficticia 123',
      );
    if (caso === 'alterado') token = 'f'.repeat(64);
    if (caso === 'contraseña')
      await prisma.user.update({
        where: { id: auth.userId },
        data: { passwordHash: await bcrypt.hash('otra anterior', 4) },
      });
    if (caso === 'correo')
      await prisma.user.update({
        where: { id: auth.userId },
        data: { email: `nuevo-${email}` },
      });
    if (caso === 'desactivado')
      await prisma.user.update({
        where: { id: auth.userId },
        data: { activo: false },
      });
    if (caso === 'verificacion-retirada')
      await prisma.user.update({
        where: { id: auth.userId },
        data: { emailVerificadoEl: null },
      });
    const anterior = await prisma.user.findUnique({
      where: { id: auth.userId },
    });
    await llamar('restablecer', {
      token,
      nueva: 'No guardar clave 789',
    }).expect(400);
    expect(
      await prisma.user.findUnique({ where: { id: auth.userId } }),
    ).toEqual(anterior);
  });
  it('un enlace de verificación no permite cambiar la contraseña', async () => {
    await servicios[0].pedirVerificacion(auth, password, ip);
    await habilitarCola();
    await servicios[0].procesarPendientes();
    await llamar('restablecer', {
      token: ultimoToken(),
      nueva: 'No cambiar esta 123',
    }).expect(400);
  });
  it('dos servidores consumen el mismo enlace una sola vez', async () => {
    const token = await pedir();
    const resultado = await Promise.allSettled(
      servicios.map((s) =>
        s.confirmar(token, 'restablecer', ip, 'Clave concurrente 987'),
      ),
    );
    expect(resultado.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultado.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
  it('la cuota por correo es compartida y no se evade cambiando instancia', async () => {
    await verificada();
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        servicios[i % 2].solicitar(email, ip),
      ),
    );
    await habilitarCola();
    await servicios[0].procesarPendientes();
    expect(correo.enviarAcceso).toHaveBeenCalledTimes(3);
    expect(
      await prisma.accesoLimite.findUnique({
        where: { clave: cuota('solicitud-correo', email) },
      }),
    ).toMatchObject({ cantidad: 3 });
  });
  it('el fallo de proveedor conserva el mismo envío cifrado y su idempotencia para reintentar', async () => {
    await verificada();
    await servicios[0].solicitar(email, ip);
    correo.enviarAcceso.mockRejectedValueOnce(
      new Error('No volcar al log: token=secreto-ficticio'),
    );
    await habilitarCola();
    await servicios[0].procesarPendientes();
    const [datos, idempotencia] = correo.enviarAcceso.mock.calls[0];
    const fila = await prisma.accesoCorreo.findFirstOrThrow({
      where: { userId: auth.userId, tipo: 'restablecer' },
    });
    expect(JSON.stringify(fila)).not.toContain(datos.url);
    expect(fila.estado).toBe('pendiente');
    await prisma.accesoCorreo.update({
      where: { id: fila.id },
      data: { proximoEl: new Date(0) },
    });
    await servicios[1].procesarPendientes();
    expect(correo.enviarAcceso.mock.calls.at(-1)).toEqual([
      datos,
      idempotencia,
    ]);
    expect(
      await prisma.accesoCorreo.findUnique({ where: { id: fila.id } }),
    ).toMatchObject({ estado: 'completo', sobre: null });
  });
  it('dos procesadores no envían dos veces la misma fila', async () => {
    await verificada();
    await servicios[0].solicitar(email, ip);
    await habilitarCola();
    await Promise.all(servicios.map((s) => s.procesarPendientes()));
    expect(correo.enviarAcceso).toHaveBeenCalledTimes(1);
  });
  it.each(['diferida', 'vencida'])(
    'no toma una tarea %s después de listar la cola',
    async (caso) => {
      await verificada();
      await servicios[0].solicitar(email, ip);
      await habilitarCola();
      const retrasada = prisma.$extends({
        query: {
          accesoCorreo: {
            async findMany({ args, query }) {
              const filas = await query(args);
              await prisma.accesoCorreo.updateMany({
                where: { id: { in: [...correoIds] }, estado: 'pendiente' },
                data:
                  caso === 'diferida'
                    ? { proximoEl: new Date(Date.now() + 60_000) }
                    : { venceEl: new Date(0) },
              });
              return filas;
            },
          },
        },
      }) as unknown as PrismaService;
      await new RecuperacionService(
        retrasada,
        secretos,
        correo as unknown as CorreoTransaccionalService,
      ).procesarPendientes();
      expect(correo.enviarAcceso).not.toHaveBeenCalled();
      expect(
        await prisma.accesoToken.count({ where: { userId: auth.userId } }),
      ).toBe(0);
    },
  );
  it('si falla revocar sesiones, revierte la clave y permite reintentar el enlace', async () => {
    const token = await pedir();
    const antes = await prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
    });
    const falla = prisma.$extends({
      query: {
        authSession: {
          updateMany() {
            throw new Error('fallo simulado');
          },
        },
      },
    }) as unknown as PrismaService;
    await expect(
      new RecuperacionService(
        falla,
        secretos,
        correo as unknown as CorreoTransaccionalService,
      ).confirmar(token, 'restablecer', ip, 'No persistir 567'),
    ).rejects.toThrow('fallo simulado');
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: auth.userId } }),
    ).toEqual(antes);
    expect(
      await prisma.accesoToken.findUnique({
        where: { tokenHash: createHash('sha256').update(token).digest('hex') },
      }),
    ).toMatchObject({ usadoEl: null });
    await servicios[0].confirmar(
      token,
      'restablecer',
      ip,
      'Ahora sí nueva 567',
    );
  });
  it('rechaza impersonación y MCP para acreditar correo', async () => {
    await expect(
      servicios[0].pedirVerificacion(
        {
          ...auth,
          mcp: { credencialId: randomUUID(), credencialNombre: 'ficticia' },
        },
        password,
        ip,
      ),
    ).rejects.toThrow('personal');
    await expect(
      servicios[0].pedirVerificacion(
        {
          ...auth,
          impersonacion: {
            sesionId: randomUUID(),
            actorUserId: randomUUID(),
            actorNombre: 'Soporte ficticio',
          },
        },
        password,
        ip,
      ),
    ).rejects.toThrow('personal');
  });
  it.each([
    'http://externo.example.invalid',
    'https://user:pass@example.invalid',
    'https://ejemplo.invalid/?redirect=otro',
    'https://ejemplo.invalid/ruta',
  ])('rechaza un origen configurado no seguro: %s', async (url) => {
    process.env.RECUPERACION_ACCESO_URL = url;
    await llamar('solicitar', { email }).expect(503);
    expect(correo.enviarAcceso).not.toHaveBeenCalled();
  });
  it('apagado no encola ni procesa tareas pendientes', async () => {
    await verificada();
    await servicios[0].solicitar(email, ip);
    process.env.RECUPERACION_ACCESO_HABILITADA = 'false';
    await llamar('solicitar', { email }).expect(503);
    await habilitarCola();
    await servicios[0].procesarPendientes();
    expect(correo.enviarAcceso).not.toHaveBeenCalled();
  });
});
