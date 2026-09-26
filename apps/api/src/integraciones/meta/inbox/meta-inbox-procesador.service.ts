import { adjuntosHabilitados, encolarAdjunto } from './meta-adjuntos';
import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { runWithTenant } from '../../../common/tenant-context';
import { PrismaService } from '../../../prisma/prisma.service';
import { InboxTiempoRealBus } from '../../../inbox-tiempo-real/inbox-tiempo-real.bus';
import {
  registrarCambioInbox,
  type CanalInbox,
} from '../../../inbox-tiempo-real/inbox-revision';
import { normalizarEventoInbox } from './meta-inbox-normalizar';
import { aplicarOperacionInbox } from './meta-inbox-proyeccion';
import { aplicarCambioCuenta } from './meta-inbox-cuenta';

export const recepcionGeneralMetaHabilitada = () =>
  process.env.META_INBOX_RECEPCION_ENABLED === 'true';

@Injectable()
export class MetaInboxProcesador {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly bus?: InboxTiempoRealBus,
  ) {}

  /** En la MISMA transacción que conserva el webhook firmado. No se procesa
   * aquí el historial: el callback puede contener miles de mensajes. */
  async encolar(tx: Prisma.TransactionClient, dedupClaves: string[]) {
    if (!recepcionGeneralMetaHabilitada()) return;
    const filas = await tx.webhookWhatsappCrudo.findMany({
      where: { dedupClave: { in: dedupClaves } },
    });
    const canales = new Map<
      string,
      Awaited<ReturnType<typeof tx.metaVinculo.findFirst>>
    >();
    for (const fila of filas) {
      if (!fila.wabaId) continue;
      const control = fila.tipo === 'account_update';
      const clave = `${fila.wabaId}:${fila.phoneNumberId ?? ''}:${control}`;
      if (!canales.has(clave))
        canales.set(
          clave,
          await tx.metaVinculo.findFirst({
            where: {
              wabaId: fila.wabaId,
              ...(fila.phoneNumberId
                ? { phoneNumberId: fila.phoneNumberId }
                : {}),
              ...(!control
                ? {
                    estado: {
                      in: ['VERIFICADO' as const, 'SUSPENDIDO' as const],
                    },
                    recepcionDesdeEl: { not: null },
                  }
                : {}),
            },
          }),
        );
      const canal = canales.get(clave);
      if (
        !canal ||
        (!control && !canal.recepcionDesdeEl) ||
        fila.recibidoEl < (canal.recepcionDesdeEl ?? canal.verificadoEl) ||
        (fila.tenantId && fila.tenantId !== canal.tenantId) ||
        (!fila.phoneNumberId && fila.tipo !== 'account_update')
      )
        continue;
      await tx.webhookWhatsappCrudo.updateMany({
        where: { id: fila.id, tenantId: null },
        data: { tenantId: canal.tenantId },
      });
      await tx.inboxTrabajoEvento.createMany({
        data: [
          {
            tenantId: canal.tenantId,
            vinculoId: canal.id,
            autorizacionId: canal.autorizacionId,
            crudoId: fila.id,
            prioridad: fila.tipo === 'account_update' ? 10 : 0,
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  /** Un lote breve y reanudable. PostgreSQL es la cola duradera; SKIP LOCKED
   * permite varias réplicas. Redis sólo acelera los avisos de actualización. */
  async procesarSiguiente(): Promise<boolean> {
    if (!recepcionGeneralMetaHabilitada()) return false;
    const candidatos = await this.prisma.inboxTrabajoEvento.findMany({
      where: { estado: 'PENDIENTE', proximoIntentoEl: { lte: new Date() } },
      orderBy: [
        { prioridad: 'desc' },
        { proximoIntentoEl: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      take: 10,
      select: { id: true, tenantId: true, vinculoId: true },
    });
    for (const candidato of candidatos) {
      let aviso: CanalInbox | undefined;
      let cursorIntentado: number | undefined;
      try {
        const procesado = await runWithTenant(candidato.tenantId, () =>
          this.prisma.$transaction(
            async (tx) => {
              const vinculos = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "MetaVinculo" WHERE id = ${candidato.vinculoId}::uuid
            AND "tenantId" = ${candidato.tenantId}::uuid FOR NO KEY UPDATE SKIP LOCKED`;
              if (!vinculos.length) return false;
              const trabajos = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "InboxTrabajoEvento" WHERE id = ${candidato.id}::uuid
            AND "tenantId" = ${candidato.tenantId}::uuid AND estado = 'PENDIENTE'
            FOR UPDATE SKIP LOCKED`;
              if (!trabajos.length) return false;
              const trabajo = await tx.inboxTrabajoEvento.findFirstOrThrow({
                where: { id: candidato.id, tenantId: candidato.tenantId },
                include: { crudo: true },
              });
              if (trabajo.proximoIntentoEl > new Date()) return false;
              cursorIntentado = trabajo.cursor;
              const canal = await tx.metaVinculo.findFirstOrThrow({
                where: { id: trabajo.vinculoId, tenantId: trabajo.tenantId },
              });
              const raw = trabajo.crudo;
              if (
                (raw.tipo !== 'account_update' &&
                  (canal.estado === 'DESCONECTADO' ||
                    !canal.recepcionDesdeEl)) ||
                canal.autorizacionId !== trabajo.autorizacionId ||
                raw.tenantId !== canal.tenantId ||
                raw.wabaId !== canal.wabaId ||
                (raw.phoneNumberId !== canal.phoneNumberId &&
                  !(raw.tipo === 'account_update' && !raw.phoneNumberId))
              ) {
                await tx.inboxTrabajoEvento.update({
                  where: { id: trabajo.id, tenantId: canal.tenantId },
                  data: { estado: 'PAUSADO', ultimoError: 'CANAL_NO_VIGENTE' },
                });
                return true;
              }
              if (
                canal.estado === 'SUSPENDIDO' &&
                raw.tipo !== 'account_update'
              ) {
                await tx.inboxTrabajoEvento.update({
                  where: { id: trabajo.id, tenantId: canal.tenantId },
                  data: {
                    proximoIntentoEl: new Date(Date.now() + 30_000),
                    ultimoError: 'CUENTA_SUSPENDIDA',
                  },
                });
                return true;
              }
              const normalizado = normalizarEventoInbox(raw, canal.numero);
              const importacion = {
                vinculoId: canal.id,
                autorizacionId: trabajo.autorizacionId,
              };
              await tx.inboxImportacion.upsert({
                where: { vinculoId_autorizacionId: importacion },
                create: {
                  ...importacion,
                  tenantId: canal.tenantId,
                  iniciadaEl: canal.recepcionDesdeEl ?? canal.verificadoEl,
                },
                update: {},
              });
              let cambioVisible = false;
              const lote = normalizado.operaciones.slice(
                trabajo.cursor,
                trabajo.cursor + 50,
              );
              for (const op of lote) {
                if (op.clase === 'cuenta') {
                  cambioVisible =
                    (await aplicarCambioCuenta(tx, canal, op)) || cambioVisible;
                } else
                  cambioVisible =
                    (await aplicarOperacionInbox(tx, canal, op)) ||
                    cambioVisible;
              }
              if (adjuntosHabilitados())
                for (const op of lote) {
                  if ('wamid' in op && op.clase !== 'estado')
                    await encolarAdjunto(tx, canal, op.wamid);
                }
              const cursor = trabajo.cursor + lote.length;
              const terminado = cursor >= normalizado.operaciones.length;
              const estado = terminado
                ? normalizado.avisos
                  ? 'REVISION'
                  : 'COMPLETADO'
                : 'PENDIENTE';
              await tx.inboxTrabajoEvento.update({
                where: { id: trabajo.id, tenantId: canal.tenantId },
                data: {
                  cursor,
                  total: normalizado.operaciones.length,
                  avisos: normalizado.avisos,
                  estado,
                  proximoIntentoEl: new Date(),
                  ultimoError: normalizado.avisos
                    ? 'FORMATO_REQUIERE_REVISION'
                    : null,
                },
              });
              await tx.inboxImportacion.updateMany({
                where: { ...importacion, tenantId: canal.tenantId },
                data: {
                  ultimoEventoEl: new Date(),
                  ...(normalizado.avisos ? { necesitaRevision: true } : {}),
                },
              });
              if (estado === 'COMPLETADO')
                await tx.webhookWhatsappCrudo.updateMany({
                  where: { id: raw.id, tenantId: canal.tenantId },
                  data: { procesado: true },
                });
              if (cambioVisible || terminado) {
                aviso = {
                  tenantId: canal.tenantId,
                  wabaId: canal.wabaId,
                  phoneNumberId: canal.phoneNumberId,
                };
                await registrarCambioInbox(tx, aviso);
              }
              return true;
            },
            { timeout: 20_000 },
          ),
        );
        if (procesado) {
          if (aviso) this.bus?.avisar(aviso);
          return true;
        }
      } catch (error) {
        if (cursorIntentado === undefined) throw error;
        // Rollback incluye mensajes, cursor y revisión. No repetir para siempre
        // eventos conflictivos; los errores sólo conservan un código nuestro.
        await runWithTenant(candidato.tenantId, () =>
          this.prisma.$transaction(async (tx) => {
            const fila = await tx.inboxTrabajoEvento.findFirst({
              where: {
                id: candidato.id,
                tenantId: candidato.tenantId,
                estado: 'PENDIENTE',
                cursor: cursorIntentado,
              },
            });
            if (!fila) return;
            const identidad =
              error instanceof Error &&
              error.message === 'INBOX_IDENTIDAD_CONFLICTIVA';
            const intentos = fila.intentos + 1;
            const cambiado = await tx.inboxTrabajoEvento.updateMany({
              where: {
                id: fila.id,
                tenantId: fila.tenantId,
                estado: 'PENDIENTE',
                cursor: fila.cursor,
                intentos: fila.intentos,
              },
              data: {
                intentos,
                estado: identidad || intentos >= 6 ? 'REVISION' : 'PENDIENTE',
                ultimoError: identidad
                  ? 'IDENTIDAD_CONFLICTIVA'
                  : 'PROCESAMIENTO_INTERRUMPIDO',
                proximoIntentoEl: new Date(
                  Date.now() + Math.min(300_000, 5000 * 2 ** (intentos - 1)),
                ),
              },
            });
            if (cambiado.count && (identidad || intentos >= 6))
              await tx.inboxImportacion.updateMany({
                where: {
                  tenantId: fila.tenantId,
                  vinculoId: fila.vinculoId,
                  autorizacionId: fila.autorizacionId,
                },
                data: { necesitaRevision: true },
              });
          }),
        );
        return true;
      }
    }
    return false;
  }
}
