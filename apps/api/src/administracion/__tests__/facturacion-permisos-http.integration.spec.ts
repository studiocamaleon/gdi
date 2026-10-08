import { FacturacionLotesService } from '../facturacion-lotes.service';
import { FacturacionLotesController } from '../facturacion-lotes.controller';
import { EventosSistemaService } from '../../eventos-sistema/eventos-sistema.service';
import { runWithTenant } from '../../common/tenant-context';
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
import type { EmitirInput, EmitirResultado } from '../invoicing/invoicing-provider';

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
  const emitir = jest.fn(async (input: EmitirInput): Promise<EmitirResultado> => {
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
  let generarAviso = false;
  let lotes: FacturacionLotesService;
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
        publicarParaLote: jest.fn(async (tenantId: string, comprobanteId: string) => {
          if (!generarAviso) return { encolada: false, motivo: 'Avisos desactivados en el ensayo.' };
          const aviso = await prisma.notificacionWhatsapp.create({ data: {
            tenantId, evento: 'comprobante_emitido', claveUnica: `comprobante_emitido:${comprobanteId}`,
            telefono: '5491100000000', plantilla: 'ficticia', parametros: [],
          } });
          return { encolada: true, id: aviso.id };
        }),
      },
    ) as ComprobantesService;
    lotes = new FacturacionLotesService(prisma, servicio, emisiones, new EventosSistemaService(prisma), capacidades);
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
      controllers: [AdministracionController, FacturacionLotesController],
      providers: [
        { provide: FacturacionLotesService, useValue: lotes },
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
  async function avanzarLote(id: string) {
    const lote = await prisma.facturacionLote.findUniqueOrThrow({ where: { id } });
    const propio = { ...lote, leaseToken: randomUUID() };
    await prisma.facturacionLote.update({ where: { id }, data: { leaseToken: propio.leaseToken, leaseHasta: new Date(Date.now() + 120_000) } });
    try { await lotes.procesar(propio); } finally { await lotes.liberar(propio, 0); }
  }
  it.each(['por_orden', 'agrupada'])(
    'acepta un lote %s sin emitir en HTTP, lo recupera y notifica sólo al iniciador',
    async modo => {
      const ordenes = await Promise.all([orden(), orden()]);
      const inicio = emitir.mock.calls.length;
      const body = { modo, claveSolicitud: randomUUID(), ordenIds: ordenes.map(o => o.id) };
      const res = await post('facturacion/lote', 'facturador').send(body).expect(202);
      expect(res.body.items).toHaveLength(modo === 'agrupada' ? 1 : 2);
      expect(res.body.leaseToken).toBeUndefined();
      expect(res.body.solicitudJson).toBeUndefined();
      expect(emitir.mock.calls.length).toBe(inicio);
      const repetido = await post('facturacion/lote', 'facturador').send(body).expect(202);
      expect(repetido.body.id).toBe(res.body.id);
      await post('facturacion/lote', 'facturador').send({ ...body, detalle: modo === 'agrupada' ? 'items' : 'orden' }).expect(409);
      await post('facturacion/lote', 'facturador').send({ ...body, claveSolicitud: randomUUID() }).expect(409);
      for (let paso = 0; paso < 8; paso++) await avanzarLote(res.body.id);
      const final = await prisma.facturacionLote.findUniqueOrThrow({ where: { id: res.body.id }, include: { items: true } });
      expect(final.estado).toBe('con_observaciones'); // avisos intencionalmente apagados
      expect(final.items.every(i => i.estado === 'emitida' && i.avisoEstado === 'omitida')).toBe(true);
      expect(emitir.mock.calls.length - inicio).toBe(modo === 'agrupada' ? 1 : 2);
      const eventos = await prisma.eventoSistema.findMany({ where: { entidadId: res.body.id }, include: { notificaciones: true } });
      expect(eventos).toHaveLength(1);
      expect(eventos[0].notificaciones.map(n => n.userId)).toEqual([final.userId]);
      expect(eventos[0].titulo).not.toContain('envíos completados');
      await request(app.getHttpServer()).get(`/administracion/facturacion/lotes/${res.body.id}`).auth(tokens.administrador, { type: 'bearer' }).expect(404);
    },
  );
  it('espera confirmación del envío, sobrevive a recuperar el item y notifica éxito una sola vez', async () => {
    generarAviso = true;
    try {
      const ot = await orden();
      const inicio = emitir.mock.calls.length;
      const res = await post('facturacion/lotes', 'facturador').send({ modo: 'por_orden', claveSolicitud: randomUUID(), ordenIds: [ot.id] }).expect(202);
      const id = res.body.id;
      await avanzarLote(id); // ARCA confirmó, el worker puede morir acá.
      await prisma.facturacionLoteItem.updateMany({ where: { loteId: id }, data: { estado: 'emitiendo' } });
      await avanzarLote(id); // Recupera la factura emitida, sin un segundo POST fiscal.
      expect(emitir.mock.calls.length - inicio).toBe(1);
      await avanzarLote(id); // Encola el aviso.
      await avanzarLote(id); // Pendiente todavía no es éxito.
      expect(await prisma.eventoSistema.count({ where: { entidadId: id } })).toBe(0);
      const item = await prisma.facturacionLoteItem.findFirstOrThrow({ where: { loteId: id } });
      await prisma.notificacionWhatsapp.updateMany({ where: { claveUnica: `comprobante_emitido:${item.comprobanteId}` }, data: { estado: 'enviada' } });
      await avanzarLote(id);
      await avanzarLote(id);
      await avanzarLote(id);
      const final = await prisma.facturacionLote.findUniqueOrThrow({ where: { id } });
      expect(final.estado).toBe('completado');
      expect(await prisma.eventoSistema.count({ where: { entidadId: id, severidad: 'EXITO' } })).toBe(1);
    } finally { generarAviso = false; }
  });

  it('conserva resultados parciales y muestra el rechazo fiscal sin deshacer la otra factura', async () => {
    const ordenes = await Promise.all([orden(), orden()]);
    const res = await post('facturacion/lotes', 'facturador').send({ modo: 'por_orden', claveSolicitud: randomUUID(), ordenIds: ordenes.map(o => o.id) }).expect(202);
    emitir.mockResolvedValueOnce({ estado: 'rechazado', errores: ['Receptor ficticio inválido.'], raw: {} });
    for (let i = 0; i < 7; i++) await avanzarLote(res.body.id);
    const items = await prisma.facturacionLoteItem.findMany({ where: { loteId: res.body.id }, orderBy: { posicion: 'asc' } });
    expect(items.map(i => i.estado)).toEqual(['error', 'emitida']);
    expect(items[0].error).toContain('Receptor ficticio inválido');
    expect(await prisma.eventoSistema.count({ where: { entidadId: res.body.id, severidad: 'ADVERTENCIA' } })).toBe(1);
  });

  it('no reenvía un resultado fiscal incierto y detiene las otras órdenes del lote', async () => {
    const ordenes = await Promise.all([orden(), orden()]);
    const res = await post('facturacion/lotes', 'facturador').send({ modo: 'por_orden', claveSolicitud: randomUUID(), ordenIds: ordenes.map(o => o.id) }).expect(202);
    const inicio = emitir.mock.calls.length;
    emitir.mockRejectedValueOnce(new Error('Timeout ficticio después del envío'));
    await avanzarLote(res.body.id);
    const item = await prisma.facturacionLoteItem.findFirstOrThrow({ where: { loteId: res.body.id, posicion: 0 } });
    await prisma.comprobanteEmision.updateMany({ where: { comprobanteId: item.comprobanteId! }, data: { creadaEl: new Date(Date.now() - 240_000) } });
    await avanzarLote(res.body.id);
    await avanzarLote(res.body.id);
    expect(emitir.mock.calls.length - inicio).toBe(1);
    const items = await prisma.facturacionLoteItem.findMany({ where: { loteId: res.body.id }, orderBy: { posicion: 'asc' } });
    expect(items.map(i => i.estado)).toEqual(['verificar', 'error']);
    expect(items[1].comprobanteId).toBeNull();
    // Libera sólo el intento ficticio para los otros ensayos fiscales de esta empresa.
    await prisma.comprobanteEmision.updateMany({ where: { comprobanteId: item.comprobanteId! }, data: { estado: 'rechazado', serieActiva: null } });
    await prisma.comprobante.update({ where: { id: item.comprobanteId! }, data: { estado: 'rechazado', numero: null } });
  });

  it('revalida permisos antes de emitir y distribuye leases sin tomar dos lotes de la empresa', async () => {
    const ordenes = await Promise.all([orden(), orden()]);
    const ids: string[] = [];
    for (const ot of ordenes) {
      const res = await post('facturacion/lotes', 'facturador').send({ modo: 'por_orden', claveSolicitud: randomUUID(), ordenIds: [ot.id] }).expect(202);
      ids.push(res.body.id);
    }
    const claims = await Promise.all([lotes.reclamar(), lotes.reclamar()]);
    const reclamados = claims.filter((l): l is NonNullable<typeof l> => Boolean(l));
    expect(reclamados.filter(l => l.tenantId === tenants[0])).toHaveLength(1);
    const reclamado = reclamados.find(l => ids.includes(l.id))!;
    expect(reclamado).toBeDefined();
    const lote = await prisma.facturacionLote.findUniqueOrThrow({ where: { id: reclamado.id } });
    const miembro = await prisma.membership.findFirstOrThrow({ where: { tenantId: lote.tenantId, userId: lote.userId } });
    await prisma.membership.update({ where: { id: miembro.id }, data: { activa: false } });
    const inicio = emitir.mock.calls.length;
    try {
      await lotes.procesar(reclamado);
      expect(emitir.mock.calls.length).toBe(inicio);
      const item = await prisma.facturacionLoteItem.findFirstOrThrow({ where: { loteId: lote.id } });
      expect(item.estado).toBe('error');
      expect(item.error).toContain('ya no tiene acceso');
    } finally {
      await prisma.membership.update({ where: { id: miembro.id }, data: { activa: true } });
      await lotes.liberar(reclamado);
      await prisma.facturacionLote.updateMany({ where: { id: { in: ids } }, data: { estado: 'con_observaciones' } });
    }
  });

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
      .send({ modo: 'agrupada', claveSolicitud: randomUUID(), ordenIds: [ot.id] })
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
