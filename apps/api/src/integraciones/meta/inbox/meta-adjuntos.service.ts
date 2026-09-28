import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type InboxAdjunto } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { runWithTenant } from '../../../common/tenant-context';
import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../../../archivos/storage/storage.driver';
import {
  bloquearAlmacenamiento,
  exigirEspacio,
} from '../../../archivos/cupo-almacenamiento';
import {
  SecretosService,
  type SecretoCifrado,
} from '../../cripto/secretos.service';
import { CapacidadesEmpresaService } from '../../../suscripciones/capacidades-empresa.service';
import { InboxTiempoRealBus } from '../../../inbox-tiempo-real/inbox-tiempo-real.bus';
import { registrarCambioInbox } from '../../../inbox-tiempo-real/inbox-revision';
import type { CurrentAuth } from '../../../auth/auth.types';
import { exigirAccesoInbox } from '../meta-conexion-acceso';
import { canalGeneralInbox, identidadCanalInbox } from '../meta-inbox-canal';
import {
  configuracionMetaConexion,
  modoAltaPermitido,
} from '../meta-conexion.config';
import {
  canalPruebaPermitido,
  configuracionCanalPrueba,
} from '../meta-prueba.config';
import { objeto } from './meta-inbox-normalizar';
import {
  adjuntosHabilitados,
  encolarAdjunto,
  tiposMedia,
} from './meta-adjuntos';
import {
  ErrorMediaMeta,
  MetaMediaClient,
  nombreMedia,
} from './meta-media.client';

const canalAviso = (v: {
  tenantId: string;
  wabaId: string;
  phoneNumberId: string;
}) => ({
  tenantId: v.tenantId,
  wabaId: v.wabaId,
  phoneNumberId: v.phoneNumberId,
});
@Injectable()
export class MetaAdjuntosService {
  private ocupado = false;
  constructor(
    private readonly db: PrismaService,
    private readonly secretos: SecretosService,
    private readonly client: MetaMediaClient,
    private readonly capacidades: CapacidadesEmpresaService,
    private readonly bus: InboxTiempoRealBus,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  private async retirar(tx: Prisma.TransactionClient, j: InboxAdjunto) {
    if (!j.archivoId) return;
    const f = await tx.archivo.findFirst({
      where: { id: j.archivoId, tenantId: j.tenantId, scope: 'INBOX' },
    });
    await tx.inboxAdjunto.update({
      where: { id: j.id },
      data: { archivoId: null },
    });
    if (!f || !['LISTO', 'PENDIENTE'].includes(f.estado)) return;
    await tx.archivo.update({
      where: { id: f.id },
      data: {
        estado: 'ELIMINADO',
        eliminadoEl: new Date(),
        bytesReservados: 0n,
        reservaHasta: null,
      },
    });
    if (f.estado === 'LISTO')
      await tx.tenant.update({
        where: { id: j.tenantId },
        data: { bytesArchivos: { decrement: f.bytes } },
      });
  }
  private async bloquear(
    tx: Prisma.TransactionClient,
    j: Pick<InboxAdjunto, 'id' | 'tenantId' | 'vinculoId'>,
  ) {
    await bloquearAlmacenamiento(tx, j.tenantId);
    await tx.$queryRaw`SELECT id FROM "MetaVinculo" WHERE id=${j.vinculoId}::uuid AND "tenantId"=${j.tenantId}::uuid FOR NO KEY UPDATE`;
    await tx.$queryRaw`SELECT id FROM "InboxAdjunto" WHERE id=${j.id}::uuid AND "tenantId"=${j.tenantId}::uuid FOR UPDATE`;
  }
  private async vigente(tx: Prisma.TransactionClient, j: InboxAdjunto) {
    const m = await tx.inboxMensaje.findFirstOrThrow({
      where: { id: j.mensajeId, tenantId: j.tenantId, vinculoId: j.vinculoId },
    });
    const v = await tx.metaVinculo.findFirstOrThrow({
      where: { id: j.vinculoId, tenantId: j.tenantId },
    });
    if (
      v.tipo === 'PRUEBA' &&
      (!m.conversacionId ||
        !(await tx.inboxConversacion.findFirst({
          where: {
            id: m.conversacionId,
            tenantId: v.tenantId,
            vinculoId: v.id,
            contactoWaId: v.pruebaDestinatarioWaId!,
          },
          select: { id: true },
        })))
    )
      throw new ErrorMediaMeta('NO_DISPONIBLE');
    const c = objeto(m.contenido);
    if (
      !adjuntosHabilitados() ||
      (v.tipo === 'PRUEBA'
        ? !canalPruebaPermitido(v)
        : v.tipo !== 'COEXISTENCIA' ||
          modoAltaPermitido(j.tenantId) !== 'COEXISTENCIA') ||
      v.estado !== 'VERIFICADO' ||
      !v.recepcionDesdeEl ||
      !v.tokenCifrado ||
      v.autorizacionId !== j.autorizacionId ||
      [v.tokenVenceEl, v.accesoDatosVenceEl].some(
        (d) => d && d <= new Date(),
      ) ||
      m.revocadoEl ||
      c.mediaId !== j.mediaId ||
      !tiposMedia.includes(m.tipo ?? '')
    )
      throw new ErrorMediaMeta('NO_DISPONIBLE');
    await this.capacidades.exigirOperacionTx(tx, j.tenantId, [
      'whatsapp_automatico',
    ]);
    return { v, m, c };
  }
  /** Una transferencia a la vez por proceso; la reserva y lease evitan duplicados entre réplicas. */
  async procesarSiguiente(): Promise<boolean> {
    if (this.ocupado || !adjuntosHabilitados() || !this.secretos.disponible)
      return false;
    const prueba = configuracionCanalPrueba();
    const config =
      configuracionMetaConexion() ??
      (prueba && process.env.META_APP_SECRET
        ? {
            appSecret: process.env.META_APP_SECRET,
            graphVersion: process.env.META_GRAPH_API_VERSION ?? 'v26.0',
          }
        : null);
    if (!config) return false;
    const tenants = (process.env.META_CONEXION_TENANT_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(
        (s) =>
          /^[a-f\d-]{36}$/i.test(s) && modoAltaPermitido(s) === 'COEXISTENCIA',
      );
    if (prueba) tenants.push(prueba.tenantId);
    if (!tenants.length) return false;
    this.ocupado = true;
    try {
      // Recupera también mensajes que llegaron antes de habilitar la descarga.
      const faltantes = await this.db.inboxMensaje.findMany({
        where: {
          tenantId: { in: tenants },
          tipo: { in: tiposMedia },
          revocadoEl: null,
          contenido: { path: ['mediaId'], not: Prisma.AnyNull },
          adjunto: null,
          vinculo: { estado: 'VERIFICADO' },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { vinculo: true },
      });
      for (const m of faltantes)
        await runWithTenant(m.tenantId, () =>
          this.db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "MetaVinculo" WHERE id=${m.vinculoId}::uuid FOR NO KEY UPDATE`;
            await encolarAdjunto(tx, m.vinculo, m.wamid);
          }),
        );
      const candidatos = await this.db.inboxAdjunto.findMany({
        where: {
          tenantId: { in: tenants },
          proximoIntentoEl: { lte: new Date() },
          OR: [
            { estado: 'PENDIENTE' },
            { estado: 'DESCARGANDO', bloqueoHasta: { lt: new Date() } },
          ],
        },
        orderBy: { proximoIntentoEl: 'asc' },
        take: 10,
      });
      for (const candidato of candidatos) {
        const reclamo = await runWithTenant(candidato.tenantId, () =>
          this.db.$transaction(async (tx) => {
            await this.bloquear(tx, candidato);
            const j = await tx.inboxAdjunto.findFirstOrThrow({
              where: { id: candidato.id, tenantId: candidato.tenantId },
            });
            if (
              j.proximoIntentoEl > new Date() ||
              !['PENDIENTE', 'DESCARGANDO'].includes(j.estado) ||
              (j.estado === 'DESCARGANDO' &&
                j.bloqueoHasta &&
                j.bloqueoHasta > new Date())
            )
              return null;
            // Pausa por cambio de dispositivo: no gastar intentos ni borrar el archivo.
            const canal = await tx.metaVinculo.findFirstOrThrow({
              where: { id: j.vinculoId, tenantId: j.tenantId },
            });
            if (canal.estado === 'SUSPENDIDO') {
              await tx.inboxAdjunto.update({
                where: { id: j.id },
                data: {
                  estado: 'PENDIENTE',
                  bloqueoId: null,
                  bloqueoHasta: null,
                  proximoIntentoEl: new Date(Date.now() + 30000),
                },
              });
              return null;
            }
            let source: Awaited<ReturnType<MetaAdjuntosService['vigente']>>;
            try {
              source = await this.vigente(tx, j);
            } catch {
              await this.retirar(tx, j);
              await tx.inboxAdjunto.update({
                where: { id: j.id },
                data: {
                  estado: 'RETIRADO',
                  bloqueoId: null,
                  bloqueoHasta: null,
                  falloCodigo: 'ACCESO_NO_VIGENTE',
                },
              });
              await registrarCambioInbox(tx, canalAviso(canal));
              return null;
            }
            await this.retirar(tx, j);
            if (j.intentos >= 4) {
              await tx.inboxAdjunto.update({
                where: { id: j.id },
                data: {
                  estado: 'REVISION',
                  bloqueoId: null,
                  bloqueoHasta: null,
                  falloCodigo: 'INTENTOS_AGOTADOS',
                },
              });
              await registrarCambioInbox(tx, canalAviso(canal));
              return null;
            }
            const trabajo = await tx.inboxAdjunto.update({
              where: { id: j.id },
              data: {
                estado: 'DESCARGANDO',
                bloqueoId: randomUUID(),
                bloqueoHasta: new Date(Date.now() + 180000),
                intentos: { increment: 1 },
                falloCodigo: null,
              },
            });
            return { trabajo, ...source };
          }),
        );
        if (!reclamo) continue;
        const { trabajo: j, m, c, v } = reclamo;
        let archivoId: string | undefined;
        try {
          const token = this.secretos.descifrar(
            v.tokenCifrado as SecretoCifrado,
          );
          const meta = await this.client.metadata({
            mediaId: j.mediaId,
            phoneNumberId: v.phoneNumberId,
            token,
            appSecret: config.appSecret,
            version: config.graphVersion,
            tipo: m.tipo!,
            sha256: c.sha256,
          });
          archivoId = randomUUID();
          const key = `t/${j.tenantId}/INBOX/${m.id}/${archivoId}.${meta.ext}`;
          const nombre = nombreMedia(c.nombreArchivo, meta.ext);
          await runWithTenant(j.tenantId, () =>
            this.db.$transaction(async (tx) => {
              await this.bloquear(tx, j);
              const actual = await tx.inboxAdjunto.findFirstOrThrow({
                where: { id: j.id, tenantId: j.tenantId },
              });
              if (
                actual.bloqueoId !== j.bloqueoId ||
                !actual.bloqueoHasta ||
                actual.bloqueoHasta <= new Date()
              )
                throw new ErrorMediaMeta('NO_DISPONIBLE');
              await this.vigente(tx, actual);
              await exigirEspacio(tx, j.tenantId, BigInt(meta.bytes));
              await tx.archivo.create({
                data: {
                  id: archivoId,
                  tenantId: j.tenantId,
                  scope: 'INBOX',
                  generado: true,
                  key,
                  nombreOriginal: nombre,
                  mimeType: meta.mime,
                  bytes: BigInt(meta.bytes),
                  bytesReservados: BigInt(meta.bytes),
                  reservaHasta: new Date(Date.now() + 180000),
                  hash: meta.hash,
                },
              });
              await tx.inboxAdjunto.update({
                where: { id: j.id },
                data: { archivoId },
              });
            }),
          );
          const bytes = await this.client.descargar(meta, token);
          await this.storage.subir(key, bytes, meta.mime);
          await runWithTenant(j.tenantId, () =>
            this.db.$transaction(async (tx) => {
              await this.bloquear(tx, j);
              const actual = await tx.inboxAdjunto.findFirstOrThrow({
                where: { id: j.id, tenantId: j.tenantId },
              });
              if (
                actual.bloqueoId !== j.bloqueoId ||
                actual.archivoId !== archivoId ||
                !actual.bloqueoHasta ||
                actual.bloqueoHasta <= new Date()
              )
                throw new ErrorMediaMeta('NO_DISPONIBLE');
              await this.vigente(tx, actual);
              const f = await tx.archivo.findFirstOrThrow({
                where: {
                  id: archivoId,
                  tenantId: j.tenantId,
                  estado: 'PENDIENTE',
                },
              });
              if (!f.reservaHasta || f.reservaHasta <= new Date())
                throw new ErrorMediaMeta('NO_DISPONIBLE');
              await exigirEspacio(tx, j.tenantId, f.bytes, f.id);
              await tx.archivo.update({
                where: { id: f.id },
                data: {
                  estado: 'LISTO',
                  bytesReservados: 0n,
                  reservaHasta: null,
                },
              });
              await tx.tenant.update({
                where: { id: j.tenantId },
                data: { bytesArchivos: { increment: f.bytes } },
              });
              await tx.inboxAdjunto.update({
                where: { id: j.id },
                data: {
                  estado: 'LISTO',
                  bloqueoId: null,
                  bloqueoHasta: null,
                  falloCodigo: null,
                },
              });
              await registrarCambioInbox(tx, canalAviso(v));
            }),
          );
        } catch (e) {
          const codigo =
            e instanceof ErrorMediaMeta
              ? e.codigo
              : e instanceof ForbiddenException
                ? 'CUPO_O_PLAN'
                : 'TEMPORAL';
          await runWithTenant(j.tenantId, () =>
            this.db.$transaction(async (tx) => {
              await this.bloquear(tx, j);
              const actual = await tx.inboxAdjunto.findFirstOrThrow({
                where: { id: j.id, tenantId: j.tenantId },
              });
              if (actual.bloqueoId !== j.bloqueoId) return;
              await this.retirar(tx, actual);
              await tx.inboxAdjunto.update({
                where: { id: j.id },
                data: {
                  estado:
                    codigo === 'NO_DISPONIBLE'
                      ? 'NO_DISPONIBLE'
                      : codigo === 'TEMPORAL' && j.intentos < 4
                        ? 'PENDIENTE'
                        : 'REVISION',
                  proximoIntentoEl: new Date(
                    Date.now() + 30000 * 2 ** j.intentos,
                  ),
                  falloCodigo: codigo,
                  bloqueoId: null,
                  bloqueoHasta: null,
                },
              });
              await registrarCambioInbox(tx, canalAviso(v));
            }),
          );
        }
        this.bus.avisar(canalAviso(v));
        return true;
      }
      return false;
    } finally {
      this.ocupado = false;
    }
  }

  async abrir(auth: CurrentAuth, ip: string, mensajeId: string) {
    if (!adjuntosHabilitados()) throw new NotFoundException();
    await exigirAccesoInbox(this.db, auth, ip);
    await this.capacidades.exigirIncluida(auth.tenantId, 'whatsapp_automatico');
    const canal = await canalGeneralInbox(this.db, auth.tenantId);
    if (!canal) throw new ForbiddenException();
    const leer = () =>
      this.db.inboxMensaje.findFirst({
        where: {
          id: mensajeId,
          tenantId: auth.tenantId,
          vinculoId: canal.id,
          revocadoEl: null,
        },
        include: { adjunto: { include: { archivo: true } } },
      });
    const m = await leer(),
      j = m?.adjunto,
      f = j?.archivo;
    if (
      !m ||
      !j ||
      j.estado !== 'LISTO' ||
      j.mediaId !== objeto(m.contenido).mediaId ||
      !f ||
      f.tenantId !== auth.tenantId ||
      f.scope !== 'INBOX' ||
      f.publico ||
      !f.generado ||
      f.estado !== 'LISTO'
    )
      throw new NotFoundException('El archivo todavía no está disponible.');
    // La descarga se conserva. Sólo el PDF validado recibe además un enlace
    // inline para el visor del navegador; otros documentos nunca se incrustan.
    const inline = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'audio/aac',
      'audio/amr',
      'audio/mpeg',
      'audio/mp4',
      'audio/ogg',
      'video/mp4',
      'video/3gpp',
    ].includes(f.mimeType);
    const url = await this.storage.firmarDescarga(f.key, {
      disposition: `${inline ? 'inline' : 'attachment'}; filename="adjunto"; filename*=UTF-8''${encodeURIComponent(f.nombreOriginal).replace(/'/g, '%27')}`,
      contentType: f.mimeType,
      expiraSegundos: 60,
    });
    const vistaPreviaUrl =
      f.mimeType === 'application/pdf'
        ? await this.storage.firmarDescarga(f.key, {
            disposition: `inline; filename="adjunto"; filename*=UTF-8''${encodeURIComponent(f.nombreOriginal).replace(/'/g, '%27')}`,
            contentType: 'application/pdf',
            expiraSegundos: 60,
          })
        : undefined;
    await exigirAccesoInbox(this.db, auth, ip);
    await this.capacidades.exigirIncluida(auth.tenantId, 'whatsapp_automatico');
    const actual = await canalGeneralInbox(this.db, auth.tenantId),
      comprobado = await leer();
    if (
      !adjuntosHabilitados() ||
      !actual ||
      identidadCanalInbox(actual) !== identidadCanalInbox(canal) ||
      comprobado?.adjunto?.archivoId !== f.id ||
      comprobado?.adjunto?.estado !== 'LISTO' ||
      comprobado?.adjunto?.archivo?.estado !== 'LISTO' ||
      comprobado?.adjunto?.archivo?.publico ||
      !comprobado?.adjunto?.archivo?.generado ||
      objeto(comprobado?.contenido).mediaId !== j.mediaId
    )
      throw new ForbiddenException();
    return {
      url,
      vistaPreviaUrl,
      nombre: f.nombreOriginal,
      mimeType: f.mimeType,
      bytes: Number(f.bytes),
      expiraEn: 60,
    };
  }
}
