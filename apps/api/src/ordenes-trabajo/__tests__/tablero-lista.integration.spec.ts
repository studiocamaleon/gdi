import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';
import { TableroTerminadosQueryDto } from '../dto/tablero-query.dto';
import type { CurrentAuth } from '../../auth/auth.types';
import { simularFlujo } from '../../eta/motor/flujo-produccion';
import type { TableroItemData } from '../../eta/motor/tablero-tipos';
import {
  calendarioDefault,
  type Estacion,
} from '../../eta/motor/estaciones-tipos';

const db = new PrismaClient();
const tenantId = randomUUID(),
  otroTenant = randomUUID();
const auth = {
  tenantId,
  userId: randomUUID(),
  permisos: new Set(['produccion.ver']),
} as CurrentAuth;
// Se prueba la consulta real; conciliación/backfill tienen sus propias suites.
const service = Object.assign(
  Object.create(OrdenesTrabajoService.prototype) as OrdenesTrabajoService,
  {
    prisma: db,
    reconciliarTramosVencidos: jest.fn().mockResolvedValue(undefined),
    backfillPasosTablero: jest.fn().mockResolvedValue(undefined),
  },
);
let ordenId: string,
  activoId: string,
  terminadoId: string,
  sinRutaId: string,
  ajenoId: string;
let pasoHecho: string, pasoPendiente: string, previoExterno: string;
const baseItem = (tenant: string, codigo: string) => ({
  tenantId: tenant,
  codigo,
  nombre: codigo,
  familia: 'Manual',
  cantidad: 1,
  cantidadUnidad: 'u.',
  subtotal: 0,
  impuestos: 0,
  total: 0,
});
const paso = (
  itemId: string,
  indice: number,
  estado: 'pendiente' | 'hecho',
  orden = ordenId,
  tenant = tenantId,
) =>
  db.ordenTrabajoItemPaso.create({
    data: {
      tenantId: tenant,
      ordenId: orden,
      itemId,
      indice,
      nodoClave: `${itemId}-${indice}`,
      nombre: 'Trabajo manual',
      familiaCodigo: 'trabajo_manual',
      categoriaFamilia: 'operaciones_manuales',
      estado,
      duracionEstimadaMin: 10,
      modoRegistro: 'solo_completar',
      completadoEl:
        estado === 'hecho' ? new Date('2026-09-13T15:00:00Z') : null,
      demandaHumanaJson: {
        version: 1,
        verificada: true,
        fases: [{ minutos: 10, personas: 1 }],
      },
    },
  });
beforeAll(async () => {
  await db.tenant.createMany({
    data: [tenantId, otroTenant].map((id) => ({
      id,
      slug: `lista-${id}`,
      nombre: 'Tablero Lista QA',
    })),
  });
  const orden = await db.ordenTrabajo.create({
    data: {
      tenantId,
      numero: 'OT-LISTA',
      estado: 'produccion',
      fechaEntrega: new Date('2026-09-20'),
      items: {
        create: [
          baseItem(tenantId, 'ACTIVO'),
          baseItem(tenantId, 'TERMINADO'),
          baseItem(tenantId, 'SIN-RUTA'),
        ],
      },
    },
    include: { items: true },
  });
  ordenId = orden.id;
  activoId = orden.items.find((i) => i.codigo === 'ACTIVO')!.id;
  terminadoId = orden.items.find((i) => i.codigo === 'TERMINADO')!.id;
  sinRutaId = orden.items.find((i) => i.codigo === 'SIN-RUTA')!.id;
  pasoHecho = (await paso(activoId, 0, 'hecho')).id;
  pasoPendiente = (await paso(activoId, 1, 'pendiente')).id;
  previoExterno = (await paso(terminadoId, 0, 'hecho')).id;
  await db.ordenTrabajoPasoDependencia.createMany({
    data: [pasoHecho, previoExterno].map((predecesorPasoId) => ({
      tenantId,
      ordenId,
      predecesorPasoId,
      sucesorPasoId: pasoPendiente,
      obligatoria: true,
    })),
  });
  const ajena = await db.ordenTrabajo.create({
    data: {
      tenantId: otroTenant,
      numero: 'OT-AJENA',
      estado: 'finalizada',
      items: { create: baseItem(otroTenant, 'AJENO') },
    },
    include: { items: true },
  });
  ajenoId = ajena.items[0].id;
  await paso(ajenoId, 0, 'hecho', ajena.id, otroTenant);
  for (const [estado, codigo] of [
    ['finalizada', 'FINALIZADA'],
    ['entregada', 'ENTREGADA'],
    ['cancelada', 'CANCELADA'],
    ['borrador', 'BORRADOR'],
  ] as const) {
    const o = await db.ordenTrabajo.create({
      data: {
        tenantId,
        numero: `OT-${codigo}`,
        estado,
        items: { create: baseItem(tenantId, codigo) },
      },
      include: { items: true },
    });
    await paso(o.items[0].id, 0, 'hecho', o.id);
  }
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: [tenantId, otroTenant] } } });
  await db.$disconnect();
});

it('excluye terminados en SQL y conserva todos los pasos del trabajo activo', async () => {
  const consulta = jest.spyOn(db.ordenTrabajo, 'findMany');
  const activos = await service.tablero(auth, true);
  expect(activos.items.map((i) => i.id).sort()).toEqual(
    [activoId, sinRutaId].sort(),
  );
  expect(
    activos.items.find((i) => i.id === activoId)!.pasos.map((p) => p.id),
  ).toEqual([pasoHecho, pasoPendiente]);
  expect(consulta.mock.calls[0][0]?.include?.items).toMatchObject({
    where: { contieneLotesEntrega: false, OR: expect.any(Array) },
  });
  consulta.mockRestore();
});
it('conserva las dependencias satisfechas y la ETA al excluir un componente terminado', async () => {
  const completo = await service.tablero(auth);
  const activos = await service.tablero(auth, true);
  const p = activos.items
    .find((i) => i.id === activoId)!
    .pasos.find((p) => p.id === pasoPendiente)!;
  expect(p.predecesoresSatisfechos).toBe(true);
  expect(p.predecesorPasoIds).toEqual([pasoHecho]);
  expect(p.dependenciasPendientes).toEqual([]);
  const est = {
    id: 'manual',
    nombre: 'Manual',
    activo: true,
    capacidadConcurrente: 1,
    familias: ['trabajo_manual'],
    maquinas: [],
    empleados: [],
    calendario: calendarioDefault(),
    tiempoPreparacionMin: 0,
  } as unknown as Estacion;
  const sim = (items: unknown) =>
    simularFlujo({
      items: items as TableroItemData[],
      estaciones: [est],
      medianas: new Map(),
      ahora: new Date('2026-09-14T12:00:00Z'),
      zona: 'America/Argentina/Buenos_Aires',
    }).porItem.get(activoId);
  expect(sim(activos.items)?.finEstimado).not.toBeNull();
  expect(sim(activos.items)?.finEstimado).toEqual(
    sim(completo.items)?.finEstimado,
  );
});
it('pagina terminados de órdenes activas, finalizadas y entregadas, sin mezclar tenants ni borradores', async () => {
  const consulta = jest.spyOn(db.ordenTrabajoItem, 'findMany');
  const primera = await service.tableroTerminados(auth, { page: 1, limit: 2 });
  const segunda = await service.tableroTerminados(auth, { page: 2, limit: 2 });
  expect(primera.items).toHaveLength(2);
  expect(primera.hasMore).toBe(true);
  expect(segunda.items).toHaveLength(1);
  expect(segunda.hasMore).toBe(false);
  expect(
    new Set([...primera.items, ...segunda.items].map((i) => i.codigo)),
  ).toEqual(new Set(['TERMINADO', 'FINALIZADA', 'ENTREGADA']));
  expect(consulta.mock.calls[0][0]).toMatchObject({
    take: 3,
    skip: 0,
    where: { tenantId },
  });
  expect(consulta.mock.calls[1][0]).toMatchObject({ take: 3, skip: 2 });
  consulta.mockRestore();
});
it('busca por OT y fecha de entrega con respaldo en la fecha de la orden', async () => {
  const res = await service.tableroTerminados(auth, {
    page: 1,
    limit: 25,
    q: 'OT-LISTA',
    desde: '2026-09-19',
    hasta: '2026-09-21',
  });
  expect(res.items.map((i) => i.id)).toEqual([terminadoId]);
  expect(
    (
      await service.tableroTerminados(auth, {
        page: 1,
        limit: 25,
        desde: '2026-09-21',
      })
    ).items,
  ).toEqual([]);
  await expect(
    service.tableroTerminados(auth, {
      page: 1,
      limit: 25,
      desde: '2026-09-21',
      hasta: '2026-09-20',
    }),
  ).rejects.toThrow(/fecha/);
});
it('permite consultar un terminado explícitamente y rechaza el ítem de otro tenant', async () => {
  expect((await service.consultarItemTablero(auth, terminadoId)).id).toBe(
    terminadoId,
  );
  await expect(service.consultarItemTablero(auth, ajenoId)).rejects.toThrow(
    /No se encontró/,
  );
});
it('valida límites de consulta y fechas antes de acceder al historial', async () => {
  const errores = await validate(
    plainToInstance(TableroTerminadosQueryDto, {
      page: '0',
      limit: '1000',
      desde: '2026-02-31',
    }),
  );
  expect(errores.map((e) => e.property).sort()).toEqual([
    'desde',
    'limit',
    'page',
  ]);
});
