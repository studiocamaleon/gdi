/* eslint-disable @typescript-eslint/require-await -- Dobles de IO asíncrono en pruebas. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import type { EtaService } from '../eta/eta.service';
import type { CotizarInput, CotizarOutput } from '../motor-universal/tipos';
import {
  prepararVinculosEntrega,
  vincularEntregasAlCrear,
} from './vincular-plan-entrega';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import type { CrearOrdenTrabajoDto } from '../ordenes-trabajo/dto/crear-orden-trabajo.dto';
import { PlanificacionEntregasService } from './planificacion.service';
import {
  actualizarFechaFinalOrden,
  distribucionesDeItems,
  fechaDistribucion,
} from './resumen-entregas';
import { cotizacionesExhibidor } from '../../test/fixtures/f6-planificacion/cotizaciones-exhibidor';
import { exhibidorControlado } from '../../test/fixtures/f6-planificacion/exhibidor-controlado';
import type { SolicitarPlanEntregaDto } from './planificacion.dto';
import type { FuenteCotizacionF6 } from '../eta/planificacion/adaptador-cotizacion';

const db = new PrismaService();
const tenantId = randomUUID();
const auth = {
  tenantId,
  userId: randomUUID(),
  email: 'f6@test.invalid',
} as CurrentAuth;
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
let cotizacionItemId: string, productoId: string, categoriaId: string;
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
      precioNetoTotal: 1000,
      impuestosPorFueraTotal: 210,
      precioTotal: 1210,
    },
  });
  cotizacionItemId = c.id;
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

const ordenes = new OrdenesTrabajoService(
  db,
  {
    capturarEmision: jest.fn().mockResolvedValue(undefined),
    contextoSimulacion: async () => taller,
  } as never,
  {} as never,
  { sincronizar: jest.fn().mockResolvedValue(undefined) } as never,
  { emitir: jest.fn().mockResolvedValue(undefined) } as never,
  {} as never,
  {} as never,
  {} as never,
  { asegurarParaItem: jest.fn().mockResolvedValue(undefined) } as never,
  {
    simular: jest
      .fn()
      .mockResolvedValue({ maximoCanjeable: 0, canjeMonto: 0, canjePuntos: 0 }),
  } as never,
  {} as never,
);
// Esta suite verifica el alta y el vínculo. La ejecución real (sin estos dobles)
// se verifica en lotes-ejecutables.integration.spec.ts.
jest.spyOn(ordenes, 'sincronizarLotesEntrega').mockResolvedValue(undefined);
jest
  .spyOn(
    ordenes as unknown as { materializarPasosItems: () => Promise<void> },
    'materializarPasosItems',
  )
  .mockResolvedValue(undefined);
// La respuesta enriquecida y las geometrías de producción tienen sus propias
// pruebas. Aquí se ejercita create real, su transacción, contador y vínculos.
jest.spyOn(ordenes, 'findOne').mockImplementation(async (a, id) => {
  const ot = await db.ordenTrabajo.findFirstOrThrow({
    where: { id, tenantId: a.tenantId },
  });
  return ot as unknown as Awaited<ReturnType<OrdenesTrabajoService['findOne']>>;
});

async function calculadaPrevia() {
  const v = await service.solicitar(auth, cotizacionItemId, solicitud(), true);
  await service.calcular(tenantId, v.plan!.revisionId, cotizar);
  const r = await service.consultar(tenantId, cotizacionItemId, true);
  expect(r.plan?.error).toBeNull();
  expect(r.plan?.estado).toBe('LISTA');
  return r.plan!;
}
async function elegidaPrevia() {
  const p = await calculadaPrevia();
  return (
    await service.elegir(
      auth,
      cotizacionItemId,
      {
        expectedVersion: p.version,
        revisionId: p.revisionId,
        alternativaId: 'por-entrega',
        aceptarAjusteNesting: true,
      },
      true,
    )
  ).plan!;
}
function payload(
  p: Awaited<ReturnType<typeof calculadaPrevia>>,
): CrearOrdenTrabajoDto {
  return {
    idempotencyKey: randomUUID(),
    estado: 'borrador',
    fechaEntrega: '2026-09-30',
    items: [
      {
        cotizacionItemId,
        codigo: 'EXH',
        nombre: 'Exhibidor',
        familia: 'prueba',
        cantidad: 200,
        cantidadUnidad: 'unidad',
        subtotal: 1000,
        impuestos: 210,
        total: 1210,
        planEntrega: {
          planId: p.id,
          revisionId: p.revisionId,
          expectedVersion: p.version,
        },
      },
    ],
  };
}

async function otroCliente() {
  return db.cliente.create({
    data: {
      tenantId,
      nombre: `Cliente nuevo F6 ${randomUUID()}`,
      telefonoCodigo: '+54',
      telefonoNumero: '',
      paisCodigo: 'AR',
    },
  });
}

it('cambiar cliente conserva las cuatro entregas y utiliza el precio del nuevo snapshot comercial', async () => {
  const p = await elegidaPrevia();
  const cliente = await otroCliente();
  const origen = await db.cotizacionItem.findUniqueOrThrow({
    where: { id: cotizacionItemId },
  });
  const cotizacion = await db.cotizacion.create({
    data: { tenantId, clienteId: cliente.id },
  });
  const nuevo = await db.cotizacionItem.create({
    data: {
      tenantId,
      cotizacionId: cotizacion.id,
      productoId,
      cantidad: 200,
      jobContextJson: origen.jobContextJson as never,
      snapshotJson: origen.snapshotJson as never,
      precioNetoTotal: 800,
      impuestosPorFueraTotal: 168,
      precioTotal: 968,
    },
  });
  const dto = payload(p);
  dto.clienteId = cliente.id;
  dto.items[0].cotizacionItemId = nuevo.id;
  const ot = await ordenes.create(auth, dto);
  const item = await db.ordenTrabajoItem.findFirstOrThrow({
    where: { tenantId, ordenId: ot.id, parentItemId: null },
  });
  expect(Number(item.total)).toBe(968);
  expect(item.cotizacionItemId).toBe(nuevo.id);
  const vista = await service.consultar(tenantId, item.id);
  expect(vista.plan).toMatchObject({
    id: p.id,
    revisionId: p.revisionId,
    alternativaElegidaId: 'por-entrega',
    desactualizado: false,
  });
  expect(vista.plan!.entregas).toEqual(p.entregas);
  expect(cotizar).toHaveBeenCalledTimes(2); // Sólo el cálculo original: 200 y 50.
  expect(
    (await db.planEntregaItem.findUniqueOrThrow({ where: { id: p.id } }))
      .cotizacionItemId,
  ).toBe(nuevo.id);
});

it('no traslada la distribución a otra fabricación aunque coincidan cliente y cantidad', async () => {
  const p = await elegidaPrevia();
  const cliente = await otroCliente();
  const cotizacion = await db.cotizacion.create({
    data: { tenantId, clienteId: cliente.id },
  });
  const nuevo = await db.cotizacionItem.create({
    data: {
      tenantId,
      cotizacionId: cotizacion.id,
      productoId,
      cantidad: 200,
      jobContextJson: { cantidad: 200, archivo: 'otras-piezas.dxf' },
      snapshotJson: {},
      precioNetoTotal: 800,
      impuestosPorFueraTotal: 168,
      precioTotal: 968,
    },
  });
  const dto = payload(p);
  dto.clienteId = cliente.id;
  dto.items[0].cotizacionItemId = nuevo.id;
  await expect(ordenes.create(auth, dto)).rejects.toThrow(
    'Cambió la fabricación',
  );
  expect(
    (await db.planEntregaItem.findUniqueOrThrow({ where: { id: p.id } }))
      .ordenItemId,
  ).toBeNull();
});

it.each(['editar', 'editarLote'] as const)(
  'cambiar el cliente por %s en una OT guardada conserva el plan sin renovar su vigencia',
  async (metodo) => {
    const p = await elegidaPrevia();
    const ot = await ordenes.create(auth, payload(p));
    const cliente = await otroCliente();
    const orden = await db.ordenTrabajo.findUniqueOrThrow({
      where: { id: ot.id },
    });
    const anterior = await db.planEntregaRevision.findUniqueOrThrow({
      where: { id: p.revisionId },
    });
    await ordenes[metodo](auth, ot.id, {
      clienteId: cliente.id,
      canalVenta: 'mostrador',
      expectedVersion: orden.updatedAt.toISOString(),
    });
    const item = await db.ordenTrabajoItem.findFirstOrThrow({
      where: { tenantId, ordenId: ot.id, parentItemId: null },
    });
    const vista = await service.consultar(tenantId, item.id);
    expect(vista.plan).toMatchObject({
      revisionId: p.revisionId,
      alternativaElegidaId: 'por-entrega',
      desactualizado: false,
    });
    expect(vista.plan!.entregas).toEqual(p.entregas);
    const actual = await db.planEntregaRevision.findUniqueOrThrow({
      where: { id: p.revisionId },
    });
    expect(actual.calculadaEl).toEqual(anterior.calculadaEl);
    expect(actual.contextoHuella).toBe(anterior.contextoHuella);
  },
);

it('conserva fechas por ítem y usa la última entrega elegida al crear y al eliminar su distribución', async () => {
  const p = await calculadaPrevia();
  const elegida = await service.elegir(
    auth,
    cotizacionItemId,
    {
      expectedVersion: p.version,
      revisionId: p.revisionId,
      alternativaId: p.recomendadaId!,
      aceptarAjusteNesting: true,
    },
    true,
  );
  const dto = payload(elegida.plan!);
  dto.fechaEntrega = '2026-12-31'; // Una fecha global anterior no domina a sus entregas.
  dto.items[0].fechaEntrega = '2026-09-10';
  const ot = await ordenes.create(auth, dto);
  const item = await db.ordenTrabajoItem.findFirstOrThrow({
    where: { tenantId, ordenId: ot.id, parentItemId: null },
  });
  expect(item.fechaEntrega?.toISOString().slice(0, 10)).toBe('2026-09-10');
  const resumen = (await distribucionesDeItems(db, tenantId, [item.id])).get(
    item.id,
  )!;
  expect(resumen.elegida).toBe(true);
  expect(resumen.entregas).toHaveLength(4);
  expect(JSON.stringify(resumen)).not.toMatch(/costo|geometr|operaciones/);
  const fin = fechaDistribucion(resumen)!;
  expect(
    (
      await db.ordenTrabajo.findUniqueOrThrow({ where: { id: ot.id } })
    ).fechaEntrega
      ?.toISOString()
      .slice(0, 10),
  ).toBe(fin);
  const actual = (await service.consultar(tenantId, item.id)).plan!;
  expect(actual.desactualizado).toBe(false);
  await expect(
    service.eliminar(auth, item.id, {
      planId: actual.id,
      expectedVersion: actual.version - 1,
    }),
  ).rejects.toThrow('cambió');
  await service.eliminar(auth, item.id, {
    planId: actual.id,
    expectedVersion: actual.version,
  });
  expect((await service.consultar(tenantId, item.id)).plan).toBeNull();
  expect(
    (
      await db.ordenTrabajo.findUniqueOrThrow({ where: { id: ot.id } })
    ).fechaEntrega
      ?.toISOString()
      .slice(0, 10),
  ).toBe('2026-09-10');
});

it('calcula el cierre con todos los ítems comerciales y lo adelanta al quitar el último', async () => {
  const ot = await db.ordenTrabajo.create({
    data: {
      tenantId,
      numero: `F6-fechas-${randomUUID()}`,
      fechaEntrega: new Date('2026-12-31'),
      items: {
        create: ['2026-09-12', '2026-10-02'].map((fechaEntrega, indice) => ({
          tenantId,
          codigo: `i${indice}`,
          nombre: 'Producto',
          familia: 'Prueba',
          cantidad: 1,
          cantidadUnidad: 'u',
          subtotal: 0,
          impuestos: 0,
          total: 0,
          fechaEntrega: new Date(fechaEntrega),
        })),
      },
    },
    include: { items: true },
  });
  await db.$transaction((tx) => actualizarFechaFinalOrden(tx, tenantId, ot.id));
  expect(
    (
      await db.ordenTrabajo.findUniqueOrThrow({ where: { id: ot.id } })
    ).fechaEntrega
      ?.toISOString()
      .slice(0, 10),
  ).toBe('2026-10-02');
  await db.$transaction(async (tx) => {
    await tx.ordenTrabajoItem.delete({
      where: { id: ot.items.find((i) => i.codigo === 'i1')!.id },
    });
    await actualizarFechaFinalOrden(tx, tenantId, ot.id);
  });
  expect(
    (
      await db.ordenTrabajo.findUniqueOrThrow({ where: { id: ot.id } })
    ).fechaEntrega
      ?.toISOString()
      .slice(0, 10),
  ).toBe('2026-09-12');
});

it('cotiza cantidades y elige una alternativa sin crear una OT ni reservar producción', async () => {
  const antes = await db.ordenTrabajo.count({ where: { tenantId } });
  const p = await calculadaPrevia();
  const v = await service.elegir(
    auth,
    cotizacionItemId,
    {
      expectedVersion: p.version,
      revisionId: p.revisionId,
      alternativaId: p.recomendadaId!,
      aceptarAjusteNesting: true,
    },
    true,
  );
  expect(v.plan!.alternativaElegidaId).toBe(p.recomendadaId);
  expect(v.reservaCapacidad).toBe(false);
  expect(await db.ordenTrabajo.count({ where: { tenantId } })).toBe(antes);
  expect(cotizar.mock.calls.map(([i]) => i.jobContext.cantidad)).toEqual([
    200, 50,
  ]);
  const guardado = await db.planEntregaItem.findFirstOrThrow({
    where: { id: p.id, tenantId },
  });
  expect(guardado.ordenItemId).toBeNull();
  expect(guardado.cotizacionItemId).toBe(cotizacionItemId);
});
it('la primera creación de OT conserva las cuatro entregas y la elección en el mismo commit', async () => {
  const p = await calculadaPrevia();
  const elegida = await service.elegir(
    auth,
    cotizacionItemId,
    {
      expectedVersion: p.version,
      revisionId: p.revisionId,
      alternativaId: p.recomendadaId!,
      aceptarAjusteNesting: true,
    },
    true,
  );
  const dto = payload(elegida.plan!);
  const ot = await ordenes.create(auth, dto);
  const item = await db.ordenTrabajoItem.findFirstOrThrow({
    where: { tenantId, ordenId: ot.id, parentItemId: null },
  });
  const desdeOt = await service.consultar(tenantId, item.id);
  expect(desdeOt.plan).toMatchObject({
    id: p.id,
    revisionId: p.revisionId,
    alternativaElegidaId: p.recomendadaId,
    estado: 'LISTA',
    desactualizado: false,
  });
  expect(desdeOt.plan!.entregas.map((e) => e.cantidad)).toEqual([
    50, 50, 50, 50,
  ]);
  expect((await ordenes.create(auth, dto)).id).toBe(ot.id);
  await expect(
    service.solicitar(auth, cotizacionItemId, solicitud(), true),
  ).rejects.toThrow('ya pertenece');
});
it('un fallo de escritura revierte la OT, el contador y el vínculo de entregas', async () => {
  const p = await elegidaPrevia();
  const antes = await db.ordenTrabajo.count({ where: { tenantId } });
  const contador = await db.ordenTrabajoContador.findMany({
    where: { tenantId },
  });
  const dto = payload(p);
  await expect(
    db.$transaction(async (tx) => {
      const vinculos = await prepararVinculosEntrega(
        tx,
        tenantId,
        null,
        dto.items,
      );
      const ot = await tx.ordenTrabajo.create({
        data: {
          tenantId,
          numero: `rollback-${randomUUID()}`,
          estado: 'borrador',
          items: {
            create: [
              {
                tenantId,
                cotizacionItemId,
                codigo: 'EXH',
                nombre: 'Exhibidor',
                familia: 'prueba',
                cantidad: 200,
                cantidadUnidad: 'unidad',
                subtotal: 1000,
                impuestos: 210,
                total: 1210,
              },
            ],
          },
        },
      });
      await tx.ordenTrabajoContador.upsert({
        where: { tenantId_anio: { tenantId, anio: 2026 } },
        create: { tenantId, anio: 2026, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      });
      await vincularEntregasAlCrear(tx, tenantId, ot.id, vinculos);
      throw new Error('Falla después de vincular');
    }),
  ).rejects.toThrow('Falla después de vincular');
  expect(await db.ordenTrabajo.count({ where: { tenantId } })).toBe(antes);
  expect(
    await db.ordenTrabajoContador.findMany({ where: { tenantId } }),
  ).toEqual(contador);
  expect(
    (
      await db.planEntregaItem.findFirstOrThrow({
        where: { id: p.id, tenantId },
      })
    ).ordenItemId,
  ).toBeNull();
});
it.each(['version', 'cotizacion', 'revision', 'cliente'] as const)(
  'rechaza %s distinta sin crear una OT incompleta',
  async (cambio) => {
    const p = await elegidaPrevia();
    const dto = payload(p);
    if (cambio === 'version') dto.items[0].planEntrega!.expectedVersion += 1;
    if (cambio === 'revision')
      dto.items[0].planEntrega!.revisionId = randomUUID();
    if (cambio === 'cotizacion')
      await db.cotizacionItem.update({
        where: { id: cotizacionItemId },
        data: { jobContextJson: { cantidad: 200, modificada: true } },
      });
    if (cambio === 'cliente') {
      const cliente = await db.cliente.create({
        data: {
          tenantId,
          nombre: 'Otro cliente',
          telefonoCodigo: '+54',
          telefonoNumero: '',
          paisCodigo: 'AR',
        },
      });
      dto.clienteId = cliente.id;
    }
    const antes = await db.ordenTrabajo.count({ where: { tenantId } });
    await expect(ordenes.create(auth, dto)).rejects.toThrow(
      /distribución|cotización/,
    );
    expect(await db.ordenTrabajo.count({ where: { tenantId } })).toBe(antes);
  },
);
it('espera a que termine el cálculo y conserva el pedido si todavía está en cola', async () => {
  const v = await service.solicitar(auth, cotizacionItemId, solicitud(), true);
  await expect(ordenes.create(auth, payload(v.plan!))).rejects.toThrow(
    'todavía se está calculando',
  );
  expect(
    (await service.consultar(tenantId, cotizacionItemId, true)).plan!.estado,
  ).toBe('SOLICITADA');
});
it('dos guardados simultáneos con la misma clave devuelven una sola OT con su plan', async () => {
  const dto = payload(await elegidaPrevia());
  const r = await Promise.all([
    ordenes.create(auth, dto),
    ordenes.create(auth, dto),
  ]);
  expect(r[0].id).toBe(r[1].id);
  expect(
    await db.ordenTrabajo.count({
      where: { tenantId, idempotencyKey: dto.idempotencyKey },
    }),
  ).toBe(1);
});
it('dos OTs distintas no pueden apropiarse de la misma distribución', async () => {
  const p = await elegidaPrevia();
  const r = await Promise.allSettled([
    ordenes.create(auth, payload(p)),
    ordenes.create(auth, payload(p)),
  ]);
  expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  expect(r.filter((x) => x.status === 'rejected')).toHaveLength(1);
});
it('un tenant ajeno no puede consultar, calcular ni vincular esta distribución', async () => {
  const p = await calculadaPrevia();
  const otra = { ...auth, tenantId: randomUUID() };
  await expect(
    service.consultar(otra.tenantId, cotizacionItemId, true),
  ).rejects.toThrow();
  await expect(
    service.solicitar(otra, cotizacionItemId, solicitud(), true),
  ).rejects.toThrow();
  await expect(ordenes.create(otra, payload(p))).rejects.toThrow();
});

it('también conserva el plan al emitir directamente una OT pendiente', async () => {
  const cliente = await db.cliente.create({
    data: {
      tenantId,
      nombre: 'Cliente del caso de emisión',
      telefonoCodigo: '+54',
      telefonoNumero: '',
      paisCodigo: 'AR',
    },
  });
  const origen = await db.cotizacionItem.findFirstOrThrow({
    where: { id: cotizacionItemId, tenantId },
    select: { cotizacionId: true },
  });
  await db.cotizacion.update({
    where: { id: origen.cotizacionId, tenantId },
    data: { clienteId: cliente.id },
  });
  const p = await elegidaPrevia();
  const dto = payload(p);
  dto.clienteId = cliente.id;
  dto.estado = 'pendiente';
  dto.fechaEntrega = new Date(Date.now() + 86_400_000)
    .toISOString()
    .slice(0, 10);
  const ot = await ordenes.create(auth, dto);
  const item = await db.ordenTrabajoItem.findFirstOrThrow({
    where: { ordenId: ot.id, tenantId, parentItemId: null },
  });
  expect(ot.estado).toBe('pendiente');
  expect((await service.consultar(tenantId, item.id)).plan).toMatchObject({
    id: p.id,
    revisionId: p.revisionId,
    desactualizado: false,
  });
});

it('no transforma un cálculo sin elegir en una distribución aceptada', async () => {
  const p = await calculadaPrevia();
  await expect(ordenes.create(auth, payload(p))).rejects.toThrow(
    'Guardá la distribución',
  );
});
it('revalida el reloj antes de crear la OT con una distribución', async () => {
  const p = await elegidaPrevia();
  taller.ahora = new Date(taller.ahora.getTime() + 6 * 60_000);
  await expect(ordenes.create(auth, payload(p))).rejects.toThrow(
    'Recalculá su distribución',
  );
});

it('persiste una distribución de tarjetas con contexto y cotización de 100 por entrega', async () => {
  const tarjetas = JSON.parse(
    gunzipSync(
      readFileSync(
        join(
          __dirname,
          '../../test/fixtures/f6-planificacion/tarjetas-500-100.json.gz',
        ),
      ),
    ).toString(),
  ) as FuenteCotizacionF6[];
  const estacionesAnteriores = taller.estaciones;
  const pasos = tarjetas[0].cotizacion.pasos.filter((p) => p.activado);
  taller.estaciones = pasos.map((p) => ({
    ...estacionesAnteriores[0],
    id: p.familiaCodigo,
    familias: [p.familiaCodigo],
    maquinas: p.tiempo?.maquinaId
      ? [
          {
            id: p.tiempo.maquinaId,
            centroCostoId: p.tiempo.centroCostoId ?? null,
          },
        ]
      : [],
  }));
  try {
    await db.cotizacionItem.update({
      where: { id: cotizacionItemId },
      data: {
        cantidad: 500,
        jobContextJson: {
          cantidad: 500,
          piezas: [{ cantidad: 500, anchoMm: 90, altoMm: 50 }],
          piezaAreaTotalM2: 2.25,
          piezaPerimetroTotalM: 140,
        },
      },
    });
    const creada = await service.solicitar(
      auth,
      cotizacionItemId,
      {
        expectedVersion: 0,
        idempotencyKey: randomUUID(),
        entregas: Array.from({ length: 5 }, (_, i) => ({
          clave: `e${i}`,
          cantidad: 100,
        })),
      },
      true,
    );
    const cotizarTarjetas = jest.fn(
      async (input: CotizarInput): Promise<CotizarOutput> => {
        expect(input.jobContext.piezas![0].cantidad).toBe(
          input.jobContext.cantidad,
        );
        expect(input.jobContext.piezaAreaTotalM2).toBeCloseTo(
          input.jobContext.cantidad * 0.0045,
          6,
        );
        return {
          exitoso: true,
          errores: [],
          cotizacion: {
            ...tarjetas.find(
              (f) => f.cotizacion.cantidadPedida === input.jobContext.cantidad,
            )!.cotizacion,
            productoId,
          },
        };
      },
    );
    await service.calcular(tenantId, creada.plan!.revisionId, cotizarTarjetas);
    const vista = await service.consultar(tenantId, cotizacionItemId, true);
    expect(vista.plan?.error).toBeNull();
    expect(vista.plan?.estado).toBe('LISTA');
    expect(
      vista.plan?.nesting?.lotes.every((l) => l.modo === 'LOTE_COMPLETO'),
    ).toBe(true);
    expect(
      cotizarTarjetas.mock.calls.map(([i]) => i.jobContext.cantidad),
    ).toEqual([500, 100]);
    const persistidas = await db.fuenteProduccionEntrega.findMany({
      where: { tenantId, revisionId: creada.plan!.revisionId },
    });
    expect(persistidas).toHaveLength(1);
    expect(persistidas[0].cantidad).toBe(100);
    expect(persistidas[0].contextoJson).toMatchObject({
      cantidad: 100,
      piezas: [{ cantidad: 100, anchoMm: 90, altoMm: 50 }],
      piezaAreaTotalM2: 0.45,
      piezaPerimetroTotalM: 28,
    });
    expect(persistidas[0].calculoJson).toMatchObject({ cantidadPedida: 100 });
    const calculoGuardado = persistidas[0]
      .calculoJson as unknown as FuenteCotizacionF6['cotizacion'];
    expect(calculoGuardado.costos.total).toBeCloseTo(
      tarjetas[1].cotizacion.costos.total,
      6,
    );
    const elegida = await service.elegir(
      auth,
      cotizacionItemId,
      {
        expectedVersion: vista.plan!.version,
        revisionId: vista.plan!.revisionId,
        alternativaId: 'por-entrega',
        aceptarAjusteNesting: true,
      },
      true,
    );
    expect(elegida.plan?.alternativaElegidaId).toBe('por-entrega');
    expect(elegida.plan?.entregas.map((e) => e.cantidad)).toEqual([
      100, 100, 100, 100, 100,
    ]);
  } finally {
    taller.estaciones = estacionesAnteriores;
  }
}, 30_000);
