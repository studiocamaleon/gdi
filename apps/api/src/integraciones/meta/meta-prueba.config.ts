import { isUUID } from 'class-validator';
import type { MetaVinculo } from '@prisma/client';
import type { OperacionInbox } from './inbox/meta-inbox-normalizar';

/** Lista cerrada del servidor, independiente de Embedded Signup y del piloto.
 * No acepta IDs, destinatarios ni credenciales enviados por el navegador. */
export function configuracionCanalPrueba() {
  const e = process.env;
  if (
    e.GRAFO_DEPLOY_ENV !== 'staging' ||
    e.META_INBOX_PRUEBA_ENABLED !== 'true'
  )
    return null;
  const tenantId = e.META_INBOX_PRUEBA_TENANT_ID ?? '';
  const wabaId = e.META_INBOX_PRUEBA_WABA_ID ?? '';
  const phoneNumberId = e.META_INBOX_PRUEBA_PHONE_NUMBER_ID ?? '';
  const destinatario = e.META_INBOX_PRUEBA_DESTINATARIO_WA_ID ?? '';
  const destinoE164 = e.META_INBOX_PRUEBA_DESTINO_E164 ?? '';
  if (
    !isUUID(tenantId, '4') ||
    !/^\d{1,32}$/.test(wabaId) ||
    !/^\d{1,32}$/.test(phoneNumberId) ||
    !/^[1-9]\d{7,14}$/.test(destinatario) ||
    !/^\+[1-9]\d{7,14}$/.test(destinoE164)
  )
    return null;
  return { tenantId, wabaId, phoneNumberId, destinatario, destinoE164 };
}

type Canal = Pick<
  MetaVinculo,
  | 'tipo'
  | 'tenantId'
  | 'wabaId'
  | 'phoneNumberId'
  | 'pruebaDestinatarioWaId'
  | 'pruebaDestinoE164'
  | 'tokenVenceEl'
>;

/** Falla cerrado si cambió el entorno, el destinatario o venció la credencial. */
export function canalPruebaPermitido(canal: Canal, ahora = new Date()) {
  const config = configuracionCanalPrueba();
  return Boolean(
    config &&
    canal.tipo === 'PRUEBA' &&
    canal.tenantId === config.tenantId &&
    canal.wabaId === config.wabaId &&
    canal.phoneNumberId === config.phoneNumberId &&
    canal.pruebaDestinatarioWaId === config.destinatario &&
    canal.pruebaDestinoE164 === config.destinoE164 &&
    canal.tokenVenceEl &&
    canal.tokenVenceEl > ahora,
  );
}

export function destinatarioCanalPermitido(canal: Canal, waId: string) {
  return (
    canal.tipo === 'COEXISTENCIA' ||
    (canalPruebaPermitido(canal) && waId === canal.pruebaDestinatarioWaId)
  );
}

/** El canal de pruebas no importa contactos, historial, ecos ni cambios de
 * coexistencia. Los estados sin destinatario explícito no se proyectan. */
export function operacionPruebaPermitida(canal: Canal, op: OperacionInbox) {
  if (!canalPruebaPermitido(canal)) return false;
  if (op.clase === 'mensaje')
    return (
      op.origen === 'NUEVO' &&
      op.direccion === 'ENTRANTE' &&
      op.contacto === canal.pruebaDestinatarioWaId
    );
  if (op.clase === 'estado')
    return op.destinatario === canal.pruebaDestinatarioWaId;
  return false;
}
