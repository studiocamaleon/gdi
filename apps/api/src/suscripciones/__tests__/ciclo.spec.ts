import { estadoDeCiclo } from '../ciclo';

/**
 * Lo que se fija acá es que el DENOMINADOR salga de los datos y no de un
 * supuesto. El sidebar mostraba "X / 30 días" fijo: con un plan anual eso es
 * falso, y ese es el caso que más importa de esta tanda.
 */
describe('Ciclo de la suscripción', () => {
  const ahora = new Date('2026-07-24T12:00:00Z');
  const ciclo = (
    desde: string | null,
    hasta: string | null,
    trial: string | null = null,
  ) => ({
    periodoDesde: desde ? new Date(desde) : null,
    proximoCobro: hasta ? new Date(hasta) : null,
    trialHasta: trial ? new Date(trial) : null,
  });

  it('sin suscripción no informa nada', () => {
    expect(estadoDeCiclo(null)).toEqual({
      diasRestantes: null,
      diasTotales: null,
      venceEl: null,
      enPrueba: false,
    });
  });

  it('mensual: cuenta los días y deduce el largo del período', () => {
    const r = estadoDeCiclo(
      ciclo('2026-07-04T12:00:00Z', '2026-08-03T12:00:00Z'),
      null,
      ahora,
    );
    expect(r.diasRestantes).toBe(10);
    expect(r.diasTotales).toBe(30);
    expect(r.enPrueba).toBe(false);
  });

  it('anual: el largo es 365, NO 30', () => {
    const r = estadoDeCiclo(
      ciclo('2026-01-01T12:00:00Z', '2027-01-01T12:00:00Z'),
      null,
      ahora,
    );
    expect(r.diasTotales).toBe(365);
    expect(r.diasRestantes).toBe(161);
  });

  it('sin inicio de período informa los días pero NO inventa el total', () => {
    const r = estadoDeCiclo(ciclo(null, '2026-08-03T12:00:00Z'), null, ahora);
    expect(r.diasRestantes).toBe(10);
    expect(r.diasTotales).toBeNull();
  });

  it('vencido (dunning): cero días, no negativos', () => {
    const r = estadoDeCiclo(
      ciclo('2026-06-20T12:00:00Z', '2026-07-20T12:00:00Z'),
      null,
      ahora,
    );
    expect(r.diasRestantes).toBe(0);
  });

  it('la prueba tiene prioridad sobre el cobro y usa los días del plan', () => {
    const r = estadoDeCiclo(
      ciclo('2026-07-04T12:00:00Z', '2026-08-03T12:00:00Z', '2026-07-30T12:00:00Z'),
      14,
      ahora,
    );
    expect(r.enPrueba).toBe(true);
    expect(r.diasRestantes).toBe(6);
    expect(r.diasTotales).toBe(14);
    expect(r.venceEl).toBe('2026-07-30T12:00:00.000Z');
  });

  it('prueba vencida: se pasa a informar el ciclo de cobro', () => {
    const r = estadoDeCiclo(
      ciclo('2026-07-04T12:00:00Z', '2026-08-03T12:00:00Z', '2026-07-10T12:00:00Z'),
      14,
      ahora,
    );
    expect(r.enPrueba).toBe(false);
    expect(r.diasRestantes).toBe(10);
  });

  it('la barra nunca se pasa: restantes acotan el total', () => {
    // Puede pasar tras un reintento de cobro que corre proximoCobro.
    const r = estadoDeCiclo(
      ciclo('2026-07-20T12:00:00Z', '2026-08-23T12:00:00Z'),
      null,
      ahora,
    );
    expect(r.diasRestantes).toBe(30);
    expect(r.diasTotales).toBe(34);
    expect(r.diasRestantes).toBeLessThanOrEqual(r.diasTotales!);
  });
});
