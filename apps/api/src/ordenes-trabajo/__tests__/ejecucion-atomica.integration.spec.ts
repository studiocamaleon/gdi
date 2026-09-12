import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { serviciosRecorridoF4 } from '../../../test/soporte-recorridos-f4';
import type { CurrentAuth } from '../../auth/auth.types';
import { EventosSistemaService } from '../../eventos-sistema/eventos-sistema.service';
import type { AccionPasoEnGrupo } from '../ejecucion-pasos-atomica';

const db = new PrismaClient();
const tenantId = randomUUID(),
  otroTenantId = randomUUID();
const actorId = randomUUID(),
  maquinaId = randomUUID(),
  segundaMaquinaId = randomUUID();
const { ordenes } = serviciosRecorridoF4(db);
// Sólo efectos posteriores al commit: no enviar comunicaciones ni crear
// snapshots ETA fuera del alcance de esta prueba. El núcleo y la DB son reales.
const etaCierre = jest.fn().mockResolvedValue(undefined),
  avisar = jest.fn();
Object.assign(ordenes, {
  capturarEtaCierre: etaCierre,
  avisarAlCliente: avisar,
  eventosSistema: new EventosSistemaService(db as never),
});
const auth = {
  tenantId,
  userId: actorId,
  email: 'impresor@qa.invalid',
  permisos: new Set(['produccion.supervisar']),
} as CurrentAuth;

beforeAll(async () => {
  await db.tenant.createMany({
    data: [tenantId, otroTenantId].map((id) => ({
      id,
      slug: `qa-atomica-${id}`,
      nombre: 'QA ejecución atómica',
    })),
  });
  await db.user.create({
    data: { id: actorId, email: `qa-${actorId}@example.invalid` },
  });
  const empleado = await db.empleado.create({
    data: {
      tenantId,
      userId: actorId,
      nombreCompleto: 'Impresor QA',
      emailPrincipal: auth.email,
      telefonoCodigo: '+54',
      telefonoNumero: '',
      sector: 'Impresión',
      fechaIngreso: new Date('2026-01-01'),
    },
  });
  const planta = await db.planta.create({
    data: { tenantId, nombre: 'Taller', codigo: 'QA' },
  });
  for (const id of [maquinaId, segundaMaquinaId]) {
    const estacion = await db.estacion.create({
      data: { tenantId, nombre: id, activo: true },
    });
    await db.maquina.create({
      data: {
        id,
        tenantId,
        plantaId: planta.id,
        estacionId: estacion.id,
        codigo: id,
        nombre: 'Impresora QA',
        plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
        geometriaTrabajo: 'ROLLO',
        unidadProduccionPrincipal: 'M2',
      },
    });
    if (id === maquinaId)
      await db.estacionEmpleado.create({
        data: { tenantId, estacionId: estacion.id, empleadoId: empleado.id },
      });
  }
});
beforeEach(() => {
  etaCierre.mockClear();
  avisar.mockClear();
});
afterAll(async () => {
  await db.proyectoCampana.deleteMany({ where: { tenantId } });
  await db.tenant.deleteMany({
    where: { id: { in: [tenantId, otroTenantId] } },
  });
  await db.user.deleteMany({ where: { id: actorId } });
  await db.$disconnect();
});

async function crearTrabajo(
  opciones: { tenant?: string; maquina?: string; cronometro?: boolean } = {},
) {
  const tenant = opciones.tenant ?? tenantId;
  const orden = await db.ordenTrabajo.create({
    data: {
      tenantId: tenant,
      numero: randomUUID(),
      estado: 'pendiente',
      fechaEntrega: new Date('2026-09-25'),
      items: {
        create: {
          tenantId: tenant,
          codigo: 'A',
          nombre: 'Trabajo QA',
          familia: 'impresion',
          cantidad: 50,
          cantidadUnidad: 'u',
          subtotal: 0,
          impuestos: 0,
          total: 0,
        },
      },
    },
    include: { items: true },
  });
  const paso = await db.ordenTrabajoItemPaso.create({
    data: {
      tenantId: tenant,
      ordenId: orden.id,
      itemId: orden.items[0].id,
      indice: 0,
      nodoClave: 'imprimir',
      esTerminal: true,
      nombre: 'Impresión',
      familiaCodigo: 'impresion_por_area',
      categoriaFamilia: 'produccion_impresion',
      maquinaId: opciones.maquina ?? maquinaId,
      modoRegistro: opciones.cronometro ? 'cronometro' : 'solo_completar',
      duracionEstimadaMin: 30,
      mesaUsuarioId: actorId,
    },
  });
  return { ordenId: orden.id, itemId: paso.itemId, pasoId: paso.id };
}
const completar = (
  t: Awaited<ReturnType<typeof crearTrabajo>>,
): AccionPasoEnGrupo => ({ ...t, payload: { accion: 'completar' } });
async function verificarSinCambios(
  trabajos: Array<Awaited<ReturnType<typeof crearTrabajo>>>,
) {
  const ids = trabajos.map((t) => t.ordenId);
  const ots = await db.ordenTrabajo.findMany({ where: { id: { in: ids } } });
  for (const ot of ots)
    expect(ot).toMatchObject({
      estado: 'pendiente',
      progresoPct: null,
      fechaFinalizada: null,
      fechaVencimientoComercial: null,
    });
  const pasos = await db.ordenTrabajoItemPaso.findMany({
    where: { id: { in: trabajos.map((t) => t.pasoId) } },
  });
  for (const paso of pasos)
    expect(paso).toMatchObject({
      estado: 'pendiente',
      completadoEl: null,
      tiempoRealMin: null,
    });
  expect(
    await db.ordenTrabajoEvento.count({ where: { ordenId: { in: ids } } }),
  ).toBe(0);
  expect(
    await db.eventoSistema.count({ where: { entidadId: { in: ids } } }),
  ).toBe(0);
  expect(etaCierre).not.toHaveBeenCalled();
  expect(avisar).not.toHaveBeenCalled();
}

it('cierra dos OT juntas, conserva entregas, atribución y tiempos sin crear tramos humanos ficticios', async () => {
  const trabajos = [await crearTrabajo(), await crearTrabajo()];
  await ordenes.accionesPasos(auth, trabajos.map(completar));
  for (const t of trabajos) {
    const ot = await db.ordenTrabajo.findUniqueOrThrow({
      where: { id: t.ordenId },
    });
    expect(ot).toMatchObject({
      estado: 'finalizada',
      progresoPct: 100,
      fechaEntrega: new Date('2026-09-25'),
    });
    expect(ot.fechaFinalizada).not.toBeNull();
    const p = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
      where: { id: t.pasoId },
    });
    expect(p).toMatchObject({
      estado: 'hecho',
      completadoPorId: actorId,
      tiempoFuente: 'estimado',
    });
    expect(Number(p.tiempoRealMin)).toBe(30);
    expect(
      await db.ordenTrabajoPasoTramo.count({ where: { pasoId: t.pasoId } }),
    ).toBe(0);
    expect(
      await db.ordenTrabajoEvento.count({
        where: { ordenId: t.ordenId, tipo: 'paso' },
      }),
    ).toBe(1);
  }
  expect(etaCierre).toHaveBeenCalledTimes(2);
  expect(avisar).toHaveBeenCalledTimes(2);
});

it('si el último trabajo falla por material, revierte pasos, eventos y finalización de los anteriores', async () => {
  const trabajos = [await crearTrabajo(), await crearTrabajo()];
  await db.ordenTrabajoPasoGate.create({
    data: {
      tenantId,
      ordenId: trabajos[1].ordenId,
      pasoId: trabajos[1].pasoId,
      tipo: 'MATERIAL',
    },
  });
  await expect(
    ordenes.accionesPasos(auth, trabajos.map(completar)),
  ).rejects.toThrow(/material/);
  await verificarSinCambios(trabajos);
});

it('mantiene el bloqueo por dependencias y revierte el grupo completo', async () => {
  const trabajos = [await crearTrabajo(), await crearTrabajo()];
  const t = trabajos[1];
  const previo = await db.ordenTrabajoItemPaso.create({
    data: {
      tenantId,
      ordenId: t.ordenId,
      itemId: t.itemId,
      indice: 1,
      nodoClave: 'preparar',
      nombre: 'Preparar archivo',
      familiaCodigo: 'trabajo_manual',
      categoriaFamilia: 'produccion',
      estado: 'pendiente',
    },
  });
  await db.ordenTrabajoPasoDependencia.create({
    data: {
      tenantId,
      ordenId: t.ordenId,
      predecesorPasoId: previo.id,
      sucesorPasoId: t.pasoId,
    },
  });
  await expect(
    ordenes.accionesPasos(auth, trabajos.map(completar)),
  ).rejects.toThrow(/dependencias/);
  await verificarSinCambios(trabajos);
});

it('lee los gates documentales con la misma transacción y revierte cualquier cierre previo', async () => {
  const trabajos = [await crearTrabajo(), await crearTrabajo()];
  const cliente = await db.cliente.create({
    data: {
      tenantId,
      nombre: 'Cliente QA',
      telefonoCodigo: '+54',
      telefonoNumero: '',
      paisCodigo: 'AR',
    },
  });
  const campana = await db.proyectoCampana.create({
    data: {
      tenantId,
      clienteId: cliente.id,
      codigo: randomUUID(),
      nombre: 'Prueba documental',
    },
  });
  const archivo = await db.archivoMaestro.create({
    data: {
      tenantId,
      proyectoCampanaId: campana.id,
      nombre: 'Archivo sin aprobar',
      proposito: 'PRINT',
      etapa: 'PRODUCCION',
      creadoPorNombre: 'QA',
    },
  });
  await db.gateProduccionDocumento.create({
    data: {
      tenantId,
      proyectoCampanaId: campana.id,
      ordenId: trabajos[1].ordenId,
      archivoMaestroId: archivo.id,
      tipoAprobacion: 'CLIENTE',
      nombre: 'Aprobación cliente',
    },
  });
  await expect(
    ordenes.accionesPasos(auth, trabajos.map(completar)),
  ).rejects.toThrow(/aprobación documental/);
  await verificarSinCambios(trabajos);
});

it('no autoriza por el primer trabajo: exige habilitación en cada estación y revierte todo', async () => {
  const trabajos = [
    await crearTrabajo(),
    await crearTrabajo({ maquina: segundaMaquinaId }),
  ];
  await expect(
    ordenes.accionesPasos(
      { ...auth, permisos: new Set(['produccion.ejecutar']) },
      trabajos.map(completar),
    ),
  ).rejects.toThrow(/habilitado/);
  await verificarSinCambios(trabajos);
});

it('rechaza otros tenants y correspondencias falsas entre paso, ítem y OT', async () => {
  const propio = await crearTrabajo(),
    ajeno = await crearTrabajo({ tenant: otroTenantId });
  await expect(
    ordenes.accionesPasos(auth, [completar(propio), completar(ajeno)]),
  ).rejects.toThrow(/No se encontró/);
  await verificarSinCambios([propio, ajeno]);
  const segundo = await crearTrabajo();
  await expect(
    ordenes.accionesPasos(auth, [
      completar(propio),
      { ...completar(segundo), itemId: propio.itemId },
    ]),
  ).rejects.toThrow(/No se encontró/);
  await verificarSinCambios([propio, segundo]);
});

it('sin permiso, con duplicados o fuera del límite no modifica ningún trabajo', async () => {
  const t = await crearTrabajo();
  await expect(
    ordenes.accionesPasos({ ...auth, permisos: new Set(['produccion.ver']) }, [
      completar(t),
    ]),
  ).rejects.toThrow(/permiso/);
  await expect(
    ordenes.accionesPasos(auth, [completar(t), completar(t)]),
  ).rejects.toThrow(/dos veces/);
  await expect(ordenes.accionesPasos(auth, [])).rejects.toThrow(/1 y 50/);
  await expect(
    ordenes.accionesPasos(
      auth,
      Array.from({ length: 51 }, () => completar(t)),
    ),
  ).rejects.toThrow(/1 y 50/);
  await verificarSinCambios([t]);
});

it('dos grupos concurrentes en orden inverso producen un único cierre sin duplicar eventos', async () => {
  const trabajos = [await crearTrabajo(), await crearTrabajo()];
  const resultados = await Promise.allSettled([
    ordenes.accionesPasos(auth, trabajos.map(completar)),
    ordenes.accionesPasos(auth, [...trabajos].reverse().map(completar)),
  ]);
  expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const error = resultados.find(
    (r) => r.status === 'rejected',
  ) as PromiseRejectedResult;
  expect(String(error.reason)).toMatch(/Finalizada|estado "hecho"/);
  expect(
    await db.ordenTrabajoEvento.count({
      where: { ordenId: { in: trabajos.map((t) => t.ordenId) }, tipo: 'paso' },
    }),
  ).toBe(2);
  expect(avisar).toHaveBeenCalledTimes(2);
});

it('el comando individual y el conjunto compiten por los mismos cerrojos', async () => {
  const trabajos = [await crearTrabajo(), await crearTrabajo()];
  const [grupo, individual] = await Promise.allSettled([
    ordenes.accionesPasos(auth, trabajos.map(completar)),
    ordenes.accionPaso(
      auth,
      trabajos[0].ordenId,
      trabajos[0].itemId,
      trabajos[0].pasoId,
      { accion: 'completar' },
    ),
  ]);
  expect(
    [grupo, individual].filter((r) => r.status === 'fulfilled'),
  ).toHaveLength(1);
  const segundo = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
    where: { id: trabajos[1].pasoId },
  });
  expect(segundo.estado).toBe(
    grupo.status === 'fulfilled' ? 'hecho' : 'pendiente',
  );
  expect(
    await db.ordenTrabajoEvento.count({
      where: { ordenId: trabajos[0].ordenId, tipo: 'paso' },
    }),
  ).toBe(1);
});

it('mantiene la ejecución compartida F4 y rechaza ejecutar un participante por separado', async () => {
  const operativo = await crearTrabajo(),
    otro = await crearTrabajo();
  await db.ordenTrabajoItemPaso.update({
    where: { id: operativo.pasoId },
    data: { nestingLoteId: 'f4', nestingLoteRol: 'OPERATIVO' },
  });
  const alias = await db.ordenTrabajoItemPaso.create({
    data: {
      tenantId,
      ordenId: operativo.ordenId,
      itemId: operativo.itemId,
      indice: 1,
      nodoClave: 'alias',
      nombre: 'Participante',
      familiaCodigo: 'impresion_por_area',
      categoriaFamilia: 'produccion',
      nestingLoteId: 'f4',
      nestingLoteRol: 'PARTICIPANTE',
      duracionEstimadaMin: 0,
    },
  });
  await expect(
    ordenes.accionesPasos(auth, [
      completar(otro),
      { ...completar(operativo), pasoId: alias.id },
    ]),
  ).rejects.toThrow(/operación principal/);
  await verificarSinCambios([operativo, otro]);
  await ordenes.accionesPasos(auth, [completar(operativo), completar(otro)]);
  const participacion = await db.ordenTrabajoItemPaso.findUniqueOrThrow({
    where: { id: alias.id },
  });
  expect(participacion.estado).toBe('hecho');
  expect(Number(participacion.tiempoRealMin)).toBe(0);
});

it('puede iniciar varios pasos con cronómetro sin mantener tramos si uno falla', async () => {
  const trabajos = [
    await crearTrabajo({ cronometro: true }),
    await crearTrabajo(),
  ];
  await expect(
    ordenes.accionesPasos(
      auth,
      trabajos.map((t) => ({ ...t, payload: { accion: 'iniciar' } })),
    ),
  ).rejects.toThrow(/sin cronómetro/);
  await verificarSinCambios(trabajos);
  expect(
    await db.ordenTrabajoPasoTramo.count({
      where: { pasoId: { in: trabajos.map((t) => t.pasoId) } },
    }),
  ).toBe(0);
});

it('confirma el máximo de 50 operaciones en una sola transacción', async () => {
  const trabajos = [];
  for (let i = 0; i < 50; i++) trabajos.push(await crearTrabajo());
  const resultados = await ordenes.accionesPasos(auth, trabajos.map(completar));
  expect(resultados).toHaveLength(50);
  expect(
    await db.ordenTrabajoItemPaso.count({
      where: { id: { in: trabajos.map((t) => t.pasoId) }, estado: 'hecho' },
    }),
  ).toBe(50);
  expect(avisar).toHaveBeenCalledTimes(50);
}, 20_000);

it('recalcula los pasos de una misma OT y dispara los efectos de cierre una sola vez', async () => {
  const t = await crearTrabajo();
  const otro = await db.ordenTrabajoItemPaso.create({
    data: {
      tenantId,
      ordenId: t.ordenId,
      itemId: t.itemId,
      indice: 1,
      nodoClave: 'terminar',
      nombre: 'Terminar',
      familiaCodigo: 'trabajo_manual',
      categoriaFamilia: 'produccion',
      modoRegistro: 'solo_completar',
      duracionEstimadaMin: 60,
    },
  });
  await db.ordenTrabajoPasoDependencia.create({
    data: {
      tenantId,
      ordenId: t.ordenId,
      predecesorPasoId: t.pasoId,
      sucesorPasoId: otro.id,
    },
  });
  await ordenes.accionesPasos(auth, [
    completar(t),
    { ...completar(t), pasoId: otro.id },
  ]);
  expect(
    await db.ordenTrabajo.findUniqueOrThrow({ where: { id: t.ordenId } }),
  ).toMatchObject({ estado: 'finalizada', progresoPct: 100 });
  expect(etaCierre).toHaveBeenCalledTimes(1);
  expect(avisar).toHaveBeenCalledTimes(1);
});

it('no toma silenciosamente un trabajo que el operario no tiene en su mesa', async () => {
  const trabajos = [await crearTrabajo(), await crearTrabajo()];
  await db.ordenTrabajoItemPaso.update({
    where: { id: trabajos[1].pasoId },
    data: { mesaUsuarioId: null },
  });
  await expect(
    ordenes.accionesPasos(
      { ...auth, permisos: new Set(['produccion.ejecutar']) },
      trabajos.map(completar),
    ),
  ).rejects.toThrow(/mesa de trabajo/);
  await verificarSinCambios(trabajos);
});
