import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { capacidadesDePrueba } from '../../test/fixture-capacidades';
import { AuthGuard } from '../auth/auth.guard';
import { PermisosGuard } from '../auth/permisos.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { PrismaService } from '../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesService } from './cotizaciones.service';
import { TipoCambioService } from './tipo-cambio.service';

/** Sesiones, guards, servicios y SQL reales. La suscripción y la respuesta
 * pública de DolarAPI son fixtures; ningún pedido llega a un proveedor. */
describe('Tipos de cambio: aislamiento y permisos por HTTP', () => {
  const prisma = new PrismaService();
  const capacidades = capacidadesDePrueba();
  const jwt = new JwtService({ secret: randomUUID() });
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const actors: Record<string, { token: string; userId: string }> = {};
  const tasas: string[] = [];
  let app: INestApplication<Server>;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let baseValidada = false;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Requiere base local de test y aislamiento activo');
    baseValidada = true;
    await prisma.$connect();
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('Proveedor externo no permitido en este ensayo');
    });
    for (const [i, tenantId] of tenants.entries()) {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          slug: `qa-cambio-${tenantId}`,
          nombre: 'Empresa ficticia',
        },
      });
      await prisma.datosEmpresa.create({
        data: {
          tenantId,
          paisCodigo: i === 0 ? 'AR' : 'UY',
          monedaCodigo: i === 0 ? 'ARS' : 'UYU',
          tipoCambioConfig: {
            modo: 'manual',
            monedaDestino: i === 0 ? 'ARS' : 'UYU',
            tasaManual: i === 0 ? 1200 : 40,
            referencia: `Privada ${i}`,
          },
        },
      });
    }
    for (const [actor, i, permisos] of [
      ['gestor', 0, ['configuracion.gestionar', 'comercial.ver']],
      ['comercial', 0, ['comercial.ver']],
      ['inventario', 0, ['inventario.ver']],
      ['sin-permisos', 0, []],
      ['otra-empresa', 1, ['configuracion.gestionar', 'comercial.ver']],
    ] as const) {
      const user = await prisma.user.create({
        data: { email: `qa-cambio-${randomUUID()}@example.invalid` },
      });
      users.push(user.id);
      const rol = await prisma.rol.create({
        data: { tenantId: tenants[i], nombre: actor, permisos: [...permisos] },
      });
      const miembro = await prisma.membership.create({
        data: {
          tenantId: tenants[i],
          userId: user.id,
          rol: 'ADMINISTRADOR',
          rolId: rol.id,
        },
      });
      const sesion = await prisma.authSession.create({
        data: {
          userId: user.id,
          currentTenantId: tenants[i],
          currentMembershipId: miembro.id,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      actors[actor] = {
        userId: user.id,
        token: jwt.sign({
          sub: user.id,
          email: user.email,
          sessionId: sesion.id,
          tenantId: tenants[i],
          membershipId: miembro.id,
          role: 'ADMINISTRADOR',
        }),
      };
    }
    const cotizaciones = new CotizacionesService(prisma);
    const cambio = new TipoCambioService(prisma, cotizaciones, capacidades);
    for (const [i, tenantId] of tenants.entries()) {
      const snapshot = await cambio.crear(tenantId, null, {
        modo: 'manual',
        tasa: i === 0 ? 1200 : 40,
      });
      tasas.push(snapshot.id);
    }
    const modulo = await Test.createTestingModule({
      controllers: [CotizacionesController],
      providers: [
        { provide: CotizacionesService, useValue: cotizaciones },
        { provide: TipoCambioService, useValue: cambio },
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

  afterAll(async () => {
    await app?.close();
    fetchSpy?.mockRestore();
    if (baseValidada) {
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.$disconnect();
  });

  const http = (
    ruta: string,
    actor = 'comercial',
    metodo: 'get' | 'patch' | 'post' = 'get',
  ) =>
    request(app.getHttpServer())
      [metodo](`/cotizaciones/${ruta}`)
      .auth(actors[actor].token, { type: 'bearer' })
      .set('x-tenant-id', tenants[1]);

  it('exige sesión en las cinco rutas', async () => {
    for (const ruta of [
      'dolar',
      'tipo-cambio/configuracion',
      `tipo-cambio/${tasas[0]}`,
    ])
      await request(app.getHttpServer())
        .get(`/cotizaciones/${ruta}`)
        .expect(401);
    await request(app.getHttpServer())
      .post('/cotizaciones/tipo-cambio')
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .patch('/cotizaciones/tipo-cambio/configuracion')
      .send({})
      .expect(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('no cambia de empresa por cabeceras ni mezcla lecturas simultáneas', async () => {
    const respuestas = await Promise.all([
      http('tipo-cambio/configuracion'),
      http('tipo-cambio/configuracion', 'otra-empresa'),
      http('tipo-cambio/configuracion'),
    ]);
    for (const [n, respuesta] of respuestas.entries()) {
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toMatchObject(
        n === 1
          ? { tasaManual: 40, monedaDestino: 'UYU', referencia: 'Privada 1' }
          : { tasaManual: 1200, monedaDestino: 'ARS', referencia: 'Privada 0' },
      );
    }
    await http(`tipo-cambio/${tasas[1]}`).expect(404);
    const propia = await http(`tipo-cambio/${tasas[1]}`, 'otra-empresa').expect(
      200,
    );
    expect(propia.body).toMatchObject({
      id: tasas[1],
      tasa: 40,
      monedaDestino: 'UYU',
    });
  });

  it('conserva sólo lectura sin permitir cambiar la configuración', async () => {
    await http('tipo-cambio/configuracion', 'sin-permisos').expect(200);
    await http(`tipo-cambio/${tasas[0]}`, 'sin-permisos').expect(200);
    for (const actor of ['comercial', 'inventario', 'sin-permisos'])
      await http('tipo-cambio/configuracion', actor, 'patch')
        .send({ modo: 'manual', tasa: 999 })
        .expect(403);
    const actual = await http('tipo-cambio/configuracion').expect(200);
    expect(actual.body).toMatchObject({ tasaManual: 1200 });
  });

  it('exige permiso de comercial o inventario y fija empresa y autor en el servidor', async () => {
    const antes = await prisma.tipoCambioCotizacion.count({
      where: { tenantId: tenants[0] },
    });
    await http('tipo-cambio', 'sin-permisos', 'post')
      .send({ modo: 'manual', tasa: 1100 })
      .expect(403);
    await http('tipo-cambio', 'comercial', 'post')
      .send({
        modo: 'manual',
        tasa: 1100,
        tenantId: tenants[1],
        usuarioId: actors['otra-empresa'].userId,
      })
      .expect(400);
    expect(
      await prisma.tipoCambioCotizacion.count({
        where: { tenantId: tenants[0] },
      }),
    ).toBe(antes);
    for (const actor of ['comercial', 'inventario']) {
      const propia = await http('tipo-cambio', actor, 'post')
        .send({ modo: 'manual', tasa: 1100 })
        .expect(201);
      expect(propia.body).toMatchObject({
        tasa: 1100,
        usuarioId: actors[actor].userId,
        monedaDestino: 'ARS',
        fuente: 'Manual',
      });
      const registro = await prisma.tipoCambioCotizacion.findUniqueOrThrow({
        where: { id: (propia.body as { id: string }).id },
      });
      expect(registro.tenantId).toBe(tenants[0]);
    }
  });

  it('rechaza tasas inválidas y campos de autoría antes de persistir', async () => {
    const antes = await prisma.tipoCambioCotizacion.count({
      where: { tenantId: tenants[0] },
    });
    for (const body of [
      { modo: 'manual', tasa: 0 },
      { modo: 'manual', tasa: -1 },
      { modo: 'manual', tasa: 1_000_000_001 },
      { modo: 'manual', tasa: 1, capturadoEn: '2000-01-01' },
    ])
      await http('tipo-cambio', 'comercial', 'post').send(body).expect(400);
    expect(
      await prisma.tipoCambioCotizacion.count({
        where: { tenantId: tenants[0] },
      }),
    ).toBe(antes);
  });

  it('guarda la configuración autorizada sólo en la empresa de la sesión', async () => {
    await http('tipo-cambio/configuracion', 'gestor', 'patch')
      .send({ modo: 'manual', tasa: 1250 })
      .expect(200);
    expect(
      (await http('tipo-cambio/configuracion').expect(200)).body,
    ).toMatchObject({ tasaManual: 1250 });
    expect(
      (await http('tipo-cambio/configuracion', 'otra-empresa').expect(200))
        .body,
    ).toMatchObject({ tasaManual: 40 });
  });

  it('consulta un destino fijo del proveedor, omite caché compartida de respuesta y no acepta otro país del cliente', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            moneda: 'USD',
            casa: 'oficial',
            venta: 1200,
            fechaActualizacion: new Date().toISOString(),
          },
        ]),
        { status: 200 },
      ),
    );
    const resultado = await http('dolar?pais=UY&url=http://127.0.0.1').expect(
      200,
    );
    expect(resultado.headers['cache-control']).toBe('private, no-store');
    expect(resultado.body).toMatchObject({
      paisCodigo: 'AR',
      monedaLocal: 'ARS',
      estado: 'disponible',
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://dolarapi.com/v1/dolares',
      expect.objectContaining({
        redirect: 'error',
        signal: expect.any(AbortSignal) as unknown,
      }),
    );
  });
});
