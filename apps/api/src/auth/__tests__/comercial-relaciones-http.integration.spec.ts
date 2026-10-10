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
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { CampanasController } from '../../campanas/campanas.controller';
import { CampanasService } from '../../campanas/campanas.service';
import { CuponesController } from '../../cupones/cupones.controller';
import { CuponesService } from '../../cupones/cupones.service';
import { FidelizacionController } from '../../fidelizacion/fidelizacion.controller';
import { FidelizacionService } from '../../fidelizacion/fidelizacion.service';
import { DesarrolloDocumentalController } from '../../desarrollo-documental/desarrollo-documental.controller';
import { DesarrolloDocumentalService } from '../../desarrollo-documental/desarrollo-documental.service';
import { EnlacesPublicosService } from '../../enlaces-publicos/enlaces-publicos.service';
import { AuthGuard } from '../auth.guard';
import { RolesGuard } from '../roles.guard';
import { PermisosGuard } from '../permisos.guard';
import { todosLosPermisos } from '../permisos';

/** HTTP, permisos y escrituras reales; sólo se sustituye la lectura del plan.
 * Sin correo, archivos remotos ni publicación de enlaces. No usa el seed. */
describe('Proyectos, cupones, puntos y documentos: aislamiento comercial', () => {
  const prisma = new PrismaService();
  const capacidades = capacidadesDePrueba();
  const secretAnterior = process.env.JWT_SECRET;
  const secret = randomUUID();
  const jwt = new JwtService({ secret });
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const clientes: string[] = [];
  const campanas: string[] = [];
  const ordenes: string[] = [];
  const cupones: string[] = [];
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
          slug: `qa-comercial-${tenantId}`,
          nombre: 'Empresa ficticia',
        },
      });
      clientes.push(
        (
          await prisma.cliente.create({
            data: {
              tenantId,
              nombre: `Cliente ficticio ${i}`,
              telefonoCodigo: '+1',
              telefonoNumero: '2025550100',
              paisCodigo: 'US',
              aceptaWhatsapp: false,
            },
          })
        ).id,
      );
      campanas.push(
        (
          await prisma.proyectoCampana.create({
            data: {
              tenantId,
              clienteId: clientes[i],
              codigo: `QA-CAM-${i}`,
              nombre: `Proyecto ${i}`,
            },
          })
        ).id,
      );
      ordenes.push(
        (
          await prisma.ordenTrabajo.create({
            data: {
              tenantId,
              clienteId: clientes[i],
              numero: `QA-OT-${i}`,
            },
          })
        ).id,
      );
      cupones.push(
        (
          await prisma.cupon.create({
            data: {
              tenantId,
              codigo: `QA-CUPON-${i}`,
              tipo: 'PORCENTAJE',
              valor: 10,
            },
          })
        ).id,
      );
    }
    for (const [nombre, permisos] of [
      ['gestor', todosLosPermisos()],
      ['lector', ['comercial.ver', 'crm.ver', 'produccion.ver']],
      ['sin-permisos', []],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          email: `qa-comercial-${randomUUID()}@example.invalid`,
        },
      });
      users.push(user.id);
      const rol = await prisma.rol.create({
        data: {
          tenantId: tenants[0],
          nombre,
          permisos: [...permisos],
        },
      });
      const member = await prisma.membership.create({
        data: {
          tenantId: tenants[0],
          userId: user.id,
          rol: 'ADMINISTRADOR',
          rolId: rol.id,
        },
      });
      const session = await prisma.authSession.create({
        data: {
          userId: user.id,
          currentTenantId: tenants[0],
          currentMembershipId: member.id,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      tokens[nombre] = jwt.sign({
        sub: user.id,
        email: user.email,
        sessionId: session.id,
        tenantId: tenants[0],
        membershipId: member.id,
        role: 'ADMINISTRADOR',
      });
    }
    const modulo = await Test.createTestingModule({
      controllers: [
        CampanasController,
        CuponesController,
        FidelizacionController,
        DesarrolloDocumentalController,
      ],
      providers: [
        { provide: CapacidadesEmpresaService, useValue: capacidades },
        {
          provide: CampanasService,
          useValue: new CampanasService(prisma, undefined, capacidades),
        },
        {
          provide: CuponesService,
          useValue: new CuponesService(prisma, capacidades),
        },
        {
          provide: FidelizacionService,
          useValue: new FidelizacionService(prisma, capacidades),
        },
        {
          provide: DesarrolloDocumentalService,
          useValue: new DesarrolloDocumentalService(
            prisma,
            new EnlacesPublicosService(prisma, capacidades),
            {} as never,
            undefined,
            capacidades,
          ),
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
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.$disconnect();
  });

  function consulta(ruta: string, actor = 'gestor') {
    return request(app.getHttpServer())
      .get(ruta)
      .auth(tokens[actor], { type: 'bearer' });
  }
  const lecturas = [
    () => `/campanas/${campanas[0]}`,
    () => `/cupones/${cupones[0]}/historial`,
    () => `/fidelizacion/clientes/${clientes[0]}`,
    () => `/desarrollo-documental/ordenes/${ordenes[0]}/documentos`,
  ];
  it.each(lecturas)(
    'la lectura requiere sesión y permiso, y conserva acceso al lector (%#)',
    async (ruta) => {
      await request(app.getHttpServer()).get(ruta()).expect(401);
      await consulta(ruta(), 'sin-permisos').expect(403);
      await consulta(ruta(), 'lector').expect(200);
    },
  );
  it.each([
    () => `/campanas/${campanas[1]}`,
    () => `/cupones/${cupones[1]}/historial`,
    () => `/fidelizacion/clientes/${clientes[1]}`,
    () => `/desarrollo-documental/ordenes/${ordenes[1]}/documentos`,
  ])('ni el gestor puede leer datos ajenos (%#)', async (ruta) => {
    await consulta(ruta()).set('x-tenant-id', tenants[1]).expect(404);
  });

  function altaDocumento(ordenId: string) {
    return {
      ordenId,
      nombre: 'Arte ficticio',
      proposito: 'PRINT',
      etapa: 'DISENO',
    };
  }
  function escrituras() {
    return [
      [
        'post',
        '/campanas',
        { clienteId: clientes[0], nombre: 'Nuevo proyecto' },
      ],
      ['patch', `/campanas/${campanas[0]}`, { nombre: 'Cambio no autorizado' }],
      ['post', '/cupones', { codigo: 'QA-NUEVO', tipo: 'MONTO', valor: 10 }],
      ['patch', `/cupones/${cupones[0]}`, { version: 1, valor: 20 }],
      ['delete', `/cupones/${cupones[0]}`, {}],
      ['patch', '/fidelizacion/configuracion', { acumulacionActiva: true }],
      [
        'post',
        `/fidelizacion/clientes/${clientes[0]}/ajustes`,
        { tipo: 'CREDITO', puntos: 10, motivo: 'Ajuste ficticio' },
      ],
      ['post', '/desarrollo-documental/maestros', altaDocumento(ordenes[0])],
    ] as const;
  }
  it('rechaza ocho acciones de escritura con un lector aunque tenga rol base administrador', async () => {
    for (const [metodo, ruta, body] of escrituras()) {
      await request(app.getHttpServer())
        [metodo](ruta)
        .auth(tokens.lector, { type: 'bearer' })
        .send(body)
        .expect(403);
    }
    expect(
      await prisma.proyectoCampana.count({ where: { tenantId: tenants[0] } }),
    ).toBe(1);
    expect(await prisma.cupon.count({ where: { tenantId: tenants[0] } })).toBe(
      1,
    );
    expect(
      await prisma.fidelizacionMovimiento.count({
        where: { tenantId: tenants[0] },
      }),
    ).toBe(0);
    expect(
      await prisma.archivoMaestro.count({ where: { tenantId: tenants[0] } }),
    ).toBe(0);
  });

  it('rechaza referencias ajenas en altas y no crea registros parciales', async () => {
    for (const [ruta, body, status] of [
      [
        '/campanas',
        { clienteId: clientes[1], nombre: 'Referencia ajena' },
        400,
      ],
      [
        '/cupones',
        {
          codigo: 'QA-AJENO',
          tipo: 'MONTO',
          valor: 10,
          alcanceTipo: 'CLIENTE',
          alcanceRef: clientes[1],
        },
        400,
      ],
      [
        `/fidelizacion/clientes/${clientes[1]}/ajustes`,
        { tipo: 'CREDITO', puntos: 10, motivo: 'Referencia ajena' },
        404,
      ],
      ['/desarrollo-documental/maestros', altaDocumento(ordenes[1]), 404],
    ] as const) {
      await request(app.getHttpServer())
        .post(ruta)
        .auth(tokens.gestor, { type: 'bearer' })
        .send(body)
        .expect(status);
    }
    expect(
      await prisma.proyectoCampana.count({ where: { tenantId: tenants[0] } }),
    ).toBe(1);
    expect(await prisma.cupon.count({ where: { tenantId: tenants[0] } })).toBe(
      1,
    );
    expect(
      await prisma.fidelizacionCuenta.count({
        where: { tenantId: { in: tenants } },
      }),
    ).toBe(0);
    expect(
      await prisma.archivoMaestro.count({ where: { tenantId: tenants[0] } }),
    ).toBe(0);
  });

  it('permite las cuatro altas propias con gestión, sin aceptar un tenant del cuerpo', async () => {
    for (const [ruta, body] of [
      [
        '/campanas',
        { clienteId: clientes[0], nombre: 'Nuevo proyecto autorizado' },
      ],
      [
        '/cupones',
        {
          codigo: 'QA-PROPIO',
          tipo: 'MONTO',
          valor: 10,
          alcanceTipo: 'CLIENTE',
          alcanceRef: clientes[0],
        },
      ],
      [
        `/fidelizacion/clientes/${clientes[0]}/ajustes`,
        { tipo: 'CREDITO', puntos: 10, motivo: 'Ajuste autorizado' },
      ],
      ['/desarrollo-documental/maestros', altaDocumento(ordenes[0])],
    ] as const) {
      await request(app.getHttpServer())
        .post(ruta)
        .auth(tokens.gestor, { type: 'bearer' })
        .send({ ...body, tenantId: tenants[1] })
        .expect(400);
      await request(app.getHttpServer())
        .post(ruta)
        .auth(tokens.gestor, { type: 'bearer' })
        .set('x-tenant-id', tenants[1])
        .send(body)
        .expect(201);
    }
    expect(
      await prisma.proyectoCampana.count({ where: { tenantId: tenants[0] } }),
    ).toBe(2);
    expect(await prisma.cupon.count({ where: { tenantId: tenants[0] } })).toBe(
      2,
    );
    expect(
      (
        await prisma.fidelizacionCuenta.findUniqueOrThrow({
          where: { clienteId: clientes[0] },
        })
      ).saldoPuntos,
    ).toBe(10);
    expect(
      await prisma.archivoMaestro.count({ where: { tenantId: tenants[0] } }),
    ).toBe(1);
    expect(
      await prisma.proyectoCampana.count({ where: { tenantId: tenants[1] } }),
    ).toBe(1);
    expect(await prisma.cupon.count({ where: { tenantId: tenants[1] } })).toBe(
      1,
    );
    expect(
      await prisma.fidelizacionCuenta.count({
        where: { tenantId: tenants[1] },
      }),
    ).toBe(0);
    expect(
      await prisma.archivoMaestro.count({ where: { tenantId: tenants[1] } }),
    ).toBe(0);
  });
});
