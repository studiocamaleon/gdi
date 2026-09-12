import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProduccionService } from '../produccion/produccion.service';
import { EquiposProduccionService } from '../produccion/equipos-produccion.service';
import { huellaContextoPlan } from '../planificacion-entregas/planificacion-contrato';
import { EtaService } from './eta.service';
import { simularFlujo } from './motor/flujo-produccion';
import { demandaDesdeTiempo } from './motor/demanda-humana';
import type { CalendarioEstacion } from './motor/estaciones-tipos';
import { proponerEntregasPiloto } from './planificacion/prototipo-entregas';

// Datos de ejemplo deliberados: importa la respuesta a cada parámetro, no
// calibrar una imprenta real. Jest fuerza gdi_saas_test antes de los imports.
const db = new PrismaService();
const produccion = new ProduccionService(db);
const equipos = new EquiposProduccionService(db);
const eta = new EtaService(db, produccion);
const ahora = new Date('2026-09-14T09:00:00-03:00');
const calendario = (desde = '09:00', hasta = '18:00'): CalendarioEstacion => ({
  dias: {
    lun: [{ desde, hasta }],
    mar: [{ desde, hasta }],
    mie: [{ desde, hasta }],
    jue: [{ desde, hasta }],
    vie: [{ desde, hasta }],
    sab: null,
    dom: null,
  },
});
const demanda = () =>
  demandaDesdeTiempo({
    maquinaId: 'maquina',
    operacionMaquina: 'autonoma',
    dotacionOperarios: 1,
    totalMin: 100,
    setupMin: 10,
    runMin: 80,
    cleanupMin: 10,
    tiempoFijoMin: 0,
  })!;
let tenantId: string, estacionId: string, equipoId: string;
let maquinas: string[];
let auth: CurrentAuth;

beforeEach(async () => {
  tenantId = randomUUID();
  auth = { tenantId, userId: randomUUID() } as CurrentAuth;
  await db.tenant.create({
    data: {
      id: tenantId,
      nombre: 'QA parámetros ETA',
      slug: `qa-eta-${tenantId}`,
    },
  });
  const planta = await db.planta.create({
    data: { tenantId, nombre: 'Taller', codigo: 'P1' },
  });
  maquinas = [randomUUID(), randomUUID()];
  await db.maquina.createMany({
    data: maquinas.map((id, i) => ({
      id,
      tenantId,
      plantaId: planta.id,
      nombre: `Impresora ${i + 1}`,
      codigo: `M${i + 1}`,
      plantilla: 'IMPRESORA_LASER',
      geometriaTrabajo: 'PLIEGO',
      unidadProduccionPrincipal: 'HOJA',
      parametrosTecnicosJson: { operacionMaquina: 'autonoma' },
    })),
  });
  equipoId = (
    await equipos.guardar(tenantId, {
      nombre: 'Impresores',
      personas: 1,
      activo: true,
      calendario: calendario(),
    })
  ).id;
  estacionId = (
    await produccion.createEstacion(auth, {
      nombre: 'Impresión',
      activo: true,
      calendario: calendario(),
      equipoProduccionId: equipoId,
      capacidadConcurrente: 1,
      tiempoPreparacionMin: 0,
      maquinaIds: maquinas,
    })
  ).id;
  for (const [i, maquinaId] of maquinas.entries()) {
    const orden = await db.ordenTrabajo.create({
      data: {
        tenantId,
        numero: `QA-${i}`,
        estado: 'pendiente',
        fechaEntrega: new Date('2026-10-01'),
      },
    });
    const item = await db.ordenTrabajoItem.create({
      data: {
        tenantId,
        ordenId: orden.id,
        codigo: `P${i}`,
        nombre: `Trabajo ${i + 1}`,
        familia: 'QA',
        cantidad: 1,
        cantidadUnidad: 'u',
        subtotal: 100,
        impuestos: 0,
        total: 100,
      },
    });
    await db.ordenTrabajoItemPaso.create({
      data: {
        tenantId,
        ordenId: orden.id,
        itemId: item.id,
        indice: 0,
        nombre: 'Impresión',
        familiaCodigo: 'impresion_por_hoja',
        categoriaFamilia: 'impresion',
        maquinaId,
        duracionEstimadaMin: 100,
        demandaHumanaJson: demanda() as unknown as Prisma.InputJsonValue,
        esTerminal: true,
      },
    });
  }
});
afterEach(async () => {
  await db.tenant.deleteMany({ where: { id: tenantId } });
});
afterAll(() => db.$disconnect());

async function contexto() {
  return { ...(await eta.contextoSimulacion(tenantId)), ahora };
}
async function capturar() {
  const c = await contexto();
  const sim = simularFlujo(c);
  return {
    c,
    sim,
    huella: huellaContextoPlan(c, c.margenEtaDias),
    // La traza registra decisiones, no tiene por contrato orden cronológico.
    horas: sim.traza
      .map((t) => [t.inicio.toISOString(), t.fin.toISOString()])
      .sort(([a], [b]) => a.localeCompare(b)),
  };
}
const instante = (hora: string, dia = '14') => `2026-09-${dia}T${hora}:00.000Z`;
const cambiarEstacion = async (
  cambio: Partial<Parameters<typeof produccion.updateEstacion>[2]>,
) => {
  const actual = (await produccion.findEstaciones(tenantId)).find(
    (e) => e.id === estacionId,
  )!;
  // Como el formulario: las listas son reemplazos completos, no parches.
  return produccion.updateEstacion(auth, estacionId, {
    nombre: 'Impresión',
    activo: true,
    maquinaIds: actual.maquinas.map((m) => m.id),
    familias: actual.pasosSinMaquina,
    ...cambio,
  });
};
const cambiarEquipo = (
  cambio: Partial<Parameters<typeof equipos.guardar>[1]>,
) =>
  equipos.guardar(
    tenantId,
    {
      nombre: 'Impresores',
      personas: 1,
      activo: true,
      calendario: calendario(),
      ...cambio,
    },
    equipoId,
  );
const cambiarModo = (operacionMaquina: 'autonoma' | 'con_operario') =>
  db.maquina.updateMany({
    where: { tenantId },
    data: { parametrosTecnicosJson: { operacionMaquina } },
  });

it('guardar horarios de estación reproyecta desde la nueva apertura sin cambiar duración ni promesas', async () => {
  const antes = await capturar();
  expect(antes.horas).toEqual([
    [instante('12:00'), instante('13:40')],
    [instante('12:10'), instante('13:50')],
  ]);
  await cambiarEstacion({ calendario: calendario('11:00') });
  const despues = await capturar();
  expect(despues.horas).toEqual([
    [instante('14:00'), instante('15:40')],
    [instante('14:10'), instante('15:50')],
  ]);
  expect(despues.huella).not.toBe(antes.huella);
  expect(despues.sim.traza.map((t) => t.duracionMin)).toEqual([100, 100]);
  expect(despues.c.items.map((i) => i.fechaEntrega)).toEqual(
    antes.c.items.map((i) => i.fechaEntrega),
  );
});

it('guardar el horario del equipo limita la atención a la intersección con la estación', async () => {
  await cambiarEquipo({ calendario: calendario('14:00') });
  expect((await capturar()).horas).toEqual([
    [instante('17:00'), instante('18:40')],
    [instante('17:10'), instante('18:50')],
  ]);
});

it('un día fijo y un feriado se combinan: jueves cerrado traslada al jueves siguiente', async () => {
  const soloJueves: CalendarioEstacion = {
    dias: {
      lun: null,
      mar: null,
      mie: null,
      jue: [{ desde: '09:00', hasta: '18:00' }],
      vie: null,
      sab: null,
      dom: null,
    },
  };
  await cambiarEstacion({ calendario: soloJueves });
  expect((await capturar()).horas[0][0]).toBe(instante('12:00', '17'));
  const feriado = await produccion.crearDiaNoLaborable(auth, {
    fecha: '2026-09-17',
  });
  expect((await capturar()).horas[0][0]).toBe(instante('12:00', '24'));
  await produccion.eliminarDiaNoLaborable(auth, feriado.id);
  expect((await capturar()).horas[0][0]).toBe(instante('12:00', '17'));
});

it('la jornada cortada conserva minutos de trabajo y salta el receso', async () => {
  const cortado = calendario();
  cortado.dias.lun = [
    { desde: '09:00', hasta: '10:00' },
    { desde: '14:00', hasta: '18:00' },
  ];
  await cambiarEstacion({ calendario: cortado });
  expect((await capturar()).horas).toEqual([
    [instante('12:00'), instante('17:40')],
    [instante('12:10'), instante('17:50')],
  ]);
});

it('el modo de máquina y la cantidad de personas cambian el paralelismo de una OT ya guardada', async () => {
  const original = await capturar();
  await cambiarModo('con_operario');
  const atendida = await capturar();
  expect(atendida.horas).toEqual([
    [instante('12:00'), instante('13:40')],
    [instante('13:40'), instante('15:20')],
  ]);
  expect(atendida.huella).not.toBe(original.huella);
  await cambiarEquipo({ personas: 2 });
  expect((await capturar()).horas).toEqual([
    [instante('12:00'), instante('13:40')],
    [instante('12:00'), instante('13:40')],
  ]);
  await cambiarModo('autonoma');
  await cambiarEquipo({ personas: 1 });
  expect((await capturar()).horas).toEqual(original.horas);
});

it('compartir o separar equipos cambia la competencia humana entre estaciones', async () => {
  await cambiarModo('con_operario');
  const equipo2 = await equipos.guardar(tenantId, {
    nombre: 'Otro equipo',
    personas: 1,
    activo: true,
    calendario: calendario(),
  });
  const otra = await produccion.createEstacion(auth, {
    nombre: 'Otra estación',
    activo: true,
    calendario: calendario(),
    tiempoPreparacionMin: 0,
    equipoProduccionId: equipo2.id,
    maquinaIds: [maquinas[1]],
  });
  expect((await capturar()).horas.map((h) => h[0])).toEqual([
    instante('12:00'),
    instante('12:00'),
  ]);
  await produccion.updateEstacion(auth, otra.id, {
    nombre: 'Otra estación',
    activo: true,
    equipoProduccionId: equipoId,
    maquinaIds: [maquinas[1]],
  });
  expect((await capturar()).horas.map((h) => h[0])).toEqual([
    instante('12:00'),
    instante('13:40'),
  ]);
});

it('los puestos manuales limitan tareas sin máquina, incluso si sobran personas', async () => {
  await db.ordenTrabajoItemPaso.updateMany({
    where: { tenantId },
    data: {
      maquinaId: null,
      familiaCodigo: 'embalaje',
      demandaHumanaJson: {
        version: 1,
        verificada: true,
        fases: [{ minutos: 100, personas: 1 }],
      },
    },
  });
  await cambiarEstacion({ familias: ['embalaje'] });
  await cambiarEquipo({ personas: 2 });
  expect((await capturar()).horas.map((h) => h[0])).toEqual([
    instante('12:00'),
    instante('13:40'),
  ]);
  await cambiarEstacion({ capacidadConcurrente: 2 });
  expect((await capturar()).horas.map((h) => h[0])).toEqual([
    instante('12:00'),
    instante('12:00'),
  ]);
});

it('una misma máquina no se duplica por aumentar puestos ni personas', async () => {
  await db.ordenTrabajoItemPaso.updateMany({
    where: { tenantId },
    data: { maquinaId: maquinas[0] },
  });
  await cambiarEquipo({ personas: 2 });
  await cambiarEstacion({ capacidadConcurrente: 2 });
  expect((await capturar()).horas.map((h) => h[0])).toEqual([
    instante('12:00'),
    instante('13:40'),
  ]);
});

it('separación general, propia y cero tienen efectos distintos y no alargan el tiempo cotizado', async () => {
  await db.ordenTrabajoItemPaso.updateMany({
    where: { tenantId },
    data: { maquinaId: maquinas[0] },
  });
  await cambiarEstacion({ tiempoPreparacionMin: null });
  await produccion.actualizarConfiguracion(auth, {
    margenEtaDias: 0,
    tiempoEntrePasosMin: 20,
  });
  expect((await capturar()).horas[1][0]).toBe(instante('14:00'));
  await cambiarEstacion({ tiempoPreparacionMin: 5 });
  expect((await capturar()).horas[1][0]).toBe(instante('13:45'));
  await cambiarEstacion({ tiempoPreparacionMin: 0 });
  const cero = await capturar();
  expect(cero.horas[1][0]).toBe(instante('13:40'));
  expect(cero.sim.traza.map((t) => t.duracionMin)).toEqual([100, 100]);
});

it.each(['inactivo', 'sin intersección'] as const)(
  'equipo %s no produce una fecha confirmable',
  async (caso) => {
    await cambiarEquipo(
      caso === 'inactivo'
        ? { activo: false }
        : { calendario: calendario('19:00', '20:00') },
    );
    const { sim } = await capturar();
    expect(sim.traza).toHaveLength(0);
    expect(
      [...sim.porItem.values()].every(
        (i) => i.finEstimado === null && i.motivoSinEstimar,
      ),
    ).toBe(true);
  },
);

it('la zona del tenant cambia la interpretación horaria sin modificar la fecha comprometida', async () => {
  await db.datosEmpresa.create({
    data: { tenantId, zonaHoraria: 'America/Lima' },
  });
  const { c, horas } = await capturar();
  expect(c.zona).toBe('America/Lima');
  expect(horas[0][0]).toBe(instante('14:00'));
  expect(c.items.every((i) => i.fechaEntrega === '2026-10-01')).toBe(true);
});

it('la dotación cotizada debe caber en el equipo y se respeta durante las maniobras', async () => {
  const deDos = demandaDesdeTiempo({
    maquinaId: maquinas[0],
    operacionMaquina: 'autonoma',
    dotacionOperarios: 2,
    totalMin: 100,
    setupMin: 10,
    runMin: 80,
    cleanupMin: 10,
    tiempoFijoMin: 0,
  });
  await db.ordenTrabajoItemPaso.updateMany({
    where: { tenantId },
    data: { demandaHumanaJson: deDos as unknown as Prisma.InputJsonValue },
  });
  expect((await capturar()).sim.traza).toHaveLength(0);
  await cambiarEquipo({ personas: 2 });
  const { sim, horas } = await capturar();
  expect(horas).toEqual([
    [instante('12:00'), instante('13:40')],
    [instante('12:10'), instante('13:50')],
  ]);
  expect(
    sim.traza
      .flatMap((t) => t.reservasHumanas ?? [])
      .every((r) => r.personas === 2),
  ).toBe(true);
});

it('una cotización con otros tiempos cambia la duración proyectada, conservando sus fases', async () => {
  // Emula la materialización de una nueva cotización: el Gantt no edita tiempos.
  const nueva = demandaDesdeTiempo({
    maquinaId: maquinas[0],
    operacionMaquina: 'autonoma',
    dotacionOperarios: 1,
    totalMin: 160,
    setupMin: 20,
    runMin: 120,
    cleanupMin: 20,
    tiempoFijoMin: 0,
  });
  await db.ordenTrabajoItemPaso.updateMany({
    where: { tenantId },
    data: {
      duracionEstimadaMin: 160,
      demandaHumanaJson: nueva as unknown as Prisma.InputJsonValue,
    },
  });
  const { sim, horas } = await capturar();
  expect(horas).toEqual([
    [instante('12:00'), instante('14:40')],
    [instante('12:20'), instante('15:00')],
  ]);
  expect(sim.traza.map((t) => t.duracionMin)).toEqual([160, 160]);
  expect(
    sim.traza.map((t) =>
      t.reservasHumanas!.reduce((s, r) => s + (r.fin - r.inicio) / 60000, 0),
    ),
  ).toEqual([40, 40]);
});

it.each(['estación', 'máquina'] as const)(
  'desactivar la %s retira su capacidad confirmada',
  async (tipo) => {
    if (tipo === 'estación') await produccion.toggleEstacion(auth, estacionId);
    else
      await db.maquina.updateMany({
        where: { tenantId },
        data: { activo: false },
      });
    const { sim } = await capturar();
    expect(
      [...sim.porItem.values()].every(
        (i) => i.parcial || i.finEstimado === null,
      ),
    ).toBe(true);
    expect(sim.traza.every((t) => t.parcial)).toBe(true);
  },
);

async function propuesta() {
  const c = await contexto();
  const resultado = proponerEntregasPiloto({
    cantidad: 2,
    entregas: [
      { id: 'a', cantidad: 1 },
      { id: 'b', cantidad: 1 },
    ],
    prioridadSinFechas: 'PRIMERAS_ENTREGAS',
    porEntrega: true,
    condicionesPendientes: [],
    margenDiasHabiles: c.margenEtaDias,
    taller: c,
    operaciones: [
      {
        codigo: 'imprimir',
        nombre: 'Impresión',
        familiaCodigo: 'impresion_por_hoja',
        maquinaId: maquinas[0],
        requiereMaquina: true,
        piezasPorProducto: 1,
        predecesoras: [],
        mediciones: [
          {
            cantidadProductos: 1,
            preparacionMin: 10,
            ejecucionMin: 90,
            costo: 100,
            fuente: 'Ejemplo de desarrollo',
            demandaHumana: demanda(),
          },
        ],
      },
    ],
  });
  return resultado.alternativas.find((a) => a.id === 'por-entrega')!;
}
it('el margen hábil guardado cambia la entrega sugerida de F6 y no la producción', async () => {
  const antes = await propuesta();
  await produccion.actualizarConfiguracion(auth, { margenEtaDias: 2 });
  await produccion.crearDiaNoLaborable(auth, { fecha: '2026-09-15' });
  const despues = await propuesta();
  expect(despues.entregas.map((e) => e.finProduccion)).toEqual(
    antes.entregas.map((e) => e.finProduccion),
  );
  expect(antes.entregas.map((e) => e.fechaSugerida)).toEqual([
    '2026-09-14',
    '2026-09-14',
  ]);
  expect(despues.entregas.map((e) => e.fechaSugerida)).toEqual([
    '2026-09-17',
    '2026-09-17',
  ]);
  expect(despues.costo).toBe(antes.costo);
});

it('F6 usa el calendario guardado actual en las próximas tandas', async () => {
  const antes = await propuesta();
  await cambiarEstacion({ calendario: calendario('14:00') });
  const despues = await propuesta();
  expect(Date.parse(despues.entregas[0].finProduccion!)).toBeGreaterThan(
    Date.parse(antes.entregas[0].finProduccion!),
  );
  expect(despues.operaciones.map((o) => o.medicion)).toEqual(
    antes.operaciones.map((o) => o.medicion),
  );
});

it('cambiar el equipo invalida los intervalos de una agenda publicada y reduce su paralelismo', async () => {
  await cambiarModo('con_operario');
  await cambiarEquipo({ personas: 2 });
  const original = await capturar();
  for (const t of original.sim.traza)
    await db.ordenTrabajoItemPaso.update({
      where: { id: t.pasoId },
      data: {
        planificadoDesde: t.inicio,
        planificadoHasta: t.fin,
        atencionPlanificadaJson:
          t.atencionPlanificada as unknown as Prisma.InputJsonValue,
      },
    });
  expect((await capturar()).horas).toEqual(original.horas);
  await cambiarEquipo({ personas: 1 });
  expect((await capturar()).horas).toEqual([
    [instante('12:00'), instante('13:40')],
    [instante('13:40'), instante('15:20')],
  ]);
});
