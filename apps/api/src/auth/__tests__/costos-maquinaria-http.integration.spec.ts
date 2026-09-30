import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthGuard } from '../auth.guard';
import { PermisosGuard } from '../permisos.guard';
import { RolesGuard } from '../roles.guard';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { todosLosPermisos } from '../permisos';
import { CostosController } from '../../costos/costos.controller';
import { CostosService } from '../../costos/costos.service';
import { CostosCatalogoService } from '../../costos/costos-catalogo.service';
import { CostosConfiguracionPeriodoService } from '../../costos/costos-configuracion-periodo.service';
import { CostosTarifasService } from '../../costos/costos-tarifas.service';
import { CostosRepartoService } from '../../costos/costos-reparto.service';
import { CostosValidacionesService } from '../../costos/costos-validaciones.service';
import { CostosMapper } from '../../costos/costos.mapper';
import { MaquinariaController } from '../../maquinaria/maquinaria.controller';
import { MaquinariaService } from '../../maquinaria/maquinaria.service';
import { EquiposProduccionController } from '../../produccion/equipos-produccion.controller';
import { EquiposProduccionService } from '../../produccion/equipos-produccion.service';
import { calendarioDefault } from '../../eta/motor/estaciones-tipos';

describe('Costos, máquinas y equipos: separación HTTP con PostgreSQL', () => {
  const db = new PrismaService(),
    caps = capacidadesDePrueba(),
    mapper = new CostosMapper();
  const validaciones = new CostosValidacionesService(db),
    reparto = new CostosRepartoService(db, mapper);
  const catalogo = new CostosCatalogoService(db, mapper, validaciones, caps);
  const tarifas = new CostosTarifasService(
    db,
    mapper,
    reparto,
    validaciones,
    caps,
  );
  const configuracion = new CostosConfiguracionPeriodoService(
    db,
    mapper,
    validaciones,
    reparto,
    tarifas,
    catalogo,
    caps,
  );
  const costos = new CostosService(catalogo, configuracion, tarifas);
  const maquinaria = new MaquinariaService(db, caps),
    equipos = new EquiposProduccionService(db, caps);
  const secret = randomUUID(),
    anterior = process.env.JWT_SECRET,
    jwt = new JwtService({ secret });
  const tenants = [randomUUID(), randomUUID()],
    users: string[] = [],
    plantas: string[] = [],
    centros: string[] = [],
    maquinas: string[] = [],
    equipoIds: string[] = [];
  const tokens: Record<string, string> = {};
  let app: INestApplication<Server>,
    validada = false;
  const cuerpoCentro = (plantaId: string) => ({
    plantaId,
    codigo: 'CC-QA',
    nombre: 'Centro ficticio',
    tipoCentro: 'productivo',
    activo: true,
  });
  const cuerpoMaquina = (plantaId: string) => ({
    plantaId,
    nombre: 'Máquina ficticia',
    plantilla: 'guillotina',
    estado: 'inactiva',
    activo: false,
    geometriaTrabajo: 'pliego',
    unidadProduccionPrincipal: 'cortes_min',
    perfilesOperativos: [],
    consumibles: [],
    componentesDesgaste: [],
  });
  const cuerpoEquipo = () => ({
    nombre: 'Equipo ficticio',
    personas: 2,
    activo: true,
    calendario: calendarioDefault(),
  });
  async function usuario(nombre: string, permisos: string[]) {
    const user = await db.user.create({
      data: { email: 'qa-costos-' + randomUUID() + '@example.invalid' },
    });
    users.push(user.id);
    const rol = await db.rol.create({
      data: { tenantId: tenants[0], nombre, permisos },
    });
    const m = await db.membership.create({
      data: {
        tenantId: tenants[0],
        userId: user.id,
        rolId: rol.id,
        rol: 'ADMINISTRADOR',
      },
    });
    const sesion = await db.authSession.create({
      data: {
        userId: user.id,
        currentTenantId: tenants[0],
        currentMembershipId: m.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    tokens[nombre] = jwt.sign({
      sub: user.id,
      sessionId: sesion.id,
      tenantId: tenants[0],
      membershipId: m.id,
      role: 'ADMINISTRADOR',
      email: user.email,
    });
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Sólo base ficticia local y aislamiento activo');
    validada = true;
    process.env.JWT_SECRET = secret;
    await db.$connect();
    for (const [i, tenantId] of tenants.entries()) {
      await db.tenant.create({
        data: {
          id: tenantId,
          nombre: 'Empresa ficticia ' + i,
          slug: 'qa-costos-' + tenantId,
        },
      });
      plantas.push(
        (
          await db.planta.create({
            data: { tenantId, codigo: 'PLT-QA', nombre: 'Planta privada ' + i },
          })
        ).id,
      );
      centros.push(
        (
          await db.centroCosto.create({
            data: {
              tenantId,
              plantaId: plantas[i],
              codigo: 'CC-INICIAL',
              nombre: 'Centro privado ' + i,
              tipoCentro: 'PRODUCTIVO',
            },
          })
        ).id,
      );
      maquinas.push(
        (
          await db.maquina.create({
            data: {
              tenantId,
              plantaId: plantas[i],
              codigo: 'MAQ-INICIAL',
              nombre: 'Máquina privada ' + i,
              plantilla: 'GUILLOTINA',
              geometriaTrabajo: 'PLIEGO',
              unidadProduccionPrincipal: 'CORTES_MIN',
              estado: 'INACTIVA',
              activo: false,
            },
          })
        ).id,
      );
      equipoIds.push(
        (
          await equipos.guardar(tenantId, {
            ...cuerpoEquipo(),
            nombre: 'Equipo privado ' + i,
          })
        ).id,
      );
    }
    await usuario('admin', todosLosPermisos());
    await usuario('lector', ['costos.ver']);
    await usuario('sin-permisos', []);
    const modulo = await Test.createTestingModule({
      controllers: [
        CostosController,
        MaquinariaController,
        EquiposProduccionController,
      ],
      providers: [
        { provide: CostosService, useValue: costos },
        { provide: MaquinariaService, useValue: maquinaria },
        { provide: EquiposProduccionService, useValue: equipos },
      ],
    }).compile();
    app = modulo.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    const reflector = new Reflector();
    app.useGlobalGuards(
      new AuthGuard(reflector, jwt, db),
      new RolesGuard(reflector),
      new PermisosGuard(reflector),
    );
    app.useGlobalInterceptors(new TenantContextInterceptor(reflector));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    await app?.close();
    if (validada) {
      await db.tenant.deleteMany({ where: { id: { in: tenants } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    await db.$disconnect();
    if (anterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = anterior;
  });
  type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';
  const rutasLectura = [
    '/costos/plantas',
    '/costos/centros-costo',
    '/costos/centros-costo/resumen?periodo=2026-09',
    '/costos/centros-costo/:c/configuracion?periodo=2026-09',
    '/costos/centros-costo/:c/tarifas',
    '/maquinaria',
    '/maquinaria/:m',
    '/maquinaria/:m/historial',
    '/produccion/equipos',
  ];
  const escrituras: Array<[Metodo, string]> = [
    ['post', '/costos/plantas'],
    ['put', '/costos/plantas/:p'],
    ['patch', '/costos/plantas/:p/toggle'],
    ['post', '/costos/centros-costo'],
    ['post', '/costos/centros-costo/planilla'],
    ['put', '/costos/centros-costo/:c'],
    ['patch', '/costos/centros-costo/:c/toggle?periodo=2026-09'],
    ['delete', '/costos/centros-costo/:c'],
    ['put', '/costos/centros-costo/:c/configuracion-base'],
    ['put', '/costos/centros-costo/:c/lineas?periodo=2026-09'],
    ['put', '/costos/centros-costo/:c/capacidad?periodo=2026-09'],
    ['post', '/costos/centros-costo/:c/calcular-tarifa?periodo=2026-09'],
    ['post', '/costos/centros-costo/:c/publicar-tarifa?periodo=2026-09'],
    ['post', '/maquinaria'],
    ['put', '/maquinaria/:m'],
    ['patch', '/maquinaria/:m/activo'],
    ['patch', '/maquinaria/:m/toggle'],
    ['post', '/produccion/equipos'],
    ['put', '/produccion/equipos/:e'],
  ];
  const ruta = (r: string, i = 0) =>
    r
      .replace(':p', plantas[i])
      .replace(':c', centros[i])
      .replace(':m', maquinas[i])
      .replace(':e', equipoIds[i]);
  const pedir = (metodo: Metodo, r: string, actor = 'admin') =>
    request(app.getHttpServer())
      [metodo](r)
      .auth(tokens[actor], { type: 'bearer' });
  it.each([
    ...rutasLectura.map((r) => ['get', r] as [Metodo, string]),
    ...escrituras,
  ])('rechaza anónimos: %s %s', async (m, r) => {
    await request(app.getHttpServer())[m](ruta(r)).send().expect(401);
  });
  it.each(rutasLectura)(
    'rechaza un rol sin permiso aunque su enum diga administrador: %s',
    async (r) => {
      await pedir('get', ruta(r), 'sin-permisos').expect(403);
    },
  );
  it.each(escrituras)('un lector no puede escribir: %s %s', async (m, r) => {
    await pedir(m, ruta(r), 'lector').send({}).expect(403);
  });
  it.each([
    '/costos/plantas',
    '/costos/centros-costo',
    '/maquinaria',
    '/produccion/equipos',
  ])('el listado no revela datos de otra empresa: %s', async (r) => {
    const res = await pedir('get', r).expect(200);
    expect(JSON.stringify(res.body)).toContain('privad');
    expect(JSON.stringify(res.body)).not.toMatch(/privad[ao] 1/);
  });
  it.each([
    '/costos/centros-costo/:c/configuracion?periodo=2026-09',
    '/costos/centros-costo/:c/tarifas',
    '/maquinaria/:m',
    '/maquinaria/:m/historial',
  ])('rechaza lectura por identificador ajeno: %s', async (r) => {
    await pedir('get', ruta(r, 1)).expect(404);
  });
  it('no crea ni mueve un centro hacia una planta ajena', async () => {
    const n = await db.centroCosto.count({ where: { tenantId: tenants[0] } });
    await pedir('post', '/costos/centros-costo')
      .send(cuerpoCentro(plantas[1]))
      .expect(404);
    await pedir('put', ruta('/costos/centros-costo/:c'))
      .send(cuerpoCentro(plantas[1]))
      .expect(404);
    expect(
      await db.centroCosto.count({ where: { tenantId: tenants[0] } }),
    ).toBe(n);
    expect(
      (await db.centroCosto.findUniqueOrThrow({ where: { id: centros[0] } }))
        .plantaId,
    ).toBe(plantas[0]);
  });
  it('no crea una máquina con planta o centro de otra empresa', async () => {
    await pedir('post', '/maquinaria')
      .send(cuerpoMaquina(plantas[1]))
      .expect(400);
    await pedir('post', '/maquinaria')
      .send({
        ...cuerpoMaquina(plantas[0]),
        centroCostoPrincipalId: centros[1],
      })
      .expect(400);
    expect(await db.maquina.count({ where: { tenantId: tenants[0] } })).toBe(1);
  });
  it('no modifica ni elimina fichas de otra empresa', async () => {
    await pedir('put', ruta('/costos/plantas/:p', 1))
      .send({ codigo: 'INV', nombre: 'No guardar' })
      .expect(404);
    await pedir('put', ruta('/costos/centros-costo/:c', 1))
      .send(cuerpoCentro(plantas[0]))
      .expect(404);
    await pedir('delete', ruta('/costos/centros-costo/:c', 1)).expect(404);
    await pedir('put', ruta('/maquinaria/:m', 1))
      .send(cuerpoMaquina(plantas[0]))
      .expect(404);
    await pedir('patch', ruta('/maquinaria/:m/activo', 1))
      .send({ activo: false })
      .expect(404);
    await pedir('put', ruta('/produccion/equipos/:e', 1))
      .send(cuerpoEquipo())
      .expect(404);
    expect(
      (await db.maquina.findUniqueOrThrow({ where: { id: maquinas[1] } }))
        .nombre,
    ).toBe('Máquina privada 1');
    expect(
      (await db.centroCosto.findUniqueOrThrow({ where: { id: centros[1] } }))
        .nombre,
    ).toBe('Centro privado 1');
  });
  it('el administrador puede crear sus fichas válidas sin darles un propietario arbitrario', async () => {
    await pedir('post', '/costos/centros-costo')
      .send(cuerpoCentro(plantas[0]))
      .expect(201);
    await pedir('post', '/maquinaria')
      .send(cuerpoMaquina(plantas[0]))
      .expect(201);
    await pedir('post', '/produccion/equipos').send(cuerpoEquipo()).expect(201);
    await pedir('post', '/costos/plantas')
      .send({ codigo: 'PROHIBIDA', nombre: 'No guardar', tenantId: tenants[1] })
      .expect(400);
  });
});
