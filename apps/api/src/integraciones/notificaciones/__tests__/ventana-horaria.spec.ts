import { proximaVentana } from '../despacho.service';

/**
 * Decide si un cliente recibe un WhatsApp a las 23:40, y si le avisamos que
 * pase a retirar un sábado que el local está cerrado. Se prueba sola —sin base
 * ni red— porque es aritmética y es lo que se rompe callado.
 *
 * Las fechas van en UTC a propósito: en Render el servidor corre en UTC y la
 * ventana se evalúa en hora de Buenos Aires (UTC-3). Si el cálculo usara la
 * hora del servidor, todo esto correría tres horas.
 *
 * 2026-07-23 es JUEVES.
 */
const CORTESIA = { horaDesde: '09:00', horaHasta: '20:00' };
const LUN_A_VIE = '1,2,3,4,5';

/** Jueves 2026-07-23 a las `hUtc`:`min` UTC. */
const jue = (hUtc: number, min = 0) =>
  new Date(Date.UTC(2026, 6, 23, hUtc, min));
/** Sábado 2026-07-25. */
const sab = (hUtc: number, min = 0) =>
  new Date(Date.UTC(2026, 6, 25, hUtc, min));

const horas = (ms: number) => ms / 3_600_000;

describe('proximaVentana — cortesía', () => {
  const reglas = {
    ...CORTESIA,
    diasAtencion: LUN_A_VIE,
    requiereLocalAbierto: false,
  };

  it('null dentro de la ventana', () => {
    // 15:00 UTC = 12:00 en Buenos Aires.
    expect(proximaVentana(jue(15), reglas)).toBeNull();
  });

  it('el borde de apertura ya está adentro', () => {
    expect(proximaVentana(jue(12), reglas)).toBeNull(); // 09:00 exacto
  });

  it('el borde de cierre ya está afuera', () => {
    expect(proximaVentana(jue(23), reglas)).not.toBeNull(); // 20:00 exacto
  });

  it('antes de abrir espera hasta la apertura de hoy', () => {
    // 10:00 UTC = 07:00; faltan 2 h.
    const p = proximaVentana(jue(10), reglas)!;
    expect(horas(p.getTime() - jue(10).getTime())).toBe(2);
  });

  /**
   * El caso que motiva la feature: una orden que se cierra de noche no puede
   * despertar a nadie, pero tampoco perderse.
   */
  it('a las 21 espera hasta las 9 de la mañana siguiente', () => {
    // 00:00 UTC del viernes = 21:00 del jueves en Buenos Aires.
    const ahora = new Date(Date.UTC(2026, 6, 24, 0, 0));
    const p = proximaVentana(ahora, reglas)!;
    expect(horas(p.getTime() - ahora.getTime())).toBe(12);
  });

  it('un evento que no depende del local sale igual el sábado', () => {
    // Sábado 15:00 UTC = 12:00. Un pago acreditado no espera al lunes.
    expect(proximaVentana(sab(15), reglas)).toBeNull();
  });
});

describe('proximaVentana — días de atención al público', () => {
  const reglas = {
    ...CORTESIA,
    diasAtencion: LUN_A_VIE,
    requiereLocalAbierto: true,
  };

  it('un jueves al mediodía sale', () => {
    expect(proximaVentana(jue(15), reglas)).toBeNull();
  });

  /**
   * Lo que pidió el usuario: la imprenta produce el sábado pero no atiende.
   * "Pasá a retirarla" ese día lo hace viajar al pedo, así que espera al lunes.
   */
  it('un sábado espera hasta el lunes a la mañana', () => {
    const ahora = sab(15); // sábado 12:00 en Buenos Aires
    const p = proximaVentana(ahora, reglas)!;
    // Del sábado 12:00 al lunes 09:00 hay 45 h.
    expect(horas(p.getTime() - ahora.getTime())).toBe(45);
  });

  it('si el tenant abre los sábados, sale el sábado', () => {
    expect(
      proximaVentana(sab(15), { ...reglas, diasAtencion: '1,2,3,4,5,6' }),
    ).toBeNull();
  });

  it('un viernes a la noche espera al lunes, no al sábado', () => {
    // 01:00 UTC del sábado = 22:00 del viernes.
    const ahora = new Date(Date.UTC(2026, 6, 25, 1, 0));
    const p = proximaVentana(ahora, reglas)!;
    // Del viernes 22:00 al lunes 09:00 hay 59 h.
    expect(horas(p.getTime() - ahora.getTime())).toBe(59);
  });

  /**
   * Configuración imposible. Antes de colgar el mensaje para siempre o
   * mandarlo con el local cerrado, se reprograma y se vuelve a mirar.
   */
  it('sin ningún día de atención no explota', () => {
    const p = proximaVentana(jue(15), { ...reglas, diasAtencion: '' });
    expect(p).not.toBeNull();
  });
});
