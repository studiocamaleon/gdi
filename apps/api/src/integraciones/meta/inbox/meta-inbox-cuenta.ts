import { type MetaVinculo, Prisma } from '@prisma/client';
import type { OperacionInbox } from './meta-inbox-normalizar';

/** El llamador mantiene el bloqueo de MetaVinculo. Sólo eventos firmados,
 * atribuidos a la generación vigente por el procesador, llegan aquí. */
export async function aplicarCambioCuenta(
  tx: Prisma.TransactionClient,
  canal: MetaVinculo,
  op: Extract<OperacionInbox, { clase: 'cuenta' }>,
) {
  const piso = canal.recepcionDesdeEl ?? canal.verificadoEl;
  if (op.fecha.getTime() < Math.floor(piso.getTime() / 1000) * 1000)
    return false;
  const anterior = canal.ultimoCambioCuentaEl;
  if (anterior && op.fecha < anterior) return false;
  // En un empate no restaurar acceso. Una revocación gana sobre una pausa.
  if (
    anterior &&
    op.fecha.getTime() === anterior.getTime() &&
    (op.evento === canal.ultimoEventoCuenta ||
      op.evento === 'ACCOUNT_RECONNECTED' ||
      (canal.estado === 'DESCONECTADO' &&
        canal.ultimoEventoCuenta !== 'GRAFO_DESCARTADO'))
  )
    return false;
  const scope = {
    tenantId: canal.tenantId,
    vinculoId: canal.id,
    autorizacionId: canal.autorizacionId,
  };
  if (op.evento === 'ACCOUNT_RECONNECTED') {
    if (canal.estado === 'DESCONECTADO') return false;
    const credencialVigente =
      canal.tokenCifrado &&
      canal.recepcionDesdeEl &&
      ![canal.tokenVenceEl, canal.accesoDatosVenceEl].some(
        (d) => d && d <= new Date(),
      );
    if (!credencialVigente) return false;
    // No crea otra alta ni repite smb_app_data: Meta no resincroniza el
    // historial al restaurar la aplicación complementaria.
    const cambio = {
      estado: 'VERIFICADO' as const,
      desconectadoEl: null,
      ultimoCambioCuentaEl: op.fecha,
      ultimoEventoCuenta: op.evento,
    };
    await tx.metaVinculo.update({
      where: { id: canal.id, tenantId: canal.tenantId },
      data: cambio,
    });
    Object.assign(canal, cambio);
    await tx.inboxTrabajoEvento.updateMany({
      where: {
        ...scope,
        estado: 'PENDIENTE',
        ultimoError: 'CUENTA_SUSPENDIDA',
      },
      data: { proximoIntentoEl: new Date(), ultimoError: null },
    });
    return true;
  }
  const temporal = op.evento === 'ACCOUNT_OFFBOARDED';
  if (temporal && canal.estado === 'DESCONECTADO') return false;
  const cambio = {
    estado: temporal ? ('SUSPENDIDO' as const) : ('DESCONECTADO' as const),
    desconectadoEl: op.fecha,
    ultimoCambioCuentaEl: op.fecha,
    ultimoEventoCuenta: op.evento,
    ...(!temporal
      ? { tokenCifrado: Prisma.DbNull, recepcionDesdeEl: null }
      : {}),
  };
  await tx.metaVinculo.update({
    where: { id: canal.id, tenantId: canal.tenantId },
    data: cambio,
  });
  Object.assign(canal, cambio, !temporal ? { tokenCifrado: null } : {});
  // Si interrumpe el alta inicial, revisar el resultado. Nunca repetir un
  // POST en vuelo ni reanudar solicitudes de un solo uso por una reconexión.
  await tx.metaAlta.updateMany({
    where: {
      ...scope,
      estado: { notIn: ['SOLICITUDES_COMPLETADAS', 'REVISION', 'PAUSADA'] },
    },
    data: {
      estado: temporal ? 'REVISION' : 'PAUSADA',
      falloCodigo: temporal
        ? 'ALTA_INTERRUMPIDA_POR_CUENTA'
        : 'CANAL_NO_VIGENTE',
    },
  });
  await tx.metaAutorizacion.updateMany({
    where: {
      tenantId: canal.tenantId,
      estado: { in: ['PREPARADA', 'CANJEANDO', 'CANJEADA', 'VERIFICANDO'] },
    },
    data: { estado: 'CANCELADA', tokenCifrado: Prisma.DbNull },
  });
  return true;
}
