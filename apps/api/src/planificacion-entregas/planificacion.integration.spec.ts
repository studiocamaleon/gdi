import type { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
/* eslint-disable @typescript-eslint/require-await -- Dobles de IO asíncrono en pruebas. */
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { PlanificacionEntregasWorker } from './planificacion.worker';
import { PlanificacionEntregasDispatcher } from './planificacion-dispatcher';
import { TenantConcurrencyService } from '../workers/tenant-concurrency.service';
import type { TrabajoPlanEntrega } from './planificacion-cola';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import type { EtaService } from '../eta/eta.service';
import type { CotizarInput, CotizarOutput } from '../motor-universal/tipos';
import { podarPlata } from '../auth/margenes';
import { PlanificacionEntregasService } from './planificacion.service';
import { cotizacionesExhibidor } from '../../test/fixtures/f6-planificacion/cotizaciones-exhibidor';
import { exhibidorControlado } from '../../test/fixtures/f6-planificacion/exhibidor-controlado';
import type { SolicitarPlanEntregaDto } from './planificacion.dto';

const db = new PrismaService();
const tenantId = randomUUID();
const auth = { tenantId, userId: randomUUID() } as CurrentAuth;
const fuentes = cotizacionesExhibidor();
const base = exhibidorControlado().taller;
const pasos = [
  ...fuentes[0].cotizacion.pasos,
  ...fuentes[0].cotizacion.componentesFabricados!.flatMap((h) => h.pasos!),
].filter((p) => p.activado);
const taller = {
  ...base,
  items: [] as typeof base.items,
  margenEtaDias: 1,
  estaciones: pasos.map((p) => ({
    ...base.estaciones[0],
    id: p.familiaCodigo,
    equipoProduccion: {
      ...base.estaciones[0].equipoProduccion!,
      id: `equipo-${p.familiaCodigo}`,
    },
    familias: [p.familiaCodigo],
    maquinas: p.tiempo?.maquinaId
      ? [
          {
            id: p.tiempo.maquinaId,
            centroCostoId: p.tiempo.centroCostoId ?? null,
          },
        ]
      : [],
  })),
};
const service = new PlanificacionEntregasService(
  db,
  {
    contextoSimulacion: async () => taller,
  } as unknown as EtaService,
  {
    sincronizarLotesEntrega: jest.fn(),
    prepararRecorridosDeItems: jest.fn(),
  } as unknown as OrdenesTrabajoService,
);
let itemId: string, ordenId: string, productoId: string, categoriaId: string;
const cotizar = jest.fn(
  async (input: CotizarInput): Promise<CotizarOutput> => ({
    exitoso: true,
    errores: [],
    cotizacion: {
      ...fuentes.find(
        (f) =>
          f.cotizacion.cantidadPedida === Number(input.jobContext.cantidad),
      )!.cotizacion,
      productoId,
    },
  }),
);
const solicitud = (expectedVersion = 0): SolicitarPlanEntregaDto => ({
  expectedVersion,
  idempotencyKey: randomUUID(),
  entregas: [1, 2, 3, 4].map((i) => ({ clave: `entrega-${i}`, cantidad: 50 })),
});
beforeAll(async () => {
  await db.user.create({
    data: { id: auth.userId, email: `${auth.userId}@test.invalid` },
  });
  await db.tenant.create({
    data: { id: tenantId, nombre: 'Prueba aislada F6', slug: `f6-${tenantId}` },
  });
  categoriaId = (
    await db.productoCategoriaComercial.create({
      data: { codigo: `f6-${tenantId}`, nombre: 'F6 prueba' },
    })
  ).id;
  const subcategoria = await db.productoSubcategoriaComercial.create({
    data: {
      categoriaId,
      codigo: `f6-${tenantId}`,
      nombre: 'F6 prueba',
      atributosSchemaJson: {},
    },
  });
  productoId = (
    await db.producto.create({
      data: {
        tenantId,
        subcategoriaComercialId: subcategoria.id,
        codigo: 'EXHIBIDOR-F6',
        nombre: 'Exhibidor F6',
      },
    })
  ).id;
}, 30_000);
beforeEach(async () => {
  taller.ahora = new Date('2026-09-09T08:00:00-03:00');
  taller.items = [];
  taller.margenEtaDias = 1;
  const cotizacion = await db.cotizacion.create({ data: { tenantId } });
  const c = await db.cotizacionItem.create({
    data: {
      tenantId,
      cotizacionId: cotizacion.id,
      productoId,
      cantidad: 200,
      jobContextJson: { cantidad: 200, testOrigen: 'confiable' },
      snapshotJson: {},
    },
  });
  ordenId = (
    await db.ordenTrabajo.create({
      data: { tenantId, numero: `F6-${randomUUID()}`, estado: 'pendiente' },
    })
  ).id;
  itemId = (
    await db.ordenTrabajoItem.create({
      data: {
        tenantId,
        ordenId,
        cotizacionItemId: c.id,
        codigo: 'EXH',
        nombre: 'Exhibidor',
        familia: 'prueba',
        cantidad: 200,
        cantidadUnidad: 'u.',
        subtotal: 1000,
        impuestos: 210,
        total: 1210,
      },
    })
  ).id;
  cotizar.mockClear();
  // Las solicitudes de los casos anteriores no deben consumir el cupo del siguiente.
  await db.planEntregaRevision.updateMany({
    where: { tenantId, estado: { in: ['SOLICITADA', 'CALCULANDO'] } },
    data: { estado: 'SUPERADA' },
  });
});
afterAll(async () => {
  await db.tenant.delete({ where: { id: tenantId } });
  await db.user.delete({ where: { id: auth.userId } });
  if (categoriaId) {
    await db.productoSubcategoriaComercial.deleteMany({
      where: { categoriaId },
    });
    await db.productoCategoriaComercial.delete({ where: { id: categoriaId } });
  }
  await db.$disconnect();
}, 30_000);
async function calculada() {
  const v = await service.solicitar(auth, itemId, solicitud());
  await service.calcular(tenantId, v.plan!.revisionId, cotizar);
  const r = await service.consultar(tenantId, itemId);
  expect(r.plan?.error).toBeNull();
  expect(r.plan?.estado).toBe('LISTA');
  return r.plan!;
}
it('persiste fecha civil y reintenta sin duplicar solicitudes', async () => {
  const dto = solicitud();
  dto.entregas[0].fechaSolicitada = '2026-09-10';
  const a = await service.solicitar(auth, itemId, dto),
    b = await service.solicitar(auth, itemId, dto);
  expect(a.plan?.id).toBe(b.plan?.id);
  expect(b.plan?.revision).toBe(1);
  expect(b.plan?.entregas[0].fechaSolicitada).toBe('2026-09-10');
  expect(
    await db.planEntregaRevision.count({
      where: { tenantId, planId: a.plan!.id },
    }),
  ).toBe(1);
  await expect(
    service.solicitar(auth, itemId, {
      ...dto,
      entregas: dto.entregas.map((e) => ({ ...e, fechaSolicitada: undefined })),
    }),
  ).rejects.toThrow('otros datos');
});
it('rechaza cantidades incompletas y fechas imposibles o invertidas', async () => {
  await expect(
    service.solicitar(auth, itemId, {
      ...solicitud(),
      entregas: [{ clave: 'a', cantidad: 199 }],
    }),
  ).rejects.toThrow('sumar');
  await expect(
    service.solicitar(auth, itemId, {
      ...solicitud(),
      entregas: [{ clave: 'a', cantidad: 200, fechaSolicitada: '2026-02-30' }],
    }),
  ).rejects.toThrow('válidas');
  await expect(
    service.solicitar(auth, itemId, {
      ...solicitud(),
      entregas: [
        { clave: 'a', cantidad: 100, fechaSolicitada: '2026-09-11' },
        { clave: 'b', cantidad: 100, fechaSolicitada: '2026-09-10' },
      ],
    }),
  ).rejects.toThrow('orden');
});
it('aísla lectura, solicitud y elección entre empresas', async () => {
  const otro = { ...auth, tenantId: randomUUID() };
  await expect(service.consultar(otro.tenantId, itemId)).rejects.toThrow(
    'No se encontró',
  );
  await expect(service.solicitar(otro, itemId, solicitud())).rejects.toThrow(
    'No se encontró',
  );
  await expect(
    service.elegir(otro, itemId, {
      expectedVersion: 0,
      revisionId: randomUUID(),
      alternativaId: 'por-entrega',
      aceptarAjusteNesting: true,
    }),
  ).rejects.toThrow('No se encontró');
});
it('sólo una ventana puede crear la siguiente revisión', async () => {
  const r = await Promise.allSettled([
    service.solicitar(auth, itemId, solicitud()),
    service.solicitar(auth, itemId, solicitud()),
  ]);
  expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  expect(r.filter((x) => x.status === 'rejected')).toHaveLength(1);
});
it('cotiza cantidades exactas, conserva el precio y solicita la adopción de los lotes', async () => {
  const antes = await db.ordenTrabajo.findUniqueOrThrow({
    where: { id: ordenId },
    include: { items: true },
  });
  const p = await calculada();
  expect(p.alternativas).toHaveLength(1);
  expect(p.desactualizado).toBe(false);
  expect(
    cotizar.mock.calls.map(([input]) => input.jobContext.cantidad),
  ).toEqual([200, 50]);
  expect(
    cotizar.mock.calls.every(
      ([input]) =>
        input.tenantId === tenantId &&
        input.jobContext.testOrigen === 'confiable',
    ),
  ).toBe(true);
  expect(p.alternativas.find((a) => a.id === 'por-entrega')?.placas).toBe(128);
  expect(JSON.stringify(p)).not.toMatch(
    /contorno|geometryJson|jobContext|testOrigen/,
  );
  expect(Buffer.byteLength(JSON.stringify(p))).toBeLessThan(100_000);
  expect(p.alternativas[0].costo).toBeGreaterThan(0);
  expect(podarPlata(p.alternativas[0])).not.toHaveProperty('costo');
  expect(podarPlata(p.alternativas[0])).not.toHaveProperty('costoAdicional');
  expect(p.nesting?.estado).toBe('REQUIERE_AJUSTE');
  await expect(
    service.elegir(auth, itemId, {
      expectedVersion: p.version,
      revisionId: p.revisionId,
      alternativaId: 'por-entrega',
    }),
  ).rejects.toThrow('Aceptá el ajuste');
  await expect(
    service.elegir(auth, itemId, {
      expectedVersion: p.version,
      revisionId: p.revisionId,
      alternativaId: 'completo',
      aceptarAjusteNesting: true,
    }),
  ).rejects.toThrow('una tanda por entrega');
  const elegido = await service.elegir(auth, itemId, {
    expectedVersion: p.version,
    revisionId: p.revisionId,
    alternativaId: 'por-entrega',
    aceptarAjusteNesting: true,
  });
  expect(elegido.plan?.alternativaElegidaId).toBe('por-entrega');
  expect(elegido.reservaCapacidad).toBe(false);
  expect(elegido.plan?.ajusteNestingAceptado).toBe(true);
  const despues = await db.ordenTrabajo.findUniqueOrThrow({
    where: { id: ordenId },
    include: { items: true },
  });
  const fechas = p.alternativas
    .find((a) => a.id === 'por-entrega')!
    .entregas.map((e) => e.fechaSolicitada || e.fechaSugerida)
    .filter(Boolean)
    .sort();
  expect(despues.fechaEntrega?.toISOString().slice(0, 10)).toBe(fechas.at(-1));
  expect({
    ...despues,
    fechaEntrega: antes.fechaEntrega,
    updatedAt: antes.updatedAt,
  }).toEqual(antes);
  expect(elegido.plan?.desactualizado).toBe(false);
  const recalculada = await service.solicitar(
    auth,
    itemId,
    solicitud(elegido.plan!.version),
  );
  expect(recalculada.plan?.ajusteNestingAceptado).toBe(false);
}, 30_000);
it('confirma las cuatro tandas con layouts originales sin pedir aceptar un ajuste', async () => {
  const item = await db.ordenTrabajoItem.findUniqueOrThrow({
    where: { id: itemId },
  });
  const q = fuentes.find(
    (f) => f.cotizacion.cantidadPedida === 200,
  )!.cotizacion;
  await db.cotizacionItem.update({
    where: { id: item.cotizacionItemId! },
    data: db.prepararSnapshot('CotizacionItem', {
      trazabilidadJson: JSON.parse(
        JSON.stringify({
          pasos: q.pasos,
          componentesFabricados: q.componentesFabricados,
          analisisNestingCompuesto: q.analisisNestingCompuesto,
        }),
      ) as Prisma.InputJsonValue,
      snapshotJson: JSON.parse(
        JSON.stringify({ ejecucion: { costos: q.costos } }),
      ) as Prisma.InputJsonValue,
    }),
  });
  const p = await calculada();
  expect(p.nesting?.estado).toBe('CONSERVADO');
  expect(p.nesting?.placasOriginales).toBe(128);
  expect(p.nesting?.placasPlan).toBe(128);
  expect(p.nesting?.lotes.map((l) => l.layouts.map((x) => x.copias))).toEqual(
    Array.from({ length: 4 }, () => [25, 4, 1, 1, 1]),
  );
  const elegida = await service.elegir(auth, itemId, {
    expectedVersion: p.version,
    revisionId: p.revisionId,
    alternativaId: 'por-entrega',
  });
  expect(elegida.plan?.alternativaElegidaId).toBe('por-entrega');
  expect(elegida.plan?.ajusteNestingAceptado).toBe(false);
}, 30_000);
it('bloquea elección con tiempo vencido o carga diferente', async () => {
  const p = await calculada(),
    dto = {
      expectedVersion: p.version,
      revisionId: p.revisionId,
      alternativaId: 'por-entrega',
      aceptarAjusteNesting: true,
    };
  taller.ahora = new Date(taller.ahora.getTime() + 6 * 60_000);
  expect((await service.consultar(tenantId, itemId)).plan?.desactualizado).toBe(
    true,
  );
  await expect(service.elegir(auth, itemId, dto)).rejects.toThrow(
    'desactualizada',
  );
  taller.ahora = new Date('2026-09-09T08:00:00-03:00');
  taller.margenEtaDias = 2;
  await expect(service.elegir(auth, itemId, dto)).rejects.toThrow(
    'desactualizada',
  );
}, 30_000);
it('reemplaza trabajo propio pendiente conservando los compromisos ajenos', async () => {
  taller.items = [
    { ...base.items[0], id: itemId },
    { ...base.items[0], id: 'otra-ot' },
  ];
  const c = await service['contexto'](tenantId, new Set([itemId]));
  expect(c.taller.items.map((i) => i.id)).toEqual(['otra-ot']);
});
it('un cambio de OT durante el cálculo no publica el resultado anterior', async () => {
  const v = await service.solicitar(auth, itemId, solicitud());
  await service.calcular(tenantId, v.plan!.revisionId, async (input) => {
    const r = await cotizar(input);
    await db.ordenTrabajo.update({
      where: { id: ordenId },
      data: { observaciones: 'Cambio durante cálculo' },
    });
    return r;
  });
  const p = (await service.consultar(tenantId, itemId)).plan!;
  expect(p.estado).toBe('FALLIDA');
  expect(p.error).toContain('cambió');
  expect(p.alternativas).toHaveLength(0);
});
it('la ejecución anterior no pisa una nueva revisión', async () => {
  const v = await service.solicitar(auth, itemId, solicitud());
  let reemplazada = false;
  await service.calcular(tenantId, v.plan!.revisionId, async (input) => {
    if (!reemplazada) {
      reemplazada = true;
      await service.solicitar(auth, itemId, solicitud(v.plan!.version));
    }
    return cotizar(input);
  });
  const p = (await service.consultar(tenantId, itemId)).plan!;
  expect(p.revision).toBe(2);
  expect(p.estado).toBe('SOLICITADA');
  expect(p.historial.find((r) => r.numero === 1)?.estado).toBe('SUPERADA');
});
it('un error de cotización permite reintentar con otra revisión', async () => {
  const v = await service.solicitar(auth, itemId, solicitud());
  await service.calcular(tenantId, v.plan!.revisionId, async () => {
    throw new Error('Falta el perfil de corte.');
  });
  const p = (await service.consultar(tenantId, itemId)).plan!;
  expect(p.estado).toBe('FALLIDA');
  expect(p.error).toContain('perfil de corte');
  expect(
    (await service.solicitar(auth, itemId, solicitud(p.version))).plan
      ?.revision,
  ).toBe(2);
});
it('la producción iniciada no admite un plan inicial', async () => {
  await db.ordenTrabajo.update({
    where: { id: ordenId },
    data: { estado: 'produccion' },
  });
  await expect(service.solicitar(auth, itemId, solicitud())).rejects.toThrow(
    'antes de comenzar',
  );
});

it('dos reintentos concurrentes comparten la primera revisión', async () => {
  const dto = solicitud();
  const [a, b] = await Promise.all([
    service.solicitar(auth, itemId, dto),
    service.solicitar(auth, itemId, dto),
  ]);
  expect(a.plan?.revisionId).toBe(b.plan?.revisionId);
  expect(a.plan?.revision).toBe(1);
});

it('recorre outbox → Redis → worker → revisión persistida usando sólo IDs', async () => {
  const nombre = `grafo-f6-test-${randomUUID()}`;
  const connection = { host: '127.0.0.1', port: 6379 };
  const queue = new Queue<TrabajoPlanEntrega>(nombre, { connection });
  const events = new QueueEvents(nombre, { connection });
  const concurrency = new TenantConcurrencyService();
  const processor = new PlanificacionEntregasWorker(
    service,
    { cotizar } as never,
    concurrency,
  );
  const worker = new Worker<TrabajoPlanEntrega>(
    nombre,
    (job) => processor.procesar(job),
    { connection },
  );
  try {
    await Promise.all([worker.waitUntilReady(), events.waitUntilReady()]);
    const v = await service.solicitar(auth, itemId, solicitud());
    const dispatcher = new PlanificacionEntregasDispatcher({
      planEntregaRevision: {
        updateMany: async () => ({ count: 0 }),
        findMany: () =>
          db.planEntregaRevision.findMany({
            where: { tenantId, id: v.plan!.revisionId, estado: 'SOLICITADA' },
            select: { id: true, tenantId: true },
          }),
      },
    } as never);
    Object.assign(dispatcher, { queue });
    await dispatcher.despachar();
    const job = await queue.getJob(v.plan!.revisionId);
    expect(job?.data).toEqual({ tenantId, revisionId: v.plan!.revisionId });
    await job!.waitUntilFinished(events, 20_000);
    const final = await service.consultar(tenantId, itemId);
    expect(final.plan?.estado).toBe('LISTA');
    expect(final.plan?.alternativas.length).toBe(1);
  } finally {
    await worker.close();
    await events.close();
    await queue.obliterate();
    await queue.close();
    concurrency.onApplicationShutdown();
  }
}, 30_000);

it('un cálculo largo renueva su pulso y no vence mientras sigue trabajando', async () => {
  const v = await service.solicitar(auth, itemId, solicitud());
  const revisionId = v.plan!.revisionId;
  let liberar!: () => void, inicio!: () => void;
  const espera = new Promise<void>((r) => {
    liberar = r;
  });
  const iniciado = new Promise<void>((r) => {
    inicio = r;
  });
  const intervalos = jest.spyOn(global, 'setInterval');
  const calculo = service.calcular(tenantId, revisionId, async (input) => {
    inicio();
    await espera;
    return cotizar(input);
  });
  try {
    await iniciado;
    const anterior = new Date(Date.now() - 180_000);
    await db.planEntregaRevision.update({
      where: { id: revisionId },
      data: { updatedAt: anterior },
    });
    const pulso = intervalos.mock.calls.find(([, ms]) => ms === 30_000)?.[0];
    expect(typeof pulso).toBe('function');
    (pulso as () => void)();
    for (let i = 0; i < 100; i++) {
      const actual = await db.planEntregaRevision.findUniqueOrThrow({
        where: { id: revisionId },
      });
      if (+actual.updatedAt > +anterior) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    const actual = await db.planEntregaRevision.findUniqueOrThrow({
      where: { id: revisionId },
    });
    expect(+actual.updatedAt).toBeGreaterThan(+anterior);
    const dispatcher = new PlanificacionEntregasDispatcher({
      planEntregaRevision: {
        updateMany: (args: Prisma.PlanEntregaRevisionUpdateManyArgs) =>
          db.planEntregaRevision.updateMany(args),
        findMany: async () => [],
      },
    } as unknown as PrismaService);
    await dispatcher.despachar();
    expect(
      (
        await db.planEntregaRevision.findUniqueOrThrow({
          where: { id: revisionId },
        })
      ).estado,
    ).toBe('CALCULANDO');
  } finally {
    liberar();
    intervalos.mockRestore();
    await calculo;
  }
  expect(
    (
      await db.planEntregaRevision.findUniqueOrThrow({
        where: { id: revisionId },
      })
    ).estado,
  ).toBe('LISTA');
});

it('la pérdida del pulso habilita reintentar y un worker tardío no publica sobre la revisión vencida', async () => {
  const v = await service.solicitar(auth, itemId, solicitud());
  const revisionId = v.plan!.revisionId;
  let liberar!: () => void, inicio!: () => void;
  const espera = new Promise<void>((r) => {
    liberar = r;
  });
  const iniciado = new Promise<void>((r) => {
    inicio = r;
  });
  const calculo = service.calcular(tenantId, revisionId, async (input) => {
    inicio();
    await espera;
    return cotizar(input);
  });
  try {
    await iniciado;
    await db.planEntregaRevision.update({
      where: { id: revisionId },
      data: { updatedAt: new Date(Date.now() - 121_000) },
    });
    const dispatcher = new PlanificacionEntregasDispatcher({
      planEntregaRevision: {
        updateMany: (args: Prisma.PlanEntregaRevisionUpdateManyArgs) =>
          db.planEntregaRevision.updateMany(args),
        findMany: async () => [],
      },
    } as unknown as PrismaService);
    await dispatcher.despachar();
    expect(
      await db.planEntregaRevision.findUniqueOrThrow({
        where: { id: revisionId },
      }),
    ).toMatchObject({ estado: 'FALLIDA', ejecucionId: null });
  } finally {
    liberar();
    await calculo;
  }
  expect(
    (
      await db.planEntregaRevision.findUniqueOrThrow({
        where: { id: revisionId },
      })
    ).estado,
  ).toBe('FALLIDA');
  expect(
    await db.fuenteProduccionEntrega.count({ where: { revisionId } }),
  ).toBe(0);
});
