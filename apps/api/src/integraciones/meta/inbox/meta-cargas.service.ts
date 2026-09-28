import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CurrentAuth } from '../../../auth/auth.types';
import { PrismaService } from '../../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../../suscripciones/capacidades-empresa.service';
import {
  bloquearAlmacenamiento,
  exigirEspacio,
} from '../../../archivos/cupo-almacenamiento';
import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../../../archivos/storage/storage.driver';
import { exigirAccesoInbox } from '../meta-conexion-acceso';
import { canalGeneralInbox, identidadCanalInbox } from '../meta-inbox-canal';
import { destinatarioCanalPermitido } from '../meta-prueba.config';
import {
  consultarVentanaRespuesta,
  enviosInboxHabilitados,
} from './meta-envios.config';
import { adjuntosHabilitados } from './meta-adjuntos';
import { nombreMedia } from './meta-media.client';
import { formatoArchivoInbox } from '../../../common/inbox/medios';
import type { IniciarCargaInboxDto } from './meta-envios.dto';
import { prepararMedioInbox } from './meta-medios-formato';
@Injectable()
export class MetaCargasService {
  private ocupado = false;
  constructor(
    private readonly db: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}
  private async acceso(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    canalId: string,
  ) {
    await exigirAccesoInbox(this.db, auth, ip);
    const v = await canalGeneralInbox(this.db, auth.tenantId);
    if (
      !v ||
      !enviosInboxHabilitados(auth.tenantId, v.tipo) ||
      !adjuntosHabilitados()
    )
      throw new ForbiddenException();
    if (identidadCanalInbox(v) !== canalId)
      throw new ConflictException('La conexión cambió. Actualizá el Inbox.');
    await this.capacidades.exigirIncluida(auth.tenantId, 'whatsapp_automatico');
    const c = await this.db.inboxConversacion.findFirst({
      where: { id: conversacionId, tenantId: auth.tenantId, vinculoId: v.id },
    });
    if (!c || !destinatarioCanalPermitido(v, c.contactoWaId))
      throw new NotFoundException();
    return { v, c };
  }
  async iniciar(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    dto: IniciarCargaInboxDto,
  ) {
    const { v, c } = await this.acceso(auth, ip, conversacionId, dto.canalId);
    if (!(await consultarVentanaRespuesta(this.db, v, c)).abierta)
      throw new ConflictException('La ventana de atención está cerrada.');
    const formato = dto.voz
      ? { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a' }[
          dto.mimeType
        ]
        ? {
            mime: dto.mimeType,
            ext: {
              'audio/webm': 'webm',
              'audio/ogg': 'ogg',
              'audio/mp4': 'm4a',
            }[dto.mimeType]!,
            max: 16_000_000,
          }
        : null
      : formatoArchivoInbox(dto.nombre, dto.mimeType);
    if (
      !formato ||
      !Number.isSafeInteger(dto.bytes) ||
      dto.bytes < 1 ||
      dto.bytes > formato.max
    )
      throw new BadRequestException(
        'Formato o tamaño no admitido por WhatsApp.',
      );
    const id = randomUUID(),
      key = `t/${auth.tenantId}/INBOX/cargas/${id}.${formato.ext}`;
    await this.db.$transaction(async (tx) => {
      await bloquearAlmacenamiento(tx, auth.tenantId);
      await exigirAccesoInbox(tx, auth, ip);
      await this.capacidades.exigirOperacionTx(tx, auth.tenantId, [
        'whatsapp_automatico',
      ]);
      if (
        (await tx.inboxCarga.count({
          where: {
            tenantId: auth.tenantId,
            usuarioId: auth.userId,
            createdAt: { gt: new Date(Date.now() - 60000) },
          },
        })) >= 10
      )
        throw new ConflictException(
          'Esperá un momento antes de subir más archivos.',
        );
      await exigirEspacio(tx, auth.tenantId, BigInt(dto.bytes));
      await tx.archivo.create({
        data: {
          id,
          tenantId: auth.tenantId,
          scope: 'INBOX',
          key,
          nombreOriginal: nombreMedia(dto.nombre, formato.ext),
          mimeType: formato.mime,
          bytesReservados: BigInt(dto.bytes),
          reservaHasta: new Date(Date.now() + 30 * 60000),
          subidoPorId: auth.userId,
        },
      });
      await tx.inboxCarga.create({
        data: {
          archivoId: id,
          tenantId: auth.tenantId,
          vinculoId: v.id,
          autorizacionId: v.autorizacionId,
          conversacionId,
          usuarioId: auth.userId,
          voz: dto.voz ?? false,
        },
      });
    });
    // El cron común limpia cargas abandonadas y PUT tardíos. Nunca hacemos público el objeto.
    const subida = await this.storage.firmarSubida(key, {
      contentType: formato.mime,
      expiraSegundos: 600,
    });
    await this.acceso(auth, ip, conversacionId, dto.canalId);
    return { archivoId: id, subida };
  }
  async validar(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    canalId: string,
    archivoId: string,
    envioId?: string,
  ) {
    const { v } = await this.acceso(auth, ip, conversacionId, canalId);
    const f = await this.db.inboxCarga.findFirst({
      where: {
        archivoId,
        tenantId: auth.tenantId,
        vinculoId: v.id,
        autorizacionId: v.autorizacionId,
        conversacionId,
        usuarioId: auth.userId,
      },
      include: { archivo: true },
    });
    if (
      !f ||
      f.archivo.tenantId !== auth.tenantId ||
      f.archivo.scope !== 'INBOX' ||
      f.archivo.estado !== 'PENDIENTE' ||
      !f.archivo.reservaHasta ||
      f.archivo.reservaHasta <= new Date() ||
      (f.envioId && f.envioId !== envioId)
    )
      throw new ConflictException(
        'La carga venció, fue cancelada o ya se utilizó. Volvé a elegir el archivo.',
      );
    return f;
  }
  async conContenido<T>(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    canalId: string,
    archivoId: string,
    envioId: string,
    accion: (medio: {
      bytes: Buffer;
      mime: string;
      nombre: string;
      voz: boolean;
    }) => Promise<T>,
  ) {
    if (this.ocupado)
      throw new ConflictException(
        'Hay otro archivo preparándose. Intentá nuevamente en un momento.',
      );
    this.ocupado = true;
    try {
      const f = await this.validar(
          auth,
          ip,
          conversacionId,
          canalId,
          archivoId,
          envioId,
        ),
        a = f.archivo;
      const meta = await this.storage.cabecera(a.key);
      if (
        !meta ||
        meta.bytes !== Number(a.bytesReservados) ||
        meta.contentType?.split(';')[0] !== a.mimeType
      )
        throw new BadRequestException('La carga está incompleta o cambió.');
      const bytes = await this.storage.leerCabecera(
        a.key,
        Number(a.bytesReservados) + 1,
      );
      if (!bytes || bytes.length !== Number(a.bytesReservados))
        throw new BadRequestException('La carga está incompleta.');
      const medio = await prepararMedioInbox(bytes, a.mimeType, f.voz);
      await this.validar(auth, ip, conversacionId, canalId, archivoId, envioId);
      return await accion({
        ...medio,
        nombre: f.voz ? 'Nota-de-voz.ogg' : a.nombreOriginal,
        voz: f.voz,
      });
    } finally {
      this.ocupado = false;
    }
  }
  async cancelar(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    canalId: string,
    archivoId: string,
  ) {
    await this.acceso(auth, ip, conversacionId, canalId);
    await this.db.$transaction(async (tx) => {
      await bloquearAlmacenamiento(tx, auth.tenantId);
      const carga = await tx.inboxCarga.findFirst({
        where: {
          archivoId,
          tenantId: auth.tenantId,
          conversacionId,
          usuarioId: auth.userId,
          envioId: null,
        },
      });
      if (!carga) return; // Nunca cancelar un envío en curso o incierto.
      await tx.archivo.updateMany({
        where: { id: archivoId, tenantId: auth.tenantId, estado: 'PENDIENTE' },
        data: {
          estado: 'PURGANDO',
          bytesReservados: 0n,
          reservaHasta: new Date(Date.now() + 86400000),
        },
      });
    });
    return { ok: true };
  }
}
