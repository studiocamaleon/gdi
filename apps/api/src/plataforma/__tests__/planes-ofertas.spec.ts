/* Transportes async simulados y matchers de Jest; persistencia real con rollback. */
/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment */
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { PlanesOfertasService } from '../planes/planes-ofertas.service';
import { ActivarOfertaDto } from '../planes/planes-ofertas.controller';
import { PlanesVersionesService } from '../planes/planes-versiones.service';
import {
  PROPUESTA_PLANES,
  type ContenidoPlan,
} from '../planes/catalogo-planes';
import { RegistroService } from '../../registro/registro.service';
import { TenantProvisioningService } from '../../provisionamiento/tenant-provisioning.service';
import { SuscripcionSyncService } from '../../cobro/suscripcion-sync.service';
import { contratoSuscripcion } from '../../suscripciones/contrato-suscripcion';
import { runWithTenant } from '../../common/tenant-context';
import { IniciarRegistroDto } from '../../registro/dto/iniciar-registro.dto';

const prisma = new PrismaService();
beforeAll(() => {
  process.env.PADDLE_ENV = 'sandbox';
});
afterAll(() => prisma.$disconnect());
const precios = {
  moneda: 'USD' as const,
  mensual: 190,
  anual: 1900,
  usuarioMensual: 15,
  usuarioAnual: 150,
};
const precioId = () => `pri_${randomUUID().replaceAll('-', '').slice(0, 26)}`;
type Ctx = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
async function confirmarIntento(
  c: Ctx,
  ofertaId: string,
  ciclo: string,
  adicionales: number,
  referencia?: string,
) {
  return c.tx.planContratacion.create({
    data: {
      tenantId: c.tenantId,
      userId: c.auth.userId,
      ofertaId,
      ciclo,
      adicionales,
      tipo: referencia ? 'cambio' : 'checkout',
      referencia,
      estado: 'enviando',
      huella: 'revision-validada-por-prueba',
      revisionContrato: 0,
      revisionJson: {},
      cobroJson: {},
      expiraEl: new Date(Date.now() + 600000),
    },
  });
}
async function preparar(c: Ctx) {
  const contenido: ContenidoPlan = {
    ...structuredClone(PROPUESTA_PLANES[0].contenido),
    almacenamientoModo: 'limitado',
    almacenamientoGb: 250,
    precios,
  };
  const version = await c.publicar(contenido);
  const dto: ActivarOfertaDto = {
    versionId: version.id,
    entorno: 'sandbox',
    revision: 0,
    registroPublico: true,
    recomendado: true,
    trialDias: 14,
    motivo: 'Activar oferta para prueba integral',
    precios: [
      { tipo: 'base', ciclo: 'mensual', priceId: precioId() },
      { tipo: 'usuario', ciclo: 'mensual', priceId: precioId() },
      { tipo: 'base', ciclo: 'anual', priceId: precioId() },
      { tipo: 'usuario', ciclo: 'anual', priceId: precioId() },
    ],
  };
  const remoto = (id: string) => {
    const i = dto.precios.find((p) => p.priceId === id)!;
    return {
      status: 'active',
      type: 'standard',
      taxMode: 'external',
      product: { status: 'active' },
      productId: 'pro_prueba',
      unitPrice: {
        amount: String(
          (i.tipo === 'base'
            ? precios[i.ciclo]
            : precios[
                i.ciclo === 'mensual' ? 'usuarioMensual' : 'usuarioAnual'
              ]) * 100,
        ),
        currencyCode: 'USD',
      },
      billingCycle: {
        frequency: 1,
        interval: i.ciclo === 'mensual' ? 'month' : 'year',
      },
      trialPeriod: null,
      unitPriceOverrides: [],
      quantity: { minimum: 1, maximum: 999 },
    };
  };
  const paddle = {
    habilitado: true,
    entorno: 'sandbox',
    leerPrecioOferta: jest.fn(async (id: string) => remoto(id)),
  };
  const service = new PlanesOfertasService(c.db, paddle as never);
  const correo = {
    enviarVerificacion: jest.fn(async (solicitud: { url: string }) => {
      expect(solicitud.url).toContain('token=');
      return { id: 'correo_prueba' };
    }),
  };
  const auth = {
    crearSesionParaMembership: jest.fn(async () => ({
      accessToken: 'sesion_prueba',
    })),
  };
  const registro = new RegistroService(
    c.db,
    correo as never,
    new TenantProvisioningService(),
    auth as never,
  );
  return { dto, contenido, version, paddle, service, registro, correo };
}

it('activa una versión sin alterar suscripciones, expone un catálogo con sus capacidades y reintenta sin duplicar auditoría', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await preparar(c);
    const antes = await c.tx.suscripcion.findMany({ orderBy: { id: 'asc' } });
    expect(
      (await x.registro.planes()).find((p) => p.codigo === x.version.codigo),
    ).toBeUndefined();
    const activada = await x.service.activar(c.staff, x.dto);
    expect(activada.actual).toMatchObject({
      nombre: x.contenido.nombre,
      precioMensual: 190,
      usuarioMensual: { importe: 15 },
      anual: { importe: 1900 },
      versionId: x.version.id,
      features: {
        usuariosMax: 3,
        storageGb: 250,
        funciones: x.contenido.funciones,
      },
    });
    expect(activada.actual?.prestaciones.map((p) => p.clave).sort()).toEqual(
      Object.keys(x.contenido.funciones)
        .filter((clave) => x.contenido.funciones[clave])
        .sort(),
    );
    expect(
      activada.actual?.prestaciones.every((p) => p.nombre && p.grupo),
    ).toBe(true);
    expect((await x.service.activar(c.staff, x.dto)).actual?.ofertaId).toBe(
      activada.actual?.ofertaId,
    );
    expect(
      await c.tx.plataformaEvento.count({
        where: { staffUserId: c.staff.userId, tipo: 'plan_oferta_activada' },
      }),
    ).toBe(1);
    expect(await c.tx.suscripcion.findMany({ orderBy: { id: 'asc' } })).toEqual(
      antes,
    );
    const catalogo = await runWithTenant(c.tenantId, () => x.registro.planes());
    expect(catalogo.find((p) => p.codigo === x.version.codigo)).toMatchObject(
      activada.actual!,
    );
    expect(catalogo.some((p) => p.codigo === 'founder')).toBe(false);
  }));

it('retira un plan anterior de nuevas altas, conserva sus contratos y exige una oferta de reemplazo', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await preparar(c);
    const suscripcion = await c.tx.suscripcion.findUniqueOrThrow({
      where: { tenantId: c.tenantId },
    });
    const anterior = await c.tx.plan.update({
      where: { id: suscripcion.planId },
      data: { publico: true, registroPublico: true },
    });
    const dto = {
      planId: anterior.id,
      revision: anterior.revisionOferta,
      motivo: 'Migración de nuevas altas a ofertas versionadas',
    };
    await expect(x.service.retirarAnterior(c.staff, dto)).rejects.toThrow(
      'Activá primero',
    );
    await x.service.activar(c.staff, x.dto);
    await expect(
      x.service.retirarAnterior(
        { ...c.staff, plataformaMfaPendiente: true },
        dto,
      ),
    ).rejects.toThrow('sesión personal');
    await expect(
      x.service.retirarAnterior(c.staff, { ...dto, revision: 99 }),
    ).rejects.toThrow('catálogo cambió');
    await x.service.retirarAnterior(c.staff, dto);
    expect(
      await c.tx.suscripcion.findUnique({ where: { tenantId: c.tenantId } }),
    ).toEqual(suscripcion);
    const retirado = await c.tx.plan.findUniqueOrThrow({
      where: { id: anterior.id },
    });
    expect(retirado).toMatchObject({
      publico: false,
      registroPublico: false,
      activo: anterior.activo,
      featuresJson: anterior.featuresJson,
      paddlePriceId: anterior.paddlePriceId,
      precioMensual: anterior.precioMensual,
    });
    expect(
      (await x.registro.planes()).some((p) => p.codigo === anterior.codigo),
    ).toBe(false);
    expect(
      await c.tx.plataformaEvento.count({
        where: { staffUserId: c.staff.userId, tipo: 'plan_anterior_retirado' },
      }),
    ).toBe(1);
    await expect(x.service.retirarAnterior(c.staff, dto)).rejects.toThrow(
      'catálogo cambió',
    );
    const nuevo = await c.tx.plan.findUniqueOrThrow({
      where: { codigo: x.version.codigo },
    });
    await expect(
      x.service.retirarAnterior(c.staff, {
        ...dto,
        planId: nuevo.id,
        revision: nuevo.revisionOferta,
      }),
    ).rejects.toThrow('oferta comercial');
  }));

it('el registro conserva la oferta elegida aunque otra versión se active durante la verificación del correo', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await preparar(c);
    const a = await x.service.activar(c.staff, x.dto);
    const dto: IniciarRegistroDto = {
      planCodigo: x.version.codigo,
      ofertaId: a.actual!.ofertaId,
      nombreCompleto: 'Cliente de prueba',
      empresaNombre: 'Empresa nueva',
      email: `${randomUUID()}@test.local`,
      password: 'ClaveDePrueba2026!',
      paisCodigo: 'AR',
      zonaHoraria: 'America/Argentina/Buenos_Aires',
      aceptaTerminos: true,
    };
    await x.registro.iniciar(dto);
    expect(x.correo.enviarVerificacion).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: x.contenido.nombre,
        trialDias: x.dto.trialDias,
      }),
    );
    const token = new URL(
      x.correo.enviarVerificacion.mock.calls[0][0].url,
    ).searchParams.get('token')!;
    await c.tx.planBorrador.update({
      where: { id: x.version.borradorId },
      data: {
        revision: { increment: 1 },
        contenido: {
          ...x.contenido,
          usuariosIncluidos: 8,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    const v2 = await new PlanesVersionesService(c.db).publicar(
      c.staff,
      x.version.borradorId,
      {
        revision: 2,
        catalogoVersion: x.version.catalogoVersion,
        motivo: 'Segunda versión de condiciones',
      },
    );
    x.dto.versionId = v2.id;
    x.dto.revision = 1;
    x.dto.precios = x.dto.precios.map((p) => ({ ...p, priceId: precioId() }));
    await x.service.activar(c.staff, x.dto);
    await expect(
      x.registro.iniciar({ ...dto, email: `${randomUUID()}@test.local` }),
    ).rejects.toThrow(/oferta cambió/);
    await x.registro.completarNuevo(token);
    const solicitud = await c.tx.registroTenant.findFirstOrThrow({
      where: { email: dto.email },
    });
    const s = await c.tx.suscripcion.findFirstOrThrow({
      where: { tenantId: solicitud.tenantCreadoId! },
      include: { plan: true, planVersion: true },
    });
    expect(s).toMatchObject({
      ofertaId: a.actual!.ofertaId,
      planVersionId: x.version.id,
      proveedor: 'manual',
      usuariosAdicionales: 0,
    });
    expect(contratoSuscripcion(s).limites.usuariosMax).toBe(3);
    expect(Math.round((s.trialHasta!.getTime() - Date.now()) / 86400000)).toBe(
      14,
    );
  }));

it('reconcilia versión, ciclo y cantidad paga sin depender del orden de ítems ni de la oferta actualmente vendida', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await preparar(c);
    const a = await x.service.activar(c.staff, x.dto);
    const sync = new SuscripcionSyncService(c.db);
    const intento = await confirmarIntento(c, a.actual!.ofertaId, 'anual', 4);
    const base = x.dto.precios.find(
      (p) => p.tipo === 'base' && p.ciclo === 'anual',
    )!.priceId;
    const extra = x.dto.precios.find(
      (p) => p.tipo === 'usuario' && p.ciclo === 'anual',
    )!.priceId;
    const externa = (items: unknown[], status = 'active') =>
      sync.extraer({
        id: 'sub_oferta_prueba',
        status,
        custom_data: { tenantId: c.tenantId, contratacionId: intento.id },
        items,
      })!;
    const payload = externa([
      { price: { id: extra }, quantity: 4 },
      { price: { id: base }, quantity: 1 },
    ]);
    expect((await sync.aplicar(payload)).aplicado).toBe(true);
    const leer = () =>
      c.tx.suscripcion.findFirstOrThrow({
        where: { tenantId: c.tenantId },
        include: { plan: true, planVersion: true },
      });
    expect(await leer()).toMatchObject({
      ofertaId: a.actual!.ofertaId,
      planVersionId: x.version.id,
      usuariosAdicionales: 4,
      cicloFacturacion: 'anual',
      trialHasta: null,
    });
    expect(contratoSuscripcion(await leer()).limites.usuariosMax).toBe(7);
    await x.service.retirar(c.staff, {
      ofertaId: a.actual!.ofertaId,
      revision: 1,
      motivo: 'Retirada para futuras contrataciones',
    });
    expect(
      (await x.registro.planes()).some((p) => p.codigo === x.version.codigo),
    ).toBe(false);
    await confirmarIntento(
      c,
      a.actual!.ofertaId,
      'anual',
      0,
      'sub_oferta_prueba',
    );
    expect(
      (await sync.aplicar(externa([{ price: { id: base }, quantity: 1 }])))
        .aplicado,
    ).toBe(true);
    expect(await leer()).toMatchObject({
      planVersionId: x.version.id,
      usuariosAdicionales: 0,
    });
    expect(
      (
        await sync.aplicar(
          externa([{ price: { id: base }, quantity: 1 }], 'canceled'),
        )
      ).aplicado,
    ).toBe(true);
    expect(await leer()).toMatchObject({
      estado: 'baja',
      planVersionId: x.version.id,
    });
  }));

it.each([
  'moneda',
  'importe',
  'ciclo',
  'archivado',
  'trial',
  'cantidad',
  'pais',
  'impuestos',
] as const)(
  'rechaza precio remoto incompatible (%s) y no deja oferta parcial',
  (caso) =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      const original = x.paddle.leerPrecioOferta.getMockImplementation()!;
      x.paddle.leerPrecioOferta.mockImplementation(async (id) => {
        const p = await original(id);
        if (caso === 'impuestos') p.taxMode = 'internal';
        if (caso === 'moneda') p.unitPrice.currencyCode = 'ARS';
        if (caso === 'importe') p.unitPrice.amount = '1';
        if (caso === 'ciclo') p.billingCycle.frequency = 2;
        if (caso === 'archivado') p.status = 'archived';
        if (caso === 'trial')
          p.trialPeriod = { interval: 'day', frequency: 7 } as never;
        if (caso === 'cantidad') p.quantity.minimum = 5;
        if (caso === 'pais') p.unitPriceOverrides = [{}] as never;
        return p;
      });
      await expect(x.service.activar(c.staff, x.dto)).rejects.toThrow(
        /no coincide/,
      );
      expect(
        await c.tx.planOferta.count({ where: { versionId: x.version.id } }),
      ).toBe(0);
    }),
);

it('rechaza mezcla de ciclos, planes duplicados, ítems desconocidos y cantidades inválidas sin conceder cupos', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await preparar(c);
    await x.service.activar(c.staff, x.dto);
    const sync = new SuscripcionSyncService(c.db);
    const base = x.dto.precios[0].priceId;
    const extra = x.dto.precios[1].priceId;
    const anual = x.dto.precios[3].priceId;
    const original = await c.tx.suscripcion.findFirstOrThrow({
      where: { tenantId: c.tenantId },
    });
    const item = (id: string, quantity: unknown = 1) => ({
      price: { id },
      quantity,
    });
    for (const items of [
      [item(base), item(anual)],
      [item(base), item(base)],
      [item(base, 2)],
      [item(base), item(extra, 1000)],
      [item(base), item(extra, 1.5)],
      [item(base), item(extra, '4')],
      [item(extra, 3)],
      [item(base), item(precioId())],
    ]) {
      const ext = sync.extraer({
        id: 'sub_invalida',
        status: 'active',
        customData: { tenantId: c.tenantId },
        items,
      })!;
      expect((await sync.aplicar(ext)).aplicado).toBe(false);
      expect(
        await c.tx.suscripcion.findFirstOrThrow({
          where: { tenantId: c.tenantId },
        }),
      ).toEqual(original);
    }
  }));

it('una oferta inmutable no admite reutilizar precio, edición directa ni activaciones con sesión o revisión inválidas', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await preparar(c);
    await expect(
      x.service.activar({ ...c.staff, plataformaMfaPendiente: true }, x.dto),
    ).rejects.toThrow(/administración/);
    await expect(
      x.service.activar(c.staff, { ...x.dto, revision: 3 }),
    ).rejects.toThrow(/oferta cambió/);
    const a = await x.service.activar(c.staff, x.dto);
    await expect(
      x.service.activar(c.staff, { ...x.dto, trialDias: 30 }),
    ).rejects.toThrow(/inmutables/);
    const otra = await c.publicar(x.contenido);
    await expect(
      x.service.activar(c.staff, { ...x.dto, versionId: otra.id }),
    ).rejects.toThrow(/otro contrato/);
    for (const modelo of ['planOferta', 'planOfertaPrecio'] as const) {
      await c.tx.$executeRawUnsafe('SAVEPOINT inmutable_oferta');
      const op =
        modelo === 'planOferta'
          ? c.tx.planOferta.update({
              where: { id: a.actual!.ofertaId },
              data: { trialDias: 30 },
            })
          : c.tx.planOfertaPrecio.updateMany({
              where: { ofertaId: a.actual!.ofertaId },
              data: { importe: 1 },
            });
      await expect(op).rejects.toThrow(/inmutables/);
      await c.tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT inmutable_oferta');
    }
  }));

it.each(['canceled', 'paused', 'past_due'] as const)(
  'un estado %s auténtico se aplica aunque falten precios, sin borrar el contrato',
  (estado) =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      const oferta = await x.service.activar(c.staff, x.dto);
      const sync = new SuscripcionSyncService(c.db);
      const intento = await confirmarIntento(
        c,
        oferta.actual!.ofertaId,
        'mensual',
        0,
      );
      const data = {
        id: 'sub_condiciones_incompletas',
        status: 'active',
        customData: { tenantId: c.tenantId, contratacionId: intento.id },
        items: [{ price: { id: x.dto.precios[0].priceId }, quantity: 1 }],
      };
      await sync.aplicar(sync.extraer(data)!);
      const resultado = await sync.aplicar(
        sync.extraer({ ...data, status: estado, items: [] })!,
      );
      expect(resultado).toMatchObject({
        aplicado: true,
        advertencia: expect.stringContaining('requieren revisión'),
      });
      const s = await c.tx.suscripcion.findFirstOrThrow({
        where: { tenantId: c.tenantId },
      });
      expect(s).toMatchObject({
        planVersionId: x.version.id,
        estado:
          estado === 'canceled'
            ? 'baja'
            : estado === 'paused'
              ? 'suspendida'
              : 'activa',
      });
      if (estado === 'past_due') expect(s.graciaHasta).not.toBeNull();
      // Un estado activo con datos incompletos no vuelve a conceder acceso.
      expect(
        (await sync.aplicar(sync.extraer({ ...data, items: [] })!)).aplicado,
      ).toBe(false);
    }),
);

it('permite ofrecer sólo el ciclo mensual y no inventa un precio anual pendiente', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await preparar(c);
    const version = await c.publicar({
      ...x.contenido,
      precios: { ...precios, anual: null, usuarioAnual: null },
    });
    const dto = {
      ...x.dto,
      versionId: version.id,
      precios: x.dto.precios.filter((p) => p.ciclo === 'mensual'),
    };
    const oferta = await x.service.activar(c.staff, dto);
    expect(oferta.actual).toMatchObject({
      precioMensual: 190,
      anual: null,
      usuarioAnual: null,
    });
    const otra = await c.publicar({
      ...x.contenido,
      precios: { ...precios, anual: null, usuarioAnual: null },
    });
    await expect(
      x.service.activar(c.staff, { ...x.dto, versionId: otra.id }),
    ).rejects.toThrow(/Definí el precio/);
  }));

it('el alta administrativa también captura la versión y no concede permisos por fallback del catálogo anterior', () =>
  conPlanesAsignados(prisma, async (c) => {
    const x = await preparar(c);
    const oferta = await x.service.activar(c.staff, x.dto);
    const plan = await c.tx.plan.findUniqueOrThrow({
      where: { codigo: x.version.codigo },
    });
    expect(() => contratoSuscripcion({ plan })).toThrow(/versión asignada/);
    const alta = await new TenantProvisioningService().provisionarBase(c.tx, {
      nombre: 'Alta administrativa de prueba',
      plan: { id: plan.id, trialDias: 90 },
      origen: 'plataforma',
    });
    const s = await c.tx.suscripcion.findFirstOrThrow({
      where: { tenantId: alta.tenantId },
      include: { plan: true, planVersion: true },
    });
    expect(s).toMatchObject({
      ofertaId: oferta.actual!.ofertaId,
      planVersionId: x.version.id,
    });
    expect(contratoSuscripcion(s).limites.usuariosMax).toBe(3);
    expect(Math.round((s.trialHasta!.getTime() - Date.now()) / 86400000)).toBe(
      14,
    );
    await x.service.retirar(c.staff, {
      ofertaId: oferta.actual!.ofertaId,
      revision: 1,
      motivo: 'Retirar oferta para nuevas altas',
    });
    await expect(
      new TenantProvisioningService().provisionarBase(c.tx, {
        nombre: 'Alta sin oferta',
        plan: { id: plan.id, trialDias: 14 },
        origen: 'plataforma',
      }),
    ).rejects.toThrow(/oferta publicada/);
  }));

it('el DTO admite códigos del catálogo y exige identificadores válidos sin aceptar precios del navegador', async () => {
  const dto = plainToInstance(IniciarRegistroDto, {
    planCodigo: 'avanzado',
    ofertaId: randomUUID(),
    nombreCompleto: 'Cliente nuevo',
    empresaNombre: 'Empresa prueba',
    email: 'registro@test.local',
    password: 'ClaveSegura2026',
    paisCodigo: 'AR',
    zonaHoraria: 'America/Argentina/Buenos_Aires',
    aceptaTerminos: true,
  });
  expect(
    await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
  ).toEqual([]);
  Object.assign(dto, { precioMensual: 1 });
  expect(
    (await validate(dto, { whitelist: true, forbidNonWhitelisted: true }))
      .length,
  ).toBeGreaterThan(0);
});
