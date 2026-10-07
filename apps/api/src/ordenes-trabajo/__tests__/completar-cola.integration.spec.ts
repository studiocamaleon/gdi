import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { validate } from 'class-validator';
import { serviciosRecorridoF4 } from '../../../test/soporte-recorridos-f4';
import type { CurrentAuth } from '../../auth/auth.types';
import { EventosSistemaService } from '../../eventos-sistema/eventos-sistema.service';
import { AccionesColaController } from '../acciones-cola.controller';
import { CompletarColaDto } from '../dto/completar-cola.dto';
import { ColasProduccionService } from '../../produccion/colas/colas.service';

const db = new PrismaClient();
const tenantId = randomUUID(),
  ajeno = randomUUID(),
  actorId = randomUUID(),
  otroActorId = randomUUID();
const maquinaId = randomUUID(),
  otraMaquina = randomUUID();
let empleadoId: string, otroEmpleadoId: string;
const { ordenes } = serviciosRecorridoF4(db);
Object.assign(ordenes, {
  capturarEtaCierre: jest.fn(),
  avisarAlCliente: jest.fn(),
  eventosSistema: new EventosSistemaService(db as never),
});
const controller = new AccionesColaController(ordenes);
const colas = new ColasProduccionService(db as never);
const auth = {
  tenantId,
  userId: actorId,
  email: 'qa@invalid.test',
  permisos: new Set(['produccion.ejecutar']),
} as CurrentAuth;

beforeAll(async () => {
  await db.tenant.createMany({
    data: [tenantId, ajeno].map((id) => ({
      id,
      slug: `qa-colas-${id}`,
      nombre: 'QA Colas',
    })),
  });
  await db.user.createMany({
    data: [actorId, otroActorId].map((id) => ({
      id,
      email: `${id}@invalid.test`,
    })),
  });
  const empleado = await db.empleado.create({
    data: {
      tenantId,
      userId: actorId,
      nombreCompleto: 'Operador QA',
      emailPrincipal: auth.email,
      telefonoCodigo: '+54',
      telefonoNumero: '',
      sector: 'Taller',
      fechaIngreso: new Date(),
    },
  });
  empleadoId = empleado.id;
  const otroEmpleado = await db.empleado.create({
    data: {
      tenantId,
      userId: otroActorId,
      nombreCompleto: 'Compañera QA',
      emailPrincipal: `${otroActorId}@invalid.test`,
      telefonoCodigo: '+54',
      telefonoNumero: '',
      sector: 'Taller',
      fechaIngreso: new Date(),
    },
  });
  otroEmpleadoId = otroEmpleado.id;
  const planta = await db.planta.create({
    data: { tenantId, nombre: 'Taller', codigo: 'P' },
  });
  for (const id of [maquinaId, otraMaquina]) {
    const estacion = await db.estacion.create({
      data: { tenantId, nombre: id },
    });
    await db.maquina.create({
      data: {
        id,
        tenantId,
        estacionId: estacion.id,
        plantaId: planta.id,
        codigo: id,
        nombre: 'Impresora',
        plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
        geometriaTrabajo: 'ROLLO',
        unidadProduccionPrincipal: 'M2',
      },
    });
    if (id === maquinaId)
      await db.estacionEmpleado.createMany({
        data: [empleado.id, otroEmpleado.id].map((empleadoId) => ({
          tenantId,
          estacionId: estacion.id,
          empleadoId,
        })),
      });
  }
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: [tenantId, ajeno] } } });
  await db.user.deleteMany({ where: { id: { in: [actorId, otroActorId] } } });
  await db.$disconnect();
});
async function trabajo(conSucesor = false, maquina = maquinaId) {
  const orden = await db.ordenTrabajo.create({
    data: {
      tenantId,
      numero: randomUUID(),
      estado: 'produccion',
      fechaEntrega: new Date('2026-10-01'),
      items: {
        create: {
          tenantId,
          codigo: 'A',
          nombre: 'Vinilo',
          familia: 'impresion',
          cantidad: 10,
          cantidadUnidad: 'u',
          subtotal: 1,
          impuestos: 0,
          total: 1,
        },
      },
    },
    include: { items: true },
  });
  const paso = await db.ordenTrabajoItemPaso.create({
    data: {
      tenantId,
      ordenId: orden.id,
      itemId: orden.items[0].id,
      maquinaId: maquina,
      indice: 0,
      nodoClave: 'imprimir',
      nombre: 'Impresión',
      familiaCodigo: 'impresion_por_area',
      categoriaFamilia: 'produccion_impresion',
      modoRegistro: 'solo_completar',
      mesaUsuarioId: actorId,
      duracionEstimadaMin: 12,
    },
  });
  if (conSucesor) {
    const siguiente = await db.ordenTrabajoItemPaso.create({
      data: {
        tenantId,
        ordenId: orden.id,
        itemId: paso.itemId,
        maquinaId: maquina,
        indice: 1,
        nodoClave: 'terminar',
        mesaUsuarioId: actorId,
        nombre: 'Terminación',
        familiaCodigo: 'trabajo_manual',
        categoriaFamilia: 'produccion',
        modoRegistro: 'solo_completar',
        duracionEstimadaMin: 4,
      },
    });
    await db.ordenTrabajoPasoDependencia.create({
      data: {
        tenantId,
        ordenId: orden.id,
        predecesorPasoId: paso.id,
        sucesorPasoId: siguiente.id,
      },
    });
  }
  return paso;
}
async function hechos(ids: string[]) {
  return db.ordenTrabajoItemPaso.count({
    where: { id: { in: ids }, estado: 'hecho' },
  });
}

it('completa desde la cola sin exigir configuración compatible y respetando Mi mesa y libera sucesores', async () => {
  const a = await trabajo(true),
    b = await trabajo();
  await db.ordenTrabajoItem.update({
    where: { id: a.itemId },
    data: {
      jobContextSnapshotJson: {
        modoColor: 'CMYK',
        ancho: 1370,
        material: 'vinilo',
      },
    },
  });
  await db.ordenTrabajoItem.update({
    where: { id: b.itemId },
    data: {
      jobContextSnapshotJson: {
        modoColor: 'CMYK+W',
        ancho: 1520,
        material: 'lona',
      },
    },
  });
  const r = await controller.completar(auth, maquinaId, {
    pasoIds: [a.id, b.id],
  });
  expect(r).toMatchObject({ completados: 2 });
  expect(await hechos([a.id, b.id])).toBe(2);
  const completado = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
    where: { id: a.id },
  });
  expect(completado.completadoPorId).toBe(actorId);
  expect(completado.tiempoFuente).toBe('estimado');
  const cola = await colas.listar(tenantId, maquinaId, {
    estado: 'listos',
    page: 1,
    limit: 100,
    q: '',
  });
  expect(
    cola.items.some((p) => p.itemId === a.itemId && p.nombre === 'Terminación'),
  ).toBe(true);
  expect(cola.items.some((p) => [a.id, b.id].includes(p.id))).toBe(false);
  expect(
    await db.ordenTrabajo.findUniqueOrThrow({ where: { id: b.ordenId } }),
  ).toMatchObject({
    estado: 'finalizada',
    progresoPct: 100,
    fechaEntrega: new Date('2026-10-01'),
  });
});

it('un error identifica la OT y revierte toda la selección', async () => {
  const a = await trabajo(),
    b = await trabajo();
  await db.ordenTrabajoPasoGate.create({
    data: {
      tenantId,
      ordenId: b.ordenId,
      pasoId: b.id,
      tipo: 'MATERIAL',
      estado: 'PENDIENTE',
    },
  });
  await expect(
    controller.completar(auth, maquinaId, { pasoIds: [a.id, b.id] }),
  ).rejects.toThrow('No se completó ningún trabajo');
  expect(await hechos([a.id, b.id])).toBe(0);
  expect(
    await db.ordenTrabajoEvento.count({
      where: { ordenId: { in: [a.ordenId, b.ordenId] } },
    }),
  ).toBe(0);
});
it('conserva permisos, aislamiento y pertenencia a la máquina', async () => {
  const a = await trabajo(),
    b = await trabajo(false, otraMaquina);
  await expect(
    controller.completar(
      { ...auth, permisos: new Set(['produccion.ver']) },
      maquinaId,
      { pasoIds: [a.id] },
    ),
  ).rejects.toThrow('permiso');
  await expect(
    controller.completar({ ...auth, tenantId: ajeno }, maquinaId, {
      pasoIds: [a.id],
    }),
  ).rejects.toThrow('máquina');
  await expect(
    controller.completar(auth, maquinaId, { pasoIds: [a.id, b.id] }),
  ).rejects.toThrow('máquina');
  await expect(
    controller.completar(auth, otraMaquina, { pasoIds: [b.id] }),
  ).rejects.toThrow();
  expect(await hechos([a.id, b.id])).toBe(0);
});
it('no toma trabajos asignados a otro operario', async () => {
  const a = await trabajo();
  await db.ordenTrabajoItemPaso.update({
    where: { id: a.id },
    data: { mesaUsuarioId: otroActorId },
  });
  await expect(
    controller.completar(auth, maquinaId, { pasoIds: [a.id] }),
  ).rejects.toThrow('no está asignado a vos');
  expect(await hechos([a.id])).toBe(0);
});
it('doble clic o reintento no duplica el registro', async () => {
  const a = await trabajo(),
    b = await trabajo();
  const resultados = await Promise.allSettled(
    [0, 1].map(() =>
      controller.completar(auth, maquinaId, { pasoIds: [a.id, b.id] }),
    ),
  );
  expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(await hechos([a.id, b.id])).toBe(2);
  expect(
    await db.ordenTrabajoEvento.count({
      where: { ordenId: { in: [a.ordenId, b.ordenId] }, tipo: 'paso' },
    }),
  ).toBe(2);
});
it('no completa pasos que todavía dependen de otro', async () => {
  const a = await trabajo(true);
  const siguiente = await db.ordenTrabajoItemPaso.findFirstOrThrow({
    where: { itemId: a.itemId, indice: 1 },
  });
  await expect(
    controller.completar(auth, maquinaId, { pasoIds: [siguiente.id] }),
  ).rejects.toThrow('dependencias');
  expect(await hechos([siguiente.id])).toBe(0);
});
it('rechaza IDs duplicados, inválidos o más de 50 antes de ejecutar', async () => {
  for (const pasoIds of [
    [],
    [randomUUID(), 'no-uuid'],
    Array(2).fill(actorId),
    Array.from({ length: 51 }, () => randomUUID()),
  ]) {
    expect(
      (await validate(Object.assign(new CompletarColaDto(), { pasoIds })))
        .length,
    ).toBeGreaterThan(0);
  }
});

const iniciar = (id: string) =>
  controller.accion(auth, maquinaId, id, { accion: 'iniciar' });
async function cronometro() {
  const a = await trabajo();
  return db.ordenTrabajoItemPaso.update({
    where: { id: a.id },
    data: { modoRegistro: 'cronometro' },
  });
}
it('Colas y Tablero rechazan por igual iniciar una máquina configurada para completar directamente', async () => {
  const a = await trabajo();
  await expect(iniciar(a.id)).rejects.toThrow('sin cronómetro');
  await expect(
    ordenes.accionPaso(auth, a.ordenId, a.itemId, a.id, { accion: 'iniciar' }),
  ).rejects.toThrow('sin cronómetro');
  expect(
    await db.ordenTrabajoPasoTramo.count({ where: { pasoId: a.id } }),
  ).toBe(0);
});
it('inicia, pausa con motivo, continúa y completa conservando los tramos medidos', async () => {
  const a = await cronometro();
  await iniciar(a.id);
  await expect(
    controller.accion(auth, maquinaId, a.id, { accion: 'pausar' }),
  ).rejects.toThrow('motivo');
  await expect(
    controller.accion(auth, maquinaId, a.id, {
      accion: 'pausar',
      motivo: 'otro',
    }),
  ).rejects.toThrow('motivo');
  await controller.accion(auth, maquinaId, a.id, {
    accion: 'pausar',
    motivo: 'otro',
    motivoDetalle: 'Revisar impresión',
  });
  expect(
    await db.ordenTrabajoPasoTramo.findFirstOrThrow({
      where: { pasoId: a.id },
    }),
  ).toMatchObject({
    motivoFin: 'pausa:otro',
    motivoDetalle: 'Revisar impresión',
  });
  await controller.accion(auth, maquinaId, a.id, { accion: 'continuar' });
  const abierto = await db.ordenTrabajoPasoTramo.findFirstOrThrow({
    where: { pasoId: a.id, finEl: null },
  });
  await db.ordenTrabajoPasoTramo.update({
    where: { id: abierto.id },
    data: { inicioEl: new Date(Date.now() - 5 * 60_000) },
  });
  const cola = await colas.listar(
    tenantId,
    maquinaId,
    { estado: 'en_curso', page: 1, limit: 100, q: '' },
    auth,
  );
  expect(cola.items.find((p) => p.id === a.id)?.control).toMatchObject({
    canManage: true,
    paso: {
      estado: 'en_curso',
      modoRegistro: 'cronometro',
      tramoAbierto: { esMio: true },
    },
  });
  await controller.completar(auth, maquinaId, { pasoIds: [a.id] });
  expect(
    await db.ordenTrabajoPasoTramo.count({
      where: { pasoId: a.id, finEl: null },
    }),
  ).toBe(0);
  const completado = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
    where: { id: a.id },
  });
  expect(completado.tiempoFuente).toBe('medido');
  expect(Number(completado.tiempoRealMin)).toBeCloseTo(5, 0);
});
it('tiempo insuficiente exige la misma decisión en ambas vistas y revierte la selección completa', async () => {
  const a = await trabajo(),
    b = await cronometro();
  await expect(
    ordenes.accionPaso(auth, b.ordenId, b.itemId, b.id, {
      accion: 'completar',
    }),
  ).rejects.toThrow('tiempo medido es insuficiente');
  await expect(
    controller.completar(auth, maquinaId, { pasoIds: [a.id, b.id] }),
  ).rejects.toThrow('tiempo medido es insuficiente');
  expect(await hechos([a.id, b.id])).toBe(0);
  expect(
    await db.ordenTrabajoEvento.count({
      where: { ordenId: { in: [a.ordenId, b.ordenId] } },
    }),
  ).toBe(0);
  await controller.completar(auth, maquinaId, {
    pasoIds: [a.id, b.id],
    tiempos: [{ pasoId: b.id, tiempoDeclaradoMin: 7 }],
  });
  const completado = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
    where: { id: b.id },
  });
  expect(completado.tiempoFuente).toBe('declarado');
  expect(Number(completado.tiempoRealMin)).toBe(7);
  expect(await hechos([a.id, b.id])).toBe(2);
});
it('sólo registra tiempo inválido cuando el operario elige explícitamente completar sin tiempo', async () => {
  const a = await cronometro(),
    b = await cronometro();
  await controller.accion(auth, maquinaId, a.id, {
    accion: 'completar',
    sinTiempoConfirmado: true,
  });
  await ordenes.accionPaso(auth, b.ordenId, b.itemId, b.id, {
    accion: 'completar',
    sinTiempoConfirmado: true,
  });
  const filas = await db.ordenTrabajoItemPaso.findMany({
    where: { id: { in: [a.id, b.id] } },
  });
  expect(
    filas.every(
      (p) =>
        p.estado === 'hecho' &&
        p.tiempoFuente === 'invalido' &&
        p.tiempoRealMin === null,
    ),
  ).toBe(true);
});
it('bloquea con motivo y sólo permite desbloquear al supervisor', async () => {
  const a = await trabajo();
  await expect(
    controller.accion(auth, maquinaId, a.id, { accion: 'bloquear' }),
  ).rejects.toThrow('motivo');
  await controller.accion(auth, maquinaId, a.id, {
    accion: 'bloquear',
    motivo: 'Falta tinta',
  });
  await expect(
    controller.completar(auth, maquinaId, { pasoIds: [a.id] }),
  ).rejects.toThrow('bloqueado');
  await expect(
    controller.accion(auth, maquinaId, a.id, { accion: 'desbloquear' }),
  ).rejects.toThrow('supervisor');
  await controller.accion(
    { ...auth, permisos: new Set(['produccion.supervisar']) },
    maquinaId,
    a.id,
    { accion: 'desbloquear' },
  );
  expect(
    await db.ordenTrabajoItemPaso.findUniqueOrThrow({ where: { id: a.id } }),
  ).toMatchObject({ estado: 'pendiente', motivoBloqueo: null });
});
it('no salta la asignación a Mi mesa, ni siquiera para un trabajo libre', async () => {
  const a = await cronometro();
  await db.ordenTrabajoItemPaso.update({
    where: { id: a.id },
    data: { mesaUsuarioId: null },
  });
  await expect(iniciar(a.id)).rejects.toThrow('no está asignado a vos');
  await expect(
    controller.completar(auth, maquinaId, {
      pasoIds: [a.id],
      tiempos: [{ pasoId: a.id, sinTiempoConfirmado: true }],
    }),
  ).rejects.toThrow('no está asignado a vos');
  const cola = await colas.listar(
    tenantId,
    maquinaId,
    { estado: 'listos', page: 1, limit: 100, q: '' },
    auth,
  );
  expect(cola.items.find((p) => p.id === a.id)?.control).toMatchObject({
    canManage: false,
    puedeTomarMesa: true,
  });
  await ordenes.mesaPaso(auth, a.id, true);
  await iniciar(a.id);
  expect(
    await db.ordenTrabajoItemPaso.findUniqueOrThrow({ where: { id: a.id } }),
  ).toMatchObject({ estado: 'en_curso', mesaUsuarioId: actorId });
});
it('dos inicios simultáneos abren un solo tramo', async () => {
  const a = await cronometro();
  const resultados = await Promise.allSettled([iniciar(a.id), iniciar(a.id)]);
  expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(
    await db.ordenTrabajoPasoTramo.count({ where: { pasoId: a.id } }),
  ).toBe(1);
});
it('no acepta declaraciones duplicadas o de trabajos fuera de la selección', async () => {
  const a = await trabajo();
  for (const tiempos of [
    [{ pasoId: randomUUID(), tiempoDeclaradoMin: 4 }],
    [{ pasoId: a.id }, { pasoId: a.id }],
  ]) {
    await expect(
      controller.completar(auth, maquinaId, { pasoIds: [a.id], tiempos }),
    ).rejects.toThrow('tiempos');
  }
  expect(await hechos([a.id])).toBe(0);
});

const companera = { ...auth, userId: otroActorId };
async function automatico(
  opciones: { cronometro?: boolean; maquina?: string } = {},
) {
  const paso = await trabajo(false, opciones.maquina);
  return db.ordenTrabajoItemPaso.update({
    where: { id: paso.id },
    data: {
      mesaUsuarioId: null,
      modoRegistro: opciones.cronometro ? 'cronometro' : 'solo_completar',
      asignacionPersonalJson: {
        version: 1,
        origen: 'automatica',
        conflicto: null,
        franjas: [],
        personas: [{ empleadoId, usuarioId: actorId, nombre: 'Operador QA' }],
      },
    },
  });
}
async function controlDe(id: string, quien = companera, estado = 'listos') {
  const cola = await colas.listar(
    tenantId,
    maquinaId,
    {
      estado: estado as 'listos' | 'en_curso',
      page: 1,
      limit: 100,
      q: '',
    },
    quien,
  );
  return cola.items.find((p) => p.id === id)?.control;
}

it('permite completar una previsión automática a otra integrante de la estación y registra su autoría', async () => {
  const paso = await automatico();
  expect(await controlDe(paso.id)).toMatchObject({
    canManage: true,
    puedeTomarMesa: false,
  });
  const tablero = await ordenes.tablero(companera);
  expect(
    tablero.items.find((i) => i.id === paso.itemId)?.pasos[0],
  ).toMatchObject({
    ejecucionPorEquipo: true,
    asignacionPersonal: { esMia: false, origen: 'automatica' },
  });
  await controller.completar(companera, maquinaId, { pasoIds: [paso.id] });
  expect(
    await db.ordenTrabajoItemPaso.findUniqueOrThrow({ where: { id: paso.id } }),
  ).toMatchObject({
    estado: 'hecho',
    completadoPorId: otroActorId,
    completadoPorNombre: 'Compañera QA',
  });
});

it('comparte el cronómetro sin duplicarlo y conserva quién inició, quién trabajó y quién terminó', async () => {
  const paso = await automatico({ cronometro: true });
  const inicio = await ordenes.accionPaso(
    companera,
    paso.ordenId,
    paso.itemId,
    paso.id,
    { accion: 'iniciar' },
  );
  expect(inicio.pasos[0]).toMatchObject({
    ejecucionPorEquipo: true,
    iniciadoPorNombre: 'Compañera QA',
  });
  expect(await controlDe(paso.id, auth, 'en_curso')).toMatchObject({
    canManage: true,
  });
  const tramo = await db.ordenTrabajoPasoTramo.findFirstOrThrow({
    where: { pasoId: paso.id, finEl: null },
  });
  await db.ordenTrabajoPasoTramo.update({
    where: { id: tramo.id },
    data: { inicioEl: new Date(Date.now() - 5 * 60_000) },
  });
  await controller.completar(auth, maquinaId, { pasoIds: [paso.id] });
  expect(
    await db.ordenTrabajoItemPaso.findUniqueOrThrow({ where: { id: paso.id } }),
  ).toMatchObject({
    iniciadoPorId: otroActorId,
    completadoPorId: actorId,
    tiempoFuente: 'medido',
    mesaUsuarioId: null,
  });
  expect(
    await db.ordenTrabajoPasoTramo.findMany({ where: { pasoId: paso.id } }),
  ).toEqual([
    expect.objectContaining({
      usuarioId: otroActorId,
      finEl: expect.any(Date),
    }),
  ]);
});

it('respeta la asignación manual aunque todavía quede una previsión automática anterior', async () => {
  const paso = await automatico();
  await db.ordenTrabajoItemPaso.update({
    where: { id: paso.id },
    data: {
      asignacionManualJson: {
        version: 1,
        revision: randomUUID(),
        empleadoIds: [otroEmpleadoId],
        asignadoEl: new Date().toISOString(),
        usuarioId: actorId,
        usuarioNombre: 'Supervisor QA',
      },
    },
  });
  expect(await controlDe(paso.id, auth)).toMatchObject({
    canManage: false,
    puedeTomarMesa: false,
  });
  await expect(
    controller.completar(auth, maquinaId, { pasoIds: [paso.id] }),
  ).rejects.toThrow('asignación manual');
  const tablero = await ordenes.tablero(auth);
  expect(
    tablero.items.find((i) => i.id === paso.itemId)?.pasos[0]
      ?.ejecucionPorEquipo,
  ).toBe(false);
  expect(await controlDe(paso.id)).toMatchObject({ canManage: true });
  await controller.completar(companera, maquinaId, { pasoIds: [paso.id] });
  expect(await hechos([paso.id])).toBe(1);
});

it('el trabajo compartido sigue exigiendo permiso, empleado activo y pertenencia a la estación', async () => {
  const paso = await automatico();
  const sinPermiso = { ...companera, permisos: new Set(['produccion.ver']) };
  expect(await controlDe(paso.id, sinPermiso)).toMatchObject({
    canManage: false,
  });
  await expect(
    controller.completar(sinPermiso, maquinaId, { pasoIds: [paso.id] }),
  ).rejects.toThrow('permiso');
  await db.empleado.update({
    where: { id: otroEmpleadoId },
    data: { activo: false },
  });
  try {
    expect(await controlDe(paso.id)).toMatchObject({ canManage: false });
    await expect(
      controller.completar(companera, maquinaId, { pasoIds: [paso.id] }),
    ).rejects.toThrow('empleado activo');
  } finally {
    await db.empleado.update({
      where: { id: otroEmpleadoId },
      data: { activo: true },
    });
  }
  const otraEstacion = await automatico({ maquina: otraMaquina });
  await expect(
    controller.completar(companera, otraMaquina, {
      pasoIds: [otraEstacion.id],
    }),
  ).rejects.toThrow('habilitado');
  expect(await hechos([paso.id, otraEstacion.id])).toBe(0);
});

it('compartir no salta gates, precedencias ni una toma explícita en Mi mesa', async () => {
  const paso = await automatico();
  await db.ordenTrabajoPasoGate.create({
    data: {
      tenantId,
      ordenId: paso.ordenId,
      pasoId: paso.id,
      tipo: 'MATERIAL',
      estado: 'PENDIENTE',
    },
  });
  await expect(
    controller.completar(companera, maquinaId, { pasoIds: [paso.id] }),
  ).rejects.toThrow('material');
  const mesa = await automatico();
  await db.ordenTrabajoItemPaso.update({
    where: { id: mesa.id },
    data: { mesaUsuarioId: actorId },
  });
  expect(await controlDe(mesa.id)).toMatchObject({ canManage: false });
  await expect(
    controller.completar(companera, maquinaId, { pasoIds: [mesa.id] }),
  ).rejects.toThrow('no está asignado a vos');
  const conSucesor = await trabajo(true);
  const siguiente = await db.ordenTrabajoItemPaso.findFirstOrThrow({
    where: { itemId: conSucesor.itemId, indice: 1 },
  });
  await db.ordenTrabajoItemPaso.update({
    where: { id: siguiente.id },
    data: {
      mesaUsuarioId: null,
      asignacionPersonalJson: paso.asignacionPersonalJson!,
    },
  });
  await expect(
    controller.completar(companera, maquinaId, { pasoIds: [siguiente.id] }),
  ).rejects.toThrow('dependencias');
  expect(await hechos([paso.id, mesa.id, siguiente.id])).toBe(0);
});

it('dos integrantes no pueden registrar dos veces la misma finalización', async () => {
  const paso = await automatico();
  const resultados = await Promise.allSettled(
    [auth, companera].map((quien) =>
      controller.completar(quien, maquinaId, { pasoIds: [paso.id] }),
    ),
  );
  expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(
    await db.ordenTrabajoEvento.count({
      where: { ordenId: paso.ordenId, tipo: 'paso' },
    }),
  ).toBe(1);
  expect(await hechos([paso.id])).toBe(1);
});

it('entrega conserva la fecha propia del ítem y usa la de la OT cuando no hay una propia', async () => {
  const propia = await automatico(),
    heredada = await automatico();
  await db.ordenTrabajoItem.update({
    where: { id: propia.itemId },
    data: { fechaEntrega: new Date('2026-10-12') },
  });
  const tablero = await ordenes.tablero(companera);
  expect(tablero.items.find((i) => i.id === propia.itemId)?.fechaEntrega).toBe(
    '2026-10-12',
  );
  expect(
    tablero.items.find((i) => i.id === heredada.itemId)?.fechaEntrega,
  ).toBe('2026-10-01');
});
