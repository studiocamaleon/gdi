import { exhibidorControlado } from '../../test/fixtures/f6-planificacion/exhibidor-controlado';
import { proponerEntregasPiloto } from '../eta/planificacion/prototipo-entregas';
import { simularFlujo } from '../eta/motor/flujo-produccion';
import { aplicarOperacionMaquina } from '../eta/motor/demanda-humana';
import { buscarReprogramaciones } from './reprogramacion-escenarios';

function casoCompartido() {
  const e = exhibidorControlado();
  e.porEntrega = true;
  e.margenDiasHabiles = 2;
  e.operaciones = [
    {
      ...e.operaciones[0],
      mediciones: [
        {
          cantidadProductos: 50,
          preparacionMin: 30,
          ejecucionMin: 90,
          costo: 100,
          fuente: 'Aceptación F6: máquina autónoma con preparación y cierre',
          demandaHumana: aplicarOperacionMaquina(
            {
              version: 1,
              verificada: true,
              fases: [
                { minutos: 30, personas: 1 },
                { minutos: 60, personas: 0, operacionMaquina: true },
                { minutos: 30, personas: 1 },
              ],
            },
            'autonoma',
          ),
        },
      ],
    },
  ];
  e.entregas = e.entregas.map((entrega) => ({
    ...entrega,
    fechaSolicitada: '2026-09-09',
  }));
  const corte = e.taller.estaciones[0];
  corte.maquinas = [
    { id: 'mesa-1', centroCostoId: null, operacionMaquina: 'autonoma' },
  ];
  e.taller.estaciones = [
    corte,
    {
      ...corte,
      id: 'segunda-estacion',
      familias: [],
      maquinas: [
        { id: 'mesa-2', centroCostoId: null, operacionMaquina: 'con_operario' },
      ],
    },
  ];
  e.taller.items = [
    {
      ...e.taller.items[0],
      ordenEstado: 'pendiente',
      fechaEntrega: '2026-09-11',
      pasos: [
        {
          ...e.taller.items[0].pasos[0],
          maquinaId: 'mesa-2',
          duracionEstimadaMin: 270,
          demandaHumana: {
            version: 1,
            verificada: true,
            fases: [{ minutos: 270, personas: 1 }],
          },
          esTerminal: true,
        },
      ],
    },
  ];
  const alternativa = proponerEntregasPiloto(e).alternativas[0];
  return { e, alternativa };
}

it('reprograma por capacidad humana compartida aunque las máquinas sean distintas', async () => {
  const { e, alternativa } = casoCompartido();
  expect(alternativa.estado).toBe('FUERA_DE_FECHA');
  const resultado = await buscarReprogramaciones({
    taller: e.taller,
    margen: e.margenDiasHabiles,
    alternativa,
    operaciones: e.operaciones,
    excluidas: [],
  });
  expect(resultado.alternativas.length).toBeGreaterThan(0);
  const elegida = resultado.alternativas[0];
  expect(elegida.entregas).toHaveLength(4);
  expect(elegida.entregas.every((entrega) => entrega.cumple)).toBe(true);
  expect(
    elegida.reprogramacion!.entregasAfectadas.every(
      (entrega) => !entrega.cambiaEntrega,
    ),
  ).toBe(true);
  expect(elegida.operaciones.map((o) => o.medicion)).toEqual(
    alternativa.operaciones.map((o) => o.medicion),
  );
});

it('la agenda aceptada conserva fechas y capacidad al volver a consultarla con fases y equipo compartido', async () => {
  const { e, alternativa } = casoCompartido();
  const { alternativas } = await buscarReprogramaciones({
    taller: e.taller,
    margen: e.margenDiasHabiles,
    alternativa,
    operaciones: e.operaciones,
    excluidas: [],
  });
  expect(alternativas.length).toBeGreaterThan(0);
  const elegida = alternativas[0];
  const agenda = elegida.reprogramacion!.agenda;
  const nuevos = elegida.operaciones.map((o) => ({
    ...e.taller.items[0],
    id: o.id,
    ordenId: 'ot-nueva',
    ordenNumero: 'OT-999',
    fechaEntrega: '2026-09-09',
    pasos: [
      {
        ...e.taller.items[0].pasos[0],
        id: o.id,
        maquinaId: 'mesa-1',
        duracionEstimadaMin:
          o.medicion!.preparacionMin + o.medicion!.ejecucionMin,
        demandaHumana: o.medicion!.demandaHumana,
        predecesorPasoIds: o.predecesoras,
      },
    ],
  }));
  const items = [...e.taller.items, ...nuevos].map((item) => ({
    ...item,
    pasos: item.pasos.map((p) => {
      const ventana = agenda.find((v) => v.pasoId === p.id)!;
      return {
        ...p,
        planificadoDesde: ventana.inicio,
        planificadoHasta: ventana.fin,
        atencionPlanificada: ventana.atencionPlanificada,
      };
    }),
  }));
  const consulta = simularFlujo({ ...e.taller, items });
  expect(consulta.traza).toHaveLength(agenda.length);
  for (const ventana of agenda) {
    const tarea = consulta.traza.find((t) => t.pasoId === ventana.pasoId)!;
    expect({
      id: tarea.pasoId,
      inicio: tarea.inicio.toISOString(),
      fin: tarea.fin.toISOString(),
    }).toEqual({
      id: ventana.pasoId,
      inicio: ventana.inicio,
      fin: ventana.fin,
    });
    expect(tarea.parcial).toBe(false);
  }
  const reservas = consulta.traza.flatMap((t) => t.reservasHumanas ?? []);
  const eventos = reservas
    .flatMap((r) => [
      [r.inicio, r.personas],
      [r.fin, -r.personas],
    ])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let personas = 0;
  for (const [, cambio] of eventos) {
    personas += cambio;
    expect(personas).toBeLessThanOrEqual(1);
  }
  expect(personas).toBe(0);
});

it('publicar una tarea con espera antes de descargar conserva la agenda que ya era viable', () => {
  const { e } = casoCompartido();
  const previo = e.taller.items[0];
  const b = {
    ...previo,
    pasos: [
      {
        ...previo.pasos[0],
        duracionEstimadaMin: 120,
        demandaHumana: {
          version: 1 as const,
          verificada: true,
          fases: [{ minutos: 120, personas: 1 }],
        },
        planificadoDesde: '2026-09-09T12:00:00.000Z',
        planificadoHasta: '2026-09-09T14:00:00.000Z',
      },
    ],
  };
  const a = {
    ...previo,
    id: 'otra-ot',
    ordenId: 'otra-ot',
    pasos: [
      {
        ...previo.pasos[0],
        id: 'autonoma-con-espera',
        maquinaId: 'mesa-1',
        duracionEstimadaMin: 120,
        demandaHumana: e.operaciones[0].mediciones[0].demandaHumana,
      },
    ],
  };
  const primera = simularFlujo({ ...e.taller, items: [a, b] });
  expect(
    primera.traza.find((t) => t.pasoId === a.pasos[0].id)!.fin.toISOString(),
  ).toBe('2026-09-09T14:30:00.000Z');
  const publicados = [a, b].map((item) => ({
    ...item,
    pasos: item.pasos.map((p) => {
      const t = primera.traza.find((t) => t.pasoId === p.id)!;
      return {
        ...p,
        planificadoDesde: t.inicio.toISOString(),
        planificadoHasta: t.fin.toISOString(),
        atencionPlanificada: t.atencionPlanificada,
      };
    }),
  }));
  const consulta = simularFlujo({ ...e.taller, items: publicados });
  for (const t of primera.traza) {
    const recargada = consulta.traza.find((r) => r.pasoId === t.pasoId)!;
    expect([recargada.inicio, recargada.fin]).toEqual([t.inicio, t.fin]);
    expect(recargada.reservasHumanas).toEqual(t.reservasHumanas);
  }
});

it('dos máquinas que esperan al mismo operario no se bloquean entre sí al recargar una agenda publicada', () => {
  const { e } = casoCompartido();
  e.taller.estaciones.push({
    ...e.taller.estaciones[0],
    id: 'tercera',
    maquinas: [
      { id: 'mesa-3', centroCostoId: null, operacionMaquina: 'autonoma' },
    ],
  });
  const previo = e.taller.items[0];
  const b = {
    ...previo,
    pasos: [
      {
        ...previo.pasos[0],
        duracionEstimadaMin: 120,
        demandaHumana: {
          version: 1 as const,
          verificada: true,
          fases: [{ minutos: 120, personas: 1 }],
        },
        planificadoDesde: '2026-09-09T13:00:00.000Z',
        planificadoHasta: '2026-09-09T15:00:00.000Z',
      },
    ],
  };
  const tarea = (
    id: string,
    maquinaId: string,
    run: number,
    desde?: string,
  ) => ({
    ...previo,
    id,
    ordenId: id,
    pasos: [
      {
        ...previo.pasos[0],
        id,
        maquinaId,
        duracionEstimadaMin: 60 + run,
        planificadoDesde: desde,
        demandaHumana: aplicarOperacionMaquina(
          {
            version: 1,
            verificada: true,
            fases: [
              { minutos: 30, personas: 1 },
              { minutos: run, personas: 0, operacionMaquina: true },
              { minutos: 30, personas: 1 },
            ],
          },
          'autonoma',
        ),
      },
    ],
  });
  const items = [
    tarea('a', 'mesa-1', 120),
    tarea('c', 'mesa-3', 90, '2026-09-09T12:00:00.000Z'),
    b,
  ];
  const primera = simularFlujo({ ...e.taller, items });
  const publicados = items.map((item) => ({
    ...item,
    pasos: item.pasos.map((p) => {
      const t = primera.traza.find((t) => t.pasoId === p.id)!;
      return {
        ...p,
        planificadoDesde: t.inicio.toISOString(),
        planificadoHasta: t.fin.toISOString(),
        atencionPlanificada: t.atencionPlanificada,
      };
    }),
  }));
  const consulta = simularFlujo({ ...e.taller, items: publicados });
  expect(
    consulta.traza.map((t) => ({ id: t.pasoId, inicio: t.inicio, fin: t.fin })),
  ).toEqual(
    primera.traza.map((t) => ({ id: t.pasoId, inicio: t.inicio, fin: t.fin })),
  );
});
