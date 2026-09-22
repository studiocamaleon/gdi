/* Los transportes simulados conservan la interfaz async; los matchers de Jest
 * devuelven any por diseño. La base y las transacciones son reales. */
/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment */
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { PlanesOfertasService } from '../../plataforma/planes/planes-ofertas.service';
import { PROPUESTA_PLANES } from '../../plataforma/planes/catalogo-planes';
import { SuscripcionSyncService } from '../../cobro/suscripcion-sync.service';
import { TenantProvisioningService } from '../../provisionamiento/tenant-provisioning.service';
import { ContratacionService } from '../contratacion.service';
import type { SeleccionContratacion } from '../contratacion-tipos';
import { runWithTenant } from '../../common/tenant-context';
import { SuscripcionesService } from '../suscripciones.service';
import { bloquearCupoUsuarios, exigirCupoUsuario } from '../cupos-usuarios';
import { exigirEspacio } from '../../archivos/cupo-almacenamiento';
import { PlanesAsignacionService } from '../../plataforma/planes/planes-asignacion.service';
import { SuscripcionesPlataformaService } from '../../plataforma/suscripciones-plataforma.service';
import { PlataformaService } from '../../plataforma/plataforma.service';
import { ordenImpresionFixture } from '../../../test/fixture-impresion-planes';
import { CapacidadesEmpresaService } from '../capacidades-empresa.service';
import { ConsultaContratacionService } from '../consulta-contratacion.service';
import { ContratacionesPlataformaService } from '../../plataforma/contrataciones-plataforma.service';

const prisma = new PrismaService();
beforeAll(() => {
  process.env.PADDLE_ENV = 'sandbox';
});
afterAll(() => prisma.$disconnect());
type Ctx = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];

async function escenario(c: Ctx) {
  const version = await c.publicar({
    ...structuredClone(PROPUESTA_PLANES[0].contenido),
    almacenamientoModo: 'limitado',
    almacenamientoGb: 250,
    precios: {
      moneda: 'USD',
      mensual: 190,
      anual: null,
      usuarioMensual: 15,
      usuarioAnual: null,
    },
  });
  const base = `pri_${randomUUID().replaceAll('-', '').slice(0, 26)}`;
  const extra = `pri_${randomUUID().replaceAll('-', '').slice(0, 26)}`;
  let contratacionId = '';
  let tenantId = '';
  let pagado = false;
  let cancelado = false;
  let remotos = [{ priceId: base, quantity: 1 }];
  let revision = 1;
  const payload = () => ({
    id: 'sub_contratacion_prueba',
    status: 'active',
    updatedAt: new Date(Date.UTC(2026, 8, 21, 12, revision)).toISOString(),
    customData: { tenantId, contratacionId },
    items: remotos.map((i) => ({
      price: { id: i.priceId },
      quantity: i.quantity,
    })),
  });
  const transaccion = () => ({
    id: 'txn_contratacion_prueba',
    status: cancelado ? 'canceled' : pagado ? 'completed' : 'ready',
    subscriptionId: pagado ? 'sub_contratacion_prueba' : null,
    items: remotos.map((i) => ({
      price: { id: i.priceId },
      quantity: i.quantity,
    })),
    customData: { tenantId, contratacionId },
  });
  const paddle = {
    habilitado: true,
    entorno: 'sandbox',
    leerPrecioOferta: jest.fn(async (id: string) => ({
      status: 'active',
      type: 'standard',
      taxMode: 'external',
      product: { status: 'active' },
      productId: 'pro_prueba',
      unitPrice: {
        amount: id === base ? '19000' : '1500',
        currencyCode: 'USD',
      },
      billingCycle: { frequency: 1, interval: 'month' },
      trialPeriod: null,
      unitPriceOverrides: [],
      quantity: { minimum: 1, maximum: 999 },
    })),
    obtenerSuscripcion: jest.fn(async () => payload()),
    previsualizarItems: jest.fn(async () => ({
      aCobrar: 7.5,
      aCredito: 0,
      moneda: 'USD',
      impuestosEnCheckout: false,
    })),
    cambiarItems: jest.fn(async (_ref: string, items: typeof remotos) => {
      remotos = items;
      revision++;
      return payload();
    }),
    crearCheckoutContratacion: jest.fn(
      async (items: typeof remotos, _tenant: string, id: string) => {
        remotos = items;
        contratacionId = id;
        return transaccion();
      },
    ),
    suscripcionDeTransaccion: jest.fn(async () => (pagado ? payload() : null)),
    leerCheckoutContratacion: jest.fn(async () => transaccion()),
    cancelarCheckoutContratacion: jest.fn(async () => {
      cancelado = true;
      return transaccion();
    }),
    buscarCheckoutContratacion: jest.fn(async () =>
      contratacionId ? transaccion() : null,
    ),
    esRechazoDefinitivo: (error: unknown) =>
      error instanceof Error &&
      'type' in error &&
      error.type === 'request_error',
  };
  const oferta = await new PlanesOfertasService(c.db, paddle as never).activar(
    c.staff,
    {
      versionId: version.id,
      entorno: 'sandbox',
      revision: 0,
      registroPublico: true,
      recomendado: false,
      trialDias: 14,
      motivo: 'Prueba de contratación completa',
      precios: [
        { tipo: 'base', ciclo: 'mensual', priceId: base },
        { tipo: 'usuario', ciclo: 'mensual', priceId: extra },
      ],
    },
  );
  const o = await c.tx.planOferta.findUniqueOrThrow({
    where: { id: oferta.actual!.ofertaId },
  });
  const alta = await new TenantProvisioningService().provisionarBase(c.tx, {
    nombre: 'Contratación de prueba',
    plan: { id: o.planId, trialDias: 14 },
    origen: 'registro_publico',
  });
  tenantId = alta.tenantId;
  const miembro = await c.tx.membership.create({
    data: {
      tenantId,
      userId: c.auth.userId,
      rol: 'ADMINISTRADOR',
      rolId: alta.administradorRolId,
    },
  });
  const sesion = await c.tx.authSession.create({
    data: {
      userId: c.auth.userId,
      currentTenantId: tenantId,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const auth = {
    ...c.auth,
    tenantId,
    membershipId: miembro.id,
    sessionId: sesion.id,
  };
  const sync = new SuscripcionSyncService(c.db);
  const service = new ContratacionService(c.db, paddle as never, sync);
  const dto: SeleccionContratacion = {
    ofertaId: o.id,
    ciclo: 'mensual',
    adicionales: 2,
  };
  const leer = () => c.tx.suscripcion.findFirstOrThrow({ where: { tenantId } });
  const pagar = async () => {
    pagado = true;
    return sync.aplicar(sync.extraer(payload())!);
  };
  const contratar = async () => {
    const r = await service.preparar(auth, dto);
    expect(r.revision.bloqueos).toEqual([]);
    const enviada = await service.confirmar(auth, r.id!, r.revision.revisiones);
    expect(enviada.estado).toBe('checkout');
    expect((await pagar()).aplicado).toBe(true);
    return r;
  };
  return {
    service,
    sync,
    auth,
    dto,
    paddle,
    payload,
    pagar,
    pagarSinWebhook: () => {
      pagado = true;
    },
    contratar,
    leer,
    base,
    extra,
    version,
    o,
    tenantId,
  };
}

async function recuperacion(c: Ctx) {
  const x = await escenario(c);
  const crear = x.paddle.crearCheckoutContratacion.getMockImplementation()!;
  x.paddle.crearCheckoutContratacion.mockImplementationOnce(async (...args) => {
    await crear(...args);
    throw new Error('Respuesta perdida después de crear la transacción');
  });
  const r = await x.service.preparar(x.auth, x.dto);
  expect((await x.service.confirmar(x.auth, r.id!, [])).estado).toBe(
    'verificar',
  );
  const admin = new ContratacionesPlataformaService(
    c.db,
    new ConsultaContratacionService(c.db, x.paddle as never, x.sync),
  );
  const sub = await x.leer();
  const dto = {
    solicitudId: randomUUID(),
    motivo: 'Investigar resultado del pago informado',
  };
  const consultar = (datos = dto) =>
    admin.recuperar(c.staff, sub.id, r.id!, datos);
  return { ...x, r, sub, admin, consultaDto: dto, consultar };
}

it('Plataforma recupera un pago sin webhook y conserva auditoría, cupos e idempotencia sin cobrar otra vez', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await recuperacion(c);
    x.pagarSinWebhook();
    const r = await x.consultar();
    expect(r).toMatchObject({
      resultado: 'aplicada',
      estado: 'aplicada',
      transaccionId: 'txn_contratacion_prueba',
    });
    expect(await x.leer()).toMatchObject({
      planVersionId: x.version.id,
      usuariosAdicionales: 2,
      proveedor: 'paddle',
    });
    expect(await x.consultar()).toEqual(r);
    expect(x.paddle.crearCheckoutContratacion).toHaveBeenCalledTimes(1);
    expect(x.paddle.cambiarItems).not.toHaveBeenCalled();
    expect(x.paddle.leerCheckoutContratacion).toHaveBeenCalledTimes(1);
    const h = await x.admin.historial(x.sub.id, x.r.id!, 1, 10);
    expect(h.total).toBe(2);
    expect(h.eventos.map((e) => e.tipo)).toEqual(
      expect.arrayContaining([
        'contratacion_consulta_solicitada',
        'contratacion_consulta_terminada',
      ]),
    );
    await expect(
      x.consultar({ ...x.consultaDto, motivo: 'Otro motivo distinto' }),
    ).rejects.toThrow('otra consulta');
  }));

it('localiza un checkout por referencia explícita sin depender de una búsqueda incompleta', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await recuperacion(c);
    x.paddle.buscarCheckoutContratacion.mockResolvedValue(null);
    const r = await x.consultar({
      ...x.consultaDto,
      transaccionId: 'txn_contratacion_prueba',
    } as typeof x.consultaDto);
    expect(r).toMatchObject({
      resultado: 'checkout',
      estado: 'checkout',
      transaccionId: 'txn_contratacion_prueba',
    });
    expect(x.paddle.buscarCheckoutContratacion).not.toHaveBeenCalled();
    await expect(x.service.preparar(x.auth, x.dto)).rejects.toThrow(
      'pendiente',
    );
    expect((await x.leer()).proveedor).toBe('manual');
  }));

it('sólo una cancelación comprobada en Paddle cierra el checkout pendiente', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await recuperacion(c);
    await x.paddle.cancelarCheckoutContratacion(); // Simula una cancelación externa anterior a la consulta.
    x.paddle.cancelarCheckoutContratacion.mockClear();
    expect(await x.consultar()).toMatchObject({
      resultado: 'cancelada',
      estado: 'rechazada',
    });
    expect(x.paddle.cancelarCheckoutContratacion).not.toHaveBeenCalled();
    await expect(x.service.preparar(x.auth, x.dto)).resolves.toMatchObject({
      estado: 'preparada',
    });
  }));

it.each(['tenantId', 'contratacionId'] as const)(
  'rechaza una referencia con %s ajeno sin vincularla',
  (campo) =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await recuperacion(c);
      const original = await x.paddle.leerCheckoutContratacion();
      x.paddle.leerCheckoutContratacion.mockResolvedValue({
        ...original,
        customData: { ...original.customData, [campo]: randomUUID() },
      });
      expect(await x.consultar()).toMatchObject({
        resultado: 'no_coincide',
        estado: 'verificar',
        transaccionId: null,
      });
      expect(x.paddle.obtenerSuscripcion).not.toHaveBeenCalled();
      expect((await x.leer()).proveedor).toBe('manual');
    }),
);

it.each(['sin_resultado', 'fallida'] as const)(
  'una consulta %s no libera otro cobro y queda auditada',
  (resultado) =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await recuperacion(c);
      if (resultado === 'fallida')
        x.paddle.buscarCheckoutContratacion.mockRejectedValue(
          new Error('Sin conexión'),
        );
      else x.paddle.buscarCheckoutContratacion.mockResolvedValue(null);
      expect(await x.consultar()).toMatchObject({
        resultado,
        estado: 'verificar',
        transaccionId: null,
      });
      expect(
        (await x.admin.historial(x.sub.id, x.r.id!, 1, 10)).eventos.some(
          (e) => e.resultado === resultado,
        ),
      ).toBe(true);
      await expect(x.service.preparar(x.auth, x.dto)).rejects.toThrow(
        'pendiente',
      );
      expect(x.paddle.crearCheckoutContratacion).toHaveBeenCalledTimes(1);
    }),
);

it('revocar la sesión durante la lectura impide aplicar el resultado y vincular la referencia', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await recuperacion(c);
    x.pagarSinWebhook();
    const original = x.paddle.obtenerSuscripcion.getMockImplementation()!;
    x.paddle.obtenerSuscripcion.mockImplementation(async () => {
      await c.tx.authSession.update({
        where: { id: c.staff.sessionId },
        data: { revokedAt: new Date() },
      });
      return original();
    });
    await expect(x.consultar()).rejects.toThrow('sesión vigente');
    expect(
      await c.tx.planContratacion.findUniqueOrThrow({ where: { id: x.r.id! } }),
    ).toMatchObject({ estado: 'verificar', transaccionId: null });
    expect((await x.leer()).proveedor).toBe('manual');
  }));

it('soporte y empresa no pueden usar la recuperación administrativa', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await recuperacion(c);
    await expect(
      x.admin.recuperar(x.auth, x.sub.id, x.r.id!, x.consultaDto),
    ).rejects.toThrow('sesión personal');
    await c.tx.user.update({
      where: { id: c.staff.userId },
      data: { rolPlataforma: 'SOPORTE' },
    });
    await expect(x.consultar()).rejects.toThrow('sesión vigente');
    expect(x.paddle.buscarCheckoutContratacion).not.toHaveBeenCalled();
  }));

it('lista e historial están acotados a la empresa y no consultan Paddle al abrirse', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await recuperacion(c);
    const lista = await x.admin.listar(x.sub.id, 1, 1);
    expect(lista.total).toBe(1);
    expect(lista.contrataciones).toHaveLength(1);
    expect(lista.contrataciones[0]).toMatchObject({
      id: x.r.id,
      estado: 'verificar',
      adicionales: 2,
    });
    expect(lista.contrataciones[0]).not.toHaveProperty('huella');
    expect((await x.admin.listar(x.sub.id, 2, 1)).contrataciones).toEqual([]);
    const otra = await c.tx.suscripcion.findUniqueOrThrow({
      where: { tenantId: c.tenantId },
    });
    await expect(
      x.admin.recuperar(c.staff, otra.id, x.r.id!, x.consultaDto),
    ).rejects.toThrow('esta empresa');
    await expect(x.admin.historial(otra.id, x.r.id!, 1, 10)).rejects.toThrow(
      'esta empresa',
    );
    expect(x.paddle.buscarCheckoutContratacion).not.toHaveBeenCalled();
  }));

it('la recuperación conserva un resultado que el webhook guardó durante la lectura', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await recuperacion(c);
    const original = x.paddle.leerCheckoutContratacion.getMockImplementation()!;
    x.paddle.leerCheckoutContratacion.mockImplementation(async () => {
      await x.pagar();
      return original();
    });
    expect(await x.consultar()).toMatchObject({
      resultado: 'finalizada',
      estado: 'aplicada',
    });
    expect((await x.leer()).usuariosAdicionales).toBe(2);
    expect(x.paddle.crearCheckoutContratacion).toHaveBeenCalledTimes(1);
  }));

async function impresionPiloto(c: Ctx, tenantId: string) {
  const plan = await c.tx.plan.create({
    data: {
      codigo: `piloto-${randomUUID()}`,
      nombre: 'Piloto interno',
      publico: false,
      precioMensual: 0,
      featuresJson: { impresionDirecta: true },
    },
  });
  await c.tx.suscripcion.update({
    where: { tenantId },
    data: { planId: plan.id, planVersionId: null, ofertaId: null },
  });
  const o = await ordenImpresionFixture(c.tx, tenantId);
  await o.solicitar(1);
  await o.enviar({ pagina: 2, estado: 'COMPLETE' });
  return o;
}

it('no recupera un checkout cuyo precio o cantidad fue alterado después de aceptarse', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await recuperacion(c);
    const t = await x.paddle.leerCheckoutContratacion();
    x.paddle.leerCheckoutContratacion.mockResolvedValue({
      ...t,
      items: [{ price: { id: x.base }, quantity: 40 }],
    });
    expect(await x.consultar()).toMatchObject({
      resultado: 'no_coincide',
      estado: 'verificar',
      transaccionId: null,
    });
    expect((await x.leer()).usuariosAdicionales).toBe(0);
  }));

it('una transacción cobrada sin suscripción confirmada conserva verificación y no ofrece retomar pago', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await recuperacion(c);
    const t = await x.paddle.leerCheckoutContratacion();
    x.paddle.leerCheckoutContratacion.mockResolvedValue({
      ...t,
      status: 'completed',
      subscriptionId: null,
    });
    expect(await x.consultar()).toMatchObject({
      resultado: 'sin_resultado',
      estado: 'verificar',
      transaccionId: t.id,
    });
    expect(x.paddle.obtenerSuscripcion).not.toHaveBeenCalled();
    await expect(x.service.preparar(x.auth, x.dto)).rejects.toThrow(
      'pendiente',
    );
  }));

it('una respuesta con otro identificador de transacción no se vincula aunque copie metadatos', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await recuperacion(c);
    const t = await x.paddle.leerCheckoutContratacion();
    x.paddle.leerCheckoutContratacion.mockResolvedValue({
      ...t,
      id: 'txn_otro',
    });
    expect(await x.consultar()).toMatchObject({
      resultado: 'no_coincide',
      estado: 'verificar',
      transaccionId: null,
    });
  }));

it('el checkout exige reconocer los pendientes de impresión, sin perderlos al aplicar el contrato', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    const o = await impresionPiloto(c, x.tenantId);
    const antes = await c.tx.ordenTrabajoEvento.findMany({
      where: { ordenId: o.ordenId },
      orderBy: { id: 'asc' },
    });
    const r = await x.service.preparar(x.auth, x.dto);
    expect(r.revision.bloqueos).toEqual([]);
    expect(r.revision.revisiones).toEqual(
      expect.arrayContaining([
        'impresion_sin_envio',
        'impresion_sin_verificar',
        'impresion_en_equipos',
      ]),
    );
    await expect(
      x.service.confirmar(
        x.auth,
        r.id!,
        r.revision.revisiones.filter((k) => k !== 'impresion_sin_envio'),
      ),
    ).rejects.toThrow('revisiones');
    expect(x.paddle.crearCheckoutContratacion).not.toHaveBeenCalled();
    await x.service.confirmar(x.auth, r.id!, r.revision.revisiones);
    expect(x.paddle.crearCheckoutContratacion).toHaveBeenCalledTimes(1);
    expect((await x.pagar()).aplicado).toBe(true);
    expect(
      await new CapacidadesEmpresaService(c.db).puedeOperar(
        x.tenantId,
        'impresion_directa',
      ),
    ).toBe(false);
    expect(
      await c.tx.ordenTrabajoEvento.findMany({
        where: { ordenId: o.ordenId },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(antes);
  }));

it('no crea un checkout con una revisión obsoleta aunque siga habiendo una sola salida por verificar', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    const o = await impresionPiloto(c, x.tenantId);
    const r = await x.service.preparar(x.auth, x.dto);
    await o.enviar({ pagina: 2, estado: 'SIN_CONFIRMAR' });
    await expect(
      x.service.confirmar(x.auth, r.id!, r.revision.revisiones),
    ).rejects.toThrow('Cambió');
    expect(x.paddle.crearCheckoutContratacion).not.toHaveBeenCalled();
    const fresca = await x.service.preparar(x.auth, x.dto);
    expect(fresca.revision.diagnostico).toEqual(r.revision.diagnostico);
    await expect(
      x.service.confirmar(x.auth, fresca.id!, fresca.revision.revisiones),
    ).resolves.toMatchObject({ estado: 'checkout' });
  }));

it('revisa importes y cupos, crea un único checkout y sólo concede adicionales al confirmar Paddle', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    const r = await runWithTenant(x.tenantId, () =>
      x.service.preparar(x.auth, x.dto),
    );
    expect(r).toMatchObject({
      tipo: 'checkout',
      estado: 'preparada',
      revision: {
        totalPeriodo: 220,
        destino: { totalUsuarios: 5 },
        bloqueos: [],
      },
      cobro: { aCobrar: null },
    });
    const a = await x.service.confirmar(x.auth, r.id!, []);
    expect(a).toMatchObject({
      estado: 'checkout',
      transaccionId: 'txn_contratacion_prueba',
    });
    expect((await x.service.confirmar(x.auth, r.id!, [])).transaccionId).toBe(
      a.transaccionId,
    );
    expect(x.paddle.crearCheckoutContratacion).toHaveBeenCalledTimes(1);
    expect(x.paddle.crearCheckoutContratacion).toHaveBeenCalledWith(
      [
        { priceId: x.base, quantity: 1 },
        { priceId: x.extra, quantity: 2 },
      ],
      x.tenantId,
      r.id,
    );
    expect(await x.leer()).toMatchObject({
      proveedor: 'manual',
      usuariosAdicionales: 0,
    });
    await expect(x.service.preparar(x.auth, x.dto)).rejects.toThrow(
      /pendiente/,
    );
    expect((await x.pagar()).aplicado).toBe(true);
    expect((await x.service.consultar(x.auth, r.id!)).estado).toBe('aplicada');
    expect(await x.leer()).toMatchObject({
      ofertaId: x.o.id,
      planVersionId: x.version.id,
      cicloFacturacion: 'mensual',
      usuariosAdicionales: 2,
      proveedor: 'paddle',
    });
  }));

it('impide activar una oferta con un precio público y metadatos inventados sin revisión confirmada', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    const original = await x.leer();
    expect(await x.sync.aplicar(x.sync.extraer(x.payload())!)).toMatchObject({
      aplicado: false,
      motivo: expect.stringContaining('revisión confirmada'),
    });
    const r = await x.service.preparar(x.auth, x.dto);
    expect(
      (
        await x.sync.aplicar(
          x.sync.extraer({
            ...x.payload(),
            customData: { tenantId: x.tenantId, contratacionId: r.id },
          })!,
        )
      ).aplicado,
    ).toBe(false);
    expect(await x.leer()).toEqual(original);
  }));

it('cambia adicionales con preview, envía todos los ítems y un doble clic no repite el cobro', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    await x.contratar();
    const r = await x.service.preparar(x.auth, { ...x.dto, adicionales: 3 });
    expect(r).toMatchObject({ tipo: 'cambio', cobro: { aCobrar: 7.5 } });
    expect((await x.service.confirmar(x.auth, r.id!, [])).estado).toBe(
      'aplicada',
    );
    expect((await x.service.confirmar(x.auth, r.id!, [])).estado).toBe(
      'aplicada',
    );
    expect(x.paddle.cambiarItems).toHaveBeenCalledTimes(1);
    expect(x.paddle.cambiarItems).toHaveBeenCalledWith(
      'sub_contratacion_prueba',
      [
        { priceId: x.base, quantity: 1 },
        { priceId: x.extra, quantity: 3 },
      ],
    );
    expect((await x.leer()).usuariosAdicionales).toBe(3);
    const sinExtras = await x.service.preparar(x.auth, {
      ...x.dto,
      adicionales: 0,
    });
    expect((await x.service.confirmar(x.auth, sinExtras.id!, [])).estado).toBe(
      'aplicada',
    );
    expect((await x.leer()).usuariosAdicionales).toBe(0);
    expect(x.paddle.cambiarItems).toHaveBeenLastCalledWith(
      'sub_contratacion_prueba',
      [{ priceId: x.base, quantity: 1 }],
    );
  }));

it.each(['checkout', 'cambio'] as const)(
  'recupera una respuesta perdida de %s consultando Paddle, sin repetir el envío',
  (tipo) =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await escenario(c);
      if (tipo === 'cambio') await x.contratar();
      const mock =
        tipo === 'cambio'
          ? x.paddle.cambiarItems
          : x.paddle.crearCheckoutContratacion;
      const fn = mock.getMockImplementation()!;
      mock.mockImplementationOnce((async (...args: unknown[]) => {
        await (fn as (...args: unknown[]) => Promise<unknown>)(...args);
        throw new Error('Conexión interrumpida');
      }) as never);
      const r = await x.service.preparar(x.auth, { ...x.dto, adicionales: 3 });
      expect((await x.service.confirmar(x.auth, r.id!, [])).estado).toBe(
        'verificar',
      );
      expect((await x.service.confirmar(x.auth, r.id!, [])).estado).toBe(
        'verificar',
      );
      if (tipo === 'checkout') {
        expect((await x.service.consultar(x.auth, r.id!)).estado).toBe(
          'checkout',
        );
        await x.pagar();
      }
      expect((await x.service.consultar(x.auth, r.id!)).estado).toBe(
        'aplicada',
      );
      expect(mock).toHaveBeenCalledTimes(1);
      expect((await x.leer()).usuariosAdicionales).toBe(3);
    }),
);

it('no envía ni concede cambios si el preview del cobro cambió después de la revisión', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    await x.contratar();
    const r = await x.service.preparar(x.auth, { ...x.dto, adicionales: 3 });
    x.paddle.previsualizarItems.mockResolvedValue({
      aCobrar: 20,
      aCredito: 0,
      moneda: 'USD',
      impuestosEnCheckout: false,
    });
    expect(await x.service.confirmar(x.auth, r.id!, [])).toMatchObject({
      estado: 'rechazada',
      detalle: expect.stringContaining('importe del ajuste cambió'),
    });
    expect(x.paddle.cambiarItems).not.toHaveBeenCalled();
    expect((await x.leer()).usuariosAdicionales).toBe(2);
  }));

it('bloquea la reducción de cupos ocupados por invitaciones y vuelve a comprobar el uso antes del envío', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    const r = await x.service.preparar(x.auth, { ...x.dto, adicionales: 0 });
    await c.tx.invitation.createMany({
      data: Array.from({ length: 3 }, () => ({
        tenantId: x.tenantId,
        email: `${randomUUID()}@test.local`,
        tokenHash: randomUUID(),
        rol: 'OPERADOR' as const,
        expiresAt: new Date(Date.now() + 3600000),
      })),
    });
    await expect(x.service.confirmar(x.auth, r.id!, [])).rejects.toThrow(
      /Cambió/,
    );
    const bloqueada = await x.service.preparar(x.auth, {
      ...x.dto,
      adicionales: 0,
    });
    expect(bloqueada.estado).toBe('requiere_revision');
    expect(bloqueada.revision.diagnostico.usuariosExcedidos).toBe(1);
    expect(x.paddle.crearCheckoutContratacion).not.toHaveBeenCalled();
    expect(
      (await x.service.preparar(x.auth, { ...x.dto, adicionales: 1 })).revision
        .bloqueos,
    ).toEqual([]);
  }));

it('respeta la expiración y la retirada de una oferta sin cobrar una revisión obsoleta', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    const r = await x.service.preparar(x.auth, x.dto);
    await c.tx.planContratacion.update({
      where: { id: r.id! },
      data: { expiraEl: new Date(1) },
    });
    await expect(x.service.confirmar(x.auth, r.id!, [])).rejects.toThrow(
      /venció/,
    );
    const r2 = await x.service.preparar(x.auth, x.dto);
    await c.tx.plan.update({
      where: { id: x.o.planId },
      data: { ofertaActualId: null },
    });
    await expect(x.service.confirmar(x.auth, r2.id!, [])).rejects.toThrow(
      /oferta ya no/,
    );
    expect(x.paddle.crearCheckoutContratacion).not.toHaveBeenCalled();
  }));

it('exige sesión propia de administrador y no filtra revisiones de otra empresa', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    for (const auth of [
      { ...x.auth, esPlataforma: true },
      { ...x.auth, role: 'OPERADOR' as const },
      { ...x.auth, sessionId: c.staff.sessionId },
    ])
      await expect(x.service.preparar(auth, x.dto)).rejects.toThrow(
        /administrador|sesión/,
      );
    const r = await x.service.preparar(x.auth, x.dto);
    const sesion = await c.tx.authSession.create({
      data: {
        userId: c.auth.userId,
        currentTenantId: c.tenantId,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    await expect(
      x.service.consultar({ ...c.auth, sessionId: sesion.id }, r.id!),
    ).rejects.toThrow(/no existe/);
    await c.tx.membership.update({
      where: { id: x.auth.membershipId },
      data: { activa: false },
    });
    await expect(x.service.confirmar(x.auth, r.id!, [])).rejects.toThrow(
      /sesión/,
    );
    expect(x.paddle.crearCheckoutContratacion).not.toHaveBeenCalled();
  }));

it('recupera el checkout pendiente al volver y sólo permite descartarlo tras confirmación remota', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    expect(await x.service.pendiente(x.auth)).toBeNull();
    const r = await x.service.preparar(x.auth, x.dto);
    await x.service.confirmar(x.auth, r.id!, []);
    expect(await x.service.pendiente(x.auth)).toMatchObject({
      id: r.id,
      estado: 'checkout',
    });
    expect(await x.service.descartar(x.auth, r.id!)).toMatchObject({
      estado: 'rechazada',
    });
    expect(await x.service.pendiente(x.auth)).toBeNull();
    expect(await x.service.descartar(x.auth, r.id!)).toMatchObject({
      estado: 'rechazada',
    });
    expect(x.paddle.cancelarCheckoutContratacion).toHaveBeenCalledTimes(1);
    expect((await x.service.preparar(x.auth, x.dto)).estado).toBe('preparada');
    expect((await x.leer()).proveedor).toBe('manual');
  }));

it('una respuesta perdida al descartar no declara cancelado un pago que continúa pendiente', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    const r = await x.service.preparar(x.auth, x.dto);
    await x.service.confirmar(x.auth, r.id!, []);
    x.paddle.cancelarCheckoutContratacion.mockRejectedValueOnce(
      new Error('Red no disponible'),
    );
    expect((await x.service.descartar(x.auth, r.id!)).estado).toBe('checkout');
    await expect(x.service.preparar(x.auth, x.dto)).rejects.toThrow(
      /pendiente/,
    );
    await x.pagar();
    expect((await x.service.descartar(x.auth, r.id!)).estado).toBe('aplicada');
    expect(x.paddle.cancelarCheckoutContratacion).toHaveBeenCalledTimes(1);
  }));

it('el catálogo contratable presenta la oferta activa y el contrato conserva los precios históricos', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    await x.contratar();
    const servicio = new SuscripcionesService(
      c.db,
      x.paddle as never,
      x.sync,
      {} as never,
    );
    const estado = await servicio.estadoParaTenant(x.tenantId);
    expect(estado.planes.find((p) => p.ofertaId === x.o.id)).toMatchObject({
      precioMensual: 190,
      usuarioMensual: { importe: 15 },
      anual: null,
      esActual: true,
      features: { usuariosMax: 3, storageGb: 250 },
    });
    expect(estado.actual).toMatchObject({
      ofertaId: x.o.id,
      totalPeriodo: 220,
      usuariosAdicionales: 2,
      cicloFacturacion: 'mensual',
    });
    expect(estado.planes.some((p) => p.codigo === 'founder')).toBe(false);
    await c.tx.plan.update({
      where: { id: x.o.planId },
      data: { ofertaActualId: null, precioMensual: 999 },
    });
    const retirado = await servicio.estadoParaTenant(x.tenantId);
    expect(retirado.planes.some((p) => p.ofertaId === x.o.id)).toBe(false);
    expect(retirado.actual).toMatchObject({
      precioMensual: 190,
      totalPeriodo: 220,
    });
  }));

it.each(['canceled', 'paused', 'past_due'])(
  'conserva contrato y aplica %s aunque los ítems válidos correspondan a un cambio sin autorizar',
  (status) =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await escenario(c);
      await x.contratar();
      const resultado = await x.sync.aplicar(
        x.sync.extraer({
          ...x.payload(),
          status,
          items: [{ price: { id: x.base }, quantity: 1 }],
        })!,
      );
      expect(resultado).toMatchObject({
        aplicado: true,
        advertencia: expect.stringContaining('requieren revisión'),
      });
      expect(await x.leer()).toMatchObject({
        ofertaId: x.o.id,
        usuariosAdicionales: 2,
        estadoProveedor: status,
      });
    }),
);

it.each(['enviando', 'checkout', 'verificar'])(
  'con contratación %s reserva el cupo menor para nuevas invitaciones y archivos',
  (estado) =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await escenario(c);
      await c.tx.suscripcion.update({
        where: { tenantId: x.tenantId },
        data: { planVersionId: c.versiones[1].id },
      });
      const r = await x.service.preparar(x.auth, { ...x.dto, adicionales: 0 });
      expect(r.revision.bloqueos).toEqual([]);
      await x.service.confirmar(x.auth, r.id!, r.revision.revisiones);
      await c.tx.planContratacion.update({
        where: { id: r.id! },
        data: { estado, expiraEl: new Date(0) },
      });
      await bloquearCupoUsuarios(c.tx, x.tenantId);
      // Ya hay un administrador: dos invitaciones llenan los tres lugares del destino.
      await c.tx.invitation.createMany({
        data: [1, 2].map((i) => ({
          tenantId: x.tenantId,
          email: `reserva-${i}@test.local`,
          tokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 3600000),
          rol: 'OPERADOR' as const,
        })),
      });
      await expect(
        exigirCupoUsuario(c.tx, x.tenantId, { email: 'nuevo@test.local' }),
      ).rejects.toMatchObject({
        response: { code: 'CUPO_USUARIOS_AGOTADO', limite: 3 },
      });
      await expect(
        exigirCupoUsuario(c.tx, x.tenantId, { email: 'reserva-1@test.local' }),
      ).resolves.toBeUndefined();
      await expect(
        exigirEspacio(c.tx, x.tenantId, 251n * 1024n ** 3n),
      ).rejects.toMatchObject({
        response: {
          code: 'CUPO_ALMACENAMIENTO_AGOTADO',
          cuotaBytes: 250 * 1024 ** 3,
        },
      });
      await expect(
        exigirEspacio(c.tx, x.tenantId, 250n * 1024n ** 3n),
      ).resolves.toBeUndefined();
      await expect(
        exigirEspacio(c.tx, x.tenantId, -1n),
      ).resolves.toBeUndefined();
      // La empresa ajena y las excepciones de espacio conservan su contrato.
      await expect(
        exigirEspacio(c.tx, c.tenantId, 251n * 1024n ** 3n),
      ).resolves.toBeUndefined();
      await c.tx.tenant.update({
        where: { id: x.tenantId },
        data: { cuotaBytesArchivos: 400n * 1024n ** 3n },
      });
      await expect(
        exigirEspacio(c.tx, x.tenantId, 300n * 1024n ** 3n),
      ).resolves.toBeUndefined();
      await c.tx.planContratacion.update({
        where: { id: r.id! },
        data: { estado: 'rechazada' },
      });
      await expect(
        exigirCupoUsuario(c.tx, x.tenantId, { email: 'nuevo@test.local' }),
      ).resolves.toBeUndefined();
    }),
  30000,
);

it(
  'un checkout sin pagar no amplía el cupo actual ni permite cambios administrativos del contrato',
  () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await escenario(c);
      const r = await x.service.preparar(x.auth, x.dto);
      await x.service.confirmar(x.auth, r.id!, r.revision.revisiones);
      await bloquearCupoUsuarios(c.tx, x.tenantId);
      await c.tx.invitation.createMany({
        data: [1, 2].map((i) => ({
          tenantId: x.tenantId,
          email: `ocupado-${i}@test.local`,
          tokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 3600000),
          rol: 'OPERADOR' as const,
        })),
      });
      await expect(
        exigirCupoUsuario(c.tx, x.tenantId, { email: 'nuevo@test.local' }),
      ).rejects.toMatchObject({ response: { limite: 3 } });
      const actual = await x.leer();
      const admin = new SuscripcionesPlataformaService(
        c.db,
        x.paddle as never,
        x.sync,
      );
      await expect(
        admin.ajustarCupoUsuarios(c.staff, actual.id, {
          anteriores: 0,
          adicionales: 5,
          motivo: 'Ajuste que debe esperar al cobro',
        }),
      ).rejects.toMatchObject({ response: { code: 'CONTRATACION_PENDIENTE' } });
      const asignacion = new PlanesAsignacionService(c.db);
      const d = await asignacion.diagnostico({
        tenantId: x.tenantId,
        versionId: c.versiones[1].id,
      });
      await expect(
        asignacion.asignar(c.staff, {
          tenantId: x.tenantId,
          versionId: c.versiones[1].id,
          revision: d.actual.revision,
          huella: d.huella,
          revisionesAceptadas: d.revisiones,
          motivo: 'Asignación mientras se procesa cobro',
          operacionId: randomUUID(),
        }),
      ).rejects.toMatchObject({ response: { code: 'CONTRATACION_PENDIENTE' } });
      const plataforma = new PlataformaService(
        c.db,
        {} as never,
        {} as never,
        {} as never,
      );
      await expect(
        plataforma.cambiarPlan(
          c.staff.userId,
          x.tenantId,
          actual.planId,
          'Cambio mientras se procesa cobro',
        ),
      ).rejects.toMatchObject({ response: { code: 'CONTRATACION_PENDIENTE' } });
      await x.pagar();
      await expect(
        exigirCupoUsuario(c.tx, x.tenantId, { email: 'nuevo@test.local' }),
      ).resolves.toBeUndefined();
    }),
  30000,
);
