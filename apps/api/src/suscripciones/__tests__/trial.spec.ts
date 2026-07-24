import { estadoDePrueba, finDePrueba } from '../trial';

/**
 * Los días de prueba se CALCULAN, nunca se guardan. Este spec fija esa
 * propiedad: la misma fecha vista en dos momentos distintos da números
 * distintos, que es justamente lo que un contador persistido no hace.
 */
describe('Prueba gratuita', () => {
  const ahora = new Date('2026-07-24T12:00:00Z');

  it('sin fecha de fin, no hay prueba', () => {
    expect(estadoDePrueba(null, ahora)).toEqual({
      enPrueba: false,
      diasRestantes: null,
      hasta: null,
      vencida: false,
    });
  });

  it('cuenta los días que faltan', () => {
    const fin = new Date('2026-08-03T12:00:00Z'); // +10 días
    const r = estadoDePrueba(fin, ahora);
    expect(r.enPrueba).toBe(true);
    expect(r.diasRestantes).toBe(10);
    expect(r.vencida).toBe(false);
  });

  it('redondea hacia arriba: quedan horas → todavía es 1 día', () => {
    const fin = new Date('2026-07-24T14:00:00Z'); // +2 horas
    // Decir "0 días" a alguien que aún puede trabajar hoy sería confuso.
    expect(estadoDePrueba(fin, ahora).diasRestantes).toBe(1);
    expect(estadoDePrueba(fin, ahora).enPrueba).toBe(true);
  });

  it('vencida cuando la fecha ya pasó', () => {
    const fin = new Date('2026-07-20T12:00:00Z');
    const r = estadoDePrueba(fin, ahora);
    expect(r.vencida).toBe(true);
    expect(r.enPrueba).toBe(false);
    expect(r.diasRestantes).toBe(0);
  });

  it('el mismo dato leído más tarde da MENOS días (no está congelado)', () => {
    const fin = new Date('2026-08-03T12:00:00Z');
    const hoy = estadoDePrueba(fin, ahora).diasRestantes;
    const enTresDias = estadoDePrueba(
      fin,
      new Date('2026-07-27T12:00:00Z'),
    ).diasRestantes;
    expect(hoy).toBe(10);
    expect(enTresDias).toBe(7);
  });

  it('finDePrueba: null si el plan no da prueba', () => {
    expect(finDePrueba(null, ahora)).toBeNull();
    expect(finDePrueba(0, ahora)).toBeNull();
  });

  it('finDePrueba: suma los días del plan', () => {
    expect(finDePrueba(30, ahora)?.toISOString()).toBe(
      '2026-08-23T12:00:00.000Z',
    );
  });
});
