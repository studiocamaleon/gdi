import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { GastosFijosController } from '../../gastos-fijos/gastos-fijos.controller';
import { GastosFijosService } from '../../gastos-fijos/gastos-fijos.service';
import { EgresosController } from '../../egresos/egresos.controller';
import { EgresosService } from '../../egresos/egresos.service';
import { RecurrentesService } from '../../egresos/recurrentes.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { DatosEmpresaService } from '../../tenants/datos-empresa.service';
import { AuthGuard } from '../auth.guard';
import { RolesGuard } from '../roles.guard';
import { PermisosGuard } from '../permisos.guard';
import { MargenesInterceptor } from '../margenes.interceptor';
import { SessionCacheService } from '../session-cache.service';
import { todosLosPermisos } from '../permisos';

/** HTTP, sesiones, permisos y PostgreSQL reales. Sin scheduler, pagos,
 * correo, almacenamiento ni proveedores externos conectados. */
describe('Egresos y gastos fijos: relaciones privadas entre empresas', () => {
  const prisma = new PrismaService();
  const capacidades = capacidadesDePrueba();
  const secretoAnterior = process.env.JWT_SECRET;
  const secreto = randomUUID();
  const jwt = new JwtService({ secret: secreto });
  const tenantIds = [randomUUID(), randomUUID()];
  const userIds: string[] = [];
  const tokens: Record<string, string> = {};
  const categorias: string[] = [];
  const metodos: string[] = [];
  const gastos: string[] = [];
  const egresos: string[] = [];
  const recurrentes: string[] = [];
  let app: INestApplication<Server>;
  let baseValidada = false;

  const fijo = (extra: Record<string, unknown> = {}) => ({
    nombre: `Gasto ficticio ${randomUUID()}`,
    categoriaEgresoId: categorias[0],
    valor: 100,
    frecuencia: 'MENSUAL',
    vigenteDesde: '2026-09',
    ...extra,
  });
  const recurrente = (extra: Record<string, unknown> = {}) => ({
    descripcion: `Plantilla ficticia ${randomUUID()}`,
    categoriaEgresoId: categorias[0],
    monto: 100,
    vigenteDesde: '2026-09',
    ...extra,
  });
  const egreso = (extra: Record<string, unknown> = {}) => ({
    descripcion: `Egreso ficticio ${randomUUID()}`,
    categoriaEgresoId: categorias[0],
    neto: 100,
    beneficiarioNombre: 'Beneficiario ficticio',
    fechaVencimiento: '2026-10-01',
    ...extra,
  });

  async function usuario(nombre: string, permisos: string[], indice = 0) {
    const tenantId = tenantIds[indice];
    const user = await prisma.user.create({
      data: { email: `qa-egresos-${randomUUID()}@example.invalid` },
    });
    userIds.push(user.id);
    const rol = await prisma.rol.create({
      data: { tenantId, nombre, permisos },
    });
    const miembro = await prisma.membership.create({
      data: { tenantId, userId: user.id, rolId: rol.id, rol: 'ADMINISTRADOR' },
    });
    const sesion = await prisma.authSession.create({
      data: {
        userId: user.id,
        currentTenantId: tenantId,
        currentMembershipId: miembro.id,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    tokens[nombre] = jwt.sign({
      sub: user.id,
      sessionId: sesion.id,
      tenantId,
      membershipId: miembro.id,
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
      throw new Error('Requiere base local de test y aislamiento activo');
    baseValidada = true;
    process.env.JWT_SECRET = secreto;
    await prisma.$connect();
    for (const [indice, tenantId] of tenantIds.entries()) {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          nombre: `QA gastos ${indice}`,
          slug: `qa-gastos-${tenantId}`,
        },
      });
      const categoria = await prisma.categoriaEgreso.create({
        data: {
          tenantId,
          nombre: 'Alquiler ficticio',
          codigo: 'alquiler',
          naturaleza: 'GASTO_ESTRUCTURA',
        },
      });
      categorias.push(categoria.id);
      const metodo = await prisma.metodoPago.create({
        data: {
          tenantId,
          nombre: `Método privado empresa ${indice}`,
          codigo: 'efectivo',
          tipo: 'efectivo',
        },
      });
      metodos.push(metodo.id);
      const gasto = await prisma.gastoFijoEstructura.create({
        data: {
          tenantId,
          nombre: `Gasto empresa ${indice}`,
          categoriaEgresoId: categoria.id,
          valor: 100,
          importeMensual: 100,
          vigenteDesde: '2026-09',
          metodoPagoId: metodo.id,
        },
      });
      gastos.push(gasto.id);
      egresos.push(
        (
          await prisma.egreso.create({
            data: {
              tenantId,
              numero: 'QA-1',
              descripcion: `Egreso empresa ${indice}`,
              categoriaEgresoId: categoria.id,
              beneficiarioNombre: 'Ficticio',
              fechaCompetencia: new Date('2026-09-01'),
              neto: 100,
              total: 100,
            },
          })
        ).id,
      );
      recurrentes.push(
        (
          await prisma.gastoRecurrente.create({
            data: {
              tenantId,
              descripcion: `Plantilla empresa ${indice}`,
              categoriaEgresoId: categoria.id,
              monto: 100,
              vigenteDesde: '2026-09',
            },
          })
        ).id,
      );
    }
    await usuario('admin', todosLosPermisos());
    await usuario('otro-admin', todosLosPermisos(), 1);
    await usuario('lector', ['administracion.ver']);
    await usuario('configurador', ['administracion.configurar']);
    await usuario('sin-permisos', []);

    const modulo = await Test.createTestingModule({
      controllers: [GastosFijosController, EgresosController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: CapacidadesEmpresaService, useValue: capacidades },
        {
          provide: GastosFijosService,
          useValue: new GastosFijosService(prisma, capacidades),
        },
        {
          provide: RecurrentesService,
          useValue: new RecurrentesService(prisma, capacidades),
        },
        {
          provide: EgresosService,
          useValue: new EgresosService(
            prisma,
            new DatosEmpresaService(prisma),
            {} as never,
            {} as never,
            capacidades,
          ),
        },
      ],
    }).compile();
    app = modulo.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    const reflector = new Reflector();
    app.useGlobalGuards(
      new AuthGuard(reflector, jwt, prisma, new SessionCacheService()),
      new RolesGuard(reflector),
      new PermisosGuard(reflector),
    );
    app.useGlobalInterceptors(
      new TenantContextInterceptor(reflector),
      new MargenesInterceptor(reflector),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
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
    if (secretoAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretoAnterior;
    await app?.close();
    if (baseValidada) {
      // Primero las relaciones del ensayo: también permite limpiar una
      // ejecución anterior al parche que haya aceptado una referencia ajena.
      await prisma.egreso.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
      await prisma.gastoRecurrente.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
      await prisma.gastoFijoEstructura.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });
  const peticion = (
    metodo: 'get' | 'post' | 'patch' | 'put' | 'delete',
    ruta: string,
    actor = 'admin',
  ) =>
    request(app.getHttpServer())
      [metodo](ruta)
      .auth(tokens[actor], { type: 'bearer' });
  const rutas = ['/gastos-fijos', '/egresos', '/egresos/recurrentes'];

  it.each(rutas)('%s exige sesión y permiso explícito', async (ruta) => {
    await request(app.getHttpServer()).get(ruta).expect(401);
    await peticion('get', ruta, 'sin-permisos').expect(403);
  });
  it.each(rutas)(
    '%s separa listados y solicitudes simultáneas',
    async (ruta) => {
      const ids =
        ruta === '/gastos-fijos'
          ? gastos
          : ruta === '/egresos'
            ? egresos
            : recurrentes;
      const respuestas = await Promise.all(
        Array.from({ length: 6 }, (_, n) =>
          peticion('get', ruta, n % 2 ? 'otro-admin' : 'admin')
            .set('x-tenant-id', tenantIds[1 - (n % 2)])
            .expect(200),
        ),
      );
      for (const [n, respuesta] of respuestas.entries()) {
        expect(respuesta.text).toContain(ids[n % 2]);
        expect(respuesta.text).not.toContain(ids[1 - (n % 2)]);
      }
    },
  );
  it.each(['crear', 'actualizar'])(
    'rechaza método de pago ajeno al %s un gasto fijo',
    async (operacion) => {
      const antes = await prisma.gastoFijoEstructura.findMany({
        where: { tenantId: tenantIds[0] },
      });
      const respuesta = await peticion(
        operacion === 'crear' ? 'post' : 'put',
        operacion === 'crear' ? '/gastos-fijos' : `/gastos-fijos/${gastos[0]}`,
      ).send(fijo({ metodoPagoId: metodos[1] }));
      expect(respuesta.text).not.toContain('Método privado empresa 1');
      expect(respuesta.status).toBe(400);
      expect(
        await prisma.gastoFijoEstructura.findMany({
          where: { tenantId: tenantIds[0] },
        }),
      ).toEqual(antes);
    },
  );
  it('rechaza método de pago ajeno al crear una programación', async () => {
    const antes = await prisma.gastoRecurrente.count({
      where: { tenantId: tenantIds[0] },
    });
    await peticion('post', '/egresos/recurrentes')
      .send(recurrente({ metodoPagoId: metodos[1] }))
      .expect(400);
    expect(
      await prisma.gastoRecurrente.count({ where: { tenantId: tenantIds[0] } }),
    ).toBe(antes);
  });
  it.each([1, 3])(
    'rechaza imputar un egreso a un gasto ajeno con %i cuota(s)',
    async (cuotas) => {
      const antes = await prisma.egreso.count({
        where: { tenantId: tenantIds[0] },
      });
      await peticion('post', '/egresos')
        .send(
          egreso({
            gastoFijoEstructuraId: gastos[1],
            cuotas: cuotas === 1 ? undefined : cuotas,
          }),
        )
        .expect(400);
      expect(
        await prisma.egreso.count({ where: { tenantId: tenantIds[0] } }),
      ).toBe(antes);
    },
  );
  it('mantiene altas legítimas con referencias propias y sin referencias opcionales', async () => {
    for (const metodoPagoId of [metodos[0], null, undefined]) {
      await peticion('post', '/gastos-fijos')
        .send(fijo({ metodoPagoId }))
        .expect(201);
      await peticion('post', '/egresos/recurrentes')
        .send(recurrente({ metodoPagoId }))
        .expect(201);
    }
    await peticion('post', '/egresos')
      .send(egreso({ gastoFijoEstructuraId: gastos[0], cuotas: 2 }))
      .expect(201);
    await peticion('post', '/egresos').send(egreso()).expect(201);
  });
  it('rechaza referencias inexistentes sin escribir ni devolver errores de base', async () => {
    await peticion('post', '/gastos-fijos')
      .send(fijo({ metodoPagoId: randomUUID() }))
      .expect(400);
    await peticion('post', '/egresos/recurrentes')
      .send(recurrente({ metodoPagoId: randomUUID() }))
      .expect(400);
    await peticion('post', '/egresos')
      .send(egreso({ gastoFijoEstructuraId: randomUUID() }))
      .expect(400);
  });
  it('permite conservar un método propio inactivo y quitarlo sin afectar su historial', async () => {
    const metodo = await prisma.metodoPago.create({
      data: {
        tenantId: tenantIds[0],
        codigo: 'historico',
        nombre: 'Método anterior',
        tipo: 'efectivo',
        activo: false,
      },
    });
    await peticion('put', `/gastos-fijos/${gastos[0]}`)
      .send(fijo({ metodoPagoId: metodo.id }))
      .expect(200);
    await peticion('put', `/gastos-fijos/${gastos[0]}`)
      .send(fijo({ metodoPagoId: null }))
      .expect(200);
    expect(
      await prisma.gastoFijoEstructura.findUniqueOrThrow({
        where: { id: gastos[0] },
      }),
    ).toMatchObject({ metodoPagoId: null });
    expect(
      await prisma.metodoPago.findUniqueOrThrow({ where: { id: metodo.id } }),
    ).toMatchObject({ activo: false });
  });
  it('consulta administrativa no permite crear, editar, anular ni generar egresos', async () => {
    await peticion('get', '/egresos', 'lector').expect(200);
    await peticion('post', '/egresos', 'lector').send(egreso()).expect(403);
    await peticion('patch', `/egresos/${egresos[0]}`, 'lector')
      .send({ descripcion: 'Cambio' })
      .expect(403);
    await peticion('patch', `/egresos/${egresos[0]}/anular`, 'lector')
      .send({ motivo: 'No autorizado' })
      .expect(403);
    await peticion('post', '/egresos/recurrentes/generar', 'lector').expect(
      403,
    );
    await peticion('post', '/egresos/recurrentes', 'lector')
      .send(recurrente())
      .expect(403);
    await peticion(
      'delete',
      `/egresos/recurrentes/${recurrentes[0]}`,
      'lector',
    ).expect(403);
    await peticion('get', '/gastos-fijos', 'lector').expect(403);
  });
  it('configurar gastos no permite activar pagos programados', async () => {
    const antes = await prisma.gastoFijoEstructura.count({
      where: { tenantId: tenantIds[0] },
    });
    await peticion('post', '/gastos-fijos', 'configurador')
      .send(
        fijo({
          programacion: { activa: true, desde: '2026-09', diaVencimiento: 10 },
        }),
      )
      .expect(403);
    expect(
      await prisma.gastoFijoEstructura.count({
        where: { tenantId: tenantIds[0] },
      }),
    ).toBe(antes);
  });
  it('no altera ni borra gastos, plantillas o egresos ajenos', async () => {
    const antes = await prisma.gastoFijoEstructura.findUniqueOrThrow({
      where: { id: gastos[1] },
    });
    await peticion('put', `/gastos-fijos/${gastos[1]}`)
      .send(fijo())
      .expect(404);
    await peticion('patch', `/gastos-fijos/${gastos[1]}/toggle`).expect(404);
    await peticion('delete', `/gastos-fijos/${gastos[1]}`).expect(404);
    await peticion('patch', `/egresos/recurrentes/${recurrentes[1]}`)
      .send({ descripcion: 'Cambio' })
      .expect(404);
    await peticion('delete', `/egresos/recurrentes/${recurrentes[1]}`).expect(
      404,
    );
    await peticion('patch', `/egresos/${egresos[1]}`)
      .send({ descripcion: 'Cambio' })
      .expect(404);
    await peticion('patch', `/egresos/${egresos[1]}/anular`)
      .send({ motivo: 'Cambio' })
      .expect(404);
    expect(
      await prisma.gastoFijoEstructura.findUniqueOrThrow({
        where: { id: gastos[1] },
      }),
    ).toEqual(antes);
    expect(
      await prisma.egreso.findUniqueOrThrow({ where: { id: egresos[1] } }),
    ).toMatchObject({ descripcion: 'Egreso empresa 1', estado: 'pendiente' });
  });
  it('no admite falsificar propietario, saldo ni estados calculados', async () => {
    await peticion('post', '/gastos-fijos')
      .send(fijo({ tenantId: tenantIds[1] }))
      .expect(400);
    await peticion('post', '/egresos')
      .send(egreso({ pagadoTotal: 100, estado: 'pagado' }))
      .expect(400);
    await peticion('post', '/egresos/recurrentes')
      .send(recurrente({ tenantId: tenantIds[1] }))
      .expect(400);
  });
});
