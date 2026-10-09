import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProduccionService } from '../produccion/produccion.service';
import { EtaService } from '../eta/eta.service';
import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';
import {
  ReprogramacionService,
  fechaReprogramacion,
} from './reprogramacion.service';
import { leerPlanReferencia } from '../produccion/plan-referencia-paso';
import { calendarioDefault } from '../eta/motor/estaciones-tipos';
import type { CurrentAuth } from '../auth/auth.types';
import { simularFlujo } from '../eta/motor/flujo-produccion';

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
const servicio = new ReprogramacionService(
  db,
  eta,
  new EventosSistemaService(db),
);
const secretoOriginal = process.env.JWT_SECRET;
beforeAll(() => {
  process.env.JWT_SECRET = 'solo-para-tests-de-reprogramacion';
});
afterAll(() => {
  if (secretoOriginal === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = secretoOriginal;
});
const auth = (): CurrentAuth => ({
  userId: users[0],
  tenantId,
  role: 'ADMINISTRADOR',
  sessionId: randomUUID(),
  membershipId: randomUUID(),
  email: 'supervisor@qa.invalid',
  permisos: new Set([
    'produccion.supervisar',
    'produccion.planificacion.ver',
    'comercial.ordenes.gestionar',
  ]),
});

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
      slug: `qa-reprogramacion-${id}`,
      nombre: 'QA reprogramación',
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

const solicitud = (
  fecha = '2026-09-15',
  alcance: 'paso' | 'item' = 'paso',
) => ({ tipo: 'produccion' as const, alcance, fecha, hora: '10:00' });
const entrega = (fecha = '2026-09-22') => ({
  tipo: 'entrega' as const,
  alcance: 'item' as const,
  fecha,
});
const confirmar = async (id: string, s = solicitud()) => {
  const r = await servicio.simular(auth(), id, s);
  expect(r.motivos).toEqual([]);
  expect(r.token).toBeTruthy();
  await servicio.confirmar(auth(), id, { token: r.token! });
  return r;
};
const agregarSucesor = async () =>
  db.ordenTrabajoItemPaso.create({
    data: {
      tenantId,
      ordenId,
      itemId: pasos[0].itemId,
      indice: 1,
      nombre: 'Terminación',
      familiaCodigo: 'pre_prensa',
      categoriaFamilia: 'pre_prensa',
      duracionEstimadaMin: 30,
      modoRegistro: 'cronometro',
      demandaHumanaJson: {
        version: 1,
        verificada: true,
        fases: [{ minutos: 30, personas: 1 }],
      },
    },
  });

it('la vista previa no escribe; confirma el paso y sus siguientes, conserva promesas y registra el impacto', async () => {
  const siguiente = await agregarSucesor();
  const antes = await db.ordenTrabajoItemPaso.findMany({
    where: { tenantId },
    orderBy: { id: 'asc' },
  });
  const revision = await servicio.simular(auth(), pasos[0].id, solicitud());
  expect(revision.motivos).toEqual([]);
  expect(
    revision.pasos
      .filter((p) => p.seGuarda)
      .map((p) => p.id)
      .sort(),
  ).toEqual([pasos[0].id, siguiente.id].sort());
  expect(
    await db.ordenTrabajoItemPaso.findMany({
      where: { tenantId },
      orderBy: { id: 'asc' },
    }),
  ).toEqual(antes);
  await servicio.confirmar(auth(), pasos[0].id, {
    token: revision.token!,
    motivo: 'Cambio solicitado en QA',
  });
  const guardados = await db.ordenTrabajoItemPaso.findMany({
    where: { tenantId },
    orderBy: { indice: 'asc' },
  });
  const primero = guardados.find((p) => p.id === pasos[0].id)!;
  expect(primero.planificadoDesde).toEqual(new Date('2026-09-15T13:00:00Z'));
  expect(
    guardados.find((p) => p.id === siguiente.id)!.planificadoDesde!.getTime(),
  ).toBeGreaterThanOrEqual(primero.planificadoHasta!.getTime());
  expect(
    guardados.find((p) => p.id === pasos[1].id)!.planificadoDesde,
  ).toBeNull();
  expect(
    (await db.ordenTrabajo.findUniqueOrThrow({ where: { id: ordenId } }))
      .fechaEntrega,
  ).toEqual(new Date('2026-09-20'));
  expect(
    (
      await db.ordenTrabajoEvento.findFirstOrThrow({
        where: { tenantId, tipo: 'reprogramacion' },
      })
    ).datosJson,
  ).toMatchObject({ solicitud: solicitud() });
  const guardado = simularFlujo(await eta.contextoSimulacion(tenantId));
  expect(guardado.traza.find((p) => p.pasoId === primero.id)!.inicio).toEqual(
    primero.planificadoDesde,
  );
});

it('respeta el calendario al solicitar un domingo y avisa el riesgo de entrega', async () => {
  const r = await confirmar(pasos[0].id, solicitud('2026-09-20'));
  expect(
    r.pasos.find((p) => p.id === pasos[0].id)!.inicioPropuesto!.slice(0, 10),
  ).toBe('2026-09-21');
  expect(r.entregas.some((e) => e.enRiesgo)).toBe(true);
});

it('reprograma todo el ítem pendiente sin cambiar un paso ya iniciado', async () => {
  const siguiente = await agregarSucesor();
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[0].id },
    data: { estado: 'en_curso', iniciadoEl: ahora },
  });
  const antes = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
    where: { id: pasos[0].id },
  });
  const r = await confirmar(pasos[0].id, solicitud('2026-09-15', 'item'));
  expect(r.pasos.filter((p) => p.seGuarda).map((p) => p.id)).toEqual([
    siguiente.id,
  ]);
  expect(
    await db.ordenTrabajoItemPaso.findUniqueOrThrow({
      where: { id: pasos[0].id },
    }),
  ).toEqual(antes);
  await expect(
    servicio.simular(auth(), pasos[0].id, solicitud()),
  ).rejects.toThrow('todavía no se iniciaron');
});

it('conserva un piso de materiales incluso al reprogramar una segunda vez', async () => {
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[0].id },
    data: { planificadoDesde: new Date('2026-09-17T12:00:00Z') },
  });
  await confirmar(pasos[0].id);
  await confirmar(pasos[0].id, solicitud('2026-09-16'));
  const p = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
    where: { id: pasos[0].id },
  });
  expect(p.planificadoDesde!.getTime()).toBeGreaterThanOrEqual(
    Date.parse('2026-09-17T12:00:00Z'),
  );
  expect(leerPlanReferencia(p.planReferenciaJson)?.inicioMinimo).toBe(
    '2026-09-17T12:00:00.000Z',
  );
});

it('cambia sólo la entrega elegida; materializa las otras y actualiza el cierre de la OT', async () => {
  const previo = await db.ordenTrabajoItemPaso.findMany({
    where: { tenantId },
    orderBy: { id: 'asc' },
  });
  const r = await servicio.simular(auth(), pasos[0].id, entrega());
  await servicio.confirmar(auth(), pasos[0].id, { token: r.token! });
  const items = await db.ordenTrabajoItem.findMany({ where: { tenantId } });
  expect(items.find((i) => i.id === pasos[0].itemId)!.fechaEntrega).toEqual(
    new Date('2026-09-22'),
  );
  expect(items.find((i) => i.id === pasos[1].itemId)!.fechaEntrega).toEqual(
    new Date('2026-09-20'),
  );
  expect(
    (await db.ordenTrabajo.findUniqueOrThrow({ where: { id: ordenId } }))
      .fechaEntrega,
  ).toEqual(new Date('2026-09-22'));
  expect(
    await db.ordenTrabajoItemPaso.findMany({
      where: { tenantId },
      orderBy: { id: 'asc' },
    }),
  ).toEqual(previo);
});

it('rechaza otra empresa, otro usuario, falta de permiso, firma alterada y reutilización', async () => {
  await expect(
    servicio.simular(
      { ...auth(), tenantId: otroTenant },
      pasos[0].id,
      solicitud(),
    ),
  ).rejects.toThrow('no está disponible');
  await expect(
    servicio.simular(
      { ...auth(), permisos: new Set(['produccion.planificacion.ver']) },
      pasos[0].id,
      solicitud(),
    ),
  ).rejects.toThrow('supervisión');
  await expect(
    servicio.simular(
      {
        ...auth(),
        permisos: new Set([
          'produccion.planificacion.ver',
          'produccion.supervisar',
        ]),
      },
      pasos[0].id,
      entrega(),
    ),
  ).rejects.toThrow('gestionar órdenes');
  const r = await servicio.simular(auth(), pasos[0].id, solicitud());
  await expect(
    servicio.confirmar({ ...auth(), userId: users[1] }, pasos[0].id, {
      token: r.token!,
    }),
  ).rejects.toThrow('no es válida');
  await expect(
    servicio.confirmar(auth(), pasos[0].id, { token: r.token! + 'x' }),
  ).rejects.toThrow('no es válida');
  await servicio.confirmar(auth(), pasos[0].id, { token: r.token! });
  await expect(
    servicio.confirmar(auth(), pasos[0].id, { token: r.token! }),
  ).rejects.toThrow('Cambiaron');
});

it('rechaza una propuesta vencida o si cambió la carga del taller, sin escrituras parciales', async () => {
  const r = await servicio.simular(auth(), pasos[0].id, solicitud());
  const reloj = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 121000);
  await expect(
    servicio.confirmar(auth(), pasos[0].id, { token: r.token! }),
  ).rejects.toThrow('venció');
  reloj.mockRestore();
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[1].id },
    data: { duracionEstimadaMin: 120 },
  });
  await expect(
    servicio.confirmar(auth(), pasos[0].id, { token: r.token! }),
  ).rejects.toThrow('Cambiaron');
  expect(
    (
      await db.ordenTrabajoItemPaso.findUniqueOrThrow({
        where: { id: pasos[0].id },
      })
    ).planificadoDesde,
  ).toBeNull();
  expect(await db.ordenTrabajoEvento.count({ where: { tenantId } })).toBe(0);
});

it('rechaza fechas inexistentes, horas fuera de rango y el pasado en la zona del taller', () => {
  for (const s of [
    { ...solicitud(), fecha: '2026-02-30' },
    { ...solicitud(), hora: '24:30' },
    solicitud('2026-09-13'),
  ])
    expect(() =>
      fechaReprogramacion(s, 'America/Argentina/Buenos_Aires', ahora),
    ).toThrow();
  expect(
    fechaReprogramacion(solicitud(), 'America/Argentina/Buenos_Aires', ahora),
  ).toBe('2026-09-15T13:00:00.000Z');
});

it('no inventa un compromiso para otro producto que todavía no tiene fecha', async () => {
  await db.ordenTrabajo.update({
    where: { id: ordenId },
    data: { fechaEntrega: null },
  });
  const r = await servicio.simular(auth(), pasos[0].id, entrega());
  expect(r.entregaOrden.propuesta).toBeNull();
  await servicio.confirmar(auth(), pasos[0].id, { token: r.token! });
  const contexto = await eta.contextoSimulacion(tenantId);
  expect(
    contexto.items.find((i) => i.id === pasos[1].itemId)!.fechaEntrega,
  ).toBeNull();
});

it('reprograma los componentes de un producto pero no otro producto de la misma OT', async () => {
  await db.ordenTrabajoItem.update({
    where: { id: pasos[1].itemId },
    data: { parentItemId: pasos[0].itemId },
  });
  const r = await confirmar(pasos[1].id, solicitud('2026-09-15', 'item'));
  expect(
    r.pasos
      .filter((p) => p.seGuarda)
      .map((p) => p.id)
      .sort(),
  ).toEqual([pasos[0].id, pasos[1].id].sort());
  expect(
    (
      await db.ordenTrabajoItemPaso.findUniqueOrThrow({
        where: { id: pasos[2].id },
      })
    ).planificadoDesde,
  ).toBeNull();
});

it('cambia un lote de entrega y conserva su lote hermano', async () => {
  const root = await db.ordenTrabajoItem.create({
    data: {
      tenantId,
      ordenId,
      codigo: 'COMPUESTO',
      nombre: 'Producto por lotes QA',
      familia: 'Manual',
      cantidad: 2,
      cantidadUnidad: 'u',
      subtotal: 0,
      impuestos: 0,
      total: 0,
      contieneLotesEntrega: true,
    },
  });
  const plan = await db.planEntregaItem.create({
    data: { tenantId, ordenItemId: root.id },
  });
  const revision = await db.planEntregaRevision.create({
    data: {
      tenantId,
      planId: plan.id,
      numero: 1,
      idempotencyKey: randomUUID(),
      solicitudHuella: 'qa',
      origenHuella: 'qa',
      cantidad: 2,
      solicitadoPorId: users[0],
      solicitudJson: {},
    },
  });
  const fuente = await db.fuenteProduccionEntrega.create({
    data: {
      tenantId,
      revisionId: revision.id,
      cantidad: 2,
      calculoJson: {},
      contextoJson: {},
    },
  });
  const lotes: string[] = [];
  for (let n = 0; n < 2; n++) {
    const lote = await db.loteProduccionEntrega.create({
      data: {
        tenantId,
        revisionId: revision.id,
        fuenteId: fuente.id,
        productoItemId: root.id,
        clave: `qa-${n}`,
        secuencia: n,
        cantidad: 1,
        fechaEntrega: new Date('2026-09-20'),
      },
    });
    lotes.push(lote.id);
    await db.ordenTrabajoItem.update({
      where: { id: pasos[n].itemId },
      data: {
        parentItemId: root.id,
        loteEntregaId: lote.id,
        fechaEntrega: new Date('2026-09-20'),
      },
    });
  }
  const r = await servicio.simular(auth(), pasos[0].id, entrega());
  expect(r.entregaOrden.propuesta).toBe('2026-09-22');
  await servicio.confirmar(auth(), pasos[0].id, { token: r.token! });
  expect(
    (
      await db.loteProduccionEntrega.findUniqueOrThrow({
        where: { id: lotes[0] },
      })
    ).fechaEntrega,
  ).toEqual(new Date('2026-09-22'));
  expect(
    (
      await db.loteProduccionEntrega.findUniqueOrThrow({
        where: { id: lotes[1] },
      })
    ).fechaEntrega,
  ).toEqual(new Date('2026-09-20'));
  expect(
    (await db.ordenTrabajoItem.findUniqueOrThrow({ where: { id: root.id } }))
      .fechaEntrega,
  ).toEqual(new Date('2026-09-22'));
  await db.ordenTrabajoItem.update({
    where: { id: pasos[2].itemId },
    data: { parentItemId: root.id },
  });
  await expect(
    servicio.simular(auth(), pasos[2].id, entrega()),
  ).rejects.toThrow('Seleccioná un paso del lote');
  const prod = await confirmar(pasos[0].id, solicitud('2026-09-15', 'item'));
  expect(prod.pasos.filter((p) => p.seGuarda).map((p) => p.id)).toEqual([
    pasos[0].id,
  ]);
});

it('rechaza un cambio si se perdió el permiso después de simular y revierte si falla el historial', async () => {
  const r = await servicio.simular(auth(), pasos[0].id, solicitud());
  await expect(
    servicio.confirmar(
      { ...auth(), permisos: new Set(['produccion.planificacion.ver']) },
      pasos[0].id,
      { token: r.token! },
    ),
  ).rejects.toThrow('supervisión');
  jest
    .spyOn(servicio['eventos'], 'publicarDesdeAuth')
    .mockRejectedValueOnce(new Error('Falla simulada de auditoría'));
  await expect(
    servicio.confirmar(auth(), pasos[0].id, { token: r.token! }),
  ).rejects.toThrow('Falla simulada');
  expect(
    (
      await db.ordenTrabajoItemPaso.findUniqueOrThrow({
        where: { id: pasos[0].id },
      })
    ).planificadoDesde,
  ).toBeNull();
});

it('no propone una agenda incompleta ni permite mover un paso de un trabajo conjunto por separado', async () => {
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[0].id },
    data: {
      duracionEstimadaMin: null,
      demandaHumanaJson: { version: 1, verificada: false, fases: [] },
    },
  });
  const r = await servicio.simular(auth(), pasos[0].id, solicitud());
  expect(r.viable).toBe(false);
  expect(r.token).toBeNull();
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[0].id },
    data: { nestingLoteId: 'qa-tanda-compartida', nestingLoteRol: 'OPERATIVO' },
  });
  await expect(
    servicio.simular(auth(), pasos[0].id, solicitud()),
  ).rejects.toThrow('trabajo conjunto');
});

it('sólo una confirmación simultánea publica la revisión', async () => {
  const r = await servicio.simular(auth(), pasos[0].id, solicitud());
  const resultados = await Promise.allSettled(
    [1, 2].map(() =>
      servicio.confirmar(auth(), pasos[0].id, { token: r.token! }),
    ),
  );
  expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(
    await db.ordenTrabajoEvento.count({
      where: { tenantId, tipo: 'reprogramacion' },
    }),
  ).toBe(1);
});

it('conserva los ítems ya entregados y no cambia una dependencia de un paso iniciado', async () => {
  await db.ordenTrabajoItem.update({
    where: { id: pasos[0].itemId },
    data: { entregadoEl: ahora },
  });
  await expect(
    servicio.simular(auth(), pasos[0].id, solicitud()),
  ).rejects.toThrow('ya entregado');
  await expect(
    servicio.simular(auth(), pasos[0].id, entrega()),
  ).rejects.toThrow('ya entregado');
  await db.ordenTrabajoItem.update({
    where: { id: pasos[0].itemId },
    data: { entregadoEl: null },
  });
  const siguiente = await agregarSucesor();
  await db.ordenTrabajoItemPaso.update({
    where: { id: siguiente.id },
    data: { estado: 'en_curso', iniciadoEl: ahora },
  });
  await expect(
    servicio.simular(auth(), pasos[0].id, solicitud()),
  ).rejects.toThrow('Un paso siguiente ya se inició');
});
