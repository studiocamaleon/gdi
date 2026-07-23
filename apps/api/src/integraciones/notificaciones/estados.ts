/**
 * Estados de una fila de la cola de notificaciones.
 *
 * En su propio archivo para que el servicio que encola y el que despacha no
 * tengan que importarse entre sí.
 */
export const ESTADOS = {
  pendiente: 'pendiente',
  enviada: 'enviada',
  fallida: 'fallida',
  descartada: 'descartada',
} as const;
