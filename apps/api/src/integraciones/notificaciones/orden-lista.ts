import { POR_EVENTO, type EventoNotificacion } from '../wati/catalogo';

/** Un solo momento de la OT, con cuatro presentaciones posibles. */
export const EVENTOS_ORDEN_LISTA: EventoNotificacion[] = [
  'orden_lista',
  'orden_lista_con_saldo',
  'orden_lista_qr',
  'orden_lista_con_saldo_qr',
];

export function eventoOrdenLista(
  saldo: number,
  configurados: Array<{ evento: string; activo: boolean }>,
): EventoNotificacion | undefined {
  const explicitos = new Map(configurados.map((e) => [e.evento, e.activo]));
  const opciones: EventoNotificacion[] =
    saldo > 0
      ? ['orden_lista_con_saldo_qr', 'orden_lista_con_saldo']
      : ['orden_lista_qr', 'orden_lista'];
  // El QR es optativo. Si ambas variantes están activas, se prefiere QR;
  // jamás se generan dos mensajes ni se ignora un apagado explícito.
  return opciones.find(
    (evento) =>
      explicitos.get(evento) ??
      POR_EVENTO.get(evento)?.activoPorDefecto ??
      false,
  );
}
