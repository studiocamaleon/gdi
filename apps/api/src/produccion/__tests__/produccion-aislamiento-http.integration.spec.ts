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
import { ProduccionController } from '../produccion.controller';
import { ProduccionService } from '../produccion.service';

/** Sesiones, permisos, controlador, servicio y PostgreSQL reales. Sólo la
 * lectura del plan se sustituye; los fixtures no usan colas ni proveedores. */
describe('Producción: permisos HTTP, referencias y rechazo atómico', () => {
  const prisma = new PrismaService();
  const capacidades = capacidadesDePrueba();
  const secretAnterior = process.env.JWT_SECRET;
  const secret = randomUUID();
  const jwt = new JwtService({ secret });
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const estaciones: string[] = [];
  const maquinas: string[] = [];
  const empleados: string[] = [];
  const equipos: string[] = [];
  const pasos: string[] = [];
  const dias: string[] = [];
  const tokens: Record<string, string> = {};
  let app: INestApplication<Server>;
  let baseValidada = false;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    ) {
      throw new Error('Requiere base local de test y aislamiento activo');
    }
    baseValidada = true;
    process.env.JWT_SECRET = secret;
    await prisma.$connect();
    for (const [i, tenantId] of tenants.entries()) {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          slug: `qa-produccion-${tenantId}`,
          nombre: 'Empresa ficticia',
        },
      });
      const equipo = await prisma.equipoProduccion.create({
        data: {
          tenantId,
          nombre: `Equipo privado ${i}`,
          personas: 1,
          calendarioJson: {},
        },
      });
      equipos.push(equipo.id);
      const estacion = await prisma.estacion.create({
        data: {
          tenantId,
          nombre: `Estación privada ${i}`,
          equipoProduccionId: equipo.id,
        },
      });
      estaciones.push(estacion.id);
      const planta = await prisma.planta.create({
        data: { tenantId, codigo: 'QA-PLANTA', nombre: 'Planta ficticia' },
      });
      const maquina = await prisma.maquina.create({
        data: {
          tenantId,
          plantaId: planta.id,
          estacionId: estacion.id,
          codigo: 'QA-MAQUINA',
          nombre: `Máquina privada ${i}`,
          plantilla: 'GUILLOTINA',
          geometriaTrabajo: 'PLIEGO',
          unidadProduccionPrincipal: 'CORTES_MIN',
        },
      });
      maquinas.push(maquina.id);
      const empleado = await prisma.empleado.create({
        data: {
          tenantId,
          nombreCompleto: `Empleado privado ${i}`,
          emailPrincipal: `operario-${i}@example.invalid`,
          telefonoCodigo: '',
          telefonoNumero: '',
          sector: 'Producción',
          fechaIngreso: new Date('2026-01-01'),
        },
      });
      empleados.push(empleado.id);
      await prisma.estacionEmpleado.create({
        data: { tenantId, estacionId: estacion.id, empleadoId: empleado.id },
      });
      const paso = await prisma.pasoTenant.create({
        data: {
          tenantId,
          nombre: `Paso privado ${i}`,
          plantillaCodigo: 'embalaje',
        },
      });
      pasos.push(paso.id);
      const dia = await prisma.diaNoLaborable.create({
        data: {
          tenantId,
          fecha: new Date('2026-12-24'),
          descripcion: `Cierre privado ${i}`,
        },
      });
      dias.push(dia.id);
      await prisma.configuracionProduccion.create({
        data: { tenantId, margenEtaDias: i + 1 },
      });
    }
    for (const [actor, i, permisos] of [
      ['gestor', 0, ['produccion.ver', 'produccion.configurar']],
      ['lector', 0, ['produccion.ver']],
      ['sin-permisos', 0, []],
      ['otro-gestor', 1, ['produccion.ver', 'produccion.configurar']],
    ] as const) {
      const user = await prisma.user.create({
        data: { email: `qa-produccion-${randomUUID()}@example.invalid` },
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
      tokens[actor] = jwt.sign({
        sub: user.id,
        email: user.email,
        sessionId: sesion.id,
        tenantId: tenants[i],
        membershipId: miembro.id,
        role: 'ADMINISTRADOR',
      });
    }
    const modulo = await Test.createTestingModule({
      controllers: [ProduccionController],
      providers: [
        {
          provide: ProduccionService,
          useValue: new ProduccionService(prisma, capacidades),
        },
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
      // El vínculo de equipo es Restrict: quitar primero nuestras estaciones.
      await prisma.estacion.deleteMany({
        where: { tenantId: { in: tenants } },
      });
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.$disconnect();
  });

  const http = (
    metodo: 'get' | 'post' | 'put' | 'patch' | 'delete',
    ruta: string,
    actor = 'gestor',
  ) =>
    request(app.getHttpServer())
      [metodo](`/produccion/${ruta}`)
      .auth(tokens[actor], { type: 'bearer' })
      .set('x-tenant-id', tenants[1]);
  const payload = () => ({
    nombre: `Estación nueva ${randomUUID()}`,
    activo: true,
  });
  async function estado() {
    const where = { tenantId: { in: tenants } };
    const orderBy = { id: 'asc' as const };
    return Promise.all([
      prisma.estacion.findMany({ where, orderBy }),
      prisma.estacionEmpleado.findMany({
        where,
        orderBy: { empleadoId: 'asc' },
      }),
      prisma.estacionRegla.findMany({ where, orderBy }),
      prisma.maquina.findMany({ where, orderBy }),
      prisma.empleado.findMany({ where, orderBy }),
      prisma.configuracionProduccion.findMany({
        where,
        orderBy: { tenantId: 'asc' },
      }),
      prisma.diaNoLaborable.findMany({ where, orderBy }),
    ]);
  }

  it('exige sesión y el permiso real, aunque el enum del rol diga administrador', async () => {
    await request(app.getHttpServer())
      .get('/produccion/estaciones')
      .expect(401);
    await http('get', 'estaciones', 'sin-permisos').expect(403);
    await http('get', 'estaciones-recursos', 'lector').expect(403);
    const antes = await estado();
    await http('post', 'estaciones', 'sin-permisos')
      .send(payload())
      .expect(403);
    expect(await estado()).toEqual(antes);
  });

  it('conserva la empresa de cada sesión, incluso con cabecera ajena y peticiones concurrentes', async () => {
    const resultados = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        http('get', 'estaciones', i % 2 ? 'otro-gestor' : 'gestor').expect(200),
      ),
    );
    for (const [i, r] of resultados.entries()) {
      expect(r.text).toContain(estaciones[i % 2]);
      expect(r.text).toContain(empleados[i % 2]);
      expect(r.text).toContain(maquinas[i % 2]);
      for (const ajeno of [
        estaciones[1 - (i % 2)],
        empleados[1 - (i % 2)],
        maquinas[1 - (i % 2)],
        equipos[1 - (i % 2)],
      ])
        expect(r.text).not.toContain(ajeno);
    }
    const recursos = await http('get', 'estaciones-recursos').expect(200);
    expect(recursos.text).toContain(empleados[0]);
    expect(recursos.text).toContain(maquinas[0]);
    expect(recursos.text).not.toContain(empleados[1]);
    expect(recursos.text).not.toContain(maquinas[1]);
    const familias = await http('get', 'familias-pasos').expect(200);
    expect(familias.text).toContain(pasos[0]);
    expect(familias.text).not.toContain(pasos[1]);
    const calendario = await http('get', 'dias-no-laborables').expect(200);
    expect(calendario.text).toContain(dias[0]);
    expect(calendario.text).not.toContain(dias[1]);
    expect((await http('get', 'configuracion').expect(200)).body).toMatchObject(
      { margenEtaDias: 1 },
    );
  });

  it('un lector no puede alterar estaciones, días ni configuración', async () => {
    const antes = await estado();
    await http('post', 'estaciones', 'lector').send(payload()).expect(403);
    await http('put', `estaciones/${estaciones[0]}`, 'lector')
      .send(payload())
      .expect(403);
    await http('patch', `estaciones/${estaciones[0]}/toggle`, 'lector').expect(
      403,
    );
    await http('delete', `estaciones/${estaciones[0]}`, 'lector').expect(403);
    await http('post', 'dias-no-laborables', 'lector')
      .send({ fecha: '2026-12-25' })
      .expect(403);
    await http('delete', `dias-no-laborables/${dias[0]}`, 'lector').expect(403);
    await http('put', 'configuracion', 'lector')
      .send({ margenEtaDias: 9 })
      .expect(403);
    expect(await estado()).toEqual(antes);
  });

  it('un gestor tampoco puede editar, desactivar o borrar una estación o día de otra empresa', async () => {
    const antes = await estado();
    await http('put', `estaciones/${estaciones[1]}`)
      .send(payload())
      .expect(404);
    await http('patch', `estaciones/${estaciones[1]}/toggle`).expect(404);
    await http('delete', `estaciones/${estaciones[1]}`).expect(404);
    await http('delete', `dias-no-laborables/${dias[1]}`).expect(404);
    expect(await estado()).toEqual(antes);
  });

  it.each(['equipo', 'empleado', 'maquina', 'paso', 'horario'] as const)(
    'rechaza la referencia ajena %s al crear y editar sin cambios parciales',
    async (tipo) => {
      const referencias = {
        equipo: { equipoProduccionId: equipos[1] },
        empleado: { empleadoIds: [empleados[0], empleados[1]] },
        maquina: { maquinaIds: [maquinas[0], maquinas[1]] },
        paso: { familias: [pasos[0], pasos[1]] },
        horario: {
          empleadoIds: [empleados[0]],
          horariosEmpleados: [
            {
              empleadoId: empleados[1],
              calendario: {
                dias: { lun: [{ desde: '09:00', hasta: '12:00' }] },
              },
            },
          ],
        },
      };
      const antes = await estado();
      const codigo = tipo === 'empleado' || tipo === 'maquina' ? 404 : 400;
      await http('post', 'estaciones')
        .send({ ...payload(), ...referencias[tipo] })
        .expect(codigo);
      await http('put', `estaciones/${estaciones[0]}`)
        .send({ ...payload(), ...referencias[tipo] })
        .expect(codigo);
      expect(await estado()).toEqual(antes);
    },
  );

  it('rechaza campos internos, listas excesivas y un calendario inválido antes de guardar', async () => {
    const antes = await estado();
    for (const extra of [
      { tenantId: tenants[1] },
      { id: estaciones[1] },
      { empleadoIds: Array.from({ length: 101 }, () => empleados[0]) },
      { capacidadConcurrente: 0 },
      { calendario: { dias: { lun: [{ desde: '12:00', hasta: '09:00' }] } } },
    ])
      await http('post', 'estaciones')
        .send({ ...payload(), ...extra })
        .expect(400);
    await http('post', 'dias-no-laborables')
      .send({ fecha: '2026-02-30' })
      .expect(400);
    await http('put', 'configuracion')
      .send({ margenEtaDias: 2, tenantId: tenants[1] })
      .expect(400);
    expect(await estado()).toEqual(antes);
  });

  it('permite crear y retirar una estación propia sin alterar empleados ni máquinas ajenos', async () => {
    const ajenos = await prisma.maquina.findUniqueOrThrow({
      where: { id: maquinas[1] },
    });
    const creada = await http('post', 'estaciones')
      .send({
        ...payload(),
        equipoProduccionId: equipos[0],
        empleadoIds: [empleados[0]],
        maquinaIds: [maquinas[0]],
        familias: [pasos[0]],
      })
      .expect(201);
    const id = (creada.body as { id: string }).id;
    expect(id).toEqual(expect.any(String));
    expect(
      await prisma.maquina.findUniqueOrThrow({ where: { id: maquinas[0] } }),
    ).toMatchObject({ estacionId: id, tenantId: tenants[0] });
    expect(
      await prisma.estacionRegla.count({
        where: { estacionId: id, tenantId: tenants[0], valor: pasos[0] },
      }),
    ).toBe(1);
    await http('patch', `estaciones/${id}/toggle`).expect(200);
    expect(
      await prisma.estacion.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({ activo: false });
    await http('delete', `estaciones/${id}`).expect(200);
    expect(await prisma.estacion.findUnique({ where: { id } })).toBeNull();
    expect(
      await prisma.maquina.findUniqueOrThrow({ where: { id: maquinas[0] } }),
    ).toMatchObject({ estacionId: null });
    expect(
      await prisma.maquina.findUniqueOrThrow({ where: { id: maquinas[1] } }),
    ).toEqual(ajenos);
    expect(
      await prisma.empleado.count({ where: { id: { in: empleados } } }),
    ).toBe(2);
  });

  it('dos altas concurrentes no pueden apropiarse del mismo paso y el rechazo revierte sus relaciones', async () => {
    const resultados = await Promise.all(
      [1, 2].map((i) =>
        http('post', 'estaciones').send({
          ...payload(),
          nombre: `Concurrente ${i}`,
          empleadoIds: [empleados[0]],
          familias: [pasos[0]],
        }),
      ),
    );
    expect(resultados.map((r) => r.status).sort()).toEqual([201, 409]);
    const id = (
      resultados.find((r) => r.status === 201)!.body as { id: string }
    ).id;
    expect(
      await prisma.estacion.count({
        where: { tenantId: tenants[0], nombre: { startsWith: 'Concurrente ' } },
      }),
    ).toBe(1);
    expect(
      await prisma.estacionRegla.count({
        where: { tenantId: tenants[0], valor: pasos[0] },
      }),
    ).toBe(1);
    expect(
      await prisma.estacionEmpleado.count({
        where: { tenantId: tenants[0], estacionId: id },
      }),
    ).toBe(1);
    await http('delete', `estaciones/${id}`).expect(200);
  });

  it('permite configurar y quitar días propios sin modificar la otra empresa', async () => {
    const ajena = await prisma.configuracionProduccion.findUniqueOrThrow({
      where: { tenantId: tenants[1] },
    });
    await http('put', 'configuracion').send({ margenEtaDias: 4 }).expect(200);
    expect(
      await prisma.configuracionProduccion.findUniqueOrThrow({
        where: { tenantId: tenants[0] },
      }),
    ).toMatchObject({ margenEtaDias: 4 });
    expect(
      await prisma.configuracionProduccion.findUniqueOrThrow({
        where: { tenantId: tenants[1] },
      }),
    ).toEqual(ajena);
    const dia = await http('post', 'dias-no-laborables')
      .send({ fecha: '2026-12-25', descripcion: 'Cierre ficticio' })
      .expect(201);
    await http(
      'delete',
      `dias-no-laborables/${(dia.body as { id: string }).id}`,
    ).expect(200);
    expect(
      await prisma.diaNoLaborable.findUnique({ where: { id: dias[1] } }),
    ).not.toBeNull();
  });
});
