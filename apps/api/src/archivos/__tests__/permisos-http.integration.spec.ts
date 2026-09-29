import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ArchivoScope } from '@prisma/client';
import request from 'supertest';
import { AuthGuard } from '../../auth/auth.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import { SessionCacheService } from '../../auth/session-cache.service';
import { todosLosPermisos } from '../../auth/permisos';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { PrismaService } from '../../prisma/prisma.service';
import { ArchivosController } from '../archivos.controller';
import { ArchivosService } from '../archivos.service';
import type { StorageDriver } from '../storage/storage.driver';

/** HTTP, JWT, sesiones, permisos y PostgreSQL reales; sólo el storage y los
 * eventos externos están simulados. No inicia workers ni usa otras empresas. */
describe('Archivos: permisos del módulo y aislamiento por HTTP', () => {
  const prisma = new PrismaService();
  const secretoAnterior = process.env.JWT_SECRET;
  const secretoDePrueba = randomUUID();
  const jwt = new JwtService({ secret: secretoDePrueba });
  const cache = new SessionCacheService();
  const tenantIds = [randomUUID(), randomUUID()];
  const userIds: string[] = [];
  const tokens: Record<string, string> = {};
  const archivos = new Map<ArchivoScope, string>();
  const storage = {
    nombre: 'local',
    firmarDescarga: jest.fn(() =>
      Promise.resolve('https://archivos.example.invalid/privado'),
    ),
    firmarSubida: jest.fn(() =>
      Promise.resolve({
        url: 'https://archivos.example.invalid/carga',
        headers: {},
        expiraEn: 60,
      }),
    ),
    cabecera: jest.fn(() =>
      Promise.resolve({ bytes: 20, contentType: 'image/png' }),
    ),
    leerCabecera: jest.fn(() =>
      Promise.resolve(
        Buffer.concat([
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
          Buffer.alloc(12),
        ]),
      ),
    ),
    borrar: jest.fn(() => Promise.resolve()),
    abortarMultipart: jest.fn(() => Promise.resolve()),
  };
  const service = new ArchivosService(
    prisma,
    storage as unknown as StorageDriver,
    {
      publicarDesdeAuth: jest.fn(() => Promise.resolve()),
    } as never,
  );
  let app: INestApplication<Server>;
  let baseLocalValidada = false;
  let clienteId: string;
  let cotizacionId: string;
  let ordenId: string;
  let ajenoId: string;
  const categoriaId = randomUUID();
  const subcategoriaId = randomUUID();

  async function usuario(
    nombre: string,
    permisos: string[],
    tenantId = tenantIds[0],
  ) {
    const user = await prisma.user.create({
      data: { email: `qa-archivos-${randomUUID()}@example.invalid` },
    });
    userIds.push(user.id);
    const rol = await prisma.rol.create({
      data: { tenantId, nombre, permisos },
    });
    const membership = await prisma.membership.create({
      data: { tenantId, userId: user.id, rolId: rol.id, rol: 'OPERADOR' },
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
      role: 'OPERADOR',
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
      throw new Error('Requiere PostgreSQL local de test y aislamiento activo');
    baseLocalValidada = true;
    await prisma.$connect();
    for (const id of tenantIds)
      await prisma.tenant.create({
        data: {
          id,
          nombre: 'QA archivos ficticios',
          slug: `qa-archivos-${id}`,
        },
      });
    clienteId = (
      await prisma.cliente.create({
        data: {
          tenantId: tenantIds[0],
          nombre: 'Cliente ficticio',
          telefonoCodigo: '1',
          telefonoNumero: '2025550100',
          paisCodigo: 'US',
        },
      })
    ).id;
    cotizacionId = (
      await prisma.cotizacion.create({
        data: { tenantId: tenantIds[0], numero: `QA-${randomUUID()}` },
      })
    ).id;
    ordenId = (
      await prisma.ordenTrabajo.create({
        data: { tenantId: tenantIds[0], numero: `QA-${randomUUID()}` },
      })
    ).id;
    const tenantId = tenantIds[0];
    const item = await prisma.ordenTrabajoItem.create({
      data: {
        tenantId,
        ordenId,
        codigo: 'QA',
        nombre: 'Ficticio',
        familia: 'QA',
        cantidad: 1,
        cantidadUnidad: 'u',
        subtotal: 1,
        impuestos: 0,
        total: 1,
      },
    });
    const campana = await prisma.proyectoCampana.create({
      data: { tenantId, clienteId, codigo: 'QA', nombre: 'Ficticia' },
    });
    const fiscal = await prisma.configuracionFiscal.create({
      data: { tenantId, razonSocial: 'Ficticia', cuit: '00000000000' },
    });
    const punto = await prisma.puntoVenta.create({
      data: {
        tenantId,
        configuracionFiscalId: fiscal.id,
        numero: 9999,
        nombre: 'Ficticio',
      },
    });
    const comprobante = await prisma.comprobante.create({
      data: {
        tenantId,
        puntoVentaId: punto.id,
        tipo: 'factura',
        letra: 'C',
        fecha: new Date(),
        receptorSnapshot: {},
        itemsJson: [],
        netoGravado: 1,
        ivaPorAlicuota: [],
        total: 1,
        idempotencyKey: randomUUID(),
      },
    });
    const metodo = await prisma.metodoPago.create({
      data: { tenantId, codigo: 'QA', nombre: 'Ficticio', tipo: 'efectivo' },
    });
    const cobro = await prisma.cobro.create({
      data: {
        tenantId,
        metodoPagoId: metodo.id,
        fecha: new Date(),
        montoBruto: 1,
        netoAcreditado: 1,
        disponibleReal: 1,
      },
    });
    const categoria = await prisma.categoriaEgreso.create({
      data: {
        tenantId,
        codigo: 'QA',
        nombre: 'Ficticia',
        naturaleza: 'GASTO_ESTRUCTURA',
      },
    });
    const egreso = await prisma.egreso.create({
      data: {
        tenantId,
        categoriaEgresoId: categoria.id,
        numero: 'QA',
        descripcion: 'Ficticio',
        beneficiarioNombre: 'Ficticio',
        fechaCompetencia: new Date(),
        neto: 1,
        total: 1,
      },
    });
    await prisma.productoCategoriaComercial.create({
      data: {
        id: categoriaId,
        codigo: `QA-${categoriaId}`,
        nombre: 'Ficticia',
      },
    });
    await prisma.productoSubcategoriaComercial.create({
      data: {
        id: subcategoriaId,
        categoriaId,
        codigo: `QA-${subcategoriaId}`,
        nombre: 'Ficticia',
        atributosSchemaJson: {},
      },
    });
    const producto = await prisma.producto.create({
      data: {
        tenantId,
        codigo: 'QA',
        nombre: 'Ficticio',
        subcategoriaComercialId: subcategoriaId,
      },
    });
    const proveedor = await prisma.proveedor.create({
      data: {
        tenantId,
        nombre: 'Ficticio',
        emailPrincipal: 'qa@example.invalid',
        telefonoCodigo: '1',
        telefonoNumero: '2025550100',
        paisCodigo: 'US',
      },
    });
    const vinculos = {
      CLIENTE: { clienteId },
      COTIZACION: { cotizacionId },
      ORDEN: { ordenId },
      ORDEN_ITEM: { ordenItemId: item.id },
      CAMPANA: { proyectoCampanaId: campana.id },
      COMPROBANTE: { comprobanteId: comprobante.id },
      COBRO: { cobroId: cobro.id },
      EGRESO: { egresoId: egreso.id },
      PRODUCTO: { productoId: producto.id },
      PROVEEDOR: { proveedorId: proveedor.id },
      TENANT_BRANDING: {},
      INBOX: {},
    };
    for (const scope of Object.values(ArchivoScope)) {
      const archivo = await prisma.archivo.create({
        data: {
          tenantId: tenantIds[0],
          scope,
          key: `qa/${randomUUID()}`,
          nombreOriginal: 'archivo-ficticio.png',
          mimeType: 'image/png',
          bytes: 20,
          estado: 'LISTO',
          ...vinculos[scope],
        },
      });
      archivos.set(scope, archivo.id);
    }
    ajenoId = (
      await prisma.archivo.create({
        data: {
          tenantId: tenantIds[1],
          scope: 'TENANT_BRANDING',
          key: `qa/${randomUUID()}`,
          nombreOriginal: 'logo-ajeno.png',
          mimeType: 'image/png',
          bytes: 20,
          estado: 'LISTO',
        },
      })
    ).id;
    await usuario('operario', ['produccion.ver', 'produccion.ejecutar']);
    await usuario('lector', ['crm.ver']);
    await usuario('comercial', [
      'comercial.gestionar',
      'crm.gestionar',
      'administracion.cobrar',
      'produccion.ver',
    ]);
    await usuario('admin', todosLosPermisos());
    await usuario('sin-permisos', []);
    await usuario('inbox', ['inbox.atender']);
    await usuario('otra-empresa', todosLosPermisos(), tenantIds[1]);
    const modulo = await Test.createTestingModule({
      controllers: [ArchivosController],
      providers: [
        { provide: ArchivosService, useValue: service },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = modulo.createNestApplication<INestApplication<Server>>();
    const reflector = new Reflector();
    app.useGlobalGuards(
      new AuthGuard(reflector, jwt, prisma, cache),
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
  beforeEach(() => jest.clearAllMocks());
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
    await prisma.productoSubcategoriaComercial.deleteMany({
      where: { id: subcategoriaId },
    });
    await prisma.productoCategoriaComercial.deleteMany({
      where: { id: categoriaId },
    });
    await prisma.$disconnect();
  });
  const get = (path: string, actor: string) =>
    request(app.getHttpServer())
      .get(path)
      .auth(tokens[actor], { type: 'bearer' });
  const post = (path: string, actor: string, body = {}) =>
    request(app.getHttpServer())
      .post(path)
      .auth(tokens[actor], { type: 'bearer' })
      .send(body);

  it('exige autenticación incluso para el logo', async () => {
    await request(app.getHttpServer())
      .get(`/archivos/${archivos.get('TENANT_BRANDING')}/contenido`)
      .expect(401);
    expect(storage.firmarDescarga).not.toHaveBeenCalled();
  });
  it.each([
    'CLIENTE',
    'COTIZACION',
    'CAMPANA',
    'COMPROBANTE',
    'COBRO',
    'EGRESO',
    'PRODUCTO',
    'PROVEEDOR',
  ] as ArchivoScope[])('el operario no descarga %s', async (scope) => {
    await get(`/archivos/${archivos.get(scope)}/contenido`, 'operario').expect(
      403,
    );
    expect(storage.firmarDescarga).not.toHaveBeenCalled();
  });
  it.each(['', '/papelera'])(
    'el operario no enumera adjuntos de clientes en %s',
    async (ruta) => {
      await get(
        `/archivos${ruta}?scope=CLIENTE&entidadId=${clienteId}`,
        'operario',
      ).expect(403);
    },
  );
  it('el lector puede leer los adjuntos de su módulo', async () => {
    await get(`/archivos?scope=CLIENTE&entidadId=${clienteId}`, 'lector')
      .expect(200)
      .expect(({ body }: { body: Array<{ id: string }> }) =>
        expect(body.map((a) => a.id)).toEqual([archivos.get('CLIENTE')]),
      );
    await get(
      `/archivos/${archivos.get('CLIENTE')}/contenido`,
      'lector',
    ).expect(302);
    expect(storage.firmarDescarga).toHaveBeenCalledTimes(1);
  });
  it.each([
    'CLIENTE',
    'COTIZACION',
    'CAMPANA',
    'COMPROBANTE',
    'COBRO',
    'EGRESO',
    'PRODUCTO',
    'PROVEEDOR',
  ] as ArchivoScope[])(
    'el administrador conserva la descarga de %s',
    async (scope) => {
      await get(`/archivos/${archivos.get(scope)}/contenido`, 'admin').expect(
        302,
      );
      expect(storage.firmarDescarga).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    'scope=DESCONOCIDO',
    'scope=CLIENTE&scope=ORDEN',
    'scope[toString]=ORDEN',
  ])(
    'rechaza un scope inválido antes de consultar archivos: %s',
    async (query) => {
      await get(`/archivos?${query}&entidadId=${clienteId}`, 'admin').expect(
        400,
      );
    },
  );
  it('no usa el scope del body para autorizar una modificación por id', async () => {
    await request(app.getHttpServer())
      .patch(`/archivos/${archivos.get('CLIENTE')}`)
      .auth(tokens.operario, { type: 'bearer' })
      .send({ scope: 'ORDEN', publico: true })
      .expect(403);
  });
  it('leer no habilita subir', async () => {
    await post('/archivos/iniciar', 'lector', {
      scope: 'CLIENTE',
      entidadId: clienteId,
      nombre: 'foto.png',
      mimeType: 'image/png',
      bytes: 20,
    }).expect(403);
    expect(storage.firmarSubida).not.toHaveBeenCalled();
  });
  it.each(['confirmar', 'cancelar-subida', 'restaurar'])(
    'leer no habilita %s',
    async (accion) => {
      await post(
        `/archivos/${archivos.get('CLIENTE')}/${accion}`,
        'lector',
      ).expect(403);
      expect(storage.cabecera).not.toHaveBeenCalled();
      expect(storage.borrar).not.toHaveBeenCalled();
    },
  );
  it('leer no habilita modificar ni eliminar; la fila queda intacta', async () => {
    const id = archivos.get('CLIENTE')!;
    const antes = await prisma.archivo.findUniqueOrThrow({ where: { id } });
    await request(app.getHttpServer())
      .patch(`/archivos/${id}`)
      .auth(tokens.lector, { type: 'bearer' })
      .send({ publico: true })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/archivos/${id}`)
      .auth(tokens.lector, { type: 'bearer' })
      .expect(403);
    expect(await prisma.archivo.findUniqueOrThrow({ where: { id } })).toEqual(
      antes,
    );
  });
  it('no se puede falsificar el scope de un archivo en la descarga', async () => {
    await get(
      `/archivos/${archivos.get('EGRESO')}/contenido?scope=ORDEN`,
      'operario',
    ).expect(403);
    expect(storage.firmarDescarga).not.toHaveBeenCalled();
  });
  it.each(['', '/papelera'])(
    'los adjuntos Inbox no se enumeran por la ruta genérica %s',
    async (ruta) => {
      await get(
        `/archivos${ruta}?scope=INBOX&entidadId=${randomUUID()}`,
        'inbox',
      ).expect(403);
      await get(
        `/archivos${ruta}?scope=INBOX&entidadId=${randomUUID()}`,
        'admin',
      ).expect(403);
    },
  );
  it('los adjuntos Inbox se descargan sólo por su circuito autorizado', async () => {
    await get(`/archivos/${archivos.get('INBOX')}/contenido`, 'admin').expect(
      404,
    );
    expect(storage.firmarDescarga).not.toHaveBeenCalled();
  });
  it('la vista agrupada de la orden exige permisos de producción', async () => {
    await get(`/archivos/de-orden/${ordenId}`, 'lector').expect(403);
    await get(`/archivos/de-orden/${ordenId}`, 'operario').expect(200);
  });
  it('el operario conserva la carga y confirmación de archivos de producción', async () => {
    const inicio = await post('/archivos/iniciar', 'operario', {
      scope: 'ORDEN',
      entidadId: ordenId,
      nombre: 'foto.png',
      mimeType: 'image/png',
      bytes: 20,
    }).expect(201);
    const { archivoId } = inicio.body as { archivoId: string };
    await post(`/archivos/${archivoId}/confirmar`, 'operario').expect(201);
    await get(`/archivos/${archivoId}/contenido`, 'operario').expect(302);
    expect(storage.firmarSubida).toHaveBeenCalledTimes(1);
  });
  it('cobrar permite leer el comprobante del cobro sin abrir los egresos', async () => {
    await get(
      `/archivos/${archivos.get('COBRO')}/contenido`,
      'comercial',
    ).expect(302);
    await get(
      `/archivos/${archivos.get('EGRESO')}/contenido`,
      'comercial',
    ).expect(403);
  });
  it('todos ven el logo pero sólo configuración puede subirlo', async () => {
    await get(
      `/archivos/${archivos.get('TENANT_BRANDING')}/contenido`,
      'sin-permisos',
    ).expect(302);
    await post('/archivos/iniciar', 'sin-permisos', {
      scope: 'TENANT_BRANDING',
      nombre: 'logo.png',
      mimeType: 'image/png',
      bytes: 20,
    }).expect(403);
    await post('/archivos/iniciar', 'admin', {
      scope: 'TENANT_BRANDING',
      nombre: 'logo.png',
      mimeType: 'image/png',
      bytes: 20,
    }).expect(201);
  });
  it('el uso de espacio sigue disponible sin revelar nombres de archivos', async () => {
    await get('/archivos/uso', 'sin-permisos')
      .expect(200)
      .expect(({ text }: { text: string }) =>
        expect(text).not.toContain('archivo-ficticio'),
      );
  });
  it('un administrador no descarga ni modifica el archivo de otra empresa', async () => {
    const antes = await prisma.archivo.findUniqueOrThrow({
      where: { id: ajenoId },
    });
    await get(`/archivos/${ajenoId}/contenido`, 'admin').expect(404);
    await request(app.getHttpServer())
      .patch(`/archivos/${ajenoId}`)
      .auth(tokens.admin, { type: 'bearer' })
      .send({ publico: true })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/archivos/${ajenoId}`)
      .auth(tokens.admin, { type: 'bearer' })
      .expect(404);
    for (const accion of ['confirmar', 'cancelar-subida', 'restaurar'])
      await post(`/archivos/${ajenoId}/${accion}`, 'admin').expect(404);
    expect(
      await prisma.archivo.findUniqueOrThrow({ where: { id: ajenoId } }),
    ).toEqual(antes);
    expect(storage.firmarDescarga).not.toHaveBeenCalled();
  });
  it('el administrador de otra empresa no enumera ni adjunta al cliente ajeno', async () => {
    await get(
      `/archivos?scope=CLIENTE&entidadId=${clienteId}`,
      'otra-empresa',
    ).expect(200, []);
    await post('/archivos/iniciar', 'otra-empresa', {
      scope: 'CLIENTE',
      entidadId: clienteId,
      nombre: 'foto.png',
      mimeType: 'image/png',
      bytes: 20,
    }).expect(404);
    expect(storage.firmarSubida).not.toHaveBeenCalled();
  });
});
