import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { StorageDriver } from '../archivos/storage/storage.driver';
import { AuthGuard } from '../auth/auth.guard';
import { ImpersonacionGuard } from '../auth/impersonacion.guard';
import { PermisosGuard } from '../auth/permisos.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { PrismaService } from '../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { SecretosService } from './cripto/secretos.service';
import { IntegracionesController } from './integraciones.controller';
import { IntegracionesService } from './integraciones.service';
import type { DespachoService } from './notificaciones/despacho.service';
import { NotificacionesController } from './notificaciones/notificaciones.controller';
import { NotificacionesService } from './notificaciones/notificaciones.service';
import { AutomaticosWebController } from './whatsapp-web/automaticos.controller';
import { AutomaticosWebService } from './whatsapp-web/automaticos.service';
import { CATALOGO } from './wati/catalogo';
import type { CredencialesWati, WatiClient } from './wati/wati.client';

/** Sesiones JWT, permisos, plan persistido, servicios y PostgreSQL reales.
 * Proveedores, archivos y despacho sustituidos: nunca se envía un mensaje.
 * Los registros ficticios pertenecen sólo a esta suite, sin seeds ni resets. */
describe('Integraciones: aislamiento y límites de soporte por HTTP', () => {
  const prisma = new PrismaService();
  const jwt = new JwtService({ secret: randomUUID() });
  const capacidades = new CapacidadesEmpresaService(prisma);
  const secretos = new SecretosService();
  const planId = randomUUID();
  const tenants = [randomUUID(), randomUUID()];
  const dispositivos = [randomUUID(), randomUUID()];
  const reservas = [randomUUID(), randomUUID()];
  const numeros = ['16505550101', '16505550102'];
  const usuarios: string[] = [];
  const tokens: Record<string, string> = {};
  const miembros: Record<string, string> = {};
  const avisos = tenants.map(() => ({
    pendiente: randomUUID(),
    reservada: randomUUID(),
    enviando: randomUUID(),
    incierta: randomUUID(),
  }));
  const credenciales = tenants.map((_, i) => ({
    endpoint: 'https://live-mt-server.wati.io',
    tenantId: `12345${i}`,
    token: `token-ficticio-${randomUUID()}`,
  }));
  const plantilla = CATALOGO.find((p) => p.evento === 'orden_recibida')!;
  const wati = {
    probar: jest.fn(() => Promise.resolve({ ok: true })),
    listarPlantillas: jest.fn((cred: CredencialesWati) =>
      Promise.resolve([
        {
          id: `remota-${cred.tenantId}`,
          nombre: plantilla.codigo,
          estado: 'DRAFT',
          parametros: [],
        },
        {
          id: 'qa',
          nombre: 'qa_sin_envio',
          estado: 'APPROVED',
          parametros: [],
        },
      ]),
    ),
    enviarAAprobacion: jest.fn(() => Promise.resolve({ ok: true })),
    enviarPlantilla: jest.fn(() => Promise.resolve({ ok: true })),
  };
  const storage = {
    subir: jest.fn(() => {
      throw new Error('Sin almacenamiento externo');
    }),
    firmarDescarga: jest.fn(() => {
      throw new Error('Sin enlaces externos');
    }),
  };
  const despacho = {
    despachar: jest.fn(() => {
      throw new Error('Sin envíos externos');
    }),
  };
  const integraciones = new IntegracionesService(
    prisma,
    secretos,
    wati as unknown as WatiClient,
    storage as unknown as StorageDriver,
    capacidades,
  );
  const notificaciones = new NotificacionesService(
    prisma,
    despacho as unknown as DespachoService,
    capacidades,
  );
  const automaticos = new AutomaticosWebService(prisma, capacidades);
  let app: INestApplication<Server>;
  let baseValidada = false;
  let impersonacionId: string;
  let red: jest.SpyInstance;
  const claveAnterior = process.env.INTEGRACIONES_ENCRYPTION_KEY;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Requiere base local de test con aislamiento activo');
    baseValidada = true;
    red = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.reject(new Error('Sin red externa durante el ensayo')),
      );
    process.env.INTEGRACIONES_ENCRYPTION_KEY =
      randomBytes(32).toString('base64');
    secretos.onModuleInit();
    await prisma.$connect();
    for (const [i, tenantId] of tenants.entries()) {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          slug: `qa-integraciones-${tenantId}`,
          nombre: `Empresa ficticia ${i}`,
        },
      });
      await prisma.integracionTenant.create({
        data: {
          tenantId,
          proveedor: 'WATI',
          estado: 'CONECTADA',
          credencialesCifradas: secretos.cifrar(
            JSON.stringify(credenciales[i]),
          ),
          metadataJson: {
            endpoint: credenciales[i].endpoint,
            tenantId: credenciales[i].tenantId,
          },
          pista: secretos.pista(credenciales[i].token),
        },
      });
    }
    await prisma.plan.create({
      data: {
        id: planId,
        codigo: `qa-integraciones-${planId}`,
        nombre: 'Plan ficticio',
        precioMensual: 0,
        publico: false,
        featuresJson: { whatsapp: true },
        suscripciones: { create: tenants.map((tenantId) => ({ tenantId })) },
      },
    });
    for (const [actor, indice, permisos] of [
      ['admin', 0, ['configuracion.ver', 'configuracion.gestionar']],
      ['lector', 0, ['configuracion.ver']],
      ['ninguno', 0, []],
      ['ajeno', 1, ['configuracion.ver', 'configuracion.gestionar']],
    ] as const) {
      const user = await prisma.user.create({
        data: { email: `qa-integraciones-${randomUUID()}@example.invalid` },
      });
      usuarios.push(user.id);
      const rol = await prisma.rol.create({
        data: {
          tenantId: tenants[indice],
          nombre: actor,
          permisos: [...permisos],
        },
      });
      const miembro = await prisma.membership.create({
        data: {
          tenantId: tenants[indice],
          userId: user.id,
          rol: 'ADMINISTRADOR',
          rolId: rol.id,
        },
      });
      miembros[actor] = miembro.id;
      const sesion = await prisma.authSession.create({
        data: {
          userId: user.id,
          currentTenantId: tenants[indice],
          currentMembershipId: miembro.id,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      tokens[actor] = jwt.sign({
        sub: user.id,
        email: user.email,
        sessionId: sesion.id,
        tenantId: tenants[indice],
        membershipId: miembro.id,
        role: 'ADMINISTRADOR',
      });
    }
    const activado = new Date(Date.now() - 60_000);
    const soporte = await prisma.user.create({
      data: {
        email: `qa-soporte-${randomUUID()}@example.invalid`,
        rolPlataforma: 'ADMIN',
        mfa: {
          create: { activatedAt: activado, recuperacionConfirmadaEl: activado },
        },
      },
    });
    usuarios.push(soporte.id);
    const imp = await prisma.sesionImpersonacion.create({
      data: {
        staffUserId: soporte.id,
        tenantId: tenants[0],
        motivo: 'Diagnóstico ficticio',
        expiraEl: new Date(Date.now() + 3_600_000),
      },
    });
    impersonacionId = imp.id;
    const sesion = await prisma.authSession.create({
      data: {
        userId: soporte.id,
        currentTenantId: tenants[0],
        impersonacionId: imp.id,
        mfaVerificadoEl: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    tokens.soporte = jwt.sign({
      sub: soporte.id,
      email: soporte.email,
      sessionId: sesion.id,
      tenantId: tenants[0],
      role: 'ADMINISTRADOR',
      imp: {
        sesionId: imp.id,
        actorUserId: soporte.id,
        actorNombre: 'Soporte ficticio',
      },
    });
    const modulo = await Test.createTestingModule({
      // Rutas específicas antes que /integraciones/:proveedor, como en la app.
      controllers: [
        NotificacionesController,
        AutomaticosWebController,
        IntegracionesController,
      ],
      providers: [
        { provide: IntegracionesService, useValue: integraciones },
        { provide: NotificacionesService, useValue: notificaciones },
        { provide: AutomaticosWebService, useValue: automaticos },
        { provide: CapacidadesEmpresaService, useValue: capacidades },
      ],
    }).compile();
    app = modulo.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    const reflector = new Reflector();
    app.useGlobalGuards(
      new AuthGuard(reflector, jwt, prisma),
      new RolesGuard(reflector),
      new PermisosGuard(reflector),
      new ImpersonacionGuard(reflector),
    );
    app.useGlobalInterceptors(new TenantContextInterceptor(reflector));
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
    jest.clearAllMocks();
    for (const [i, tenantId] of tenants.entries()) {
      await prisma.notificacionWhatsapp.deleteMany({ where: { tenantId } });
      await prisma.notificacionEvento.deleteMany({ where: { tenantId } });
      const data = {
        pausado: false,
        canalOrdenes: 'WHATSAPP_WEB',
        whatsappWebDispositivoId: dispositivos[i],
        whatsappWebNumero: numeros[i],
      };
      await prisma.configuracionNotificaciones.upsert({
        where: { tenantId },
        create: { tenantId, ...data },
        update: data,
      });
      for (const [clave, estado] of [
        ['pendiente', 'pendiente'],
        ['reservada', 'web_reservada'],
        ['enviando', 'web_enviando'],
        ['incierta', 'web_incierta'],
      ] as const)
        await prisma.notificacionWhatsapp.create({
          data: {
            id: avisos[i][clave],
            tenantId,
            evento: 'prueba_extension',
            estado,
            claveUnica: clave,
            telefono: numeros[i],
            plantilla: 'prueba_extension',
            parametros: [],
            canal: 'WHATSAPP_WEB',
            textoWeb: `Ensayo ${i}`,
            reservaToken: reservas[i],
            reservadaEl: new Date(),
          },
        });
    }
  });
  afterEach(() => {
    expect(red).not.toHaveBeenCalled();
    expect(storage.subir).not.toHaveBeenCalled();
    expect(storage.firmarDescarga).not.toHaveBeenCalled();
    expect(despacho.despachar).not.toHaveBeenCalled();
  });
  afterAll(async () => {
    await app?.close();
    if (baseValidada) {
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
      if (impersonacionId)
        await prisma.sesionImpersonacion.deleteMany({
          where: { id: impersonacionId },
        });
      await prisma.plan.deleteMany({ where: { id: planId } });
    }
    await prisma.$disconnect();
    red?.mockRestore();
    if (claveAnterior === undefined)
      delete process.env.INTEGRACIONES_ENCRYPTION_KEY;
    else process.env.INTEGRACIONES_ENCRYPTION_KEY = claveAnterior;
  });

  type Metodo = 'get' | 'post' | 'put' | 'delete';
  type Ruta = { metodo: Metodo; ruta: string; body?: Record<string, unknown> };
  const dispositivo = (i = 0) => ({
    tenantId: tenants[i],
    dispositivoId: dispositivos[i],
    numero: numeros[i],
  });
  const resolver = {
    accion: 'descartar',
    estadoEsperado: 'web_incierta',
    motivo: 'Ensayo sin mensaje real',
  };
  const mutacionesRestringidas = (): Ruta[] => [
    {
      metodo: 'post',
      ruta: `/integraciones/wati/plantillas/${plantilla.codigo}/someter`,
    },
    {
      metodo: 'post',
      ruta: '/integraciones/wati/probar-envio',
      body: {
        telefono: `+${numeros[0]}`,
        plantilla: 'qa_sin_envio',
        parametros: [],
      },
    },
    {
      metodo: 'put',
      ruta: '/integraciones/notificaciones/configuracion',
      body: { pausado: true },
    },
    {
      metodo: 'put',
      ruta: '/integraciones/notificaciones/eventos/orden_recibida',
      body: { activo: false },
    },
    {
      metodo: 'put',
      ruta: '/chrome-whatsapp/automaticos/configuracion',
      body: { ...dispositivo(), modo: 'WATI' },
    },
    {
      metodo: 'post',
      ruta: '/chrome-whatsapp/automaticos/prueba',
      body: dispositivo(),
    },
    {
      metodo: 'post',
      ruta: '/chrome-whatsapp/automaticos/reservar',
      body: dispositivo(),
    },
    {
      metodo: 'post',
      ruta: `/chrome-whatsapp/automaticos/${avisos[0].reservada}/iniciar`,
      body: { ...dispositivo(), token: reservas[0] },
    },
    {
      metodo: 'post',
      ruta: `/chrome-whatsapp/automaticos/${avisos[0].enviando}/resultado`,
      body: {
        ...dispositivo(),
        token: reservas[0],
        estado: 'enviada',
        mensajeId: 'qa-ficticio',
      },
    },
  ];
  const rutas = (): Ruta[] => [
    ...mutacionesRestringidas(),
    ...[
      '/integraciones',
      '/integraciones/WATI',
      '/integraciones/wati/plantillas',
      '/integraciones/notificaciones',
      '/integraciones/notificaciones/log',
      '/chrome-whatsapp/automaticos/estado',
    ].map((ruta) => ({ metodo: 'get' as const, ruta })),
    { metodo: 'put', ruta: '/integraciones/wati', body: credenciales[0] },
    { metodo: 'post', ruta: '/integraciones/WATI/probar' },
    { metodo: 'delete', ruta: '/integraciones/WATI' },
    {
      metodo: 'post',
      ruta: `/integraciones/notificaciones/${avisos[0].incierta}/resolver`,
      body: resolver,
    },
  ];
  const http = ({ metodo, ruta, body }: Ruta, actor = 'admin') =>
    request(app.getHttpServer())
      [metodo](ruta)
      .auth(tokens[actor], { type: 'bearer' })
      .set('x-tenant-id', tenants[1])
      .send(body ?? {});
  const snapshot = () =>
    Promise.all([
      prisma.configuracionNotificaciones.findMany({
        where: { tenantId: { in: tenants } },
        orderBy: { id: 'asc' },
      }),
      prisma.notificacionEvento.findMany({
        where: { tenantId: { in: tenants } },
        orderBy: { id: 'asc' },
      }),
      prisma.notificacionWhatsapp.findMany({
        where: { tenantId: { in: tenants } },
        orderBy: { id: 'asc' },
      }),
    ]);

  it('exige sesión y permisos efectivos en las 19 rutas', async () => {
    expect(rutas()).toHaveLength(19);
    for (const r of rutas()) {
      await request(app.getHttpServer())
        [r.metodo](r.ruta)
        .send(r.body ?? {})
        .expect(401);
      await http(r, 'ninguno').expect(403);
    }
  });
  it('un lector no modifica conexiones ni avisos aunque su rol base sea administrador', async () => {
    const antes = await snapshot();
    for (const r of rutas().filter((r) => r.metodo !== 'get'))
      await http(r, 'lector').expect(403);
    expect(await snapshot()).toEqual(antes);
    expect(wati.enviarPlantilla).not.toHaveBeenCalled();
    expect(wati.enviarAAprobacion).not.toHaveBeenCalled();
  });
  it.each(Array.from({ length: 9 }, (_, i) => i))(
    'soporte no modifica conexiones ni envía: acción %i',
    async (i) => {
      const antes = await snapshot();
      await http(mutacionesRestringidas()[i], 'soporte').expect(403);
      expect(await snapshot()).toEqual(antes);
      expect(wati.enviarPlantilla).not.toHaveBeenCalled();
      expect(wati.enviarAAprobacion).not.toHaveBeenCalled();
    },
  );
  it('soporte puede diagnosticar sin revelar credenciales ni tomar control del canal', async () => {
    for (const r of rutas().filter((r) => r.metodo === 'get')) {
      const res = await http(r, 'soporte').expect(200);
      for (const cred of credenciales)
        expect(JSON.stringify(res.body)).not.toContain(cred.token);
      expect(JSON.stringify(res.body)).not.toContain('credencialesCifradas');
    }
    for (const r of rutas().filter(
      (r) =>
        ['put', 'delete', 'post'].includes(r.metodo) &&
        [
          '/integraciones/wati',
          '/integraciones/WATI',
          '/integraciones/WATI/probar',
        ].includes(r.ruta),
    ))
      await http(r, 'soporte').expect(403);
  });
  it('conserva las operaciones del administrador legítimo', async () => {
    for (const r of mutacionesRestringidas().slice(0, 4)) {
      const res = await http(r);
      expect(res.status).toBe(r.metodo === 'post' ? 201 : 200);
    }
    expect(wati.enviarPlantilla).toHaveBeenCalledWith(
      credenciales[0],
      expect.objectContaining({ telefono: numeros[0] }),
    );
    expect(wati.enviarAAprobacion).toHaveBeenCalledWith(
      credenciales[0],
      `remota-${credenciales[0].tenantId}`,
    );
    const config = await prisma.configuracionNotificaciones.findUniqueOrThrow({
      where: { tenantId: tenants[0] },
    });
    expect(config.pausado).toBe(true);
    const evento = await prisma.notificacionEvento.findFirstOrThrow({
      where: { tenantId: tenants[0], evento: 'orden_recibida' },
    });
    expect(evento.activo).toBe(false);
  });
  it.each([4, 5, 6, 7, 8])(
    'el administrador conserva la acción del canal web %i',
    async (i) => {
      const ruta = mutacionesRestringidas()[i];
      const res = await http(ruta).expect(ruta.metodo === 'put' ? 200 : 201);
      if (i === 4) expect(res.body).toMatchObject({ modo: 'WATI' });
      if (i === 5)
        expect(
          await prisma.notificacionWhatsapp.count({
            where: { tenantId: tenants[0] },
          }),
        ).toBe(5);
      if (i === 6) {
        const aviso = await prisma.notificacionWhatsapp.findUniqueOrThrow({
          where: { id: avisos[0].pendiente },
        });
        expect(aviso.estado).toBe('web_reservada');
        expect(aviso.reservaToken).not.toBe(reservas[0]);
      }
      if (i === 7)
        expect(res.body).toMatchObject({
          trabajo: { id: avisos[0].reservada, telefono: numeros[0] },
        });
      if (i === 8) {
        const aviso = await prisma.notificacionWhatsapp.findUniqueOrThrow({
          where: { id: avisos[0].enviando },
        });
        expect(aviso.estado).toBe('enviada');
      }
    },
  );
  it('rechaza campos de empresa y estado inyectados en la configuración', async () => {
    const antes = await snapshot();
    for (const campo of [
      { tenantId: tenants[1] },
      { canalOrdenes: 'WATI' },
      { updatedAt: new Date().toISOString() },
    ])
      await http({
        metodo: 'put',
        ruta: '/integraciones/notificaciones/configuracion',
        body: { pausado: false, ...campo },
      }).expect(400);
    expect(await snapshot()).toEqual(antes);
  });
  it('el permiso personal no evita la restricción del plan', async () => {
    await prisma.plan.update({
      where: { id: planId },
      data: { featuresJson: { whatsapp: false } },
    });
    try {
      const antes = await snapshot();
      for (const i of [0, 1, 5, 6, 7])
        await http(mutacionesRestringidas()[i]).expect(403);
      expect(await snapshot()).toEqual(antes);
      expect(wati.enviarPlantilla).not.toHaveBeenCalled();
      expect(wati.enviarAAprobacion).not.toHaveBeenCalled();
    } finally {
      await prisma.plan.update({
        where: { id: planId },
        data: { featuresJson: { whatsapp: true } },
      });
    }
  });
  it('separa lecturas concurrentes y no acepta la empresa de la cabecera', async () => {
    const respuestas = await Promise.all(
      ['admin', 'ajeno', 'admin'].map((actor) =>
        http(
          { metodo: 'get', ruta: '/integraciones/notificaciones/log' },
          actor,
        ),
      ),
    );
    for (const [i, res] of respuestas.entries()) {
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(4);
      expect(
        (res.body as Array<{ id: string }>).map((n) => n.id).sort(),
      ).toEqual(Object.values(avisos[i === 1 ? 1 : 0]).sort());
    }
    for (const [i, actor] of ['admin', 'ajeno'].entries()) {
      const res = await http(
        { metodo: 'get', ruta: '/integraciones/WATI' },
        actor,
      ).expect(200);
      expect(res.body).toMatchObject({
        metadata: { tenantId: credenciales[i].tenantId },
      });
      expect(JSON.stringify(res.body)).not.toContain(credenciales[i].token);
    }
  });
  it('rechaza dispositivos, reservas y avisos de otra empresa sin cambios parciales', async () => {
    const antes = await snapshot();
    await http({
      metodo: 'put',
      ruta: '/chrome-whatsapp/automaticos/configuracion',
      body: { ...dispositivo(1), modo: 'WHATSAPP_WEB' },
    }).expect(403);
    await http({
      metodo: 'post',
      ruta: `/chrome-whatsapp/automaticos/${avisos[1].reservada}/iniciar`,
      body: { ...dispositivo(), token: reservas[1] },
    }).expect(409);
    await http({
      metodo: 'post',
      ruta: `/chrome-whatsapp/automaticos/${avisos[1].enviando}/resultado`,
      body: {
        ...dispositivo(),
        token: reservas[1],
        estado: 'enviada',
        mensajeId: 'qa-ficticio',
      },
    }).expect(409);
    await http({
      metodo: 'post',
      ruta: `/integraciones/notificaciones/${avisos[1].incierta}/resolver`,
      body: resolver,
    }).expect(404);
    expect(await snapshot()).toEqual(antes);
  });
  it('mantiene la resolución de soporte con su autor real y sin enviar', async () => {
    await http(
      {
        metodo: 'post',
        ruta: `/integraciones/notificaciones/${avisos[0].incierta}/resolver`,
        body: resolver,
      },
      'soporte',
    ).expect(201);
    const aviso = await prisma.notificacionWhatsapp.findUniqueOrThrow({
      where: { id: avisos[0].incierta },
    });
    expect(aviso.estado).toBe('descartada');
    expect(aviso.motivo).toContain('Soporte ficticio');
    const evento = await prisma.eventoSistema.findFirstOrThrow({
      where: { tenantId: tenants[0], entidadId: aviso.id },
    });
    expect(evento.actorUserId).toBe(usuarios.at(-1));
    expect(wati.enviarPlantilla).not.toHaveBeenCalled();
  });
  it('aplica la revocación persistida aunque el JWT siga vigente', async () => {
    await prisma.membership.update({
      where: { id: miembros.lector },
      data: { activa: false },
    });
    await http({ metodo: 'get', ruta: '/integraciones' }, 'lector').expect(401);
  });
});
