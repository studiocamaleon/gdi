import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { AuthGuard } from '../../auth/auth.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { PrismaService } from '../../prisma/prisma.service';
import { ProduccionService } from '../../produccion/produccion.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { EtaController } from '../eta.controller';
import { EtaService } from '../eta.service';

/** HTTP, sesiones, guards, cálculo, SQL y persistencia reales. Se sustituye
 * únicamente la lectura de la suscripción; no hay cron ni proveedores. */
describe('ETA: aislamiento HTTP de contexto, métricas y registros diarios', () => {
  const prisma = new PrismaService();
  const capacidades = capacidadesDePrueba();
  const secretAnterior = process.env.JWT_SECRET;
  const secret = randomUUID();
  const jwt = new JwtService({ secret });
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const estaciones: string[] = [];
  const items: string[] = [];
  const tokens: Record<string, string> = {};
  const lecturas = ['contexto-prevision', 'precision', 'colas', 'salud'];
  let app: INestApplication<Server>;
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
    process.env.JWT_SECRET = secret;
    await prisma.$connect();
    for (const [i, tenantId] of tenants.entries()) {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          slug: `qa-eta-${tenantId}`,
          nombre: 'Empresa ficticia',
        },
      });
      const estacion = await prisma.estacion.create({
        data: {
          tenantId,
          nombre: `Estación privada ${i}`,
        },
      });
      estaciones.push(estacion.id);
      await prisma.configuracionProduccion.create({
        data: {
          tenantId,
          margenEtaDias: i + 1,
        },
      });
      const orden = await prisma.ordenTrabajo.create({
        data: {
          tenantId,
          numero: `QA-ETA-${i}`,
          estado: 'pendiente',
        },
      });
      const item = await prisma.ordenTrabajoItem.create({
        data: {
          tenantId,
          ordenId: orden.id,
          codigo: 'QA-ETA',
          nombre: `Item privado ${i}`,
          familia: 'QA',
          cantidad: 1,
          cantidadUnidad: 'un',
          subtotal: 0,
          impuestos: 0,
          total: 0,
        },
      });
      items.push(item.id);
      await prisma.ordenTrabajoItemPaso.create({
        data: {
          tenantId,
          ordenId: orden.id,
          itemId: item.id,
          indice: 0,
          familiaCodigo: 'embalaje',
          categoriaFamilia: 'acabado',
          nombre: `Paso pendiente ${i}`,
          duracionEstimadaMin: 15,
          esTerminal: true,
        },
      });
      await prisma.etaPromesa.create({
        data: {
          tenantId,
          ordenId: orden.id,
          itemId: item.id,
          hito: 'emision',
          congeladaEl: new Date('2026-08-10T10:00:00Z'),
          finReal: new Date('2026-08-11T10:00:00Z'),
          errorMin: (i + 1) * 10,
          parcial: i === 1,
        },
      });
      await prisma.etaSnapshotEstacion.create({
        data: {
          tenantId,
          fecha: new Date('2026-08-10'),
          estacionKey: estacion.id,
          estacionNombre: estacion.nombre,
          colaMin: (i + 1) * 100,
          esperaP50Min: 0,
          esperaP90Min: 0,
          contencionMax: 1,
          utilizacion5dPct: 10,
          pasosEnPlan: 1,
        },
      });
      const terminada = await prisma.ordenTrabajo.create({
        data: { tenantId, numero: `QA-ETA-CERRADA-${i}`, estado: 'finalizada' },
      });
      const terminado = await prisma.ordenTrabajoItem.create({
        data: {
          tenantId,
          ordenId: terminada.id,
          codigo: 'QA-ETA-CERRADO',
          nombre: 'Item terminado ficticio',
          familia: 'QA',
          cantidad: 1,
          cantidadUnidad: 'un',
          subtotal: 0,
          impuestos: 0,
          total: 0,
        },
      });
      await prisma.ordenTrabajoItemPaso.createMany({
        data: Array.from({ length: 5 }, (_, indice) => ({
          tenantId,
          ordenId: terminada.id,
          itemId: terminado.id,
          indice,
          familiaCodigo: `familia-qa-${i}`,
          categoriaFamilia: 'acabado',
          nombre: 'Paso medido ficticio',
          estado: 'hecho',
          tiempoFuente: 'medido',
          duracionEstimadaMin: 10,
          tiempoRealMin: (i + 1) * 30,
        })),
      });
    }
    for (const [actor, i, permisos] of [
      ['supervisor', 0, ['produccion.ver', 'produccion.supervisar']],
      ['lector', 0, ['produccion.ver']],
      ['sin-permisos', 0, []],
      ['otra-empresa', 1, ['produccion.ver', 'produccion.supervisar']],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          email: `qa-eta-${randomUUID()}@example.invalid`,
        },
      });
      users.push(user.id);
      const rol = await prisma.rol.create({
        data: {
          tenantId: tenants[i],
          nombre: actor,
          permisos: [...permisos],
        },
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
      tokens[actor] = jwt.sign({
        sub: user.id,
        email: user.email,
        sessionId: sesion.id,
        tenantId: tenants[i],
        membershipId: miembro.id,
        role: 'ADMINISTRADOR',
      });
    }
    const produccion = new ProduccionService(prisma, capacidades);
    const modulo = await Test.createTestingModule({
      controllers: [EtaController],
      providers: [
        {
          provide: EtaService,
          useValue: new EtaService(prisma, produccion, capacidades),
        },
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
    if (secretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretAnterior;
    await app?.close();
    if (baseValidada) {
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.$disconnect();
  });

  const http = (
    ruta: string,
    actor = 'lector',
    metodo: 'get' | 'post' = 'get',
  ) =>
    request(app.getHttpServer())
      [metodo](`/eta/${ruta}`)
      .auth(tokens[actor], { type: 'bearer' })
      .set('x-tenant-id', tenants[1]);

  it.each(lecturas)('exige sesión y permiso para %s', async (ruta) => {
    await request(app.getHttpServer()).get(`/eta/${ruta}`).expect(401);
    await http(ruta, 'sin-permisos').expect(403);
  });

  it('no cambia de empresa por cabeceras ni por solicitudes simultáneas', async () => {
    const respuestas = await Promise.all([
      http('contexto-prevision'),
      http('contexto-prevision', 'otra-empresa'),
      http('contexto-prevision'),
    ]);
    for (const [n, r] of respuestas.entries()) {
      expect(r.status).toBe(200);
      const i = n === 1 ? 1 : 0;
      const body = r.body as {
        items: { id: string }[];
        estaciones: { id: string }[];
        margenEtaDias: number;
      };
      expect(body.items.map((x) => x.id)).toEqual([items[i]]);
      expect(body.estaciones.map((x) => x.id)).toEqual([estaciones[i]]);
      expect(body.margenEtaDias).toBe(i + 1);
      expect(r.text).not.toContain(items[1 - i]);
      expect(r.text).not.toContain(estaciones[1 - i]);
    }
  });

  it('separa las colas y no revela una estación ajena al usar su identificador', async () => {
    for (const [i, actor] of ['lector', 'otra-empresa'].entries()) {
      const r = await http(
        'colas?desde=2026-08-01&hasta=2026-08-31',
        actor,
      ).expect(200);
      expect(r.body).toEqual([
        expect.objectContaining({
          tenantId: tenants[i],
          estacionKey: estaciones[i],
          colaMin: (i + 1) * 100,
        }),
      ]);
      const ajena = await http(
        `colas?estacion=${estaciones[1 - i]}`,
        actor,
      ).expect(200);
      expect(ajena.body).toEqual([]);
    }
  });

  it('calcula precisión y cobertura sólo con las promesas propias', async () => {
    for (const [i, actor] of ['lector', 'otra-empresa'].entries()) {
      const precision = await http(
        'precision?desde=2026-08-01&hasta=2026-08-31',
        actor,
      ).expect(200);
      expect(precision.body).toMatchObject({
        cerradas: 1,
        muestras: 1,
        maeMin: (i + 1) * 10,
      });
      const salud = await http('salud', actor).expect(200);
      expect(salud.body).toMatchObject({
        cobertura: {
          promesas: 1,
          conEtaPct: 100,
          parcialPct: i * 100,
        },
        sesgoFamilias: [
          expect.objectContaining({
            familiaCodigo: `familia-qa-${i}`,
            muestras: 5,
            medianaRealMin: (i + 1) * 30,
          }),
        ],
      });
    }
  });

  it('el lector no puede generar registros diarios ni alterar el de otra empresa', async () => {
    const where = { tenantId: { in: tenants } };
    const antes = await prisma.etaSnapshotEstacion.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    await request(app.getHttpServer()).post('/eta/snapshot').expect(401);
    await http('snapshot', 'lector', 'post').expect(403);
    await http('snapshot', 'sin-permisos', 'post').expect(403);
    expect(
      await prisma.etaSnapshotEstacion.findMany({
        where,
        orderBy: { id: 'asc' },
      }),
    ).toEqual(antes);
    expect(await prisma.etaSnapshotItem.count({ where })).toBe(0);
  });

  it('el supervisor genera registros propios y repetir no duplica ni escribe en otra empresa', async () => {
    const otra = { tenantId: tenants[1] };
    const antes = await prisma.etaSnapshotEstacion.findMany({ where: otra });
    for (let n = 0; n < 2; n++) {
      const r = await http('snapshot', 'supervisor', 'post').expect(201);
      expect(r.body).toEqual({ ok: true });
    }
    expect(await prisma.etaSnapshotEstacion.findMany({ where: otra })).toEqual(
      antes,
    );
    expect(await prisma.etaSnapshotItem.count({ where: otra })).toBe(0);
    const propias = await prisma.etaSnapshotItem.findMany({
      where: { tenantId: tenants[0] },
    });
    expect(propias).toEqual([expect.objectContaining({ itemId: items[0] })]);
  });
});
