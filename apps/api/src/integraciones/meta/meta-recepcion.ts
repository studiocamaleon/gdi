import type { Prisma } from '@prisma/client';
import type { CambioWebhook } from '../../webhooks-whatsapp/webhooks-whatsapp.service';
import { configuracionMetaPiloto } from './meta-piloto.config';

/** La recepción tiene su propio interruptor y no amplía el piloto de envío. */
export function configuracionMetaRecepcion() {
  const config = configuracionMetaPiloto();
  return process.env.META_WHATSAPP_RECEPCION_PILOT_ENABLED === 'true' &&
    config?.listo
    ? config
    : null;
}

const objeto = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/** Sólo mensajes nuevos del contacto autorizado. History/echoes no equivalen
 * a mensajes entrantes ni abren una ventana de atención: quedan crudos. */
export function proyectarMensajePiloto(
  cambio: CambioWebhook & { tenantId: string | null },
  ahora = Date.now(),
): Prisma.MensajeWhatsappRecibidoCreateManyInput | null {
  const config = configuracionMetaRecepcion();
  if (
    !config ||
    cambio.tipo !== 'messages' ||
    cambio.tenantId !== config.tenantId ||
    cambio.wabaId !== config.wabaId ||
    cambio.phoneNumberId !== config.phoneNumberId
  )
    return null;
  const mensajes = cambio.payload.messages;
  if (!Array.isArray(mensajes) || mensajes.length !== 1) return null;
  const mensaje = objeto(mensajes[0]);
  const from = mensaje.from;
  const wamid = mensaje.id;
  const tipo = mensaje.type;
  const timestamp = mensaje.timestamp;
  if (
    typeof from !== 'string' ||
    !/^[1-9]\d{7,14}$/.test(from) ||
    `+${from}` !== config.destinatario ||
    typeof wamid !== 'string' ||
    !wamid.startsWith('wamid.') ||
    wamid.length > 512 ||
    wamid !== cambio.wamid ||
    typeof tipo !== 'string' ||
    !/^[a-z_]{1,40}$/.test(tipo) ||
    typeof timestamp !== 'string' ||
    !/^\d{1,12}$/.test(timestamp)
  )
    return null;
  const enviadoEl = new Date(Number(timestamp) * 1000);
  if (enviadoEl.getTime() <= 0 || enviadoEl.getTime() > ahora + 300_000)
    return null;
  const texto = objeto(mensaje.text).body;
  if (tipo === 'text' && (typeof texto !== 'string' || texto.length > 4096))
    return null;
  // No tomar el primer nombre del lote: debe corresponder a ESTE remitente.
  const contactos = Array.isArray(cambio.payload.contacts)
    ? cambio.payload.contacts
    : [];
  const contacto = contactos.map(objeto).find((c) => c.wa_id === from);
  const nombre = objeto(contacto?.profile).name;
  return {
    tenantId: config.tenantId,
    wabaId: config.wabaId,
    phoneNumberId: config.phoneNumberId,
    wamid,
    remitente: config.destinatario,
    nombreContacto: typeof nombre === 'string' ? nombre.slice(0, 256) : null,
    tipo,
    texto: tipo === 'text' ? (texto as string) : null,
    enviadoEl,
  };
}
