import {
  SESION_INACTIVIDAD_MS,
  SESION_VIDA_MAXIMA_MS,
  vencimientoInicial,
  vencimientoRenovado,
} from '../sesion-vida';

/**
 * La vida de una sesión.
 *
 * Antes era un plazo fijo de 7 días desde el login: una máquina del taller
 * quedaba habilitada toda la semana sin que nadie la tocara. Ahora muere por
 * inactividad y se corre con el uso — pero con dos cuidados que estos tests
 * fijan: que no escriba en cada request, y que el uso continuo no la vuelva
 * eterna.
 */

const H = 1000 * 60 * 60;
const AHORA = new Date('2026-07-25T10:00:00.000Z');

function sesion(over: { expiresAt?: Date; createdAt?: Date } = {}) {
  return {
    expiresAt: over.expiresAt ?? new Date(AHORA.getTime() + 8 * H),
    createdAt: over.createdAt ?? AHORA,
  };
}

describe('vida de la sesión', () => {
  it('nace con la ventana de inactividad', () => {
    expect(vencimientoInicial(AHORA).getTime()).toBe(
      AHORA.getTime() + SESION_INACTIVIDAD_MS,
    );
  });

  describe('renovación', () => {
    /** Sin este recorte, cada request del API sería un UPDATE. */
    it('no escribe si todavía queda más de media ventana', () => {
      const s = sesion({ expiresAt: new Date(AHORA.getTime() + 5 * H) });
      expect(vencimientoRenovado(s, AHORA)).toBeNull();
    });

    it('se corre cuando ya pasó media ventana', () => {
      const s = sesion({ expiresAt: new Date(AHORA.getTime() + 3 * H) });
      const nuevo = vencimientoRenovado(s, AHORA);
      expect(nuevo?.getTime()).toBe(AHORA.getTime() + SESION_INACTIVIDAD_MS);
    });

    /**
     * El punto de todo el cambio: al que está trabajando no lo echa nadie.
     */
    it('usándola seguido, nunca vence', () => {
      let s = sesion();
      for (let hora = 1; hora <= 40; hora += 1) {
        const t = new Date(AHORA.getTime() + hora * H);
        expect(s.expiresAt.getTime()).toBeGreaterThan(t.getTime());
        const nuevo = vencimientoRenovado(s, t);
        if (nuevo) s = { ...s, expiresAt: nuevo };
      }
    });

    /**
     * ...pero no para siempre: a los 7 días del login hay que volver a entrar,
     * aunque se la haya usado todos los días. Si no, una sesión robada dura
     * mientras el ladrón la toque.
     */
    it('no se estira más allá del tope desde el login', () => {
      const login = AHORA;
      // A los 6 días y 20 horas: pedir 8 h más se pasaría de los 7 días, que es
      // cuando el tope recién muerde. Antes de ese punto manda la ventana.
      const t = new Date(login.getTime() + 6 * 24 * H + 20 * H);
      const s = sesion({
        createdAt: login,
        expiresAt: new Date(t.getTime() + 1 * H),
      });

      const nuevo = vencimientoRenovado(s, t);
      expect(nuevo?.getTime()).toBe(login.getTime() + SESION_VIDA_MAXIMA_MS);
      // Y ese tope es antes de lo que pediría la ventana de inactividad.
      expect(nuevo!.getTime()).toBeLessThan(
        t.getTime() + SESION_INACTIVIDAD_MS,
      );
    });

    it('en el tope ya no escribe más', () => {
      const login = AHORA;
      const tope = new Date(login.getTime() + SESION_VIDA_MAXIMA_MS);
      const t = new Date(tope.getTime() - 1 * H);
      const s = sesion({ createdAt: login, expiresAt: tope });

      expect(vencimientoRenovado(s, t)).toBeNull();
    });

    /** 8 horas de inactividad: la máquina que quedó prendida amanece cerrada. */
    it('la ventana es de 8 horas', () => {
      expect(SESION_INACTIVIDAD_MS).toBe(8 * H);
    });
  });
});
