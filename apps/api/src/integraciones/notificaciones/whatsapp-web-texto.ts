import { POR_EVENTO, type EventoNotificacion } from '../wati/catalogo';

export const CANAL_WEB = 'WHATSAPP_WEB';
export const EVENTOS_WEB: EventoNotificacion[] = [
  'orden_recibida',
  'orden_demorada',
  'orden_lista',
  'orden_lista_con_saldo',
  'orden_lista_qr',
  'orden_lista_con_saldo_qr',
];
export const esOrdenWeb = (evento: string) =>
  EVENTOS_WEB.includes(evento as EventoNotificacion);

export function textoWhatsappWeb(
  evento: EventoNotificacion,
  parametros: string[],
): string {
  if (!esOrdenWeb(evento))
    throw new Error('Evento no disponible por WhatsApp Web.');
  // Las variantes con QR se convierten a su texto equivalente con enlace.
  const textoEvento =
    evento === 'orden_lista_qr'
      ? 'orden_lista'
      : evento === 'orden_lista_con_saldo_qr'
        ? 'orden_lista_con_saldo'
        : evento;
  const plantilla = POR_EVENTO.get(textoEvento)!;
  if (
    parametros.length !== plantilla.parametros.length ||
    parametros.some((p) => typeof p !== 'string')
  )
    throw new Error('Parámetros incompletos.');
  const cuerpo = plantilla.cuerpo.replace(
    /\{\{(\d+)\}\}/g,
    (_, pos: string) => parametros[Number(pos) - 1],
  );
  return `${cuerpo}\n\n${plantilla.footer}`;
}
