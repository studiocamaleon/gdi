/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { PlanesPaddleService } from '../planes/planes-paddle.service';
import { PlanesOfertasService } from '../planes/planes-ofertas.service';
import {
  PROPUESTA_PLANES,
  type ContenidoPlan,
} from '../planes/catalogo-planes';
import { revisarContratacion } from '../../suscripciones/revision-contratacion';
import { TenantProvisioningService } from '../../provisionamiento/tenant-provisioning.service';
import { RegistroService } from '../../registro/registro.service';
import { SuscripcionSyncService } from '../../cobro/suscripcion-sync.service';
import type { SuscripcionExterna } from '../../cobro/suscripcion-sync.service';

const prisma = new PrismaService();
beforeAll(() => {
  process.env.PADDLE_ENV = 'sandbox';
});
afterAll(() => prisma.$disconnect());
type Ctx = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
const rid = (prefix: string) =>
  `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 26)}`;
async function escenario(c: Ctx, fee = 199, invitacion = false) {
  const contenido: ContenidoPlan = {
    ...structuredClone(PROPUESTA_PLANES[0].contenido),
    almacenamientoModo: 'limitado',
    almacenamientoGb: 250,
    precios: {
      moneda: 'USD',
      mensual: 190,
      anual: 1900,
      usuarioMensual: 15,
      usuarioAnual: 150,
    },
    comercial: {
      acceso: invitacion ? 'invitacion' : 'publico',
      trialDias: invitacion ? 30 : 14,
      implementacion: fee,
    },
  };
  const version = await c.publicar(contenido);
  const remotos = new Map<string, unknown>();
  const identidades = new Map<string, string>();
  const paddle = {
    habilitado: true,
    entorno: 'sandbox',
    crearProductoPlan: jest.fn(async (_v: string, k: string) => {
      const id = rid('pro');
      identidades.set(k, id);
      return { id };
    }),
    crearPrecioPlan: jest.fn(
      async (a: {
        clave: string;
        productId: string;
        ciclo: string;
        importe: number;
        cantidadMaxima: number;
      }) => {
        const id = rid('pri');
        identidades.set(a.clave, id);
        remotos.set(id, {
          id,
          status: 'active',
          type: 'standard',
          taxMode: 'external',
          product: { status: 'active' },
          productId: a.productId,
          unitPrice: { amount: String(a.importe * 100), currencyCode: 'USD' },
          billingCycle:
            a.ciclo === 'unico'
              ? null
              : {
                  interval: a.ciclo === 'anual' ? 'year' : 'month',
                  frequency: 1,
                },
          trialPeriod: null,
          unitPriceOverrides: [],
          quantity: { minimum: 1, maximum: a.cantidadMaxima },
        });
        return { id };
      },
    ),
    buscarRecursoPlan: jest.fn(
      async (_v: string, k: string) => identidades.get(k) ?? null,
    ),
    leerPrecioOferta: jest.fn(async (id: string) => remotos.get(id)),
    esRechazoDefinitivo: () => false,
  };
  const ofertas = new PlanesOfertasService(c.db, paddle as never);
  const service = new PlanesPaddleService(c.db, paddle as never, ofertas);
  const dto = {
    versionId: version.id,
    entorno: 'sandbox',
    revision: 0,
    recomendado: false,
    motivo: 'Oferta comercial con condiciones nuevas',
  };
  const activar = () => service.sincronizar(c.staff, dto);
  return {
    version,
    paddle,
    service,
    dto,
    activar,
    remotos,
    ofertas,
    contenido,
  };
}

it.each([199, 499, 1200])(
  'sincroniza y valida implementación USD %i, mensual y anual, y no duplica al reintentar',
  (fee) =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await escenario(c, fee);
      const a = await x.activar();
      expect(a.actual).toMatchObject({
        implementacion: { importe: fee },
        precioMensual: 190,
        anual: { importe: 1900 },
        trialDias: 14,
        registroPublico: true,
      });
      expect(x.paddle.crearProductoPlan).toHaveBeenCalledTimes(3);
      expect(x.paddle.crearPrecioPlan).toHaveBeenCalledTimes(5);
      expect((await x.activar()).actual?.ofertaId).toBe(a.actual?.ofertaId);
      expect(x.paddle.crearPrecioPlan).toHaveBeenCalledTimes(5);
    }),
);
it('recupera un POST incierto por metadata sin duplicar el producto', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    const original = x.paddle.crearProductoPlan.getMockImplementation()!;
    x.paddle.crearProductoPlan.mockImplementationOnce(async (v, k) => {
      await original(v, k);
      throw new Error('timeout tras crear');
    });
    await expect(x.activar()).rejects.toThrow('No se completó');
    const a = await x.activar();
    expect(a.actual).not.toBeNull();
    expect(x.paddle.buscarRecursoPlan).toHaveBeenCalledWith(
      x.version.id,
      'producto:base',
    );
    expect(x.paddle.crearProductoPlan).toHaveBeenCalledTimes(3);
  }));
it('no reenvía un recurso incierto sin confirmación y rechaza entorno o actor incorrectos antes de crear', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c);
    await expect(
      x.service.sincronizar({ ...c.staff, esPlataforma: false }, x.dto),
    ).rejects.toThrow();
    await expect(
      x.service.sincronizar(c.staff, { ...x.dto, entorno: 'production' }),
    ).rejects.toThrow();
    expect(x.paddle.crearProductoPlan).not.toHaveBeenCalled();
    await c.tx.planPaddleRecurso.create({
      data: {
        versionId: x.version.id,
        entorno: 'sandbox',
        clave: 'producto:base',
        estado: 'enviando',
      },
    });
    await expect(x.activar()).rejects.toThrow('no duplicará');
    expect(x.paddle.crearProductoPlan).not.toHaveBeenCalled();
  }));
it('Co-founder queda oculto al público, concede 30 días y sólo su empresa invitada puede contratarlo', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await escenario(c, 0, true);
    const a = await x.activar();
    const o = a.actual!;
    expect(o).toMatchObject({
      registroPublico: false,
      trialDias: 30,
      implementacion: null,
      acceso: 'invitacion',
    });
    expect(x.paddle.crearPrecioPlan).toHaveBeenCalledTimes(4);
    const publico = await new RegistroService(
      c.db,
      {} as never,
      new TenantProvisioningService(),
      {} as never,
    ).planes();
    expect(publico.some((p) => p.codigo === x.version.codigo)).toBe(false);
    await expect(
      revisarContratacion(c.tx, c.tenantId, {
        ofertaId: o.ofertaId,
        ciclo: 'mensual',
        adicionales: 0,
      }),
    ).rejects.toThrow('no está disponible');
    const plan = await c.tx.plan.findUniqueOrThrow({
      where: { codigo: x.version.codigo },
    });
    const alta = await new TenantProvisioningService().provisionarBase(c.tx, {
      nombre: 'Invitación Co-founder de prueba',
      plan: { id: plan.id, trialDias: 14 },
      origen: 'plataforma',
    });
    const s = await c.tx.suscripcion.findUniqueOrThrow({
      where: { tenantId: alta.tenantId },
    });
    expect(Math.round((s.trialHasta!.getTime() - Date.now()) / 86400000)).toBe(
      30,
    );
    const r = await revisarContratacion(c.tx, alta.tenantId, {
      ofertaId: o.ofertaId,
      ciclo: 'anual',
      adicionales: 1,
    });
    expect(r.vista).toMatchObject({
      implementacion: 0,
      totalInicial: 2050,
      totalPeriodo: 2050,
    });
  }));
it.each(['mensual', 'anual'] as const)(
  'agrega implementación sólo en el primer checkout %s y la confirma con prueba del pago',
  (ciclo) =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await escenario(c);
      const a = await x.activar();
      const ofertaId = a.actual!.ofertaId;
      const plan = await c.tx.plan.findUniqueOrThrow({
        where: { codigo: x.version.codigo },
      });
      const alta = await new TenantProvisioningService().provisionarBase(c.tx, {
        nombre: 'Prueba de implementación',
        plan: { id: plan.id, trialDias: 14 },
        origen: 'registro_publico',
      });
      const tenantId = alta.tenantId;
      const s = await c.tx.suscripcion.findUniqueOrThrow({
        where: { tenantId },
      });
      expect(
        Math.round((s.trialHasta!.getTime() - Date.now()) / 86400000),
      ).toBe(14);
      const seleccion = { ofertaId, ciclo, adicionales: 2 };
      const r = await revisarContratacion(c.tx, tenantId, seleccion);
      const total = ciclo === 'mensual' ? 220 : 2200;
      expect(r.vista).toMatchObject({
        implementacion: 199,
        totalPeriodo: total,
        totalInicial: total + 199,
      });
      expect(r.items).toContainEqual({
        priceId: r.vista.implementacionPriceId,
        quantity: 1,
      });
      const intento = await c.tx.planContratacion.create({
        data: {
          tenantId,
          userId: c.auth.userId,
          ofertaId,
          ciclo,
          adicionales: 2,
          tipo: 'checkout',
          estado: 'checkout',
          transaccionId: rid('txn'),
          huella: r.huella,
          revisionContrato: s.revisionContrato,
          revisionJson: r.vista as never,
          cobroJson: {},
          expiraEl: new Date(Date.now() + 600000),
        },
      });
      const recurrentes = r.items.filter(
        (i) => i.priceId !== r.vista.implementacionPriceId,
      );
      const externa: SuscripcionExterna = {
        referencia: rid('sub'),
        estadoProveedor: 'active',
        clienteExterno: null,
        proximoCobro: null,
        periodoDesde: null,
        precios: recurrentes.map((i) => i.priceId),
        items: recurrentes,
        tenantId,
        contratacionId: intento.id,
        cambioProgramado: null,
        cambioProgramadoEl: null,
      };
      const transaccion = {
        id: intento.transaccionId,
        status: 'ready',
        subscriptionId: externa.referencia,
        customData: { tenantId, contratacionId: intento.id },
        items: r.items.map((i) => ({
          quantity: i.quantity,
          price: x.remotos.get(i.priceId),
        })),
      };
      const pago = {
        leerCheckoutContratacion: jest.fn(async () => transaccion),
      };
      const sync = new SuscripcionSyncService(c.db, pago as never);
      expect((await sync.aplicar(externa)).aplicado).toBe(false);
      transaccion.status = 'completed';
      const itemsOriginales = transaccion.items;
      transaccion.items = transaccion.items.filter(
        (i) => (i.price as { id: string }).id !== r.vista.implementacionPriceId,
      );
      expect((await sync.aplicar(externa)).aplicado).toBe(false);
      transaccion.items = itemsOriginales;
      expect((await sync.aplicar(externa)).aplicado).toBe(true);
      const pagada = await c.tx.suscripcion.findUniqueOrThrow({
        where: { tenantId },
      });
      expect(pagada.implementacionResueltaEl).not.toBeNull();
      expect(Number(pagada.implementacionImporte)).toBe(199);
      const cambio = await revisarContratacion(c.tx, tenantId, {
        ...seleccion,
        adicionales: 3,
      });
      expect(cambio.tipo).toBe('cambio');
      expect(cambio.vista.implementacion).toBe(0);
      await c.tx.suscripcion.update({
        where: { tenantId },
        data: { estado: 'baja', estadoProveedor: 'canceled' },
      });
      const reactivacion = await revisarContratacion(c.tx, tenantId, seleccion);
      expect(reactivacion.tipo).toBe('checkout');
      expect(reactivacion.vista.implementacion).toBe(0);
      expect(reactivacion.items).toHaveLength(2);
    }),
);
