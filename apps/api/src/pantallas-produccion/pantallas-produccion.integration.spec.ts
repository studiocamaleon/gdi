import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermisosGuard } from '../auth/permisos.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { PantallasProduccionService } from './pantallas-produccion.service';
import {
  DispositivoProduccionController,
  PantallasProduccionController,
} from './pantallas-produccion.controller';
import { diaEnZona } from './entregas-pantalla';

describe('TV: vinculación, lectura y aislamiento con PostgreSQL y guards reales', () => {
  const prisma = new PrismaService();
  const secret = randomUUID();
  const secretAnterior = process.env.JWT_SECRET;
  const jwt = new JwtService({ secret });
  const tenantIds = [randomUUID(), randomUUID()];
  const userIds: string[] = [];
  const miembros: string[] = [];
  const roles: string[] = [];
  const sesiones: string[] = [];
  const tokens: string[] = [];
  const hashes: string[] = [];
  let app: INestApplication<Server>;
  let ip = 10;
  let baseValidada = false;
  const permisos = ['produccion.tablero.ver', 'produccion.configurar'];
  const get = (url: string, token?: string) =>
    request(app.getHttpServer())
      .get(url)
      .set('X-Forwarded-For', `203.0.113.${ip}`)
      .set('Authorization', token ? `Bearer ${token}` : '');
  const post = (url: string, token?: string) =>
    request(app.getHttpServer())
      .post(url)
      .set('X-Forwarded-For', `203.0.113.${ip}`)
      .set('Authorization', token ? `Bearer ${token}` : '');

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Sólo base local de test con aislamiento');
    baseValidada = true;
    process.env.JWT_SECRET = secret;
    await prisma.$connect();
    for (const [i, id] of tenantIds.entries()) {
      await prisma.tenant.create({
        data: { id, nombre: `Taller ficticio ${i}`, slug: `tv-test-${id}` },
      });
      const user = await prisma.user.create({
        data: {
          email: `tv-${id}@example.invalid`,
          nombreCompleto: 'Supervisor ficticio',
          passwordHash: 'no-utilizable',
          activo: true,
        },
      });
      userIds.push(user.id);
      const rol = await prisma.rol.create({
        data: { tenantId: id, nombre: 'Supervisor de prueba', permisos },
      });
      roles.push(rol.id);
      const miembro = await prisma.membership.create({
        data: {
          tenantId: id,
          userId: user.id,
          rol: 'ADMINISTRADOR',
          rolId: rol.id,
        },
      });
      miembros.push(miembro.id);
      const sesion = await prisma.authSession.create({
        data: {
          userId: user.id,
          currentTenantId: id,
          currentMembershipId: miembro.id,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      sesiones.push(sesion.id);
      tokens.push(
        jwt.sign({
          sub: user.id,
          email: user.email,
          sessionId: sesion.id,
          tenantId: id,
          membershipId: miembro.id,
          role: 'ADMINISTRADOR',
        }),
      );
      const hoy = diaEnZona(new Date(), 'America/Argentina/Buenos_Aires');
      await prisma.ordenTrabajo.create({
        data: {
          tenantId: id,
          numero: `OT-FICTICIA-${i}`,
          estado: 'produccion',
          fechaEntrega: new Date(`${hoy}T00:00:00Z`),
          items: {
            create: {
              tenantId: id,
              codigo: 'QA',
              nombre: `Trabajo privado ${i}`,
              familia: 'Test',
              cantidad: 5,
              cantidadUnidad: 'un',
              subtotal: 999,
              impuestos: 0,
              total: 999,
            },
          },
        },
      });
    }
    const modulo = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      controllers: [
        DispositivoProduccionController,
        PantallasProduccionController,
      ],
      providers: [
        ThrottlerGuard,
        PantallasProduccionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useLogger(false);
    // Orígenes ficticios distintos para comprobar el límite por IP en cada caso.
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    const reflector = new Reflector();
    app.useGlobalGuards(
      modulo.get(ThrottlerGuard),
      new AuthGuard(reflector, jwt, prisma),
      new PermisosGuard(reflector),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new TenantContextInterceptor(reflector));
    await app.init();
  }, 30_000);

  beforeEach(() => {
    ip++;
  });
  afterAll(async () => {
    await app?.close();
    if (baseValidada) {
      await prisma.pantallaProduccion.deleteMany({
        where: { tokenHash: { in: hashes } },
      });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
    if (secretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretAnterior;
  });

  async function iniciar() {
    const token = `grafo_tv_${randomBytes(32).toString('hex')}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    hashes.push(tokenHash);
    const r = await post('/pantalla-produccion/iniciar', token).expect(201);
    return { token, tokenHash, codigo: r.body.codigo as string };
  }
  async function vincular(codigo: string, actor = 0) {
    return post('/produccion/pantallas/vincular', tokens[actor]).send({
      codigo,
      nombre: 'TV ficticia',
      intervaloSegundos: 15,
    });
  }

  it('no entrega datos sin vincular; el código sólo se canjea una vez y la TV no puede operar como usuario', async () => {
    const tv = await iniciar();
    await get('/pantalla-produccion/datos').expect(401);
    await get('/pantalla-produccion/datos', tv.token).expect(401);
    expect(
      (await get('/pantalla-produccion/estado', tv.token).expect(200)).body
        .codigo,
    ).toBe(tv.codigo);
    expect(
      (await vincular(`${tv.codigo.slice(0, 4)}-${tv.codigo.slice(4)}`)).status,
    ).toBe(201);
    expect((await vincular(tv.codigo, 1)).status).toBe(400);
    await get('/produccion/pantallas', tv.token).expect(401);
    const r = await get('/pantalla-produccion/datos', tv.token).expect(200);
    expect(r.body.filas.map((f: { producto: string }) => f.producto)).toEqual([
      'Trabajo privado 0',
    ]);
    expect(r.body.resumen).toEqual({ atrasadas: 0, hoy: 1, listas: 0 });
    expect(JSON.stringify(r.body)).not.toMatch(
      /tokenHash|codigoHash|password|subtotal|impuestos|total":999|Trabajo privado 1/,
    );
    const list = await get('/produccion/pantallas', tokens[0]).expect(200);
    expect(JSON.stringify(list.body)).not.toMatch(/tokenHash|codigoHash/);
    const row = await prisma.pantallaProduccion.findUniqueOrThrow({
      where: { tokenHash: tv.tokenHash },
    });
    expect(row.codigoHash).toBeNull();
    expect(JSON.stringify(row)).not.toContain(tv.token);
  });

  it('resuelve una vinculación simultánea a una sola empresa', async () => {
    const tv = await iniciar();
    const respuestas = await Promise.all([
      vincular(tv.codigo, 0),
      vincular(tv.codigo, 1),
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 400]);
    const ganadora = respuestas.findIndex((r) => r.status === 201);
    const datos = await get('/pantalla-produccion/datos', tv.token).expect(200);
    expect(datos.body.empresa).toBe(`Taller ficticio ${ganadora}`);
  });

  it('la lectura prioriza los ítems sin terminar y separa las OT e ítems listos con fecha vencida', async () => {
    const hoy = diaEnZona(new Date(), 'America/Argentina/Buenos_Aires');
    const ayer = new Date(`${hoy}T00:00:00Z`);
    ayer.setUTCDate(ayer.getUTCDate() - 1);
    const ids = [randomUUID(), randomUUID()];
    const producto = (nombre: string, listoEnMostrador = false) => ({
      tenantId: tenantIds[0],
      codigo: 'QA',
      nombre,
      familia: 'Test',
      cantidad: 1,
      cantidadUnidad: 'un',
      subtotal: 100,
      impuestos: 0,
      total: 100,
      listoEnMostrador,
    });
    try {
      await prisma.ordenTrabajo.create({
        data: {
          id: ids[0],
          tenantId: tenantIds[0],
          numero: 'OT-LISTA-FICTICIA',
          estado: 'finalizada',
          fechaEntrega: ayer,
          items: { create: producto('Orden terminada') },
        },
      });
      await prisma.ordenTrabajo.create({
        data: {
          id: ids[1],
          tenantId: tenantIds[0],
          numero: 'OT-MIXTA-FICTICIA',
          estado: 'produccion',
          fechaEntrega: new Date(`${hoy}T00:00:00Z`),
          items: {
            create: [
              { ...producto('Ítem atrasado'), fechaEntrega: ayer },
              { ...producto('Ítem listo', true), fechaEntrega: ayer },
            ],
          },
        },
      });
      const tv = await iniciar();
      expect((await vincular(tv.codigo)).status).toBe(201);
      const r = await get('/pantalla-produccion/datos', tv.token).expect(200);
      expect(r.body.resumen).toEqual({ atrasadas: 1, hoy: 1, listas: 2 });
      expect(r.body.filas.map((f: { producto: string }) => f.producto)).toEqual([
        'Ítem atrasado',
        'Trabajo privado 0',
        'Orden terminada',
        'Ítem listo',
      ]);
      expect(r.body.filas[0]).toMatchObject({
        atrasada: true,
        estado: 'pendiente',
      });
      expect(r.body.filas.slice(2)).toEqual([
        expect.objectContaining({ atrasada: false, estado: 'lista' }),
        expect.objectContaining({ atrasada: false, estado: 'lista' }),
      ]);
    } finally {
      await prisma.ordenTrabajo.deleteMany({
        where: { tenantId: tenantIds[0], id: { in: ids } },
      });
    }
  });

  it('impide listar/revocar otras empresas y retira datos al revocar', async () => {
    const tv = await iniciar();
    expect((await vincular(tv.codigo)).status).toBe(201);
    const row = await prisma.pantallaProduccion.findUniqueOrThrow({
      where: { tokenHash: tv.tokenHash },
    });
    const ajenas = await get('/produccion/pantallas', tokens[1]).expect(200);
    expect(ajenas.body.some((r: { id: string }) => r.id === row.id)).toBe(
      false,
    );
    await request(app.getHttpServer())
      .delete(`/produccion/pantallas/${row.id}`)
      .set('Authorization', `Bearer ${tokens[1]}`)
      .expect(404);
    await get('/pantalla-produccion/datos', tv.token).expect(200);
    await request(app.getHttpServer())
      .delete(`/produccion/pantallas/${row.id}`)
      .set('Authorization', `Bearer ${tokens[0]}`)
      .expect(200);
    await get('/pantalla-produccion/datos', tv.token).expect(401);
    await get('/pantalla-produccion/estado', tv.token).expect(401);
  });

  it('rechaza códigos vencidos, intervalos inválidos y campos para cambiar la empresa', async () => {
    const tv = await iniciar();
    await post('/produccion/pantallas/vincular', tokens[0])
      .send({ codigo: tv.codigo, nombre: 'TV', intervaloSegundos: 1 })
      .expect(400);
    await post('/produccion/pantallas/vincular', tokens[0])
      .send({ codigo: tv.codigo, nombre: 'TV', tenantId: tenantIds[1] })
      .expect(400);
    await prisma.pantallaProduccion.update({
      where: { tokenHash: tv.tokenHash },
      data: { venceCodigoEl: new Date(0), expiraEl: new Date(0) },
    });
    expect((await vincular(tv.codigo)).status).toBe(400);
    await get('/pantalla-produccion/estado', tv.token).expect(401);
  });

  it('revalida permisos, membresía, empresa e IP del autorizante en cada lectura', async () => {
    const tv = await iniciar();
    expect((await vincular(tv.codigo)).status).toBe(201);
    await prisma.rol.update({
      where: { id: roles[0] },
      data: { permisos: ['produccion.tablero.ver'] },
    });
    await get('/pantalla-produccion/datos', tv.token).expect(401);
    await post('/produccion/pantallas/vincular', tokens[0])
      .send({ codigo: tv.codigo, nombre: 'TV' })
      .expect(403);
    await prisma.rol.update({ where: { id: roles[0] }, data: { permisos } });
    await prisma.membership.update({
      where: { id: miembros[0] },
      data: { activa: false },
    });
    await get('/pantalla-produccion/datos', tv.token).expect(401);
    await prisma.membership.update({
      where: { id: miembros[0] },
      data: { activa: true, ipsPermitidas: ['192.0.2.1'] },
    });
    await get('/pantalla-produccion/datos', tv.token).expect(401);
    await prisma.membership.update({
      where: { id: miembros[0] },
      data: { ipsPermitidas: [] },
    });
    await prisma.tenant.update({
      where: { id: tenantIds[0] },
      data: { activo: false },
    });
    await get('/pantalla-produccion/datos', tv.token).expect(401);
    await prisma.tenant.update({
      where: { id: tenantIds[0] },
      data: { activo: true },
    });
    await get('/pantalla-produccion/datos', tv.token).expect(200);
  });

  it('conserva la TV al cerrar la sesión personal y la rechaza al vencer su propia credencial', async () => {
    const tv = await iniciar();
    expect((await vincular(tv.codigo)).status).toBe(201);
    await prisma.authSession.update({
      where: { id: sesiones[0] },
      data: { expiresAt: new Date(0) },
    });
    await get('/pantalla-produccion/datos', tv.token).expect(200);
    await prisma.authSession.update({
      where: { id: sesiones[0] },
      data: { expiresAt: new Date(Date.now() + 3_600_000) },
    });
    await prisma.pantallaProduccion.update({
      where: { tokenHash: tv.tokenHash },
      data: { expiraEl: new Date(0) },
    });
    await get('/pantalla-produccion/datos', tv.token).expect(401);
  });

  it('limita intentos de códigos por IP aunque cambie el código enviado', async () => {
    for (let n = 0; n < 5; n++)
      await post('/produccion/pantallas/vincular', tokens[0])
        .send({ codigo: `AAAAAAA${n}`, nombre: 'TV' })
        .expect(400);
    await post('/produccion/pantallas/vincular', tokens[0])
      .send({ codigo: 'BBBBBBBB', nombre: 'TV' })
      .expect(429);
  });
});
