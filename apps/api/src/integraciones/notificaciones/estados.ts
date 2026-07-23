/**
 * Estados de una fila de la cola de notificaciones.
 *
 * En su propio archivo para que el servicio que encola y el que despacha no
 * tengan que importarse entre sí.
 */
export const ESTADOS = {
  pendiente: 'pendiente',
  /**
   * Reservada por un despachador que está hablando con Wati justo ahora.
   * No es un estado de negocio: es el candado que evita el envío doble.
   */
  enviando: 'enviando',
  enviada: 'enviada',
  fallida: 'fallida',
  descartada: 'descartada',
} as const;
