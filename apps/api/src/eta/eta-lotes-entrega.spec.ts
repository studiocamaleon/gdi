import { agregarEtaEntregas } from './eta-lotes-entrega';
import type { SimulacionItem } from './motor/flujo-produccion';
it('el producto espera todos sus lotes y componentes sin duplicar carga', () => {
  const mk = (fin: string | null): SimulacionItem => ({
    finEstimado: fin ? new Date(fin) : null,
    sinEstimar: !fin,
    parcial: false,
    asumeDesbloqueo: false,
  });
  const mapa = new Map([
    ['a', mk('2026-09-15T12:00:00Z')],
    ['b', mk('2026-09-17T12:00:00Z')],
    ['pieza-b', mk('2026-09-18T12:00:00Z')],
  ]);
  const items = [
    {
      id: 'raiz',
      parentItemId: null,
      contieneLotesEntrega: true,
      loteEntregaId: null,
    },
    {
      id: 'a',
      parentItemId: 'raiz',
      contieneLotesEntrega: false,
      loteEntregaId: 'a',
    },
    {
      id: 'b',
      parentItemId: 'raiz',
      contieneLotesEntrega: false,
      loteEntregaId: 'b',
    },
    {
      id: 'pieza-b',
      parentItemId: 'b',
      contieneLotesEntrega: false,
      loteEntregaId: 'b',
    },
  ];
  agregarEtaEntregas(mapa, items);
  expect(mapa.get('raiz')?.finEstimado?.toISOString()).toBe(
    '2026-09-18T12:00:00.000Z',
  );
  expect(mapa.get('a')?.finEstimado?.toISOString()).toBe(
    '2026-09-15T12:00:00.000Z',
  );
  mapa.set('pieza-b', mk(null));
  agregarEtaEntregas(mapa, items);
  expect(mapa.get('raiz')).toMatchObject({
    finEstimado: null,
    sinEstimar: true,
  });
});

import { simularFlujo } from './motor/flujo-produccion';
import { exhibidorControlado } from '../../test/fixtures/f6-planificacion/exhibidor-controlado';
it('respeta el inicio aceptado y el calendario; un trabajo iniciado conserva su ejecución real', () => {
  const taller = exhibidorControlado().taller;
  const item = {
    ...taller.items[0],
    id: 'lote',
    pasos: [
      {
        ...taller.items[0].pasos[0],
        id: 'paso-lote',
        estado: 'pendiente' as const,
        iniciadoEl: null,
        planificadoDesde: '2026-09-12T11:00:00.000Z',
      },
    ],
  };
  const plan = simularFlujo({ ...taller, items: [item] });
  expect(plan.traza[0].inicio.toISOString()).toBe('2026-09-14T11:00:00.000Z');
  const enCurso = simularFlujo({
    ...taller,
    items: [
      {
        ...item,
        pasos: [
          {
            ...item.pasos[0],
            estado: 'en_curso',
            iniciadoEl: taller.ahora.toISOString(),
          },
        ],
      },
    ],
  });
  expect(enCurso.traza[0].inicio.toISOString()).toBe(
    taller.ahora.toISOString(),
  );
});
