/**
 * Cuánto vive una sesión.
 *
 * Antes era un plazo FIJO de 7 días desde el login: una máquina del taller
 * quedaba habilitada toda la semana aunque nadie la tocara, y cada login abría
 * una fila nueva que no moría hasta el séptimo día — de ahí la pila de sesiones
 * abiertas.
 *
 * Ahora la sesión se corre con el uso y muere por INACTIVIDAD. Los dos plazos
 * juntos dan: `min(última actividad + 8 h, login + 7 días)`.
 *
 * Por qué deslizante y no un plazo fijo de 8 horas: un plazo fijo echa a la
 * gente en medio de un trabajo —quien entra a las 8 se queda afuera a las 16—,
 * que es la forma más rápida de que alguien deje la sesión abierta a propósito.
 * Con ventana deslizante, al que está trabajando no lo echa nadie y la máquina
 * que quedó prendida a la noche amanece cerrada.
 */

/** Sin usarla, la sesión muere a las 8 horas. */
export const SESION_INACTIVIDAD_MS = 1000 * 60 * 60 * 8;

/**
 * Tope duro desde el login: por más que se use todos los días, a los 7 hay que
 * volver a entrar. Coincide con la vida del JWT (`JWT_EXPIRES_IN`, default 7d)
 * a propósito: estirar la sesión más allá del token no serviría de nada porque
 * el token se rechaza igual, y creer que sí llevaría a sesiones "vivas" que en
 * realidad no entran.
 */
export const SESION_VIDA_MAXIMA_MS = 1000 * 60 * 60 * 24 * 7;

/** Cuándo vence una sesión que nace ahora. */
export function vencimientoInicial(ahora = new Date()): Date {
  return new Date(ahora.getTime() + SESION_INACTIVIDAD_MS);
}

/**
 * El vencimiento nuevo de una sesión que se acaba de usar, o `null` si no hace
 * falta escribir.
 *
 * No se estira en cada request: sólo cuando ya se consumió más de la mitad de
 * la ventana. Sin ese recorte, cada llamada al API sería un UPDATE.
 */
export function vencimientoRenovado(
  sesion: { expiresAt: Date; createdAt: Date },
  ahora = new Date(),
): Date | null {
  const tope = new Date(sesion.createdAt.getTime() + SESION_VIDA_MAXIMA_MS);
  const propuesto = new Date(
    Math.min(ahora.getTime() + SESION_INACTIVIDAD_MS, tope.getTime()),
  );
  if (propuesto <= sesion.expiresAt) return null;

  const restante = sesion.expiresAt.getTime() - ahora.getTime();
  if (restante > SESION_INACTIVIDAD_MS / 2) return null;

  return propuesto;
}
