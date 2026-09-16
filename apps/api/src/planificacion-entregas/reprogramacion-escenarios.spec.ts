import {
  buscarReprogramaciones,
  diasHabilesEntre,
  gruposCompromiso,
  ordenarReprogramaciones,
} from './reprogramacion-escenarios';
import { proponerEntregasPiloto } from '../eta/planificacion/prototipo-entregas';
import { exhibidorControlado } from '../../test/fixtures/f6-planificacion/exhibidor-controlado';
import { simularFlujo } from '../eta/motor/flujo-produccion';

function caso(fechaEntrega = '2026-09-11') {
  const e = exhibidorControlado();
  e.porEntrega = true;
  e.margenDiasHabiles = 2;
  e.operaciones = [
    {
      ...e.operaciones[0],
      mediciones: [
        {
          cantidadProductos: 50,
          preparacionMin: 0,
          ejecucionMin: 120,
          costo: 100,
          fuente: 'prueba',
          demandaHumana: {version:1,verificada:true,fases:[{minutos:120,personas:1}]},
        },
      ],
    },
  ];
  e.entregas = e.entregas.map((e) => ({ ...e, fechaSolicitada: '2026-09-09' }));
  e.taller.items = [
    {
      id: 'item',
      ordenId: 'orden',
      ordenNumero: 'OT-001',
      ordenEstado: 'pendiente',
      nombre: 'Carteles',
      fechaEntrega,
      sinRuta: false,
      pasos: [
        {
          id: 'paso',
          indice: 0,
          nodoClave: 'corte',
          nombre: 'Cortar',
          familiaCodigo: 'corte',
          maquinaId: 'mesa-1',
          centroCostoId: null,
          duracionEstimadaMin: 270,
          demandaHumana: {version:1,verificada:true,fases:[{minutos:270,personas:1}]},
          estado: 'pendiente',
          iniciadoEl: null,
          tipoEjecucion: 'interno',
          plazoProveedorDias: null,
          esTerminal: true,
        },
      ],
    },
  ];
  const a = proponerEntregasPiloto(e).alternativas[0];
  return {
    e,
    a,
    buscar: (excluidas: string[] = []) =>
      buscarReprogramaciones({
        taller: e.taller,
        margen: e.margenDiasHabiles,
        alternativa: a,
        operaciones: e.operaciones,
        excluidas,
      }),
  };
}
it('cumple 4 entregas completas usando margen de otra OT, conserva promesa y CAD', async () => {
  const { a, buscar } = caso();
  expect(a.estado).toBe('FUERA_DE_FECHA');
  const r = await buscar();
  expect(r.alternativas.length).toBeGreaterThan(0);
  const elegida = r.alternativas[0],
    impacto = elegida.reprogramacion!.entregasAfectadas[0];
  expect(elegida.entregas).toHaveLength(4);
  expect(elegida.entregas.every((e) => e.cumple)).toBe(true);
  expect(elegida.operaciones).toEqual(a.operaciones);
  expect(impacto).toMatchObject({
    fechaActual: '2026-09-11',
    fechaPropuesta: '2026-09-11',
    cambiaEntrega: false,
    margenAnterior: 2,
    margenRestante: 1,
  });
});
it('informa cambios de entrega cuando la demora supera el margen', async () => {
  const r = await caso('2026-09-09').buscar();
  expect(r.alternativas[0].reprogramacion).toMatchObject({
    nivel: 'CAMBIA_ENTREGAS',
  });
  expect(r.alternativas[0].reprogramacion!.entregasAfectadas[0]).toMatchObject({
    cambiaEntrega: true,
    fechaPropuesta: '2026-09-14',
    demoraHabiles: 3,
    margenRestante: 2,
  });
});
it('excluir el trabajo impide aplicar las opciones que dependían de él', async () => {
  const r = await caso().buscar(['orden']);
  expect(r.alternativas).toEqual([]);
  expect(r.motivo).toContain('No encontramos');
});
it('no mueve trabajo iniciado ni presenta como viable una cola sin calendario', async () => {
  const { e, buscar } = caso();
  e.taller.items[0].ordenEstado = 'produccion';
  expect((await buscar()).alternativas).toEqual([]);
  e.taller.estaciones[0].calendario = null;
  expect((await buscar()).motivo).toContain('confirmá');
});
it('reaplicar las ventanas al ETA conserva la agenda y protege de nuevas inserciones', async () => {
  const { e, buscar } = caso();
  const r = (await buscar()).alternativas[0];
  const agenda = r.reprogramacion!.agenda;
  const nuevos = r.operaciones.map((o) => ({
    ...e.taller.items[0],
    id: o.id,
    ordenId: 'nueva',
    ordenNumero: 'OT-999',
    pasos: [
      { ...e.taller.items[0].pasos[0], id: o.id, duracionEstimadaMin: 120 },
    ],
  }));
  const items = [...e.taller.items, ...nuevos].map((i) => ({
    ...i,
    pasos: i.pasos.map((p) => {
      const t = agenda.find((t) => t.pasoId === p.id)!;
      return { ...p, planificadoDesde: t.inicio, planificadoHasta: t.fin };
    }),
  }));
  const intruso = {
    ...e.taller.items[0],
    id: 'intruso',
    ordenId: 'otra',
    ordenNumero: 'OT-000',
    fechaEntrega: '2026-09-09',
    pasos: [
      {
        ...e.taller.items[0].pasos[0],
        id: 'intruso',
        duracionEstimadaMin: 540,
      },
    ],
  };
  const s = simularFlujo({ ...e.taller, items: [intruso, ...items] });
  for (const a of agenda) {
    const t = s.traza.find((t) => t.pasoId === a.pasoId)!;
    expect(t.inicio.toISOString()).toBe(a.inicio);
    expect(t.fin.toISOString()).toBe(a.fin);
  }
});
it('prioriza preservar todas las entregas por encima de mover menos trabajos', async () => {
  const a = (await caso().buscar()).alternativas[0],
    b = (await caso('2026-09-09').buscar()).alternativas[0];
  a.reprogramacion!.ordenesMovidas.push('otra');
  expect(ordenarReprogramaciones([b, a])[0]).toBe(a);
});
it('agrupa componentes con el producto/lote para evaluar el compromiso completo', () => {
  const { e } = caso();
  const padre = e.taller.items[0];
  expect(
    gruposCompromiso([padre, { ...padre, id: 'hijo', parentItemId: padre.id }]),
  ).toHaveLength(1);
  expect(
    gruposCompromiso([
      { ...padre, loteEntregaId: 'a' },
      { ...padre, id: 'b', loteEntregaId: 'b' },
    ]),
  ).toHaveLength(2);
});
it('margen y demora excluyen fines de semana y feriados', () => {
  expect(
    diasHabilesEntre('2026-09-11', '2026-09-15', new Set(['2026-09-14'])),
  ).toBe(1);
  expect(
    diasHabilesEntre('2026-09-15', '2026-09-11', new Set(['2026-09-14'])),
  ).toBe(-1);
});
