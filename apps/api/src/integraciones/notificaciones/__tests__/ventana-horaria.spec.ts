import { NotificacionesScheduler } from '../notificaciones.scheduler';

/**
 * La ventana horaria decide si un cliente recibe un WhatsApp a las 23:40.
 * Se prueba sola —sin base, sin Wati— porque es aritmética pura y es el tipo
 * de cosa que se rompe callada cuando alguien toca el redondeo.
 *
 * Las fechas se construyen en UTC a propósito: en Render el servidor corre en
 * UTC y la ventana se evalúa en hora de Buenos Aires (UTC-3). Si el cálculo
 * usara la hora del servidor, todo esto correría tres horas.
 */
describe('proximaVentana', () => {
  const scheduler = new NotificacionesScheduler(
    null as never,
    null as never,
    null as never,
  );

  /** `hUtc` en UTC → qué hora es en Buenos Aires (UTC-3). */
  const utc = (hUtc: number, min = 0) =>
    new Date(Date.UTC(2026, 6, 23, hUtc, min));

  it('devuelve null dentro de la ventana', () => {
    // 15:00 UTC = 12:00 en Buenos Aires.
    expect(scheduler.proximaVentana(utc(15), '09:00', '20:00')).toBeNull();
  });

  it('el borde de apertura ya está adentro', () => {
    // 12:00 UTC = 09:00 exacto.
    expect(scheduler.proximaVentana(utc(12), '09:00', '20:00')).toBeNull();
  });

  it('el borde de cierre ya está afuera', () => {
    // 23:00 UTC = 20:00 exacto: la ventana es [desde, hasta).
    expect(scheduler.proximaVentana(utc(23), '09:00', '20:00')).not.toBeNull();
  });

  it('antes de abrir, espera hasta la apertura de HOY', () => {
    // 10:00 UTC = 07:00 en Buenos Aires; faltan 2 h para las 09:00.
    const proxima = scheduler.proximaVentana(utc(10), '09:00', '20:00');
    expect(proxima!.getTime() - utc(10).getTime()).toBe(2 * 60 * 60 * 1000);
  });

  /**
   * El caso que motiva la feature: una orden que se marca lista de noche no
   * puede despertar a nadie, pero tampoco perderse.
   */
  it('después de cerrar, espera hasta la apertura de MAÑANA', () => {
    // 02:40 UTC = 23:40 del día anterior en Buenos Aires.
    const ahora = utc(2, 40);
    const proxima = scheduler.proximaVentana(ahora, '09:00', '20:00');
    // De 23:40 a 09:00 hay 9 h 20 min.
    expect(proxima!.getTime() - ahora.getTime()).toBe(
      (9 * 60 + 20) * 60 * 1000,
    );
  });

  it('respeta una ventana angosta configurada por el tenant', () => {
    // 15:00 UTC = 12:00; con ventana 14:00-18:00 todavía no abrió.
    const ahora = utc(15);
    const proxima = scheduler.proximaVentana(ahora, '14:00', '18:00');
    expect(proxima!.getTime() - ahora.getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it('tolera horas con minutos', () => {
    // 12:00 UTC = 09:00; ventana desde 09:30 → faltan 30 min.
    const ahora = utc(12);
    const proxima = scheduler.proximaVentana(ahora, '09:30', '20:00');
    expect(proxima!.getTime() - ahora.getTime()).toBe(30 * 60 * 1000);
  });
});
