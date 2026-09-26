import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { Archivo } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CurrentAuth } from '../../../auth/auth.types';
import { WhatsappContextoService } from '../../../clientes/whatsapp-contexto.service';
import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../../../archivos/storage/storage.driver';
import { CapacidadesEmpresaService } from '../../../suscripciones/capacidades-empresa.service';
import { exigirAccesoConexionMeta } from '../meta-conexion-acceso';
import { canalGeneralInbox, identidadCanalInbox } from '../meta-inbox-canal';
import { plantillasInboxHabilitadas } from './meta-envios.config';
import { adjuntosHabilitados } from './meta-adjuntos';
import { nombreMedia } from './meta-media.client';

const limites: Record<string, number> = {
  'application/pdf': 20_000_000,
  'image/png': 5_000_000,
  'image/jpeg': 5_000_000,
};
export function versionArchivoPlantilla(f: Archivo) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        f.id,
        f.tenantId,
        f.key,
        f.clienteId,
        f.mimeType,
        String(f.bytes),
        f.hash,
        f.updatedAt.toISOString(),
      ]),
    )
    .digest('hex');
}
const apto = (f: Archivo) =>
  Boolean(
    limites[f.mimeType] &&
    f.bytes > 0 &&
    f.bytes <= BigInt(limites[f.mimeType]),
  );
const nombre = (f: Archivo) =>
  nombreMedia(
    f.nombreOriginal,
    f.mimeType === 'application/pdf'
      ? 'pdf'
      : f.mimeType === 'image/png'
        ? 'png'
        : 'jpg',
  );

/** Sólo archivos privados de la ficha que coincide de forma única con el teléfono.
 * No incluye documentos internos, otras empresas ni adjuntos de otras conversaciones. */
@Injectable()
export class MetaArchivosPlantillaService {
  private ocupado = false;
  constructor(
    private readonly db: PrismaService,
    private readonly contexto: WhatsappContextoService,
    private readonly capacidades: CapacidadesEmpresaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}
  private async cliente(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    canalId: string,
  ) {
    const permisos = await exigirAccesoConexionMeta(this.db, auth, ip);
    if (
      !plantillasInboxHabilitadas(auth.tenantId) ||
      !adjuntosHabilitados() ||
      !permisos.has('crm.ver')
    )
      throw new ForbiddenException('No está disponible el envío de archivos.');
    await this.capacidades.exigirIncluida(auth.tenantId, 'whatsapp_automatico');
    const canal = await canalGeneralInbox(this.db, auth.tenantId);
    if (!canal || identidadCanalInbox(canal) !== canalId)
      throw new ConflictException('La conexión cambió. Actualizá el Inbox.');
    const c = await this.db.inboxConversacion.findFirst({
      where: {
        id: conversacionId,
        tenantId: auth.tenantId,
        vinculoId: canal.id,
      },
    });
    if (!c) throw new NotFoundException();
    const contexto = await this.contexto.contexto(
      { ...auth, permisos },
      { telefono: `+${c.contactoWaId}` },
    );
    if (contexto.estado !== 'encontrado' || !contexto.cliente?.activo)
      return null;
    return contexto.cliente;
  }
  async listar(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    canalId: string,
  ) {
    const cliente = await this.cliente(auth, ip, conversacionId, canalId);
    if (!cliente)
      return {
        cliente: null,
        archivos: [],
        motivo:
          'Para adjuntar archivos, el teléfono debe coincidir con una única ficha activa de cliente.',
      };
    const files = await this.db.archivo.findMany({
      where: {
        tenantId: auth.tenantId,
        scope: 'CLIENTE',
        clienteId: cliente.id,
        estado: 'LISTO',
        eliminadoEl: null,
        publico: false,
        generado: false,
        OR: Object.entries(limites).map(([mimeType, limite]) => ({
          mimeType,
          bytes: { gt: 0, lte: limite },
        })),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    const actual = await this.cliente(auth, ip, conversacionId, canalId);
    if (actual?.id !== cliente.id)
      throw new ConflictException('La ficha del cliente cambió.');
    return {
      cliente: { id: cliente.id, nombre: cliente.nombre },
      motivo: null,
      archivos: files.filter(apto).map((f) => ({
        id: f.id,
        version: versionArchivoPlantilla(f),
        nombre: nombre(f),
        mimeType: f.mimeType,
        bytes: Number(f.bytes),
      })),
    };
  }
  async validar(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    canalId: string,
    archivoId: string,
    version: string,
    tipo: 'image' | 'document',
  ) {
    const cliente = await this.cliente(auth, ip, conversacionId, canalId);
    if (!cliente)
      throw new ConflictException(
        'El teléfono debe corresponder a una única ficha activa de cliente.',
      );
    const f = await this.db.archivo.findFirst({
      where: {
        id: archivoId,
        tenantId: auth.tenantId,
        scope: 'CLIENTE',
        clienteId: cliente.id,
        estado: 'LISTO',
        eliminadoEl: null,
        publico: false,
        generado: false,
      },
    });
    if (!f || !apto(f) || versionArchivoPlantilla(f) !== version)
      throw new ConflictException(
        'El archivo cambió o ya no está disponible. Volvé a elegirlo.',
      );
    if ((tipo === 'document') !== (f.mimeType === 'application/pdf'))
      throw new BadRequestException(
        'Elegí un archivo del formato que pide la plantilla.',
      );
    return f;
  }
  /** Acota memoria y concurrencia. No hace pública la URL ni lee archivos completos sin límite. */
  async conContenido<T>(
    f: Archivo,
    accion: (bytes: Buffer, nombre: string) => Promise<T>,
  ) {
    if (this.ocupado)
      throw new ConflictException(
        'Hay otro archivo preparándose. Intentá nuevamente en un momento.',
      );
    this.ocupado = true;
    try {
      const meta = await this.storage.cabecera(f.key);
      if (
        !meta ||
        meta.bytes !== Number(f.bytes) ||
        (meta.contentType && meta.contentType.split(';')[0] !== f.mimeType)
      )
        throw new Error();
      const bytes = await this.storage.leerCabecera(f.key, Number(f.bytes) + 1);
      if (!bytes || bytes.length !== Number(f.bytes)) throw new Error();
      if (f.hash && createHash('sha256').update(bytes).digest('hex') !== f.hash)
        throw new Error();
      if (f.mimeType === 'application/pdf') {
        if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error();
      } else {
        const image = await sharp(bytes, {
          limitInputPixels: 40_000_000,
        }).metadata();
        if (
          !['srgb', 'rgb'].includes(image.space ?? '') ||
          image.depth !== 'uchar' ||
          (f.mimeType === 'image/png'
            ? image.format !== 'png'
            : image.format !== 'jpeg')
        )
          throw new Error();
      }
      return await accion(bytes, nombre(f));
    } finally {
      this.ocupado = false;
    }
  }
}
