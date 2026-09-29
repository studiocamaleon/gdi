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
import { ProveedoresController } from '../../proveedores/proveedores.controller';
import { ProveedoresService } from '../../proveedores/proveedores.service';
import { EmpleadosController } from '../../empleados/empleados.controller';
import { EmpleadosService } from '../../empleados/empleados.service';
import { ComprasController } from '../../compras/compras.controller';
import { ComprasService } from '../../compras/compras.service';
import { InventarioService } from '../../inventario/inventario.service';
import { ReservasMaterialService } from '../../inventario/reservas-material.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { AuthGuard } from '../auth.guard';
import { AuthService } from '../auth.service';
import { RolesGuard } from '../roles.guard';
import { PermisosGuard } from '../permisos.guard';
import { MargenesInterceptor } from '../margenes.interceptor';
import { SessionCacheService } from '../session-cache.service';
import { todosLosPermisos } from '../permisos';
import { ReportesController } from '../../reportes/reportes.controller';
import { ReportesService } from '../../reportes/reportes.service';
import { EquipoService } from '../../reportes/equipo.service';
import { RentabilidadService } from '../../reportes/rentabilidad.service';
import { CobranzaService } from '../../reportes/cobranza.service';
import { VentasService } from '../../reportes/ventas.service';
import { ProductoService } from '../../reportes/producto.service';
import { ReporteProduccionService } from '../../reportes/produccion.service';
import { AlertasService } from '../../reportes/alertas.service';
import { ClientesService } from '../../reportes/clientes.service';
import { EmbudoService } from '../../reportes/embudo.service';
import { EtaService } from '../../eta/eta.service';

/** Identidades, permisos, contextos de empresa y transacciones reales.
 * El ensayo no inicia workers ni conecta integraciones externas. */
describe('Registros y compras: autorización HTTP y relaciones anidadas', () => {
  const prisma = new PrismaService();
  const capacidades = capacidadesDePrueba();
  const secretoAnterior = process.env.JWT_SECRET;
  const secreto = randomUUID();
  const jwt = new JwtService({ secret: secreto });
  const cache = new SessionCacheService();
  const tenantIds = [randomUUID(), randomUUID()];
  const userIds: string[] = [];
  const tokens: Record<string, string> = {};
  const proveedores: string[] = [];
  const empleados: string[] = [];
  const contactos: string[] = [];
  const direcciones: string[] = [];
  const compras: string[] = [];
  const variantes: string[] = [];
  const ubicaciones: string[] = [];
  let app: INestApplication<Server>;
  let baseValidada = false;

  const proveedor = (extra: Record<string, unknown> = {}) => ({
    nombre: `Proveedor ficticio ${randomUUID()}`,
    pais: 'AR',
    contactos: [],
    direcciones: [],
    ...extra,
  });
  const direccion = (id?: string) => ({
    id,
    descripcion: 'Entrega ficticia',
    pais: 'AR',
    direccion: 'Calle ficticia 1',
    ciudad: 'Ciudad ficticia',
    tipo: 'principal',
    principal: true,
  });
  const empleado = (extra: Record<string, unknown> = {}) => ({
    nombreCompleto: 'Empleado ficticio',
    email: `empleado-${randomUUID()}@example.invalid`,
    telefonoCodigo: '1',
    telefonoNumero: '2025550100',
    sector: 'Ventas',
    fechaIngreso: '2025-01-01',
    comisionesHabilitadas: false,
    comisiones: [],
    direcciones: [],
    ...extra,
  });
  const compra = (extra: Record<string, unknown> = {}, indice = 0) => ({
    clave: randomUUID(),
    proveedorId: proveedores[indice],
    ubicacionId: ubicaciones[indice],
    fechaPedido: '2026-09-01',
    moneda: 'ARS',
    tipoCambio: 1,
    lineas: [
      {
        varianteId: variantes[indice],
        unidadCompra: 'HOJA',
        factorStock: 1,
        cantidad: 2,
        precio: 100,
        asignaciones: [],
      },
    ],
    ...extra,
  });

  async function usuario(nombre: string, permisos: string[], indice = 0) {
    const tenantId = tenantIds[indice];
    const user = await prisma.user.create({
      data: { email: `qa-registros-${randomUUID()}@example.invalid` },
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
          nombre: `QA registros ${indice}`,
          slug: `qa-registros-${tenantId}`,
        },
      });
      const prov = await prisma.proveedor.create({
        data: {
          tenantId,
          nombre: `Proveedor empresa ${indice}`,
          emailPrincipal: '',
          telefonoCodigo: '',
          telefonoNumero: '',
          paisCodigo: 'AR',
          contactos: {
            create: {
              tenantId,
              nombre: `Contacto privado ${indice}`,
              principal: true,
            },
          },
        },
        include: { contactos: true },
      });
      proveedores.push(prov.id);
      contactos.push(prov.contactos[0].id);
      const emp = await prisma.empleado.create({
        data: {
          tenantId,
          nombreCompleto: `Empleado empresa ${indice}`,
          emailPrincipal: `empleado-${indice}@example.invalid`,
          telefonoCodigo: '1',
          telefonoNumero: '2025550100',
          sector: 'Ventas',
          fechaIngreso: new Date('2025-01-01'),
          comisionesHabilitadas: true,
          comisiones: {
            create: {
              tenantId,
              descripcion: 'Comisión privada',
              tipo: 'FIJO',
              valor: 987.65,
            },
          },
          direcciones: {
            create: {
              tenantId,
              descripcion: 'Domicilio',
              paisCodigo: 'AR',
              direccion: 'Calle ficticia 1',
              ciudad: 'Ciudad ficticia',
              tipo: 'PRINCIPAL',
              principal: true,
            },
          },
        },
        include: { direcciones: true },
      });
      empleados.push(emp.id);
      direcciones.push(emp.direcciones[0].id);
      await prisma.ordenTrabajo.create({
        data: {
          tenantId,
          numero: 'QA-VENTA',
          estado: 'pendiente',
          vendedorEmpleadoId: emp.id,
          fechaEmision: new Date('2026-09-15T12:00:00Z'),
          items: {
            create: {
              tenantId,
              codigo: 'QA',
              nombre: 'Producto ficticio',
              familia: 'Documentos',
              cantidad: 1,
              cantidadUnidad: 'copias',
              subtotal: 1000,
              impuestos: 0,
              total: 1000,
            },
          },
        },
      });
      const material = await prisma.materiaPrima.create({
        data: {
          tenantId,
          codigo: 'QA',
          nombre: `Papel empresa ${indice}`,
          familia: 'SUSTRATO',
          subfamilia: 'SUSTRATO_RIGIDO',
          tipoTecnico: 'test',
          templateId: 'test',
          unidadStock: 'HOJA',
          unidadCompra: 'HOJA',
          atributosTecnicosJson: {},
        },
      });
      variantes.push(
        (
          await prisma.materiaPrimaVariante.create({
            data: {
              tenantId,
              materiaPrimaId: material.id,
              sku: 'QA',
              atributosVarianteJson: {},
              unidadStock: 'HOJA',
              unidadCompra: 'HOJA',
            },
          })
        ).id,
      );
      const almacen = await prisma.almacenMateriaPrima.create({
        data: { tenantId, codigo: 'QA', nombre: 'Depósito ficticio' },
      });
      ubicaciones.push(
        (
          await prisma.almacenMateriaPrimaUbicacion.create({
            data: {
              tenantId,
              almacenId: almacen.id,
              codigo: 'QA',
              nombre: 'Estante ficticio',
            },
          })
        ).id,
      );
      compras.push(
        (
          await prisma.ordenCompra.create({
            data: {
              tenantId,
              numero: 1,
              proveedorId: prov.id,
              proveedorNombre: prov.nombre,
              ubicacionId: ubicaciones[indice],
              fechaPedido: new Date('2026-09-01'),
              moneda: 'ARS',
              monedaStock: 'ARS',
              tipoCambio: 1,
              creadoPor: 'QA ficticio',
            },
          })
        ).id,
      );
    }
    await usuario('admin', todosLosPermisos());
    await usuario('otro-admin', todosLosPermisos(), 1);
    await usuario('lector', [
      'registros.ver',
      'inventario.ver',
      'finanzas.ver_margenes',
    ]);
    await usuario('sin-costos', ['inventario.gestionar']);
    await usuario('personal', [
      'registros.ver',
      'registros.gestionar_empleados',
      'reportes.ver',
      'finanzas.ver_margenes',
    ]);
    await usuario('sin-permisos', []);
    const inventario = new InventarioService(prisma, undefined, capacidades);
    const reservas = new ReservasMaterialService(
      prisma,
      inventario,
      capacidades,
    );
    const modulo = await Test.createTestingModule({
      controllers: [
        ProveedoresController,
        EmpleadosController,
        ComprasController,
        ReportesController,
      ],
      providers: [
        { provide: ReportesService, useValue: new ReportesService(prisma) },
        { provide: EquipoService, useValue: new EquipoService(prisma) },
        // Sólo se prueba el reporte Equipo; los demás reportes quedan fuera
        // del ensayo y no reciben dependencias para ejecutar efectos.
        ...[
          RentabilidadService,
          CobranzaService,
          VentasService,
          ProductoService,
          ReporteProduccionService,
          AlertasService,
          ClientesService,
          EmbudoService,
          EtaService,
        ].map((provide) => ({ provide, useValue: {} })),
        { provide: PrismaService, useValue: prisma },
        { provide: CapacidadesEmpresaService, useValue: capacidades },
        {
          provide: ProveedoresService,
          useValue: new ProveedoresService(prisma),
        },
        {
          provide: EmpleadosService,
          useValue: new EmpleadosService(
            prisma,
            new AuthService(prisma, jwt, cache, {} as never),
            capacidades,
          ),
        },
        {
          provide: ComprasService,
          useValue: new ComprasService(
            prisma,
            inventario,
            reservas,
            capacidades,
          ),
        },
      ],
    }).compile();
    app = modulo.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    const reflector = new Reflector();
    app.useGlobalGuards(
      new AuthGuard(reflector, jwt, prisma, cache),
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
      const where = { tenantId: { in: tenantIds } };
      await prisma.detalleRecepcionCompra.deleteMany({ where });
      await prisma.recepcionCompra.deleteMany({ where });
      await prisma.coberturaCompra.deleteMany({ where });
      await prisma.lineaOrdenCompra.deleteMany({ where });
      await prisma.ordenCompra.deleteMany({ where });
      await prisma.ofertaCompra.deleteMany({ where });
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
  const ids = (ruta: string) =>
    ruta === 'proveedores'
      ? proveedores
      : ruta === 'empleados'
        ? empleados
        : compras;
  const rutas = ['proveedores', 'empleados', 'compras'];

  it.each(rutas)('%s exige sesión y permisos', async (ruta) => {
    await request(app.getHttpServer()).get(`/${ruta}`).expect(401);
    await peticion('get', `/${ruta}`, 'sin-permisos').expect(403);
  });
  it.each(rutas)(
    '%s aísla listado, detalle y peticiones simultáneas',
    async (ruta) => {
      const respuestas = await Promise.all(
        Array.from({ length: 6 }, (_, n) =>
          peticion('get', `/${ruta}`, n % 2 ? 'otro-admin' : 'admin')
            .set('x-tenant-id', tenantIds[1 - (n % 2)])
            .expect(200),
        ),
      );
      for (const [n, respuesta] of respuestas.entries()) {
        expect(respuesta.text).toContain(ids(ruta)[n % 2]);
        expect(respuesta.text).not.toContain(ids(ruta)[1 - (n % 2)]);
      }
      await peticion('get', `/${ruta}/${ids(ruta)[0]}`).expect(200);
      await peticion('get', `/${ruta}/${ids(ruta)[1]}`).expect(404);
    },
  );
  it.each(['proveedores', 'empleados'])(
    '%s mantiene privados sus catálogos auxiliares',
    async (ruta) => {
      const r = await peticion('get', `/${ruta}/opciones`).expect(200);
      expect(r.text).toContain(ids(ruta)[0]);
      expect(r.text).not.toContain(ids(ruta)[1]);
      await peticion('get', `/${ruta}/opciones`, 'sin-permisos').expect(403);
    },
  );
  it.each(['proveedores', 'empleados'])(
    'lector de %s no puede crear, importar, editar ni dar de baja',
    async (ruta) => {
      const body = ruta === 'proveedores' ? proveedor() : empleado();
      await peticion('post', `/${ruta}`, 'lector').send(body).expect(403);
      await peticion('post', `/${ruta}/importar`, 'lector')
        .send({ [ruta]: [body] })
        .expect(403);
      await peticion('put', `/${ruta}/${ids(ruta)[0]}`, 'lector')
        .send({ ...body, updatedAt: new Date().toISOString() })
        .expect(403);
      await peticion('patch', `/${ruta}/${ids(ruta)[0]}/estado`, 'lector')
        .send({ activo: false })
        .expect(403);
      await peticion('delete', `/${ruta}/${ids(ruta)[0]}`, 'lector').expect(
        403,
      );
    },
  );
  it.each(['proveedores', 'empleados'])(
    '%s no puede modificar ni borrar un registro ajeno',
    async (ruta) => {
      const body = ruta === 'proveedores' ? proveedor() : empleado();
      await peticion('put', `/${ruta}/${ids(ruta)[1]}`)
        .send({ ...body, updatedAt: new Date().toISOString() })
        .expect(404);
      await peticion('patch', `/${ruta}/${ids(ruta)[1]}/estado`)
        .send({ activo: false })
        .expect(404);
      await peticion('delete', `/${ruta}/${ids(ruta)[1]}`).expect(404);
      const r = await peticion(
        'get',
        `/${ruta}/${ids(ruta)[1]}`,
        'otro-admin',
      ).expect(200);
      expect(r.body).toMatchObject({ activo: true });
    },
  );
  it('una baja múltiple con un empleado ajeno revierte todo el lote', async () => {
    await peticion('patch', '/empleados/estado')
      .send({ ids: empleados, activo: false })
      .expect(400);
    expect(
      await prisma.empleado.count({
        where: { id: { in: empleados }, activo: true },
      }),
    ).toBe(2);
  });
  it('no expone comisiones sin el permiso específico', async () => {
    const r = await peticion(
      'get',
      `/empleados/${empleados[0]}`,
      'personal',
    ).expect(200);
    expect(r.body).toMatchObject({ comisionesVisibles: false, comisiones: [] });
    expect(r.text).not.toContain('987.65');
  });
  it('no permite crear comisiones sin el permiso específico', async () => {
    await peticion('post', '/empleados', 'personal')
      .send(
        empleado({
          comisionesHabilitadas: true,
          comisiones: [{ descripcion: 'Comisión', tipo: 'fijo', valor: '10' }],
        }),
      )
      .expect(403);
  });
  it('no permite importar comisiones sin el permiso específico', async () => {
    await peticion('post', '/empleados/importar', 'personal')
      .send({ empleados: [empleado({ comisionesHabilitadas: true })] })
      .expect(403);
  });
  it('el reporte Equipo respeta el permiso de comisiones y la empresa', async () => {
    const ruta = '/reportes/panel/equipo?desde=2026-09-01&hasta=2026-09-30';
    const r = await peticion('get', ruta, 'personal').expect(200);
    expect(r.body).toMatchObject({
      comisionesVisibles: false,
      vendedores: [
        expect.objectContaining({
          empleadoId: empleados[0],
          comisionEstimada: null,
        }),
      ],
    });
    expect(r.text).not.toContain(empleados[1]);
    expect(r.text).not.toContain('987.65');
    const admin = await peticion('get', ruta).expect(200);
    expect(admin.body).toMatchObject({
      comisionesVisibles: true,
      vendedores: [
        expect.objectContaining({
          empleadoId: empleados[0],
          comisionEstimada: 987.65,
        }),
      ],
    });
    expect(admin.text).not.toContain(empleados[1]);
  });
  it('editar el legajo sin permiso de comisiones conserva sus reglas privadas', async () => {
    const antes = await prisma.empleado.findUniqueOrThrow({
      where: { id: empleados[0] },
      include: { comisiones: true },
    });
    const r = await peticion('put', `/empleados/${empleados[0]}`, 'personal')
      .send(
        empleado({
          updatedAt: antes.updatedAt.toISOString(),
          comisionesHabilitadas: false,
          comisiones: [],
        }),
      )
      .expect(200);
    expect(r.body).toMatchObject({ comisionesVisibles: false, comisiones: [] });
    const despues = await prisma.empleado.findUniqueOrThrow({
      where: { id: empleados[0] },
      include: { comisiones: true },
    });
    expect(despues.comisiones).toEqual(antes.comisiones);
    expect(despues.comisionesHabilitadas).toBe(true);
  });
  it.each(['proveedores', 'empleados'])(
    '%s rechaza referencias anidadas ajenas sin alterar los registros',
    async (ruta) => {
      const propio = await peticion('get', `/${ruta}/${ids(ruta)[0]}`).expect(
        200,
      );
      const anterior = propio.body as { updatedAt: string };
      const body =
        ruta === 'proveedores'
          ? proveedor({
              contactos: [
                { id: contactos[1], nombre: 'Intento', principal: true },
              ],
            })
          : empleado({ direcciones: [direccion(direcciones[1])] });
      await peticion('put', `/${ruta}/${ids(ruta)[0]}`)
        .send({ ...body, updatedAt: anterior.updatedAt })
        .expect(409);
      const despues = await peticion('get', `/${ruta}/${ids(ruta)[0]}`).expect(
        200,
      );
      expect(despues.body).toEqual(propio.body);
      const ajeno = await peticion(
        'get',
        `/${ruta}/${ids(ruta)[1]}`,
        'otro-admin',
      ).expect(200);
      expect(ajeno.text).not.toContain('Intento');
    },
  );
  it.each(['proveedores', 'empleados'])(
    '%s revierte una importación con una referencia ajena',
    async (ruta) => {
      const primero = ruta === 'proveedores' ? proveedor() : empleado();
      const segundo =
        ruta === 'proveedores'
          ? proveedor({
              contactos: [
                { id: contactos[1], nombre: 'Intento', principal: true },
              ],
            })
          : empleado({ direcciones: [direccion(direcciones[1])] });
      const antes = await peticion('get', `/${ruta}`).expect(200);
      await peticion('post', `/${ruta}/importar`)
        .send({ [ruta]: [primero, segundo] })
        .expect(409);
      const despues = await peticion('get', `/${ruta}`).expect(200);
      expect(despues.body).toEqual(antes.body);
    },
  );
  it.each(['proveedores', 'empleados'])(
    '%s acepta altas e importaciones propias sin exponer identidades',
    async (ruta) => {
      const body = ruta === 'proveedores' ? proveedor() : empleado();
      const r = await peticion('post', `/${ruta}`).send(body).expect(201);
      expect(r.text).not.toMatch(/passwordHash|mfaSecret|rolPlataforma/);
      await peticion('post', `/${ruta}/importar`)
        .send({ [ruta]: [ruta === 'proveedores' ? proveedor() : empleado()] })
        .expect(201);
      await peticion('post', `/${ruta}`)
        .send({ ...body, tenantId: tenantIds[1], userId: userIds[0] })
        .expect(400);
    },
  );
  it('consultar compras no permite crear, ofrecer, emitir ni recibir', async () => {
    await peticion('post', '/compras', 'lector').send(compra()).expect(403);
    await peticion('put', '/compras/ofertas', 'lector').send({}).expect(403);
    await peticion('post', `/compras/${compras[0]}/acciones`, 'lector')
      .send({ clave: randomUUID(), version: 1, accion: 'emitir' })
      .expect(403);
    await peticion('post', `/compras/${compras[0]}/recepciones`, 'lector')
      .send({})
      .expect(403);
    expect(
      await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compras[0] } }),
    ).toMatchObject({ estado: 'BORRADOR', version: 1 });
  });
  it('gestionar inventario no concede acceso a precios de compra', async () => {
    for (const ruta of [
      '/compras',
      '/compras/catalogo',
      `/compras/${compras[0]}`,
    ])
      await peticion('get', ruta, 'sin-costos').expect(403);
    await peticion('get', '/compras/necesidades', 'sin-costos').expect(200);
    await peticion('post', '/compras', 'sin-costos').send(compra()).expect(403);
  });
  it.each(['proveedorId', 'ubicacionId', 'varianteId'])(
    'comprar no admite %s ajeno y revierte toda la transacción',
    async (campo) => {
      const body = compra(
        campo === 'proveedorId'
          ? { proveedorId: proveedores[1] }
          : campo === 'ubicacionId'
            ? { ubicacionId: ubicaciones[1] }
            : { lineas: [{ ...compra().lineas[0], varianteId: variantes[1] }] },
      );
      const antes = await prisma.ordenCompra.count({
        where: { tenantId: tenantIds[0] },
      });
      await peticion('post', '/compras').send(body).expect(400);
      expect(
        await prisma.ordenCompra.count({ where: { tenantId: tenantIds[0] } }),
      ).toBe(antes);
      expect(
        await prisma.operacionCompra.count({
          where: { tenantId: tenantIds[0], clave: body.clave },
        }),
      ).toBe(0);
    },
  );
  it('no modifica ni recibe compras ajenas', async () => {
    await peticion('post', `/compras/${compras[1]}/acciones`)
      .send({
        clave: randomUUID(),
        version: 1,
        accion: 'cancelar',
        motivo: 'Intento',
      })
      .expect(404);
    await peticion('post', `/compras/${compras[1]}/recepciones`)
      .send({
        clave: randomUUID(),
        version: 1,
        ubicacionId: ubicaciones[0],
        lineas: [{ lineaId: randomUUID(), cantidad: 1, cantidadStock: 1 }],
      })
      .expect(404);
    expect(
      await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compras[1] } }),
    ).toMatchObject({ estado: 'BORRADOR', version: 1 });
  });
  it('separa claves de idempotencia entre empresas y rechaza reutilizarlas con otro contenido', async () => {
    const clave = randomUUID();
    const a = compra({ clave });
    const b = compra({ clave }, 1);
    const r = await peticion('post', '/compras').send(a).expect(201);
    expect(
      (await peticion('post', '/compras').send(a).expect(201)).body,
    ).toEqual(r.body);
    const otro = await peticion('post', '/compras', 'otro-admin')
      .send(b)
      .expect(201);
    expect(otro.body).not.toEqual(r.body);
    await peticion('post', '/compras')
      .send({ ...a, notas: 'Contenido diferente' })
      .expect(409);
    expect(
      await prisma.operacionCompra.count({
        where: { tenantId: { in: tenantIds }, clave },
      }),
    ).toBe(2);
  });
});
