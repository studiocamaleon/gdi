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
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { AdministracionController } from '../administracion.controller';
import { ComprobantesService } from '../comprobantes.service';
import { FacturacionOrdenesService } from '../facturacion-ordenes.service';
import { EmisionFiscalService } from '../emision-fiscal.service';
import { ManualProvider } from '../invoicing/manual.provider';
import type { AfipSdkProvider } from '../invoicing/afip-sdk.provider';
import type { EmitirInput } from '../invoicing/invoicing-provider';

/** HTTP, roles persistidos, servicios fiscales y PostgreSQL reales.
 * ARCA se sustituye por un proveedor ficticio; no hay red fiscal, PDF ni avisos. */
describe('Facturación con permisos por vista (HTTP)', () => {
  const prisma = new PrismaService();
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const puntos: string[] = [];
  const tokens: Record<string, string> = {};
  const secretAnterior = process.env.JWT_SECRET;
  const secret = randomUUID();
  const jwt = new JwtService({ secret });
  const capacidades = capacidadesDePrueba();
  const ultimos = new Map<string, number>();
  const emitir = jest.fn(async (input: EmitirInput) => {
    ultimos.set(
      `${input.puntoVenta}:${input.tipo}:${input.letra}`,
      input.numero!,
    );
    return {
      estado: 'emitido' as const,
      numero: input.numero!,
      cae: '12345678901234',
      caeVencimiento: '2026-12-31',
      raw: {},
    };
  });
  const provider = {
    codigo: 'afipsdk',
    disponible: true,
    environment: 'dev',
    cuitOperativo: (cuit: string) => cuit,
    ultimoNumero: async (pv: number, tipo: string, letra: string) =>
      ultimos.get(`${pv}:${tipo}:${letra}`) ?? 0,
    emitir,
  } as unknown as AfipSdkProvider;
  let app: INestApplication<Server>;
  let baseValidada = false;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Requiere base local de test con aislamiento activo.');
    baseValidada = true;
    process.env.JWT_SECRET = secret;
    await prisma.$connect();
    for (const [i, tenantId] of tenants.entries()) {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          slug: `qa-fiscal-${tenantId}`,
          nombre: 'Empresa fiscal ficticia',
        },
      });
      const fiscal = await prisma.configuracionFiscal.create({
        data: {
          tenantId,
          razonSocial: 'Emisor ficticio',
          cuit: '30000000015',
          condicionFiscal: 'RI',
          proveedorFacturacion: 'afipsdk',
        },
      });
      const punto = await prisma.puntoVenta.create({
        data: {
          tenantId,
          configuracionFiscalId: fiscal.id,
          numero: i + 1,
          nombre: 'Punto ficticio',
          modalidad: 'web_services',
        },
      });
      puntos.push(punto.id);
      await prisma.integracionTenant.create({
        data: {
          tenantId,
          proveedor: 'AFIP',
          estado: 'CONECTADA',
        },
      });
    }
    for (const [actor, permisos] of Object.entries({
      administrador: [
        'acceso.por_vista',
        'administracion.facturacion.gestionar',
        'administracion.comprobantes.gestionar',
        'administracion.anular',
      ],
      facturador: ['acceso.por_vista', 'administracion.facturacion.gestionar'],
      comprobantes: [
        'acceso.por_vista',
        'administracion.comprobantes.gestionar',
      ],
      lector: [
        'acceso.por_vista',
        'administracion.facturacion.ver',
        'administracion.comprobantes.ver',
      ],
      anulador: [
        'acceso.por_vista',
        'administracion.anular',
        'administracion.facturacion.ver',
      ],
      legado: ['administracion.gestionar'],
      sinAcceso: ['acceso.por_vista'],
    })) {
      const user = await prisma.user.create({
        data: { email: `qa-fiscal-${randomUUID()}@example.invalid` },
      });
      users.push(user.id);
      const rol = await prisma.rol.create({
        data: { tenantId: tenants[0], nombre: actor, permisos },
      });
      const miembro = await prisma.membership.create({
        data: {
          tenantId: tenants[0],
          userId: user.id,
          rol: 'ADMINISTRADOR',
          rolId: rol.id,
        },
      });
      const sesion = await prisma.authSession.create({
        data: {
          userId: user.id,
          currentTenantId: tenants[0],
          currentMembershipId: miembro.id,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      tokens[actor] = jwt.sign({
        sub: user.id,
        email: user.email,
        sessionId: sesion.id,
        tenantId: tenants[0],
        membershipId: miembro.id,
        role: 'ADMINISTRADOR',
      });
    }
    const facturacion = new FacturacionOrdenesService(prisma);
    const emisiones = new EmisionFiscalService(
      prisma,
      new ManualProvider(),
      provider,
      facturacion,
      capacidades,
    );
    const servicio = Object.assign(
      Object.create(ComprobantesService.prototype),
      {
        prisma,
        capacidades,
        emisiones,
        afipIntegracion: { facturacionHabilitada: async () => true },
        congelarPdf: jest.fn(),
        publicar: jest.fn(),
      },
    ) as ComprobantesService;
    const noUsado = new Proxy(
      {},
      {
        get: (_target, key) =>
          [
            'then',
            'onModuleInit',
            'onModuleDestroy',
            'onApplicationBootstrap',
            'beforeApplicationShutdown',
            'onApplicationShutdown',
          ].includes(String(key))
            ? undefined
            : () => {
                throw new Error('Dependencia externa fuera del ensayo');
              },
      },
    );
    const dependencias = Reflect.getMetadata(
      'design:paramtypes',
      AdministracionController,
    ) as Array<new (...args: never[]) => unknown>;
    const modulo = await Test.createTestingModule({
      controllers: [AdministracionController],
      providers: [
        { provide: CapacidadesEmpresaService, useValue: capacidades },
        ...dependencias.map((provide) => ({
          provide,
          useValue: provide === ComprobantesService ? servicio : noUsado,
        })),
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
  const post = (ruta: string, actor = 'administrador') =>
    request(app.getHttpServer())
      .post(`/administracion/${ruta}`)
      .auth(tokens[actor], { type: 'bearer' })
      .set('x-tenant-id', tenants[1]);
  const orden = (empresa = 0) =>
    prisma.ordenTrabajo.create({
      data: {
        tenantId: tenants[empresa],
        numero: `OT-${randomUUID()}`,
        estado: 'finalizada',
        subtotal: 100,
        impuestos: 21,
        total: 121,
      },
    });
  const payload = (empresa = 0) => ({
    tipo: 'factura',
    puntoVentaId: puntos[empresa],
    items: [
      {
        descripcion: 'Impresión ficticia',
        cantidad: 1,
        precioUnitarioSinIva: 121,
        alicuotaIva: 21,
      },
    ],
  });
  async function borrador(empresa = 0, tipo = 'factura') {
    return prisma.comprobante.create({
      data: {
        tenantId: tenants[empresa],
        puntoVentaId: puntos[empresa],
        tipo,
        letra: 'B',
        fecha: new Date(),
        receptorSnapshot: {
          nombre: 'Consumidor Final',
          condicionFiscal: 'consumidor_final',
        },
        itemsJson: payload().items,
        netoGravado: 100,
        ivaTotal: 21,
        ivaPorAlicuota: [],
        total: 121,
        saldoPendiente: 121,
        idempotencyKey: randomUUID(),
      },
    });
  }

  it.each(['administrador', 'facturador', 'legado'])(
    '%s factura una OT hasta obtener el CAE ficticio',
    async (actor) => {
      const ot = await orden();
      const inicio = emitir.mock.calls.length;
      const res = await post(`ordenes/${ot.id}/facturar`, actor).send({});
      expect(res.body.message).toBeUndefined();
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        estado: 'emitido',
        total: 121,
        cae: '12345678901234',
      });
      expect(emitir.mock.calls.length).toBe(inicio + 1);
      const actual = await prisma.ordenTrabajo.findUniqueOrThrow({
        where: { id: ot.id },
      });
      expect(Number(actual.facturadoTotal)).toBe(121);
    },
  );
  it.each(['por_orden', 'agrupada'])(
    'factura un lote %s con sólo el permiso de facturación',
    async (modo) => {
      const ordenes = await Promise.all([orden(), orden()]);
      const inicio = emitir.mock.calls.length;
      const res = await post('facturacion/lote', 'facturador').send({
        modo,
        ordenIds: ordenes.map((o) => o.id),
      });
      expect(res.status).toBe(201);
      expect(res.body.resultados).toHaveLength(2);
      expect(res.body.resultados.every((r: { ok: boolean }) => r.ok)).toBe(
        true,
      );
      expect(emitir.mock.calls.length - inicio).toBe(
        modo === 'agrupada' ? 1 : 2,
      );
    },
  );
  it('gestión de comprobantes crea, emite y consulta sin Administración global', async () => {
    const creado = await post('comprobantes', 'comprobantes').send(payload());
    expect(creado.status).toBe(201);
    const res = await post(
      `comprobantes/${creado.body.id}/emitir`,
      'comprobantes',
    ).send({});
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('emitido');
    const consulta = await post(
      `comprobantes/${creado.body.id}/consultar-emision`,
      'comprobantes',
    ).send({});
    expect(consulta.status).toBe(201);
    expect(consulta.body.comprobante.estado).toBe('emitido');
  });
  it.each(['lector', 'sinAcceso', 'anulador', 'comprobantes'])(
    '%s no puede facturar órdenes sin el permiso correspondiente',
    async (actor) => {
      const ot = await orden();
      const inicio = emitir.mock.calls.length;
      await post(`ordenes/${ot.id}/facturar`, actor).send({}).expect(403);
      await post('facturacion/lote', actor)
        .send({ modo: 'por_orden', ordenIds: [ot.id] })
        .expect(403);
      expect(
        await prisma.comprobanteOrden.count({ where: { ordenId: ot.id } }),
      ).toBe(0);
      expect(emitir.mock.calls.length).toBe(inicio);
    },
  );
  it.each(['lector', 'sinAcceso', 'anulador', 'facturador'])(
    '%s no crea ni emite facturas generales',
    async (actor) => {
      const c = await borrador();
      const inicio = emitir.mock.calls.length;
      await post('comprobantes', actor).send(payload()).expect(403);
      await post(`comprobantes/${c.id}/emitir`, actor).send({}).expect(403);
      await post(`comprobantes/${c.id}/consultar-emision`, actor)
        .send({})
        .expect(403);
      expect(emitir.mock.calls.length).toBe(inicio);
    },
  );
  it('gestionar comprobantes no autoriza crear, emitir ni consultar notas de crédito', async () => {
    const c = await borrador(0, 'nota_credito');
    const inicio = emitir.mock.calls.length;
    await post('comprobantes', 'comprobantes')
      .send({ ...payload(), tipo: 'nota_credito' })
      .expect(403);
    await post(`comprobantes/${c.id}/emitir`, 'comprobantes')
      .send({})
      .expect(403);
    await post(`comprobantes/${c.id}/consultar-emision`, 'comprobantes')
      .send({})
      .expect(403);
    expect(emitir.mock.calls.length).toBe(inicio);
  });
  it('el permiso de anular permite una NC contra la factura de la OT', async () => {
    const ot = await orden();
    const factura = await post(`ordenes/${ot.id}/facturar`)
      .send({})
      .expect(201);
    const res = await post(`ordenes/${ot.id}/nota-credito`, 'anulador').send({
      comprobanteOrigenId: factura.body.id,
      motivo: 'Corrección ficticia',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      tipo: 'nota_credito',
      estado: 'emitido',
      total: 121,
    });
  });
  it('rechaza órdenes, puntos de venta y comprobantes de otra empresa antes de ARCA', async () => {
    const ot = await orden(1);
    const c = await borrador(1);
    const inicio = emitir.mock.calls.length;
    await post(`ordenes/${ot.id}/facturar`).send({}).expect(404);
    await post('facturacion/lote')
      .send({ modo: 'agrupada', ordenIds: [ot.id] })
      .expect(400);
    await post('comprobantes').send(payload(1)).expect(400);
    await post(`comprobantes/${c.id}/emitir`).send({}).expect(404);
    await post(`comprobantes/${c.id}/consultar-emision`).send({}).expect(404);
    expect(emitir.mock.calls.length).toBe(inicio);
    expect(
      await prisma.comprobanteEmision.count({
        where: { tenantId: tenants[1] },
      }),
    ).toBe(0);
  });
});
