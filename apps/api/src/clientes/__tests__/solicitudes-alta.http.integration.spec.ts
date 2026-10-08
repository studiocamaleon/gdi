import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthGuard } from '../../auth/auth.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { SolicitudesAltaService } from '../solicitudes-alta.service';
import {
  RegistroClientesPublicoController,
  SolicitudesAltaController,
} from '../solicitudes-alta.controller';
import { cuitValido } from '../../common/cuit';
import { expandir } from '../../auth/permisos';

describe('Autoregistro: HTTP, aprobación y aislamiento con PostgreSQL real', () => {
  const prisma = new PrismaService();
  const capacidades = capacidadesDePrueba();
  const servicio = new SolicitudesAltaService(prisma, capacidades);
  const jwt = new JwtService({ secret: randomUUID() });
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const tokens: Record<string, string> = {};
  const enlaces: string[] = [];
  let app: INestApplication<Server>;
  let baseValidada = false;
  let dni = 88000000;
  const datos = (extra = {}) => ({
    nombre: `Persona ficticia ${++dni}`,
    documentoTipo: 'DNI',
    documentoNumero: String(dni),
    condicionFiscal: 'consumidor_final',
    telefono: '+1 202 555 0100',
    direccion: 'Calle de prueba 123',
    ciudad: 'Ciudad ficticia',
    ...extra,
  });
  const get = (path: string, actor = 'aprobador') =>
    request(app.getHttpServer())
      .get(`/solicitudes-alta-clientes${path}`)
      .auth(tokens[actor], { type: 'bearer' });
  const post = (path: string, body = {}, actor = 'aprobador') =>
    request(app.getHttpServer())
      .post(`/solicitudes-alta-clientes${path}`)
      .auth(tokens[actor], { type: 'bearer' })
      .send(body);
  const publica = (body: object, token = enlaces[0]) =>
    request(app.getHttpServer()).post(`/registro-clientes/${token}`).send(body);
  async function pendiente(extra = {}, tenant = 0) {
    const body = datos(extra);
    await publica(body, enlaces[tenant]).expect(201);
    return prisma.solicitudAltaCliente.findFirstOrThrow({
      where: {
        tenantId: tenants[tenant],
        documentoNumero: body.documentoNumero.replace(/\D/g, ''),
        estado: 'PENDIENTE',
      },
    });
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Requiere base local de test aislada');
    baseValidada = true;
    await prisma.$connect();
    for (const id of tenants)
      await prisma.tenant.create({
        data: { id, slug: `qa-altas-${id}`, nombre: 'Imprenta ficticia' },
      });
    for (const [nombre, permisos] of [
      ['aprobador', ['crm.aprobar_altas', 'acceso.por_vista']],
      ['lector', ['crm.clientes.ver']],
      ['gestor', ['crm.clientes.gestionar']],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          nombreCompleto: 'Revisor ficticio',
          email: `qa-alta-${randomUUID()}@example.invalid`,
        },
      });
      users.push(user.id);
      const rol = await prisma.rol.create({
        data: { tenantId: tenants[0], nombre, permisos: [...permisos] },
      });
      const m = await prisma.membership.create({
        data: {
          userId: user.id,
          tenantId: tenants[0],
          rolId: rol.id,
          rol: 'OPERADOR',
        },
      });
      const s = await prisma.authSession.create({
        data: {
          userId: user.id,
          currentTenantId: tenants[0],
          currentMembershipId: m.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      tokens[nombre] = jwt.sign({
        sub: user.id,
        email: user.email,
        sessionId: s.id,
        tenantId: tenants[0],
        membershipId: m.id,
        role: 'OPERADOR',
      });
    }
    const module = await Test.createTestingModule({
      controllers: [
        SolicitudesAltaController,
        RegistroClientesPublicoController,
      ],
      providers: [{ provide: SolicitudesAltaService, useValue: servicio }],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    const reflector = new Reflector();
    app.useGlobalGuards(
      new AuthGuard(reflector, jwt, prisma),
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
    for (const t of tenants) enlaces.push((await servicio.habilitar(t)).token);
  });
  it('notifica una sola vez a quienes aprueban, con enlace a solicitudes, sin avisar al resto', async () => {
    const extras = [];
    for (const [tenantId, activa, activo] of [
      [tenants[0], true, true],
      [tenants[0], false, true],
      [tenants[0], true, false],
      [tenants[1], true, true],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          nombreCompleto: 'Admin ficticio',
          email: `aviso-${randomUUID()}@example.invalid`,
          activo,
        },
      });
      users.push(user.id);
      extras.push(user.id);
      await prisma.membership.create({
        data: { tenantId, userId: user.id, rol: 'ADMINISTRADOR', activa },
      });
    }
    const body = datos();
    await publica(body).expect(201);
    await publica(body).expect(201);
    const solicitud = await prisma.solicitudAltaCliente.findFirstOrThrow({
      where: { tenantId: tenants[0], documentoNumero: body.documentoNumero },
    });
    const avisos = await prisma.notificacionInterna.findMany({
      where: { tenantId: tenants[0], evento: { entidadId: solicitud.id } },
      include: { evento: true },
    });
    expect(avisos.map((a) => a.userId).sort()).toEqual(
      [users[0], extras[0]].sort(),
    );
    expect(avisos[0].evento).toMatchObject({
      tipo: 'clientes.alta_solicitada',
      href: '/crm/clientes/solicitudes',
    });
    expect(avisos[0].evento.mensaje).toContain(body.nombre);
    expect(
      await prisma.notificacionInterna.count({
        where: { tenantId: tenants[1], evento: { entidadId: solicitud.id } },
      }),
    ).toBe(0);
    const trampa = datos({ sitioWeb: 'bot.example.invalid' });
    await publica(trampa).expect(201);
    expect(
      await prisma.solicitudAltaCliente.count({
        where: {
          tenantId: tenants[0],
          documentoNumero: trampa.documentoNumero,
        },
      }),
    ).toBe(0);
  });

  afterAll(async () => {
    await app?.close();
    if (baseValidada) {
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.$disconnect();
  });

  it('el enlace sólo revela el nombre de la empresa, sin sesión', async () => {
    const r = await request(app.getHttpServer())
      .get(`/registro-clientes/${enlaces[0]}`)
      .expect(200);
    expect(r.body).toEqual({ empresa: 'Imprenta ficticia' });
    await request(app.getHttpServer())
      .get('/registro-clientes/inexistente')
      .expect(404);
    await request(app.getHttpServer())
      .get('/solicitudes-alta-clientes')
      .expect(401);
  });
  it.each(['lector', 'gestor'])(
    'deniega a %s todos los accesos de revisión y configuración',
    async (actor) => {
      await get('', actor).expect(403);
      await get('/enlace', actor).expect(403);
      await post('/enlace', {}, actor).expect(403);
      await post('/enlace/renovar', {}, actor).expect(403);
      await post(
        `/${randomUUID()}/decision`,
        { accion: 'aprobar' },
        actor,
      ).expect(403);
      await request(app.getHttpServer())
        .delete('/solicitudes-alta-clientes/enlace')
        .auth(tokens[actor], { type: 'bearer' })
        .expect(403);
    },
  );
  it('el permiso independiente permite revisión y lectura, pero no editar clientes', () => {
    const permisos = expandir(['acceso.por_vista', 'crm.aprobar_altas']);
    expect(permisos.has('crm.clientes.ver')).toBe(true);
    expect(permisos.has('crm.clientes.gestionar')).toBe(false);
  });
  it.each([
    'nombre',
    'documentoNumero',
    'condicionFiscal',
    'telefono',
    'direccion',
    'ciudad',
  ])('exige el dato %s', async (campo) => {
    const body: Record<string, unknown> = datos();
    delete body[campo];
    await publica(body).expect(400);
  });
  it('valida CUIT, condición fiscal, teléfono y rechaza campos administrativos', async () => {
    await publica(
      datos({ documentoTipo: 'CUIT', documentoNumero: '00000000000' }),
    ).expect(400);
    await publica(
      datos({ documentoTipo: 'CUIT', documentoNumero: '20123456780' }),
    ).expect(400);
    await publica(datos({ condicionFiscal: 'RI' })).expect(400);
    await publica(datos({ telefono: '12345678' })).expect(400);
    await publica(
      datos({ tenantId: tenants[1], estado: 'APROBADA', limiteCredito: 1000 }),
    ).expect(400);
  });
  it('el campo trampa no crea datos; duplicar el envío no duplica ni reemplaza la solicitud', async () => {
    const body = datos();
    await publica({ ...body, sitioWeb: 'https://example.invalid' }).expect(201);
    expect(
      await prisma.solicitudAltaCliente.count({
        where: { tenantId: tenants[0], documentoNumero: body.documentoNumero },
      }),
    ).toBe(0);
    const results = await Promise.all([
      publica(body),
      publica({ ...body, nombre: 'Nombre reemplazado' }),
    ]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(
      await prisma.solicitudAltaCliente.count({
        where: { tenantId: tenants[0], documentoNumero: body.documentoNumero },
      }),
    ).toBe(1);
  });
  it('aprobar crea datos fiscales, teléfono normalizado y auditoría, sin conceder accesos', async () => {
    const s = await pendiente();
    const antes = await prisma.user.count();
    const r = await post(`/${s.id}/decision`, {
      accion: 'aprobar',
      confirmarCoincidencias: true,
    }).expect(201);
    const cliente = await prisma.cliente.findUniqueOrThrow({
      where: { id: r.body.clienteId },
      include: { direcciones: true, eventos: true },
    });
    expect(cliente).toMatchObject({
      razonSocial: s.nombre,
      documentoNumero: s.documentoNumero,
      condicionFiscal: 'consumidor_final',
      telefonoCodigo: '+1',
      telefonoNumero: '2025550100',
      origenAlta: 'autoregistro',
      aceptaWhatsapp: null,
    });
    expect(cliente.direcciones[0]).toMatchObject({
      tipo: 'FACTURACION',
      direccion: s.direccion,
      ciudad: s.ciudad,
      principal: true,
    });
    expect(cliente.eventos[0].actorNombre).toBe('Revisor ficticio');
    expect(r.body.resueltoPorNombre).toBe('Revisor ficticio');
    expect(await prisma.user.count()).toBe(antes);
    await post(`/${s.id}/decision`, { accion: 'rechazar' }).expect(409);
  });
  it('rechazar conserva quién/cuándo/motivo y no crea cliente', async () => {
    const s = await pendiente();
    const r = await post(`/${s.id}/decision`, {
      accion: 'rechazar',
      motivo: 'Documento a corregir',
    }).expect(201);
    expect(r.body).toMatchObject({
      estado: 'RECHAZADA',
      clienteId: null,
      motivo: 'Documento a corregir',
      resueltoPorNombre: 'Revisor ficticio',
    });
  });
  it('un cliente con CUIT también se detecta por su DNI y no se duplica', async () => {
    const doc = '33333333';
    const cuit = Array.from({ length: 10 }, (_, n) => `20${doc}${n}`).find(
      cuitValido,
    )!;
    const existente = await prisma.cliente.create({
      data: {
        tenantId: tenants[0],
        nombre: 'Fiscal ficticio',
        cuit,
        paisCodigo: 'AR',
        telefonoCodigo: '+1',
        telefonoNumero: '2025550199',
      },
    });
    const s = await pendiente({ documentoNumero: doc });
    const d = await get(`/${s.id}`).expect(200);
    expect(d.body.coincidencias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: existente.id, documento: true }),
      ]),
    );
    await post(`/${s.id}/decision`, {
      accion: 'aprobar',
      confirmarCoincidencias: true,
    }).expect(409);
    await post(`/${s.id}/decision`, {
      accion: 'vincular',
      clienteId: existente.id,
    }).expect(201);
    expect(
      (await prisma.cliente.findUniqueOrThrow({ where: { id: existente.id } }))
        .nombre,
    ).toBe('Fiscal ficticio');
  });
  it('aprobar CUIT conserva CUIT y DNI, evita duplicar en sentido inverso', async () => {
    const doc = '33444444';
    const cuit = Array.from({ length: 10 }, (_, n) => `27${doc}${n}`).find(
      cuitValido,
    )!;
    const s = await pendiente({
      documentoTipo: 'CUIT',
      documentoNumero: cuit,
      condicionFiscal: 'RI',
    });
    const r = await post(`/${s.id}/decision`, {
      accion: 'aprobar',
      confirmarCoincidencias: true,
    }).expect(201);
    expect(
      await prisma.cliente.findUnique({ where: { id: r.body.clienteId } }),
    ).toMatchObject({ cuit, documentoNumero: doc, condicionFiscal: 'RI' });
    const duplicado = await pendiente({ documentoNumero: doc });
    await post(`/${duplicado.id}/decision`, {
      accion: 'aprobar',
      confirmarCoincidencias: true,
    }).expect(409);
  });
  it('teléfono compartido exige revisión explícita pero no impide crear otra persona', async () => {
    const s = await pendiente();
    await post(`/${s.id}/decision`, { accion: 'aprobar' }).expect(409);
    await post(`/${s.id}/decision`, {
      accion: 'aprobar',
      confirmarCoincidencias: true,
    }).expect(201);
  });
  it('dos aprobaciones concurrentes sólo crean un cliente', async () => {
    const s = await pendiente();
    const r = await Promise.all([
      post(`/${s.id}/decision`, {
        accion: 'aprobar',
        confirmarCoincidencias: true,
      }),
      post(`/${s.id}/decision`, {
        accion: 'aprobar',
        confirmarCoincidencias: true,
      }),
    ]);
    expect(r.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.cliente.count({
        where: { tenantId: tenants[0], documentoNumero: s.documentoNumero },
      }),
    ).toBe(1);
  });
  it('aísla solicitudes y clientes de otra empresa, incluso al vincular', async () => {
    const s = await pendiente({}, 1);
    await get(`/${s.id}`).expect(404);
    await post(`/${s.id}/decision`, { accion: 'rechazar' }).expect(404);
    const local = await pendiente();
    const ajeno = await prisma.cliente.create({
      data: {
        tenantId: tenants[1],
        nombre: 'Cliente de otra empresa',
        paisCodigo: 'AR',
        telefonoCodigo: '+1',
        telefonoNumero: '2025550100',
      },
    });
    await post(`/${local.id}/decision`, {
      accion: 'vincular',
      clienteId: ajeno.id,
    }).expect(400);
    const lista = await get('').expect(200);
    expect(
      lista.body.items.every(
        (x: { tenantId: string }) => x.tenantId === tenants[0],
      ),
    ).toBe(true);
  });
  it('renovar y desactivar invalidan el token para lectura y escritura', async () => {
    const viejo = enlaces[0];
    const r = await post('/enlace/renovar').expect(201);
    enlaces[0] = r.body.token;
    await publica(datos(), viejo).expect(404);
    await request(app.getHttpServer())
      .get(`/registro-clientes/${viejo}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete('/solicitudes-alta-clientes/enlace')
      .auth(tokens.aprobador, { type: 'bearer' })
      .expect(200);
    await publica(datos()).expect(404);
    await post('/enlace').expect(201);
  });
  it('limita el volumen diario sin escribir por encima del límite', async () => {
    const existentes = await prisma.solicitudAltaCliente.count({
      where: { tenantId: tenants[1] },
    });
    await prisma.solicitudAltaCliente.createMany({
      data: Array.from({ length: 100 - existentes }, (_, i) => ({
        tenantId: tenants[1],
        nombre: 'Solicitud ficticia',
        documentoTipo: 'DNI',
        documentoNumero: String(90000000 + i),
        condicionFiscal: 'consumidor_final',
        telefono: '+12025550100',
        direccion: 'Prueba 1',
        ciudad: 'Prueba',
        estado: 'RECHAZADA',
      })),
    });
    await publica(datos(), enlaces[1]).expect(429);
    expect(
      await prisma.solicitudAltaCliente.count({
        where: { tenantId: tenants[1] },
      }),
    ).toBe(100);
  });
});
