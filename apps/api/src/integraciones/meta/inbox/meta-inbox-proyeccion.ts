import { Prisma, type InboxEnvio, type MetaVinculo } from '@prisma/client';
import type { OperacionInbox } from './meta-inbox-normalizar';

type Contexto = Pick<
  MetaVinculo,
  'id' | 'tenantId' | 'autorizacionId' | 'recepcionDesdeEl'
>;
/** Sólo guarda cambios dentro de una transacción con el vínculo bloqueado.
 * No crea notificaciones, clientes fiscales ni trabajos de envío. */
export async function aplicarOperacionInbox(
  tx: Prisma.TransactionClient,
  canal: Contexto,
  op: OperacionInbox,
): Promise<boolean> {
  const scope = { tenantId: canal.tenantId, vinculoId: canal.id };
  if (op.clase === 'contacto') {
    const anterior = await tx.inboxContacto.findFirst({
      where: { ...scope, waId: op.waId },
    });
    // En empate prevalece la eliminación; una reentrega no resucita el nombre.
    if (
      anterior &&
      (anterior.actualizadoMetaEl > op.fecha ||
        (anterior.actualizadoMetaEl.getTime() === op.fecha.getTime() &&
          (anterior.eliminado || !op.eliminado)))
    )
      return false;
    const data = {
      nombre: op.nombre,
      eliminado: op.eliminado,
      actualizadoMetaEl: op.fecha,
    };
    if (anterior)
      await tx.inboxContacto.update({
        where: { id: anterior.id, tenantId: canal.tenantId },
        data,
      });
    else
      await tx.inboxContacto.create({
        data: { ...scope, waId: op.waId, ...data },
      });
    return true;
  }
  const importacion = {
    vinculoId: canal.id,
    autorizacionId: canal.autorizacionId,
  };
  if (op.clase === 'historial_rechazado') {
    await tx.inboxImportacion.updateMany({
      where: { ...scope, ...importacion },
      data: { historialRechazado: true },
    });
    if (
      await tx.inboxBloqueHistorial.count({
        where: { ...scope, ...importacion },
      })
    )
      await tx.inboxImportacion.updateMany({
        where: { ...scope, ...importacion },
        data: { necesitaRevision: true },
      });
    return true;
  }
  if (op.clase === 'progreso') {
    const key = { ...importacion, fase: op.fase, orden: op.orden };
    const creado = await tx.inboxBloqueHistorial.createMany({
      data: [{ ...scope, ...key, progreso: op.progreso }],
      skipDuplicates: true,
    });
    const aumentado = await tx.inboxBloqueHistorial.updateMany({
      where: { ...scope, ...key, progreso: { lt: op.progreso } },
      data: { progreso: op.progreso },
    });
    await tx.inboxImportacion.updateMany({
      where: {
        ...scope,
        ...importacion,
        progresoInformado: { lt: op.progreso },
      },
      data: { progresoInformado: op.progreso },
    });
    if (op.progreso === 100)
      await tx.inboxImportacion.updateMany({
        where: { ...scope, ...importacion, finInformadoEl: null },
        data: { finInformadoEl: new Date() },
      });
    await tx.inboxImportacion.updateMany({
      where: { ...scope, ...importacion, historialRechazado: true },
      data: { necesitaRevision: true },
    });
    // 100 significa que Meta informó fin. No supone que no falten bloques ni
    // que todos los eventos locales estén procesados.
    return creado.count + aumentado.count > 0;
  }
  if (op.clase === 'cuenta') return false; // Ciclo de vida coordinado por el procesador.

  let envioConfirmado = false;
  if (op.clase === 'estado' && op.destinatario) {
    const envio = await tx.inboxEnvio.findFirst({
      where: {
        ...scope,
        autorizacionId: canal.autorizacionId,
        OR: [
          ...(op.correlacion ? [{ id: op.correlacion }] : []),
          { wamid: op.wamid },
        ],
      },
      include: { conversacion: true },
    });
    if (
      envio &&
      envio.conversacion.contactoWaId === op.destinatario &&
      op.fecha.getTime() >=
        Math.floor(envio.createdAt.getTime() / 1000) * 1000 &&
      (!envio.wamid || envio.wamid === op.wamid)
    ) {
      envioConfirmado = await confirmarEnvioInbox(tx, canal, envio, op.wamid);
    }
  }

  const anterior = await tx.inboxMensaje.findFirst({
    where: { ...scope, wamid: op.wamid },
  });
  const data: Prisma.InboxMensajeUncheckedUpdateInput = {};
  let conversacionId = anterior?.conversacionId ?? null;
  if (op.clase === 'mensaje') {
    const conversacion = await tx.inboxConversacion.upsert({
      where: {
        vinculoId_contactoWaId: {
          vinculoId: canal.id,
          contactoWaId: op.contacto,
        },
      },
      create: { ...scope, contactoWaId: op.contacto },
      update: {},
    });
    if (
      anterior?.conversacionId &&
      (anterior.conversacionId !== conversacion.id ||
        anterior.direccion !== op.direccion)
    )
      throw new Error('INBOX_IDENTIDAD_CONFLICTIVA');
    conversacionId = conversacion.id;
    if (!anterior?.conversacionId) {
      data.conversacionId = conversacionId;
      data.direccion = op.direccion;
    }
    if (!anterior?.enviadoEl || op.fecha < anterior.enviadoEl)
      data.enviadoEl = op.fecha;
    if (op.origen === 'HISTORIAL' && !anterior?.delHistorial)
      data.delHistorial = true;
    if (op.origen === 'CELULAR' && !anterior?.delCelular)
      data.delCelular = true;
    if (op.origen === 'NUEVO' && !anterior?.entranteNuevo)
      data.entranteNuevo = true;
    await tx.inboxConversacion.updateMany({
      where: {
        id: conversacionId,
        ...scope,
        OR: [{ ultimoMensajeEl: null }, { ultimoMensajeEl: { lt: op.fecha } }],
      },
      data: { ultimoMensajeEl: op.fecha },
    });
    if (
      op.origen === 'NUEVO' &&
      !anterior?.entranteNuevo &&
      op.direccion === 'ENTRANTE' &&
      canal.recepcionDesdeEl &&
      op.fecha >= canal.recepcionDesdeEl &&
      op.fecha.getTime() <= Date.now()
    ) {
      await tx.inboxConversacion.updateMany({
        where: {
          id: conversacionId,
          ...scope,
          OR: [
            { ultimoEntranteNuevoEl: null },
            { ultimoEntranteNuevoEl: { lt: op.fecha } },
          ],
        },
        data: { ultimoEntranteNuevoEl: op.fecha },
      });
    }
  }
  if (op.clase === 'estado') {
    if (op.orden > (anterior?.estadoEntregaOrden ?? 0)) {
      data.estadoEntrega = op.estado;
      data.estadoEntregaOrden = op.orden;
      data.estadoEntregaEl = op.fecha;
    }
  } else if (op.clase === 'revocacion') {
    if (!anterior?.revocadoEl || op.fecha > anterior.revocadoEl)
      data.revocadoEl = op.fecha;
    data.contenido = Prisma.DbNull; // No resucitar texto por un historial tardío.
  } else if (!anterior?.revocadoEl) {
    const esEdicion = op.clase === 'edicion';
    const reemplazar = esEdicion
      ? !anterior?.edicionEl || op.fecha > anterior.edicionEl
      : !anterior?.edicionEl &&
        (anterior?.tipo == null || op.prioridad > anterior.prioridadContenido);
    if (reemplazar) {
      data.tipo = op.tipo;
      data.contenido = op.contenido as Prisma.InputJsonObject;
      data.prioridadContenido = op.prioridad;
      if (esEdicion) data.edicionEl = op.fecha;
    }
  }
  if (!anterior) {
    await tx.inboxMensaje.create({
      data: {
        ...scope,
        wamid: op.wamid,
        ...data,
      } as Prisma.InboxMensajeUncheckedCreateInput,
    });
    return Boolean(conversacionId);
  }
  if (!Object.keys(data).length) return envioConfirmado;
  await tx.inboxMensaje.update({
    where: { id: anterior.id, tenantId: canal.tenantId },
    data,
  });
  return Boolean(conversacionId);
}

/** Se usa tanto para la aceptación del POST como para un webhook adelantado.
 * El WAMID canónico evita duplicar un eco que haya llegado primero. */
export async function confirmarEnvioInbox(
  tx: Prisma.TransactionClient,
  canal: Contexto,
  envio: InboxEnvio,
  wamid: string,
) {
  if (envio.mensajeId || !envio.texto) return false;
  const c = await tx.inboxConversacion.findFirstOrThrow({
    where: {
      id: envio.conversacionId,
      tenantId: canal.tenantId,
      vinculoId: canal.id,
    },
  });
  await aplicarOperacionInbox(tx, canal, {
    clase: 'mensaje',
    wamid,
    contacto: c.contactoWaId,
    direccion: 'SALIENTE',
    fecha: envio.createdAt,
    origen: 'GRAFO',
    tipo: 'text',
    contenido: { texto: envio.texto },
    prioridad: 3,
  });
  const m = await tx.inboxMensaje.findFirstOrThrow({
    where: { tenantId: canal.tenantId, vinculoId: canal.id, wamid },
  });
  await tx.inboxMensaje.updateMany({
    where: { id: m.id, tenantId: canal.tenantId, estadoEntrega: null },
    data: { estadoEntrega: 'ACEPTADO' },
  });
  await tx.inboxEnvio.update({
    where: { id: envio.id, tenantId: canal.tenantId },
    data: {
      estado: 'ACEPTADO',
      wamid,
      mensajeId: m.id,
      texto: null,
      codigo: null,
    },
  });
  return true;
}
