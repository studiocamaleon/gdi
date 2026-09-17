import { evaluarLayoutsEntregas } from './layouts-entregas';
import type { PlanGeometricoF6 } from './adaptador-cotizacion';

const original: PlanGeometricoF6 = {
  cantidadProductos: 200,
  fuenteId: 'cotizada',
  operacion: 'impresion',
  origenOperacion: null,
  placas: 8,
  piezas: [
    { id: 'a', nombre: 'Frente', porProducto: 1, geometriaHash: 'geometria' },
  ],
  layouts: [
    {
      huella: 'layout-a',
      placasIndices: [0, 1, 2, 3, 4, 5, 6, 7],
      contenido: { a: 25 },
    },
  ],
};
const tandas = () =>
  [0, 1, 2, 3].map((i) => ({
    ...original,
    cantidadProductos: 50,
    placas: 2,
    fuenteId: 'cotizacion-50',
    loteId: `l${i}`,
    desde: i * 50,
    hasta: (i + 1) * 50,
    layouts: [{ ...original.layouts[0], placasIndices: [0, 1] }],
  }));

it('reparte copias enteras para cuatro entregas sin reutilizar dos veces una placa', () => {
  const r = evaluarLayoutsEntregas([original], tandas());
  expect(r.estado).toBe('CONSERVADO');
  expect(
    r.lotes.flatMap((l) => l.layouts.flatMap((p) => p.indicesOriginales)),
  ).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(r.placasPlan).toBe(8);
});
it('no confunde igual cantidad de placas con igualdad de layouts y capas', () => {
  const lotes = tandas();
  lotes[2].layouts[0].huella = 'otras-posiciones-o-capas';
  expect(evaluarLayoutsEntregas([original], lotes).estado).toBe(
    'REQUIERE_AJUSTE',
  );
});
it('no conserva si sobra o falta una copia, o si falta el original', () => {
  const lotes = tandas();
  lotes[2].layouts[0].placasIndices.push(2);
  expect(evaluarLayoutsEntregas([original], lotes).estado).toBe(
    'REQUIERE_AJUSTE',
  );
  expect(evaluarLayoutsEntregas([original], tandas().slice(1)).estado).toBe(
    'REQUIERE_AJUSTE',
  );
  expect(evaluarLayoutsEntregas(null, tandas()).estado).toBe('REQUIERE_AJUSTE');
});
it('conserva impresión y corte vinculados, contando el sustrato una sola vez', () => {
  const corte = {
    ...original,
    operacion: 'corte',
    origenOperacion: 'impresion',
  };
  const lotes = [
    ...tandas(),
    ...tandas().map((l) => ({
      ...l,
      loteId: `c${l.loteId}`,
      operacion: 'corte',
      origenOperacion: 'impresion',
    })),
  ];
  const r = evaluarLayoutsEntregas([original, corte], lotes);
  expect(r.estado).toBe('CONSERVADO');
  expect(r.placasPlan).toBe(8);
  lotes[4].layouts = [{ ...lotes[4].layouts[0], huella: 'corte-distinto' }];
  expect(evaluarLayoutsEntregas([original, corte], lotes).estado).toBe(
    'REQUIERE_AJUSTE',
  );
});
