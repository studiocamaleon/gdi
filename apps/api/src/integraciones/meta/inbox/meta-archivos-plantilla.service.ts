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
import type { Archivo, Prisma } from '@prisma/client';
import type { ArchivoPlantillaInbox } from '../../../common/inbox/plantillas';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CurrentAuth } from '../../../auth/auth.types';
import { WhatsappContextoService } from '../../../clientes/whatsapp-contexto.service';
import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../../../archivos/storage/storage.driver';
import { CapacidadesEmpresaService } from '../../../suscripciones/capacidades-empresa.service';
import { exigirAccesoInbox } from '../meta-conexion-acceso';
import { canalGeneralInbox, identidadCanalInbox } from '../meta-inbox-canal';
import { destinatarioCanalPermitido } from '../meta-prueba.config';
import { plantillasInboxHabilitadas } from './meta-envios.config';
import { adjuntosHabilitados } from './meta-adjuntos';
import { nombreMedia } from './meta-media.client';

const limites: Record<string, number> = {
  'application/pdf': 20_000_000,
  'image/png': 5_000_000,
  'image/jpeg': 5_000_000,
};
export function versionArchivoPlantilla(f: Archivo, documento?: unknown) {
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
        ...(documento === undefined ? [] : [documento]),
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

// Proyección mínima: no carga datos fiscales, snapshots, tokens públicos ni saldos.
const relaciones = {
  cotizacion: {
    select: {
      id: true,
      tenantId: true,
      clienteId: true,
      numero: true,
      estado: true,
      fechaEnvio: true,
    },
  },
  documentoPdf: {
    select: {
      tenantId: true,
      cotizacionId: true,
      revision: true,
      estado: true,
      contenidoHash: true,
    },
  },
  comprobante: {
    select: {
      id: true,
      tenantId: true,
      clienteId: true,
      tipo: true,
      letra: true,
      numero: true,
      estado: true,
      updatedAt: true,
      puntoVenta: { select: { tenantId: true, numero: true } },
    },
  },
} satisfies Prisma.ArchivoInclude;
type Fuente = Prisma.ArchivoGetPayload<{ include: typeof relaciones }>;

/** Archivos del cliente y PDF comerciales ya emitidos. Consultar no genera,
 * emite ni modifica documentos. Los permisos de cada módulo siguen vigentes. */
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
    const permisos = await exigirAccesoInbox(this.db, auth, ip);
    const canal = await canalGeneralInbox(this.db, auth.tenantId);
    if (
      !canal ||
      !plantillasInboxHabilitadas(auth.tenantId, canal.tipo) ||
      !adjuntosHabilitados() ||
      !permisos.has('crm.ver')
    )
      throw new ForbiddenException('No está disponible el envío de archivos.');
    await this.capacidades.exigirIncluida(auth.tenantId, 'whatsapp_automatico');
    if (identidadCanalInbox(canal) !== canalId)
      throw new ConflictException('La conexión cambió. Actualizá el Inbox.');
    const c = await this.db.inboxConversacion.findFirst({
      where: {
        id: conversacionId,
        tenantId: auth.tenantId,
        vinculoId: canal.id,
      },
    });
    if (!c || !destinatarioCanalPermitido(canal, c.contactoWaId))
      throw new NotFoundException();
    const contexto = await this.contexto.contexto(
      { ...auth, permisos },
      { telefono: `+${c.contactoWaId}` },
    );
    if (contexto.estado !== 'encontrado' || !contexto.cliente?.activo)
      return null;
    return { cliente: contexto.cliente, permisos };
  }
  private fuentes(
    tenantId: string,
    clienteId: string,
    permisos: Set<string>,
  ): Prisma.ArchivoWhereInput[] {
    const fuentes: Prisma.ArchivoWhereInput[] = [
      { scope: 'CLIENTE', clienteId, generado: false },
    ];
    if (permisos.has('comercial.ver'))
      fuentes.push({
        scope: 'COTIZACION',
        generado: true,
        mimeType: 'application/pdf',
        cotizacion: {
          is: {
            tenantId,
            clienteId,
            numero: { not: null },
            fechaEnvio: { not: null },
            estado: { in: ['enviado', 'aprobado', 'convertido'] },
          },
        },
        OR: [
          { documentoPdf: { is: { tenantId, revision: 2, estado: 'LISTO' } } },
          // Mismo fallback que Presupuestos: nunca sustituir la revisión emitida
          // pendiente/fallida por una vista previa o un PDF antiguo.
          {
            documentoPdfId: null,
            cotizacion: {
              is: { documentosPdf: { none: { tenantId, revision: 2 } } },
            },
          },
        ],
      });
    if (permisos.has('administracion.ver'))
      fuentes.push({
        scope: 'COMPROBANTE',
        generado: true,
        mimeType: 'application/pdf',
        documentoPdfId: null,
        comprobante: {
          is: {
            tenantId,
            clienteId,
            estado: 'emitido',
            anuladoEl: null,
            numero: { not: null },
          },
        },
      });
    return fuentes;
  }
  private disponibles(tenantId: string): Prisma.ArchivoWhereInput {
    return {
      tenantId,
      estado: 'LISTO',
      eliminadoEl: null,
      publico: false,
      OR: Object.entries(limites).map(([mimeType, limite]) => ({
        mimeType,
        bytes: { gt: 0, lte: limite },
      })),
    };
  }
  private presentar(
    f: Fuente,
    permisos: Set<string>,
  ): ArchivoPlantillaInbox | null {
    if (!apto(f)) return null;
    let origen: ArchivoPlantillaInbox['origen'] = 'CLIENTE';
    let referencia: string | undefined;
    let sello: unknown;
    if (f.scope === 'COTIZACION') {
      const c = f.cotizacion,
        d = f.documentoPdf;
      if (
        !permisos.has('comercial.ver') ||
        !c ||
        c.tenantId !== f.tenantId ||
        (d && (d.tenantId !== f.tenantId || d.cotizacionId !== c.id))
      )
        return null;
      origen = 'PRESUPUESTO';
      referencia = c.numero!;
      sello = [c, d];
    } else if (f.scope === 'COMPROBANTE') {
      const c = f.comprobante;
      if (
        !permisos.has('administracion.ver') ||
        !c ||
        c.tenantId !== f.tenantId ||
        c.puntoVenta.tenantId !== f.tenantId
      )
        return null;
      origen = 'COMPROBANTE';
      const tipo =
        {
          factura: 'Factura',
          nota_credito: 'Nota de crédito',
          nota_debito: 'Nota de débito',
        }[c.tipo] ?? 'Comprobante';
      referencia = `${tipo} ${c.letra} ${String(c.puntoVenta.numero).padStart(4, '0')}-${String(c.numero).padStart(8, '0')}`;
      sello = c;
    }
    return {
      id: f.id,
      version: versionArchivoPlantilla(f, sello),
      nombre: nombre(f),
      mimeType: f.mimeType,
      bytes: Number(f.bytes),
      origen,
      ...(referencia ? { referencia } : {}),
    };
  }
  async listar(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    canalId: string,
  ) {
    const acceso = await this.cliente(auth, ip, conversacionId, canalId);
    if (!acceso)
      return {
        cliente: null,
        archivos: [],
        motivo:
          'Para adjuntar archivos, el teléfono debe coincidir con una única ficha activa de cliente.',
      };
    const { cliente, permisos } = acceso;
    // Cupo por origen: muchos archivos comunes no ocultan los presupuestos.
    const grupos = await Promise.all(
      this.fuentes(auth.tenantId, cliente.id, permisos).map((fuente) =>
        this.db.archivo.findMany({
          where: { AND: [this.disponibles(auth.tenantId), fuente] },
          include: relaciones,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 100,
        }),
      ),
    );
    const actual = await this.cliente(auth, ip, conversacionId, canalId);
    if (actual?.cliente.id !== cliente.id)
      throw new ConflictException('La ficha del cliente cambió.');
    return {
      cliente: { id: cliente.id, nombre: cliente.nombre },
      motivo: null,
      archivos: grupos.flat().flatMap((f) => {
        const dto = this.presentar(f, actual.permisos);
        return dto ? [dto] : [];
      }),
    };
  }
  async validar(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    canalId: string,
    archivoId: string,
    version: string,
    tipo?: 'image' | 'document',
  ) {
    const acceso = await this.cliente(auth, ip, conversacionId, canalId);
    if (!acceso)
      throw new ConflictException(
        'El teléfono debe corresponder a una única ficha activa de cliente.',
      );
    const f = await this.db.archivo.findFirst({
      where: {
        id: archivoId,
        AND: [
          this.disponibles(auth.tenantId),
          {
            OR: this.fuentes(auth.tenantId, acceso.cliente.id, acceso.permisos),
          },
        ],
      },
      include: relaciones,
    });
    if (!f || this.presentar(f, acceso.permisos)?.version !== version)
      throw new ConflictException(
        'El archivo cambió o ya no está disponible. Volvé a elegirlo.',
      );
    if (tipo && (tipo === 'document') !== (f.mimeType === 'application/pdf'))
      throw new BadRequestException(
        'Elegí un archivo del formato que pide la plantilla.',
      );
    return f;
  }
  async abrir(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    canalId: string,
    archivoId: string,
    version: string,
  ) {
    const f = await this.validar(
      auth,
      ip,
      conversacionId,
      canalId,
      archivoId,
      version,
    );
    const url = await this.storage.firmarDescarga(f.key, {
      disposition: `${f.mimeType === 'application/pdf' ? 'attachment' : 'inline'}; filename="adjunto"; filename*=UTF-8''${encodeURIComponent(nombre(f)).replace(/'/g, '%27')}`,
      contentType: f.mimeType,
      expiraSegundos: 60,
    });
    // La firma no sale del servidor si cambia el cliente, la conexión o el acceso.
    await this.validar(auth, ip, conversacionId, canalId, archivoId, version);
    return { url, statusCode: 302 };
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
