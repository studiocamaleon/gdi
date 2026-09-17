import {
  fijarPlanReferencia,
  leerPlanReferencia,
  proyectarPlanReferencia,
} from './plan-referencia-paso';

const ventana = { inicio: '2026-09-14T12:00:00Z', fin: '2026-09-14T13:00:00Z' };
const ahora = new Date('2026-09-14T11:00:00Z');

it('fija una referencia automática y no la desplaza con el recálculo', () => {
  const original = fijarPlanReferencia(null, ventana, 'automatico', ahora);
  const recalculada = fijarPlanReferencia(
    original,
    { ...ventana, fin: '2026-09-15T16:00:00Z' },
    'automatico',
  );
  expect(recalculada).toEqual(original);
  expect(recalculada.historial).toEqual([]);
});

it('sólo un plan aceptado reemplaza la referencia y conserva la anterior sin duplicar reintentos', () => {
  const original = fijarPlanReferencia(null, ventana, 'automatico', ahora);
  const nueva = { ...ventana, fin: '2026-09-15T16:00:00Z' };
  const aceptada = fijarPlanReferencia(original, nueva, 'plan_aceptado', ahora);
  expect(aceptada.historial).toEqual([proyectarPlanReferencia(original)]);
  expect(fijarPlanReferencia(aceptada, nueva, 'plan_aceptado')).toEqual(
    aceptada,
  );
  expect(proyectarPlanReferencia(aceptada)).not.toHaveProperty('historial');
});

it('no acepta referencias corruptas ni ventanas invertidas', () => {
  expect(leerPlanReferencia(null)).toBeNull();
  expect(
    leerPlanReferencia({ ...ventana, version: 1, historial: [] }),
  ).toBeNull();
  expect(() =>
    fijarPlanReferencia(
      null,
      { inicio: ventana.fin, fin: ventana.inicio },
      'automatico',
    ),
  ).toThrow();
  expect(() =>
    fijarPlanReferencia(null, { ...ventana, fin: 'inválido' }, 'automatico'),
  ).toThrow();
});
