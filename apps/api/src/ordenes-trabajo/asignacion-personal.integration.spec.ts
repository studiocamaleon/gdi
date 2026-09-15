import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProduccionService } from '../produccion/produccion.service';
import { EtaService } from '../eta/eta.service';
import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';
import { AsignacionPersonalService } from './asignacion-personal.service';
import { leerAsignacionPersonal } from '../produccion/asignacion-personal';
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
const servicio = new AsignacionPersonalService(
  db,
  eta,
  new EventosSistemaService(db),
);
const secretoOriginal = process.env.JWT_SECRET;
beforeAll(() => {
  process.env.JWT_SECRET = 'solo-para-tests-de-asignacion';
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
  permisos: new Set(['produccion.supervisar', 'produccion.ver']),
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

it('ofrece sólo personal activo de la estación, también sin usuario vinculado', async () => {
  await db.empleado.update({
    where: { id: empleados[1].id },
    data: { userId: null },
  });
  const datos = await servicio.contexto(auth(), pasos[0].id);
  expect(datos.personasNecesarias).toBe(1);
  expect(datos.candidatos.map((c) => c.id).sort()).toEqual(
    empleados
      .slice(0, 2)
      .map((e) => e.id)
      .sort(),
  );
  await db.empleado.update({
    where: { id: empleados[0].id },
    data: { activo: false },
  });
  expect(
    (await servicio.contexto(auth(), pasos[0].id)).candidatos.map((c) => c.id),
  ).toEqual([empleados[1].id]);
});

it('simular no escribe y confirmar conserva Previsto, demanda y ejecución; el recálculo respeta la elección', async () => {
  await eta.sincronizarAsignaciones(tenantId);
  const previo = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
    where: { id: pasos[0].id },
  });
  const idsPrevios = (await leer(pasos[0].id)).personas.map(
    (p) => p.empleadoId,
  );
  const nuevo = empleados.slice(0, 2).find((e) => !idsPrevios.includes(e.id))!;
  const revision = await servicio.simular(auth(), pasos[0].id, [nuevo.id]);
  expect(revision.viable).toBe(true);
  expect(revision.paso.personalPropuesto).toEqual([nuevo.nombreCompleto]);
  expect(
    await db.ordenTrabajoItemPaso.findUnique({ where: { id: pasos[0].id } }),
  ).toEqual(previo);
  expect(await db.eventoSistema.count({ where: { tenantId } })).toBe(0);
  await servicio.confirmar(auth(), pasos[0].id, {
    token: revision.token!,
    motivo: 'Cambio de disponibilidad',
  });
  const guardado = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
    where: { id: pasos[0].id },
  });
  expect(guardado.planReferenciaJson).toEqual(previo.planReferenciaJson);
  expect(guardado.demandaHumanaJson).toEqual(previo.demandaHumanaJson);
  expect(guardado.planificadoDesde).toEqual(previo.planificadoDesde);
  expect(guardado.planificadoHasta).toEqual(previo.planificadoHasta);
  expect(guardado.iniciadoEl).toBeNull();
  expect(guardado.mesaUsuarioId).toBeNull();
  expect(guardado.asignacionManualJson).toMatchObject({
    empleadoIds: [nuevo.id],
    usuarioId: users[0],
  });
  reloj = new Date(ahora.getTime() + 10 * 60_000);
  await eta.sincronizarAsignaciones(tenantId);
  const final = await leer(pasos[0].id);
  expect(final.origen).toBe('manual');
  expect(final.personas.map((p) => p.empleadoId)).toEqual([nuevo.id]);
  expect(
    final.franjas.every(
      (f) => f.empleadoIds.length === 1 && f.empleadoIds[0] === nuevo.id,
    ),
  ).toBe(true);
  expect(
    (
      await db.ordenTrabajoItemPaso.findUniqueOrThrow({
        where: { id: pasos[0].id },
      })
    ).planReferenciaJson,
  ).toEqual(previo.planReferenciaJson);
  const evento = await db.eventoSistema.findFirstOrThrow({
    where: { tenantId },
  });
  expect(evento.actorUserId).toBe(users[0]);
  expect(evento.mensaje).toContain('Cambio de disponibilidad');
  expect(evento.topicos).toContain('tablero-produccion');
  await expect(
    servicio.confirmar(auth(), pasos[0].id, { token: revision.token! }),
  ).rejects.toThrow('Cambiaron');
});

it('rechaza usuarios sin supervisión y pasos de otro tenant', async () => {
  await expect(
    servicio.contexto(
      { ...auth(), permisos: new Set(['produccion.ejecutar']) },
      pasos[0].id,
    ),
  ).rejects.toThrow('supervisión');
  await expect(
    servicio.contexto({ ...auth(), tenantId: otroTenant }, pasos[0].id),
  ).rejects.toThrow('disponible');
});

it.each(['en_curso', 'pausado', 'hecho'])(
  'no permite reasignar pasos %s',
  async (estado) => {
    await db.ordenTrabajoItemPaso.update({
      where: { id: pasos[0].id },
      data: { estado },
    });
    await expect(servicio.contexto(auth(), pasos[0].id)).rejects.toThrow();
  },
);

it('no permite reasignar un paso que conserva ejecución previa, aunque esté bloqueado', async () => {
  await db.ordenTrabajoItemPaso.update({
    where: { id: pasos[0].id },
    data: { estado: 'bloqueado', iniciadoEl: ahora },
  });
  await expect(servicio.contexto(auth(), pasos[0].id)).rejects.toThrow(
    'todavía no se inició',
  );
});

it('permite revisar un paso pendiente de dependencias y conserva las precedencias', async () => {
  for (const paso of pasos)
    await db.ordenTrabajoItemPaso.update({
      where: { id: paso.id },
      data: { nodoClave: paso.id },
    });
  await db.ordenTrabajoPasoDependencia.create({
    data: {
      tenantId,
      ordenId,
      predecesorPasoId: pasos[0].id,
      sucesorPasoId: pasos[1].id,
    },
  });
  const revision = await servicio.simular(auth(), pasos[1].id, [
    empleados[1].id,
  ]);
  expect(revision.viable).toBe(true);
  const origen = simularFlujo(
    await eta.contextoSimulacion(tenantId, db, false),
  );
  expect(Date.parse(revision.paso.propuesto!)).toBeGreaterThan(
    origen.traza.find((p) => p.pasoId === pasos[0].id)!.fin.getTime(),
  );
});

it.each(['tercerizado', 'PARTICIPANTE'])(
  'no ofrece reasignación de %s',
  async (tipo) => {
    await db.ordenTrabajoItemPaso.update({
      where: { id: pasos[0].id },
      data:
        tipo === 'tercerizado'
          ? { tipoEjecucion: tipo }
          : { nestingLoteRol: 'PARTICIPANTE' },
    });
    await expect(servicio.contexto(auth(), pasos[0].id)).rejects.toThrow(
      'proveedor',
    );
  },
);

it('exige la dotación exacta, sin duplicados ni empleados ajenos', async () => {
  for (const ids of [
    [],
    [empleados[0].id, empleados[0].id],
    [empleados[2].id],
    [randomUUID()],
  ])
    await expect(servicio.simular(auth(), pasos[0].id, ids)).rejects.toThrow();
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
  await expect(
    servicio.simular(auth(), pasos[0].id, [empleados[0].id]),
  ).rejects.toThrow('exactamente 2');
  const revision = await servicio.simular(
    auth(),
    pasos[0].id,
    empleados.slice(0, 2).map((e) => e.id),
  );
  expect(revision.viable).toBe(true);
  await servicio.confirmar(auth(), pasos[0].id, { token: revision.token! });
  expect((await leer(pasos[0].id)).personas).toHaveLength(2);
  expect(
    (await leer(pasos[0].id)).franjas.every((f) => f.empleadoIds.length === 2),
  ).toBe(true);
});

it('no confirma dotaciones sin horario conjunto', async () => {
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
  const horario = (desde: string, hasta: string) => ({
    dias: {
      ...cal.dias,
      lun: [{ desde, hasta }],
      mar: null,
      mie: null,
      jue: null,
      vie: null,
    },
  });
  await db.empleado.update({
    where: { id: empleados[0].id },
    data: { calendarioProduccionJson: horario('09:00', '10:00') },
  });
  await db.empleado.update({
    where: { id: empleados[1].id },
    data: { calendarioProduccionJson: horario('11:00', '12:00') },
  });
  const revision = await servicio.simular(
    auth(),
    pasos[0].id,
    empleados.slice(0, 2).map((e) => e.id),
  );
  expect(revision.viable).toBe(false);
  expect(revision.token).toBeNull();
  expect(revision.motivos.length).toBeGreaterThan(0);
});

it('informa el efecto sobre otros pasos y su diferencia con el atraso total', async () => {
  await eta.sincronizarAsignaciones(tenantId);
  const original = await leer(pasos[0].id);
  const alternativo = empleados
    .slice(0, 2)
    .find((e) => e.id !== original.personas[0].empleadoId)!;
  const calendarioTarde = {
    dias: Object.fromEntries(
      Object.keys(cal.dias).map((d) => [
        d,
        ['sab', 'dom'].includes(d)
          ? null
          : [{ desde: '14:00', hasta: '18:00' }],
      ]),
    ),
  };
  await db.empleado.update({
    where: { id: alternativo.id },
    data: { calendarioProduccionJson: calendarioTarde },
  });
  const revision = await servicio.simular(auth(), pasos[0].id, [
    alternativo.id,
  ]);
  expect(revision.viable).toBe(true);
  expect(revision.paso.diferenciaMin).toBeGreaterThan(0);
  expect(revision.paso.desvioPropuestoMin).toBe(
    revision.paso.desvioActualMin! + revision.paso.diferenciaMin!,
  );
  expect(revision.afectados.length).toBeGreaterThan(0);
  expect(revision.entregas.length).toBeGreaterThan(0);
});

it.each(['horario', 'paso', 'referencia', 'tiempo'])(
  'vuelve a revisar cuando cambia %s entre simulación y confirmación',
  async (cambio) => {
    const revision = await servicio.simular(auth(), pasos[0].id, [
      empleados[1].id,
    ]);
    if (cambio === 'horario')
      await db.empleado.update({
        where: { id: empleados[1].id },
        data: {
          calendarioProduccionJson: {
            dias: { ...cal.dias, lun: [{ desde: '10:00', hasta: '18:00' }] },
          },
        },
      });
    if (cambio === 'paso')
      await db.ordenTrabajoItemPaso.update({
        where: { id: pasos[1].id },
        data: { estado: 'en_curso', iniciadoEl: ahora },
      });
    if (cambio === 'referencia')
      await db.ordenTrabajoItemPaso.update({
        where: { id: pasos[0].id },
        data: {
          planReferenciaJson: {
            version: 1,
            inicio: ahora.toISOString(),
            fin: new Date(ahora.getTime() + 60_000).toISOString(),
            fijadoEl: ahora.toISOString(),
            origen: 'automatico',
            historial: [],
          },
        },
      });
    if (cambio === 'tiempo') reloj = new Date(ahora.getTime() + 60_000);
    await expect(
      servicio.confirmar(auth(), pasos[0].id, { token: revision.token! }),
    ).rejects.toThrow(/revisar/);
    expect(
      (
        await db.ordenTrabajoItemPaso.findUniqueOrThrow({
          where: { id: pasos[0].id },
        })
      ).asignacionManualJson,
    ).toBeNull();
  },
);

it('rechaza tokens manipulados, ajenos y vencidos', async () => {
  const revision = await servicio.simular(auth(), pasos[0].id, [
    empleados[1].id,
  ]);
  await expect(
    servicio.confirmar(auth(), pasos[0].id, { token: 'x' + revision.token }),
  ).rejects.toThrow('válida');
  await expect(
    servicio.confirmar({ ...auth(), userId: users[1] }, pasos[0].id, {
      token: revision.token!,
    }),
  ).rejects.toThrow('válida');
  await expect(
    servicio.confirmar(auth(), pasos[1].id, { token: revision.token! }),
  ).rejects.toThrow('válida');
  const fecha = Date.now();
  jest.spyOn(Date, 'now').mockReturnValue(fecha + 180_000);
  await expect(
    servicio.confirmar(auth(), pasos[0].id, { token: revision.token! }),
  ).rejects.toThrow('venció');
});

it('si falla la auditoría revierte toda la asignación', async () => {
  const servicioRoto = new AsignacionPersonalService(db, eta, {
    publicarDesdeAuth: jest
      .fn()
      .mockRejectedValue(new Error('Fallo de evento')),
  } as unknown as EventosSistemaService);
  const revision = await servicioRoto.simular(auth(), pasos[0].id, [
    empleados[1].id,
  ]);
  await expect(
    servicioRoto.confirmar(auth(), pasos[0].id, { token: revision.token! }),
  ).rejects.toThrow('Fallo de evento');
  expect(
    (
      await db.ordenTrabajoItemPaso.findUniqueOrThrow({
        where: { id: pasos[0].id },
      })
    ).asignacionManualJson,
  ).toBeNull();
});

it('dos confirmaciones concurrentes sólo guardan una decisión y un evento', async () => {
  const revision = await servicio.simular(auth(), pasos[0].id, [
    empleados[1].id,
  ]);
  const resultados = await Promise.allSettled([
    servicio.confirmar(auth(), pasos[0].id, { token: revision.token! }),
    servicio.confirmar(auth(), pasos[0].id, { token: revision.token! }),
  ]);
  expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(await db.eventoSistema.count({ where: { tenantId } })).toBe(1);
});

it('si se retira al empleado de la estación conserva la elección y expone el conflicto', async () => {
  const revision = await servicio.simular(auth(), pasos[0].id, [
    empleados[1].id,
  ]);
  await servicio.confirmar(auth(), pasos[0].id, { token: revision.token! });
  await db.estacionEmpleado.deleteMany({
    where: { tenantId, estacionId, empleadoId: empleados[1].id },
  });
  await eta.sincronizarAsignaciones(tenantId);
  const asignacion = await leer(pasos[0].id);
  expect(asignacion.personas.map((p) => p.empleadoId)).toEqual([
    empleados[1].id,
  ]);
  expect(asignacion.conflicto).toBeTruthy();
  expect(
    (await servicio.contexto(auth(), pasos[0].id)).candidatos.map((c) => c.id),
  ).toEqual([empleados[0].id]);
});
