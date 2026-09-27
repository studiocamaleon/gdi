import type { Prisma } from '@prisma/client';
import { configuracionCanalPrueba } from '../meta-prueba.config';
import {
  modoAltaPermitido,
  configuracionMetaConexion,
} from '../meta-conexion.config';
export const enviosInboxHabilitados = (
  tenantId: string,
  tipo = 'COEXISTENCIA',
) =>
  process.env.META_INBOX_ENVIOS_ENABLED === 'true' &&
  process.env.META_INBOX_RECEPCION_ENABLED === 'true' &&
  (tipo === 'PRUEBA'
    ? configuracionCanalPrueba()?.tenantId === tenantId
    : tipo === 'COEXISTENCIA' &&
      modoAltaPermitido(tenantId) === 'COEXISTENCIA' &&
      Boolean(configuracionMetaConexion()));
/** Sólo la evidencia de mensajes nuevos recibidos habilita texto libre.
 * No inferir una ventana abierta a partir del historial, ecos o envíos propios. */
export function ventanaRespuesta(
  ultimo: Date | null,
  desde: Date | null,
  ahora = new Date(),
) {
  const valida = ultimo && desde && ultimo >= desde && ultimo <= ahora;
  const hasta = valida
    ? new Date(ultimo.getTime() + 24 * 60 * 60 * 1000)
    : null;
  return {
    abierta: Boolean(hasta && hasta > ahora),
    hasta: hasta?.toISOString() ?? null,
    servidorEl: ahora.toISOString(),
  };
}
export function presentarEnvio(e: {
  id: string;
  clave: string;
  estado: string;
  texto: string | null;
  codigo: string | null;
  createdAt: Date;
  mensajeId: string | null;
}) {
  return {
    id: e.id,
    clave: e.clave,
    estado:
      e.estado === 'ENVIANDO' && Date.now() - e.createdAt.getTime() > 45000
        ? 'INCIERTO'
        : e.estado,
    texto: e.texto,
    codigo: e.codigo,
    creadoEl: e.createdAt.toISOString(),
    mensajeId: e.mensajeId,
  };
}

/** Un rechazo explícito de Meta prevalece sobre el reloj local hasta otro mensaje entrante. */
export async function consultarVentanaRespuesta(
  db: Pick<Prisma.TransactionClient, 'inboxEnvio'>,
  canal: {
    id: string;
    tenantId: string;
    autorizacionId: string;
    recepcionDesdeEl: Date | null;
  },
  conversacion: { id: string; ultimoEntranteNuevoEl: Date | null } | null,
) {
  const ventana = ventanaRespuesta(
    conversacion?.ultimoEntranteNuevoEl ?? null,
    canal.recepcionDesdeEl,
  );
  if (!ventana.abierta || !conversacion?.ultimoEntranteNuevoEl) return ventana;
  const rechazo = await db.inboxEnvio.findFirst({
    where: {
      tenantId: canal.tenantId,
      vinculoId: canal.id,
      autorizacionId: canal.autorizacionId,
      conversacionId: conversacion.id,
      estado: 'RECHAZADO',
      codigo: '131047',
      createdAt: { gte: conversacion.ultimoEntranteNuevoEl },
    },
    select: { id: true },
  });
  return { ...ventana, abierta: !rechazo };
}

export const plantillasInboxHabilitadas = (
  tenantId: string,
  tipo = 'COEXISTENCIA',
) =>
  process.env.META_INBOX_PLANTILLAS_ENABLED === 'true' &&
  enviosInboxHabilitados(tenantId, tipo);
