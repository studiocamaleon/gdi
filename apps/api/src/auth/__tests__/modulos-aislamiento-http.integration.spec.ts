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
import { ClientesController } from '../../clientes/clientes.controller';
import { ClientesService } from '../../clientes/clientes.service';
import { PresupuestosController } from '../../presupuestos/presupuestos.controller';
import { PresupuestosService } from '../../presupuestos/presupuestos.service';
import { PresupuestoPdfService } from '../../presupuestos/presupuesto-pdf.service';
import { PresupuestoPilotoService } from '../../presupuestos/pdf-piloto/presupuesto-piloto.service';
import { CorreoPresupuestoService } from '../../presupuestos/correo-presupuesto.service';
import { OrdenesTrabajoController } from '../../ordenes-trabajo/ordenes-trabajo.controller';
import { OrdenesTrabajoService } from '../../ordenes-trabajo/ordenes-trabajo.service';
import { EntregaService } from '../../ordenes-trabajo/entrega.service';
import { MaterialesOrdenService } from '../../ordenes-trabajo/materiales-orden.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { DatosEmpresaService } from '../../tenants/datos-empresa.service';
import { AuthGuard } from '../auth.guard';
import { RolesGuard } from '../roles.guard';
import { PermisosGuard } from '../permisos.guard';
import { MargenesInterceptor } from '../margenes.interceptor';
import { todosLosPermisos } from '../permisos';

/** Prueba real del límite HTTP de las rutas enumeradas abajo. No levanta la
 * aplicación completa ni ensaya integraciones: las dependencias externas no
 * están conectadas. Identidades, roles, consultas y transacciones son reales. */
describe('Clientes, presupuestos y órdenes: acceso HTTP entre empresas', () => {
  const prisma = new PrismaService();
  const capacidades = capacidadesDePrueba();
  const secretoAnterior = process.env.JWT_SECRET;
  const secretoDePrueba = randomUUID();
  const jwt = new JwtService({ secret: secretoDePrueba });
  const empresa = new DatosEmpresaService(prisma);
  const avisos = { sincronizar: jest.fn(() => Promise.resolve()) };
  const ordenes = new OrdenesTrabajoService(
    prisma,
    {} as never,
    {} as never,
    avisos as never,
    {} as never,
    empresa,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    capacidades,
  );
  const presupuestos = new PresupuestosService(
    prisma,
    ordenes,
    {} as never,
    {} as never,
    avisos as never,
    {} as never,
    empresa,
    {} as never,
    {} as never,
    {} as never,
    capacidades,
  );
  const clientes = new ClientesService(prisma, capacidades);
  const tenantIds = [randomUUID(), randomUUID()];
  const userIds: string[] = [];
  const tokens: Record<string, string> = {};
  const clientesIds: string[] = [];
  const ordenesIds: string[] = [];
  const presupuestosIds: string[] = [];
  const contactosIds: string[] = [];
  const direccionesIds: string[] = [];
  const cuerposCliente: Array<{
    nombre: string;
    pais: string;
    telefonoCodigo: string;
    telefonoNumero: string;
    contactos: never[];
    direcciones: never[];
  }> = [];
  let app: INestApplication<Server>;
  let baseLocalValidada = false;

  async function usuario(
    nombre: string,
    permisos: string[],
    tenantId = tenantIds[0],
  ) {
    const user = await prisma.user.create({
      data: { email: `qa-modulos-${randomUUID()}@example.invalid` },
    });
    userIds.push(user.id);
    const rol = await prisma.rol.create({
      data: { tenantId, nombre, permisos },
    });
    const membership = await prisma.membership.create({
      data: { tenantId, userId: user.id, rolId: rol.id, rol: 'ADMINISTRADOR' },
    });
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        currentTenantId: tenantId,
        currentMembershipId: membership.id,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    tokens[nombre] = jwt.sign({
      sub: user.id,
      sessionId: session.id,
      tenantId,
      membershipId: membership.id,
      role: 'ADMINISTRADOR',
      email: user.email,
    });
  }
  beforeAll(async () => {
    process.env.JWT_SECRET = secretoDePrueba;
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Requiere base local de test y aislamiento activo');
    baseLocalValidada = true;
    await prisma.$connect();
    for (const [indice, tenantId] of tenantIds.entries()) {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          nombre: `QA empresa ${indice}`,
          slug: `qa-modulos-${tenantId}`,
        },
      });
      const cuerpo = {
        nombre: `Cliente ficticio ${indice}`,
        pais: 'AR',
        telefonoCodigo: '+1',
        telefonoNumero: '2025550100',
        contactos: [],
        direcciones: [],
      };
      cuerposCliente.push(cuerpo);
      const cliente = await prisma.cliente.create({
        data: {
          tenantId,
          nombre: cuerpo.nombre,
          paisCodigo: 'AR',
          telefonoCodigo: cuerpo.telefonoCodigo,
          telefonoNumero: cuerpo.telefonoNumero,
          contactos: {
            create: { tenantId, nombre: 'Contacto ficticio', principal: true },
          },
          direcciones: {
            create: {
              tenantId,
              descripcion: 'Entrega ficticia',
              paisCodigo: 'AR',
              direccion: 'Calle ficticia 1',
              ciudad: 'Ciudad ficticia',
              tipo: 'ENTREGA',
              principal: true,
            },
          },
        },
        include: { contactos: true, direcciones: true },
      });
      clientesIds.push(cliente.id);
      contactosIds.push(cliente.contactos[0].id);
      direccionesIds.push(cliente.direcciones[0].id);
      presupuestosIds.push(
        (
          await prisma.cotizacion.create({
            data: {
              tenantId,
              clienteId: cliente.id,
              numero: `QA-P-${indice}`,
              estado: 'enviado',
              total: 10,
              fechaValidez: new Date(Date.now() + 86_400_000),
            },
          })
        ).id,
      );
      ordenesIds.push(
        (
          await prisma.ordenTrabajo.create({
            data: {
              tenantId,
              clienteId: cliente.id,
              numero: `QA-OT-${indice}`,
              estado: 'borrador',
              total: 10,
            },
          })
        ).id,
      );
    }
    await usuario('admin', todosLosPermisos());
    await usuario('otro-admin', todosLosPermisos(), tenantIds[1]);
    await usuario('lector', ['crm.ver', 'comercial.ver', 'produccion.ver']);
    await usuario('operario', ['produccion.ver', 'produccion.ejecutar']);
    await usuario('sin-permisos', []);
    const modulo = await Test.createTestingModule({
      controllers: [
        ClientesController,
        PresupuestosController,
        OrdenesTrabajoController,
      ],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: ClientesService, useValue: clientes },
        { provide: PresupuestosService, useValue: presupuestos },
        { provide: OrdenesTrabajoService, useValue: ordenes },
        ...[
          PresupuestoPdfService,
          PresupuestoPilotoService,
          CorreoPresupuestoService,
          ArchivosService,
          EntregaService,
          MaterialesOrdenService,
        ].map((provide) => ({ provide, useValue: {} })),
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
    if (!baseLocalValidada) {
      await prisma.$disconnect();
      return;
    }
    await app?.close();
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
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
  const rutas = ['clientes', 'presupuestos', 'ordenes-trabajo'];
  const idsDe = (ruta: string) =>
    ruta === 'clientes'
      ? clientesIds
      : ruta === 'presupuestos'
        ? presupuestosIds
        : ordenesIds;

  it.each(rutas)(
    '%s requiere sesión y permisos, aunque el enum diga administrador',
    async (ruta) => {
      await request(app.getHttpServer()).get(`/${ruta}`).expect(401);
      await peticion('get', `/${ruta}`, 'sin-permisos').expect(403);
    },
  );
  it.each(rutas)(
    '%s sólo devuelve entidades de la empresa de la sesión',
    async (ruta) => {
      const ids = idsDe(ruta);
      const r = await peticion('get', `/${ruta}`)
        .set('x-tenant-id', tenantIds[1])
        .expect(200);
      expect(r.text).toContain(ids[0]);
      expect(r.text).not.toContain(ids[1]);
      await peticion('get', `/${ruta}/${ids[0]}`).expect(200);
      await peticion('get', `/${ruta}/${ids[1]}`).expect(404);
    },
  );
  it.each(rutas)(
    '%s mantiene el contexto de empresa en solicitudes concurrentes',
    async (ruta) => {
      const ids = idsDe(ruta);
      const resultados = await Promise.all(
        Array.from({ length: 6 }, (_, n) =>
          peticion('get', `/${ruta}`, n % 2 ? 'otro-admin' : 'admin').expect(
            200,
          ),
        ),
      );
      for (const [n, r] of resultados.entries()) {
        expect(r.text).toContain(ids[n % 2]);
        expect(r.text).not.toContain(ids[1 - (n % 2)]);
      }
    },
  );
  it('operario consulta su OT, pero no clientes ni presupuestos', async () => {
    await peticion(
      'get',
      `/ordenes-trabajo/${ordenesIds[0]}`,
      'operario',
    ).expect(200);
    await peticion('get', `/clientes/${clientesIds[0]}`, 'operario').expect(
      403,
    );
    await peticion(
      'get',
      `/presupuestos/${presupuestosIds[0]}`,
      'operario',
    ).expect(403);
  });
  it('leer clientes no permite crear, editar, desactivar ni borrar', async () => {
    const antes = await prisma.cliente.findUniqueOrThrow({
      where: { id: clientesIds[0] },
    });
    await peticion('post', '/clientes', 'lector')
      .send(cuerposCliente[0])
      .expect(403);
    await peticion('put', `/clientes/${clientesIds[0]}`, 'lector')
      .send({ ...cuerposCliente[0], updatedAt: antes.updatedAt.toISOString() })
      .expect(403);
    await peticion('patch', `/clientes/${clientesIds[0]}/estado`, 'lector')
      .send({ activo: false })
      .expect(403);
    await peticion('delete', `/clientes/${clientesIds[0]}`, 'lector').expect(
      403,
    );
    expect(
      await prisma.cliente.findUniqueOrThrow({ where: { id: clientesIds[0] } }),
    ).toEqual(antes);
  });
  it('un administrador no puede editar, desactivar ni borrar al cliente ajeno', async () => {
    const antes = await prisma.cliente.findUniqueOrThrow({
      where: { id: clientesIds[1] },
    });
    await peticion('put', `/clientes/${clientesIds[1]}`)
      .send({ ...cuerposCliente[1], updatedAt: antes.updatedAt.toISOString() })
      .expect(404);
    await peticion('patch', `/clientes/${clientesIds[1]}/estado`)
      .send({ activo: false })
      .expect(404);
    await peticion('delete', `/clientes/${clientesIds[1]}`).expect(404);
    expect(
      await prisma.cliente.findUniqueOrThrow({ where: { id: clientesIds[1] } }),
    ).toEqual(antes);
  });
  it.each(['contacto', 'direccion'])(
    'no se puede apropiarse de un %s de otra empresa mediante una actualización anidada',
    async (tipo) => {
      const antes = await prisma.cliente.findMany({
        where: { id: { in: clientesIds } },
        include: { contactos: true, direcciones: true },
        orderBy: { id: 'asc' },
      });
      const propio = antes.find((c) => c.id === clientesIds[0])!;
      const body = {
        ...cuerposCliente[0],
        nombre: 'No debe guardarse',
        updatedAt: propio.updatedAt.toISOString(),
        contactos:
          tipo === 'contacto'
            ? [
                {
                  id: contactosIds[1],
                  nombre: 'No debe guardarse',
                  principal: true,
                },
              ]
            : [],
        direcciones:
          tipo === 'direccion'
            ? [
                {
                  id: direccionesIds[1],
                  descripcion: 'No debe guardarse',
                  pais: 'AR',
                  direccion: 'Otra calle',
                  ciudad: 'Otra ciudad',
                  tipo: 'entrega',
                  principal: true,
                },
              ]
            : [],
      };
      await peticion('put', `/clientes/${clientesIds[0]}`)
        .send(body)
        .expect(409);
      expect(
        await prisma.cliente.findMany({
          where: { id: { in: clientesIds } },
          include: { contactos: true, direcciones: true },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(antes);
    },
  );
  it('no se acepta tenantId aportado por el navegador', async () => {
    const cantidad = await prisma.cliente.count({
      where: { tenantId: { in: tenantIds } },
    });
    await peticion('post', '/clientes')
      .send({ ...cuerposCliente[0], tenantId: tenantIds[1] })
      .expect(400);
    expect(
      await prisma.cliente.count({ where: { tenantId: { in: tenantIds } } }),
    ).toBe(cantidad);
  });
  it('una modificación legítima del propio cliente funciona y no modifica al ajeno', async () => {
    const ajeno = await prisma.cliente.findUniqueOrThrow({
      where: { id: clientesIds[1] },
    });
    const propio = await prisma.cliente.findUniqueOrThrow({
      where: { id: clientesIds[0] },
    });
    await peticion('put', `/clientes/${clientesIds[0]}`)
      .send({
        ...cuerposCliente[0],
        nombre: 'Cliente propio editado',
        updatedAt: propio.updatedAt.toISOString(),
      })
      .expect(200);
    expect(
      (
        await prisma.cliente.findUniqueOrThrow({
          where: { id: clientesIds[0] },
        })
      ).nombre,
    ).toBe('Cliente propio editado');
    expect(
      await prisma.cliente.findUniqueOrThrow({ where: { id: clientesIds[1] } }),
    ).toEqual(ajeno);
  });
  it.each(['lector', 'operario'])(
    '%s no puede emitir, enviar, resolver ni convertir presupuestos',
    async (actor) => {
      await peticion('post', '/presupuestos/emitir', actor)
        .send({})
        .expect(403);
      await peticion(
        'patch',
        `/presupuestos/${presupuestosIds[0]}/enviar`,
        actor,
      ).expect(403);
      await peticion(
        'patch',
        `/presupuestos/${presupuestosIds[0]}/resolver`,
        actor,
      )
        .send({ resultado: 'aprobado' })
        .expect(403);
      await peticion(
        'post',
        `/presupuestos/${presupuestosIds[0]}/convertir`,
        actor,
      )
        .send({})
        .expect(403);
    },
  );
  it('presupuesto ajeno: no se modifica ni se genera PDF', async () => {
    const id = presupuestosIds[1];
    const antes = await prisma.cotizacion.findUniqueOrThrow({ where: { id } });
    await peticion('patch', `/presupuestos/${id}/enviar`).expect(404);
    await peticion('patch', `/presupuestos/${id}/resolver`)
      .send({ resultado: 'aprobado' })
      .expect(404);
    await peticion('post', `/presupuestos/${id}/convertir`)
      .send({})
      .expect(404);
    await peticion('get', `/presupuestos/${id}/pdf/estado`).expect(404);
    expect(
      await prisma.cotizacion.findUniqueOrThrow({ where: { id } }),
    ).toEqual(antes);
    expect(avisos.sincronizar).not.toHaveBeenCalled();
  });
  it.each(['lector', 'operario'])(
    '%s no puede crear, editar ni cancelar una orden',
    async (actor) => {
      await peticion('post', '/ordenes-trabajo', actor).send({}).expect(403);
      await peticion('patch', `/ordenes-trabajo/${ordenesIds[0]}`, actor)
        .send({})
        .expect(403);
      await peticion(
        'post',
        `/ordenes-trabajo/${ordenesIds[0]}/cancelar`,
        actor,
      )
        .send({ motivo: 'QA' })
        .expect(403);
    },
  );
  it('no se puede cancelar la orden de otra empresa', async () => {
    const id = ordenesIds[1];
    const antes = await prisma.ordenTrabajo.findUniqueOrThrow({
      where: { id },
    });
    await peticion('post', `/ordenes-trabajo/${id}/cancelar`)
      .send({ motivo: 'Intento ficticio de QA' })
      .expect(404);
    expect(
      await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id } }),
    ).toEqual(antes);
    expect(avisos.sincronizar).not.toHaveBeenCalled();
  });
});
