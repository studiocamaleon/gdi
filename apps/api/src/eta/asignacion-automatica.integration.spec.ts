import { leerPlanReferencia } from '../produccion/plan-referencia-paso';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProduccionService } from '../produccion/produccion.service';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import { EtaService } from './eta.service';
import {
  leerAsignacionPersonal,
  proyectarAsignacionPersonal,
} from '../produccion/asignacion-personal';
import { calendarioDefault } from './motor/estaciones-tipos';
import type { CurrentAuth } from '../auth/auth.types';

const db = new PrismaService();
const produccion = new ProduccionService(db);
const eta = new EtaService(db, produccion);
let tenantId: string, otroTenant: string, estacionId: string, ordenId: string;
let empleados: Array<{
  id: string;
  userId: string | null;
  nombreCompleto: string;
}>;
let pasos: Array<{ id: string; itemId: string }>;
let users: string[];
const cal = calendarioDefault();
const ahora = new Date('2026-09-14T09:00:00-03:00');
let reloj: Date;

beforeEach(async () => {
  reloj = ahora;
  tenantId = randomUUID();
  otroTenant = randomUUID();
  users = [randomUUID(), randomUUID(), randomUUID()];
  await db.tenant.createMany({
    data: [tenantId, otroTenant].map((id) => ({
      id,
      slug: `qa-asignacion-${id}`,
      nombre: 'QA asignación',
    })),
  });
  await db.user.createMany({
    data: users.map((id, i) => ({
      id,
      email: `${id}@qa.invalid`,
      nombreCompleto: ['Ana', 'Bruno', 'Carla'][i],
    })),
  });
  empleados = [];
  for (const [i, userId] of users.entries())
    empleados.push(
      await db.empleado.create({
        data: {
          tenantId,
          userId,
          nombreCompleto: ['Ana', 'Bruno', 'Carla'][i],
          emailPrincipal: `${userId}@qa.invalid`,
          telefonoCodigo: '+54',
          telefonoNumero: '123',
          sector: 'Taller',
          fechaIngreso: ahora,
          calendarioProduccionJson: cal,
        },
      }),
    );
  estacionId = (
    await db.estacion.create({
      data: {
        tenantId,
        nombre: 'Pre-prensa',
        planificacionPorEmpleados: true,
        calendarioJson: cal,
        tiempoPreparacionMin: 0,
        reglas: { create: { tenantId, tipo: 'familia', valor: 'pre_prensa' } },
        empleados: {
          create: empleados
            .slice(0, 2)
            .map((e) => ({ tenantId, empleadoId: e.id })),
        },
      },
    })
  ).id;
  ordenId = (
    await db.ordenTrabajo.create({
      data: {
        tenantId,
        numero: 'OT-QA',
        estado: 'pendiente',
        fechaEntrega: new Date('2026-09-20'),
      },
    })
  ).id;
  pasos = [];
  for (let i = 0; i < 3; i++) {
    const item = await db.ordenTrabajoItem.create({
      data: {
        tenantId,
        ordenId,
        codigo: `P${i}`,
        nombre: `Trabajo ${i}`,
        familia: 'Manual',
        cantidad: 1,
        cantidadUnidad: 'u',
        subtotal: 0,
        impuestos: 0,
        total: 0,
        ordenIndice: i,
      },
    });
    pasos.push(
      await db.ordenTrabajoItemPaso.create({
        data: {
          tenantId,
          ordenId,
          itemId: item.id,
          indice: 0,
          nombre: 'Pre-prensa',
          familiaCodigo: 'pre_prensa',
          categoriaFamilia: 'pre_prensa',
          duracionEstimadaMin: 60,
          modoRegistro: 'cronometro',
          demandaHumanaJson: {
            version: 1,
            verificada: true,
            fases: [{ minutos: 60, personas: 1 }],
          },
        },
      }),
    );
  }
  // Mantener el reloj fijo sin reemplazar timers/Prisma.
  const contexto = eta.contextoSimulacion.bind(eta);
  jest.spyOn(eta, 'contextoSimulacion').mockImplementation(async (...args) => ({
    ...(await contexto(...args)),
    ahora: reloj,
  }));
});
afterEach(async () => {
  jest.restoreAllMocks();
  await db.tenant.deleteMany({ where: { id: { in: [tenantId, otroTenant] } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
});
afterAll(() => db.$disconnect());
const leer = async (id: string) =>
  leerAsignacionPersonal(
    (await db.ordenTrabajoItemPaso.findUniqueOrThrow({ where: { id } }))
      .asignacionPersonalJson,
  )!;

it('publica personal con fases decimales sin alterar los tiempos y la demanda cotizados', async () => {
  const demanda = {
    version: 1,
    verificada: true,
    fases: [
      { minutos: 5, personas: 1 },
      { minutos: 21.98571428571429, personas: 0 },
      { minutos: 1.014285714285709, personas: 1 },
    ],
  };
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[0].id },
    data: { duracionEstimadaMin: 28, demandaHumanaJson: demanda },
  });
  await eta.sincronizarAsignaciones(tenantId);
  const asignacion = await leer(pasos[0].id);
  expect(asignacion.conflicto).toBeNull();
  expect(asignacion.personas).toHaveLength(1);
  expect(
    asignacion.franjas.every(
      (f) =>
        f.empleadoIds.length === 1 &&
        f.empleadoIds[0] === asignacion.personas[0].empleadoId,
    ),
  ).toBe(true);
  expect(asignacion.franjas).toHaveLength(2);
  expect(
    asignacion.franjas.every((f) => Date.parse(f.fin) > Date.parse(f.inicio)),
  ).toBe(true);
  const guardado = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
    where: { id: pasos[0].id },
  });
  expect(Number(guardado.duracionEstimadaMin)).toBe(28);
  expect(guardado.demandaHumanaJson).toEqual(demanda);
  expect(guardado.planificadoDesde).toBeNull();
  expect(guardado.planificadoHasta).toBeNull();
});

it('publica por persona y franja, es idempotente y no modifica la agenda ni los tiempos cotizados', async () => {
  const corridas = await Promise.all([
    eta.sincronizarAsignaciones(tenantId),
    eta.sincronizarAsignaciones(tenantId),
  ]);
  expect(corridas.sort()).toEqual([0, 3]);
  const a = await leer(pasos[0].id),
    b = await leer(pasos[1].id);
  expect(a.personas).toHaveLength(1);
  expect(b.personas[0].empleadoId).not.toBe(a.personas[0].empleadoId);
  expect(a.franjas[0].inicio).toBe(b.franjas[0].inicio);
  expect(await eta.sincronizarAsignaciones(tenantId)).toBe(0);
  const guardado = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
    where: { id: pasos[0].id },
  });
  expect(guardado.planificadoDesde).toBeNull();
  expect(guardado.atencionPlanificadaJson).toBeNull();
  expect(Number(guardado.duracionEstimadaMin)).toBe(60);
  expect(
    proyectarAsignacionPersonal(
      guardado.asignacionPersonalJson,
      a.personas[0].usuarioId!,
    )?.esMia,
  ).toBe(true);
});

it('no confunde a una persona sin usuario con una mesa vacía ni inventa personal cuando falta horario', async () => {
  await db.empleado.update({
    where: { id: empleados[2].id },
    data: { userId: null },
  });
  await eta.sincronizarAsignaciones(tenantId);
  for (const paso of pasos)
    expect(
      (await leer(paso.id)).personas.map((p) => p.empleadoId),
    ).not.toContain(empleados[2].id);
  await db.estacionEmpleado.deleteMany({ where: { estacionId } });
  await eta.sincronizarAsignaciones(tenantId);
  for (const paso of pasos) {
    expect((await leer(paso.id)).personas).toEqual([]);
    expect((await leer(paso.id)).conflicto).toBeTruthy();
  }
});

it('guarda una sola persona entre turnos sin exigir usuario para aportar capacidad al plan', async () => {
  const corto = (desde: string, hasta: string) => ({
    dias: { ...cal.dias, lun: [{ desde, hasta }] },
  });
  await db.empleado.update({
    where: { id: empleados[0].id },
    data: { calendarioProduccionJson: corto('09:00', '10:00'), userId: null },
  });
  await db.empleado.update({
    where: { id: empleados[1].id },
    data: { calendarioProduccionJson: corto('10:00', '12:00') },
  });
  await db.ordenTrabajoItemPaso.updateMany({
    where: { tenantId, id: { not: pasos[0].id } },
    data: { estado: 'hecho' },
  });
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[0].id },
    data: {
      duracionEstimadaMin: 120,
      demandaHumanaJson: {
        version: 1,
        verificada: true,
        fases: [{ minutos: 120, personas: 1 }],
      },
    },
  });
  await eta.sincronizarAsignaciones(tenantId);
  const a = await leer(pasos[0].id);
  expect(a.franjas.map((f) => f.empleadoIds)).toEqual([
    [empleados[0].id],
    [empleados[0].id],
  ]);
  expect(a.personas).toHaveLength(1);
  expect(a.franjas.at(-1)?.fin).toBe(
    new Date('2026-09-15T10:00:00-03:00').toISOString(),
  );
  expect(
    a.personas.find((p) => p.empleadoId === empleados[0].id)?.usuarioId,
  ).toBeNull();
  expect(a.conflicto).toBeNull();
});

it('respeta el reclamo manual aunque cambie el equilibrio y muestra conflicto si se retira a esa persona', async () => {
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[0].id },
    data: { mesaUsuarioId: users[1] },
  });
  await eta.sincronizarAsignaciones(tenantId);
  expect((await leer(pasos[0].id)).personas.map((p) => p.empleadoId)).toEqual([
    empleados[1].id,
  ]);
  await db.estacionEmpleado.deleteMany({
    where: { estacionId, empleadoId: empleados[1].id },
  });
  await eta.sincronizarAsignaciones(tenantId);
  const a = await leer(pasos[0].id);
  expect(a.origen).toBe('manual');
  expect(a.conflicto).toBeTruthy();
  expect(a.personas.map((p) => p.empleadoId)).toEqual([empleados[1].id]);
  expect(a.franjas).toEqual([]);
});

it('conserva el equipo del paso iniciado y asigna juntas las dos personas necesarias', async () => {
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[0].id },
    data: {
      demandaHumanaJson: {
        version: 1,
        verificada: true,
        fases: [{ minutos: 60, personas: 2 }],
      },
    },
  });
  await eta.sincronizarAsignaciones(tenantId);
  const antes = await leer(pasos[0].id);
  expect(antes.franjas[0].empleadoIds).toHaveLength(2);
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[0].id },
    data: { estado: 'en_curso', iniciadoEl: ahora },
  });
  await db.estacionEmpleado.create({
    data: { tenantId, estacionId, empleadoId: empleados[2].id },
  });
  await eta.sincronizarAsignaciones(tenantId);
  expect((await leer(pasos[0].id)).personas.map((p) => p.empleadoId)).toEqual(
    antes.personas.map((p) => p.empleadoId),
  );
});

it('no consulta ni escribe los pasos de otra empresa, borradores o terminados', async () => {
  await eta.sincronizarAsignaciones(otroTenant);
  expect(
    (
      await db.ordenTrabajoItemPaso.findUniqueOrThrow({
        where: { id: pasos[0].id },
      })
    ).asignacionPersonalJson,
  ).toBeNull();
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[0].id },
    data: { estado: 'hecho' },
  });
  await eta.sincronizarAsignaciones(tenantId);
  expect(
    (
      await db.ordenTrabajoItemPaso.findUniqueOrThrow({
        where: { id: pasos[0].id },
      })
    ).asignacionPersonalJson,
  ).toBeNull();
  await db.ordenTrabajo.update({
    where: { id: ordenId },
    data: { estado: 'borrador' },
  });
  expect(await eta.sincronizarAsignaciones(tenantId)).toBe(0);
});

it('un asignado ejecuta sin mesa y registra al actor real; otro empleado no puede apropiarse del paso', async () => {
  await eta.sincronizarAsignaciones(tenantId);
  const asignado = (await leer(pasos[0].id)).personas[0];
  const service = Object.assign(
    Object.create(OrdenesTrabajoService.prototype) as OrdenesTrabajoService,
    {
      prisma: db,
      eta,
      logger: new Logger('QA'),
      reconciliarTramosVencidos: jest.fn(),
      avisarAlCliente: jest.fn(),
      desarrolloDocumental: { exigirGatesCumplidos: jest.fn() },
    },
  );
  const auth = (userId: string) =>
    ({
      tenantId,
      userId,
      email: `${userId}@qa.invalid`,
      permisos: new Set(['produccion.ver', 'produccion.ejecutar']),
    }) as CurrentAuth;
  const noAsignado = empleados.find((e) => e.id !== asignado.empleadoId)!;
  await expect(
    service.accionesPasos(auth(noAsignado.userId!), [
      {
        ordenId,
        itemId: pasos[0].itemId,
        pasoId: pasos[0].id,
        payload: { accion: 'iniciar' },
      },
    ]),
  ).rejects.toThrow('no está asignado');
  await service.accionesPasos(auth(asignado.usuarioId!), [
    {
      ordenId,
      itemId: pasos[0].itemId,
      pasoId: pasos[0].id,
      payload: { accion: 'iniciar' },
    },
  ]);
  const paso = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
    where: { id: pasos[0].id },
    include: { tramos: true },
  });
  expect(paso.mesaUsuarioId).toBeNull();
  expect(paso.estado).toBe('en_curso');
  expect(paso.tramos).toHaveLength(1);
  expect(paso.tramos[0].usuarioId).toBe(asignado.usuarioId);
  expect(paso.iniciadoPorId).toBe(asignado.usuarioId);
});

it('fija el fin de la operación sin separación; recalcular mueve la estimación, pero no el previsto', async () => {
  await db.estacion.update({
    where: { id: estacionId },
    data: { tiempoPreparacionMin: 5 },
  });
  const primera = await eta.correr(tenantId);
  const plan = primera.traza.find((p) => p.pasoId === pasos[0].id)!;
  expect(plan).toBeDefined();
  await eta.sincronizarAsignaciones(tenantId);
  const leerReferencia = async () =>
    leerPlanReferencia(
      (
        await db.ordenTrabajoItemPaso.findUniqueOrThrow({
          where: { id: pasos[0].id },
        })
      ).planReferenciaJson,
    )!;
  const referencia = await leerReferencia();
  expect(referencia.fin).toBe(plan.fin.toISOString());
  expect(referencia.inicio).toBe(plan.inicio.toISOString());
  reloj = new Date('2026-09-14T11:00:00-03:00');
  await eta.sincronizarAsignaciones(tenantId);
  expect(await leerReferencia()).toEqual(referencia);
  const actual = (await eta.correr(tenantId)).traza.find(
    (p) => p.pasoId === pasos[0].id,
  )!;
  expect(actual.fin.getTime()).toBeGreaterThan(Date.parse(referencia.fin));
  const row = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
    where: { id: pasos[0].id },
  });
  expect(row.planificadoHasta).toBeNull();
  expect(row.atencionPlanificadaJson).toBeNull();
});

it('toma el plan aceptado existente y no fabrica referencia en terminados ni cuando faltan recursos', async () => {
  const inicio = new Date('2026-09-15T09:00:00-03:00'),
    fin = new Date('2026-09-15T10:00:00-03:00');
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[0].id },
    data: { planificadoDesde: inicio, planificadoHasta: fin },
  });
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[1].id },
    data: { estado: 'hecho' },
  });
  await db.estacionEmpleado.deleteMany({ where: { estacionId } });
  await eta.sincronizarAsignaciones(tenantId);
  const rows = await db.ordenTrabajoItemPaso.findMany({ where: { tenantId } });
  expect(
    leerPlanReferencia(
      rows.find((p) => p.id === pasos[0].id)!.planReferenciaJson,
    ),
  ).toMatchObject({
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    origen: 'plan_aceptado',
  });
  expect(rows.find((p) => p.id === pasos[1].id)!.planReferenciaJson).toBeNull();
  expect(rows.find((p) => p.id === pasos[2].id)!.planReferenciaJson).toBeNull();
});

it('también fija referencia para estaciones sin reparto personal y proveedores externos', async () => {
  await db.estacion.update({
    where: { id: estacionId },
    data: { planificacionPorEmpleados: false },
  });
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[2].id },
    data: { tipoEjecucion: 'tercerizado', plazoProveedorDias: 2 },
  });
  await eta.sincronizarAsignaciones(tenantId);
  const rows = await db.ordenTrabajoItemPaso.findMany({ where: { tenantId } });
  for (const row of rows) {
    expect(leerPlanReferencia(row.planReferenciaJson)?.fin).toBeDefined();
    expect(row.asignacionPersonalJson).toBeNull();
  }
});
