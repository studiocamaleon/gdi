import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Archivo, ArchivoEstado, ArchivoScope, Prisma } from '@prisma/client';
import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';
import { createHash, randomUUID } from 'node:crypto';

import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  bloquearAlmacenamiento,
  cupoAlmacenamiento,
  exigirEspacio,
} from './cupo-almacenamiento';
import {
  STORAGE_DRIVER,
  type MultipartIniciado,
  type StorageDriver,
  type UrlFirmada,
} from './storage/storage.driver';
import { UMBRAL_MULTIPART } from './storage/multipart';
import {
  BYTES_DE_FIRMA,
  construirKey,
  contenidoCoincide,
  dispositionDe,
  esExtensionDeLogo,
  esExtensionPermitida,
  extensionDe,
  extensionesPermitidas,
  mimeCoherente,
} from './tipos-archivo';
import type {
  ActualizarArchivoDto,
  ConfirmarSubidaDto,
  IniciarSubidaDto,
  ListarArchivosDto,
} from './dto/archivos.dto';

/**
 * Tope por archivo. Con multipart ya no lo limita el tamaño de un request:
 * 2 GB cubre un arte de gran formato a resolución real sin volverse una
 * invitación a usar el storage de backup.
 */
const MAX_BYTES_DEFAULT = 2 * 1024 * 1024 * 1024;
/** Una subida abandonada deja la fila PENDIENTE; se limpia al día siguiente. */
const HORAS_PARA_BARRER_PENDIENTES = 24;
/** Papelera: el objeto sobrevive un mes al borrado lógico. */
const DIAS_DE_PAPELERA = 30;

/** Campo FK de `Archivo` que corresponde a cada scope. */
const CAMPO_POR_SCOPE: Record<ArchivoScope, keyof Archivo | null> = {
  TENANT_BRANDING: null,
  CAMPANA: 'proyectoCampanaId',
  CLIENTE: 'clienteId',
  ORDEN: 'ordenId',
  ORDEN_ITEM: 'ordenItemId',
  COTIZACION: 'cotizacionId',
  COMPROBANTE: 'comprobanteId',
  COBRO: 'cobroId',
  EGRESO: 'egresoId',
  PRODUCTO: 'productoId',
  PROVEEDOR: 'proveedorId',
};

export type ArchivoDto = {
  id: string;
  scope: ArchivoScope;
  nombre: string;
  mimeType: string;
  bytes: number;
  publico: boolean;
  descripcion: string | null;
  /** Qué automatismo lo produjo, si no lo subió una persona ("sello"). */
  autogeneradoPor: string | null;
  esImagen: boolean;
  createdAt: string;
  subidoPor: string | null;
};

export type IniciarSubidaResultado =
  | { archivoId: string; subida: UrlFirmada; multipart?: never }
  | { archivoId: string; multipart: MultipartIniciado; subida?: never };

export type UsoAlmacenamiento = {
  /** Contador denormalizado del tenant: el que consulta la cuota. */
  bytes: number;
  bytesReservados: number;
  cargasPendientes: number;
  bytesComprometidos: number;
  excedidoBytes: number;
  /** La que rige: el ajuste del tenant si lo hay, si no la del plan. */
  cuotaBytes: number | null;
  /** De dónde sale `cuotaBytes`, para poder decirlo en pantalla. */
  cuotaOrigen: 'plan' | 'ajuste' | 'sin_limite';
  /** Lo que falta para llenarla. `null` si no hay cuota. */
  restanteBytes: number | null;
  porcentaje: number | null;
  /** Suma del desglose. Si difiere de `bytes`, el contador se desincronizó. */
  bytesDetalle: number;
  porScope: Array<{ scope: ArchivoScope; bytes: number; cantidad: number }>;
  /** Ocupa bucket pero NO cuota: ya se liberó al borrar. */
  papelera: { bytes: number; cantidad: number };
  /** El plan que da el espacio. `storageGb: null` = el plan no lo declara. */
  plan: { nombre: string; storageGb: number | null } | null;
};

export type ArchivoEnPapelera = ArchivoDto & {
  eliminadoEl: string;
  /** Cuánto queda antes de que el cron lo borre del bucket. */
  diasRestantes: number;
};

export type ArchivosDeOrden = {
  /** Adjuntos de la orden entera (incluye los heredados del presupuesto). */
  documento: ArchivoDto[];
  /** Un entry por item, en el orden de la orden — aunque no tenga archivos. */
  items: Array<{ itemId: string; nombre: string; archivos: ArchivoDto[] }>;
};

@Injectable()
export class ArchivosService {
  private readonly logger = new Logger(ArchivosService.name);
  private readonly maxBytes = Number(
    process.env.ARCHIVOS_MAX_BYTES ?? MAX_BYTES_DEFAULT,
  );
  /** archivoId → data URI del logo (o null si el objeto no está). */
  private readonly cacheLogos = new Map<string, string | null>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly eventos: EventosSistemaService,
  ) {}

  // ── Subida ───────────────────────────────────────────────────────────

  /**
   * Paso 1: reserva la fila y devuelve la URL firmada. La fila nace
   * PENDIENTE **antes** de firmar, para que un objeto subido nunca quede sin
   * rastro en la base — al revés (fila sin objeto) sí es recuperable: la
   * barre el cron.
   */
  async iniciar(
    auth: CurrentAuth,
    dto: IniciarSubidaDto,
  ): Promise<IniciarSubidaResultado> {
    const ext = extensionDe(dto.nombre);
    if (!esExtensionPermitida(ext)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido (.${ext || 'sin extensión'}). ` +
          `Permitidos: ${extensionesPermitidas().join(', ')}.`,
      );
    }
    if (!mimeCoherente(ext, dto.mimeType)) {
      throw new BadRequestException(
        `El contenido declarado (${dto.mimeType}) no coincide con la extensión .${ext}.`,
      );
    }
    if (dto.bytes > this.maxBytes) {
      throw new BadRequestException(
        `El archivo supera el máximo de ${Math.round(this.maxBytes / 1024 / 1024)} MB.`,
      );
    }
    if (dto.scope === ArchivoScope.TENANT_BRANDING && !esExtensionDeLogo(ext)) {
      throw new BadRequestException(
        'El logo tiene que ser PNG, JPG, WEBP o SVG.',
      );
    }

    await this.verificarEntidad(dto.scope, dto.entidadId ?? null);
    const archivoId = randomUUID();
    const key = construirKey({
      tenantId: auth.tenantId,
      scope: dto.scope,
      entidadId: dto.entidadId ?? null,
      archivoId,
      ext,
    });
    const campo = CAMPO_POR_SCOPE[dto.scope];

    await this.prisma.$transaction(async (tx) => {
      await bloquearAlmacenamiento(tx, auth.tenantId);
      await exigirEspacio(tx, auth.tenantId, BigInt(dto.bytes));
      await tx.archivo.create({
        data: {
          id: archivoId,
          tenantId: auth.tenantId,
          scope: dto.scope,
          key,
          nombreOriginal: dto.nombre,
          mimeType: dto.mimeType,
          bytes: 0n,
          bytesReservados: BigInt(dto.bytes),
          reservaHasta: this.vencimientoSubida(),
          estado: ArchivoEstado.PENDIENTE,
          publico: dto.publico ?? false,
          descripcion: dto.descripcion ?? null,
          autogeneradoPor: dto.autogeneradoPor ?? null,
          hash: dto.hash?.toLowerCase() ?? null,
          // Se guarda igual quién tenía la sesión: el arte lo produjo el sistema,
          // pero fue porque esta persona guardó la orden.
          subidoPorId: auth.userId,
          ...(campo && dto.entidadId ? { [campo]: dto.entidadId } : {}),
        },
      });
    });
    try {
      if (dto.bytes > UMBRAL_MULTIPART) {
        const multipart = await this.storage.iniciarMultipart(key, {
          contentType: dto.mimeType,
          bytes: dto.bytes,
          // Guardar el uploadId ANTES de firmar las partes: si falla una firma
          // o el aborto remoto, el cron conserva lo necesario para reintentarlo.
          alCrear: async (uploadId) => {
            await this.prisma.archivo.update({
              where: { id: archivoId, tenantId: auth.tenantId },
              data: { multipartUploadId: uploadId },
            });
          },
        });
        return { archivoId, multipart };
      }
      const subida = await this.storage.firmarSubida(key, {
        contentType: dto.mimeType,
      });
      return { archivoId, subida };
    } catch (error) {
      await this.cancelarPendiente(auth.tenantId, archivoId).catch(
        () => undefined,
      );
      throw error;
    }
  }

  /**
   * Paso 2: el objeto ya está en el bucket. Se le cree al OBJETO, no al
   * cliente: el tamaño y el tipo salen del HEAD. Si vino más grande que el
   * máximo, se borra y se rechaza — el presign no lo puede impedir por sí solo.
   */
  async confirmar(
    auth: CurrentAuth,
    id: string,
    dto?: ConfirmarSubidaDto,
  ): Promise<ArchivoDto> {
    const archivo = await this.buscarPropio(id, auth.tenantId);
    if (archivo.estado === ArchivoEstado.LISTO) return this.aDto(archivo);
    if (archivo.estado !== ArchivoEstado.PENDIENTE) {
      throw new NotFoundException('La subida ya no está disponible.');
    }
    if (archivo.reservaHasta && archivo.reservaHasta <= new Date()) {
      await this.cancelarPendiente(auth.tenantId, id);
      throw new BadRequestException(
        'La subida venció. Volvé a seleccionar el archivo.',
      );
    }

    // Subida en partes: hay que cerrarla antes de que el objeto exista. Si
    // falta el listado de partes, el archivo no está y nunca va a estar.
    if (archivo.multipartUploadId) {
      if (!dto?.partes?.length) {
        throw new BadRequestException(
          'Falta el detalle de las partes para cerrar la subida.',
        );
      }
      try {
        await this.storage.completarMultipart(
          archivo.key,
          archivo.multipartUploadId,
          dto.partes.map((p) => ({ numero: p.numero, etag: p.etag })),
        );
      } catch (error) {
        // Otro confirmar pudo completar el mismo multipart. Sólo continuar si
        // ya existe el objeto final; el estado se decide bajo lock más abajo.
        if (!(await this.storage.cabecera(archivo.key))) throw error;
      }
      await this.prisma.archivo.update({
        where: { id },
        data: { multipartUploadId: null },
      });
    }

    const meta = await this.storage.cabecera(archivo.key);
    if (!meta || meta.bytes === 0) {
      throw new BadRequestException(
        'No encontré el archivo en el almacenamiento. Probá subirlo de nuevo.',
      );
    }

    const ext = extensionDe(archivo.nombreOriginal);
    if (meta.bytes > this.maxBytes) {
      await this.cancelarPendiente(auth.tenantId, archivo.id);
      throw new BadRequestException(
        `El archivo subido supera el máximo de ${Math.round(this.maxBytes / 1024 / 1024)} MB.`,
      );
    }
    if (meta.contentType && !mimeCoherente(ext, meta.contentType)) {
      await this.cancelarPendiente(auth.tenantId, archivo.id);
      throw new BadRequestException(
        `El contenido subido (${meta.contentType}) no coincide con la extensión .${ext}.`,
      );
    }

    // La verificación que NO depende del cliente. La extensión la elige quien
    // sube y el Content-Type también, así que hasta acá un .exe renombrado a
    // .pdf pasaba las dos. Esto mira los bytes reales del archivo.
    const cabecera = await this.storage.leerCabecera(
      archivo.key,
      BYTES_DE_FIRMA,
    );
    if (cabecera && contenidoCoincide(ext, cabecera) === false) {
      await this.cancelarPendiente(auth.tenantId, archivo.id);
      throw new BadRequestException(
        `El archivo no es un .${ext} de verdad: su contenido no corresponde a ese formato.`,
      );
    }

    const bytes = BigInt(meta.bytes);
    const actualizado = await this.prisma.$transaction(async (tx) => {
      await bloquearAlmacenamiento(tx, auth.tenantId);
      const actual = await tx.archivo.findFirst({
        where: { id, tenantId: auth.tenantId },
      });
      if (
        !actual ||
        (actual.estado !== ArchivoEstado.PENDIENTE &&
          actual.estado !== ArchivoEstado.LISTO)
      ) {
        throw new NotFoundException('La subida ya no está disponible.');
      }
      if (actual.estado === ArchivoEstado.LISTO) return actual;
      if (actual.reservaHasta && actual.reservaHasta <= new Date())
        throw new BadRequestException(
          'La subida venció. Volvé a seleccionar el archivo.',
        );
      await exigirEspacio(tx, auth.tenantId, bytes, id);
      // Sólo quien confirma PENDIENTE → LISTO contabiliza y publica. Reintentar
      // una confirmación no duplica bytes ni actividad, incluso concurrentemente.
      const cambio = await tx.archivo.updateMany({
        where: {
          id: archivo.id,
          tenantId: auth.tenantId,
          estado: ArchivoEstado.PENDIENTE,
        },
        data: {
          estado: ArchivoEstado.LISTO,
          bytes,
          bytesReservados: 0n,
          reservaHasta: null,
        },
      });
      const listo = await tx.archivo.findFirstOrThrow({
        where: { id: archivo.id, tenantId: auth.tenantId },
        include: {
          subidoPor: { select: { nombreCompleto: true, email: true } },
        },
      });
      if (!cambio.count) {
        if (listo.estado !== ArchivoEstado.LISTO)
          throw new NotFoundException('El archivo fue eliminado.');
        return listo;
      }
      await tx.tenant.update({
        where: { id: auth.tenantId },
        data: { bytesArchivos: { increment: bytes } },
      });
      const item = archivo.ordenItemId
        ? await tx.ordenTrabajoItem.findFirst({
            where: { id: archivo.ordenItemId, tenantId: auth.tenantId },
            select: { ordenId: true },
          })
        : null;
      const ordenId = archivo.ordenId ?? item?.ordenId;
      const entidad = ordenId
        ? { tipo: 'orden', id: ordenId, ruta: '/produccion/ordenes/' }
        : archivo.clienteId
          ? {
              tipo: 'cliente',
              id: archivo.clienteId,
              ruta: '/comercial/clientes/',
            }
          : archivo.proyectoCampanaId
            ? {
                tipo: 'campana',
                id: archivo.proyectoCampanaId,
                ruta: '/comercial/campanas/',
              }
            : null;
      if (entidad) {
        await this.eventos.publicarDesdeAuth(
          auth,
          {
            tipo: `archivo.${entidad.tipo}_confirmado`,
            entidadTipo: 'archivo',
            entidadId: archivo.id,
            titulo: 'Archivo subido',
            mensaje: archivo.nombreOriginal,
            href: `${entidad.ruta}${entidad.id}`,
            topicos: ['archivos', 'panel-general'],
          },
          tx,
        );
      }
      return listo;
    });
    return this.aDto(actualizado);
  }

  // ── Documentos que produce el sistema ────────────────────────────────

  /**
   * Guarda un archivo generado por el servidor (el PDF de un presupuesto, el
   * de un comprobante) y devuelve la fila.
   *
   * No pasa por presign: no hay navegador del otro lado y los bytes ya están
   * en memoria. Reemplaza al generado anterior de la misma entidad —
   * "el PDF del presupuesto X" es uno solo, no una colección.
   *
   * Primero reserva espacio y registra la clave; sólo publica después del PUT.
   * La versión anterior sigue disponible si falla la subida.
   */
  async materializar(params: {
    tenantId: string;
    scope: ArchivoScope;
    entidadId: string;
    nombre: string;
    mimeType: string;
    contenido: Buffer;
  }): Promise<Archivo> {
    const campo = CAMPO_POR_SCOPE[params.scope];
    if (!campo) {
      throw new BadRequestException(
        `El scope ${params.scope} no admite documentos generados.`,
      );
    }

    const archivoId = randomUUID();
    const key = construirKey({
      tenantId: params.tenantId,
      scope: params.scope,
      entidadId: params.entidadId,
      archivoId,
      ext: extensionDe(params.nombre),
    });
    const archivoHistorico = {
      tenantId: params.tenantId,
      scope: params.scope,
      [campo]: params.entidadId,
      generado: true,
      estado: ArchivoEstado.LISTO,
      documentoPdfId: null,
    };
    const bytes = BigInt(params.contenido.length);
    await this.prisma.$transaction(async (tx) => {
      await bloquearAlmacenamiento(tx, params.tenantId);
      const anterior = await tx.archivo.findFirst({ where: archivoHistorico });
      const delta = bytes - (anterior?.bytes ?? 0n);
      await exigirEspacio(tx, params.tenantId, delta);
      await tx.archivo.create({
        data: {
          id: archivoId,
          tenantId: params.tenantId,
          scope: params.scope,
          key,
          nombreOriginal: params.nombre,
          mimeType: params.mimeType,
          bytes,
          bytesReservados: delta > 0n ? delta : 0n,
          reservaHasta: this.vencimientoSubida(),
          estado: ArchivoEstado.PENDIENTE,
          generado: true,
          [campo]: params.entidadId,
        },
      });
    });
    try {
      await this.storage.subir(key, params.contenido, params.mimeType);
      return await this.prisma.$transaction(async (tx) => {
        await bloquearAlmacenamiento(tx, params.tenantId);
        await this.exigirPendiente(tx, params.tenantId, archivoId);
        const anterior = await tx.archivo.findFirst({
          where: archivoHistorico,
        });
        const delta = bytes - (anterior?.bytes ?? 0n);
        await exigirEspacio(tx, params.tenantId, delta, archivoId);
        // Viejo y nuevo cambian juntos: preserva el índice único y el PDF
        // anterior sigue disponible si falla la subida o esta transacción.
        if (anterior)
          await tx.archivo.update({
            where: { id: anterior.id },
            data: {
              estado: ArchivoEstado.ELIMINADO,
              eliminadoEl: new Date(),
            },
          });
        const fila = await tx.archivo.update({
          where: { id: archivoId },
          data: {
            estado: ArchivoEstado.LISTO,
            bytesReservados: 0n,
            reservaHasta: null,
          },
        });
        await tx.tenant.update({
          where: { id: params.tenantId },
          data: { bytesArchivos: { increment: delta } },
        });
        return fila;
      });
    } catch (error) {
      await this.cancelarPendiente(params.tenantId, archivoId).catch(
        () => undefined,
      );
      throw error;
    }
  }

  /** El documento vigente que el sistema generó para esa entidad, si existe. */
  async generadoDe(
    scope: ArchivoScope,
    entidadId: string,
  ): Promise<Archivo | null> {
    const campo = CAMPO_POR_SCOPE[scope];
    if (!campo) return null;
    return this.prisma.archivo.findFirst({
      where: {
        scope,
        generado: true,
        estado: ArchivoEstado.LISTO,
        [campo]: entidadId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Publicación única de una versión PDF. Un proceso viejo nunca pisa al ganador. */
  async materializarVersionPdf(params: {
    tenantId: string;
    documentoId: string;
    leaseToken: string;
    contenido: Buffer;
  }): Promise<Archivo> {
    const doc = await this.prisma.documentoPdf.findFirst({
      where: {
        id: params.documentoId,
        tenantId: params.tenantId,
        estado: 'PROCESANDO',
        leaseToken: params.leaseToken,
        leaseHasta: { gt: new Date() },
      },
    });
    if (!doc) throw new Error('PDF_LEASE_PERDIDO');
    const datos = doc.datosJson as { numero?: string };
    const nombre = `${String(datos.numero ?? 'presupuesto').replace(/[^a-zA-Z0-9_-]/g, '_')}${doc.revision === 1 ? '-borrador' : ''}.pdf`;
    const archivoId = randomUUID();
    const key = construirKey({
      tenantId: params.tenantId,
      scope: ArchivoScope.COTIZACION,
      entidadId: doc.cotizacionId,
      archivoId,
      ext: 'pdf',
    });
    const bytes = BigInt(params.contenido.length);
    // Se registra antes del PUT. Si el proceso muere, el barrido de pendientes
    // conoce la clave y limpia el objeto; nunca queda una subida sin rastro.
    await this.prisma.$transaction(async (tx) => {
      await bloquearAlmacenamiento(tx, params.tenantId);
      await exigirEspacio(tx, params.tenantId, bytes);
      await tx.archivo.create({
        data: {
          id: archivoId,
          tenantId: params.tenantId,
          scope: ArchivoScope.COTIZACION,
          cotizacionId: doc.cotizacionId,
          key,
          nombreOriginal: nombre,
          mimeType: 'application/pdf',
          bytes,
          bytesReservados: bytes,
          reservaHasta: this.vencimientoSubida(),
          estado: ArchivoEstado.PENDIENTE,
          generado: true,
          autogeneradoPor: `pdf:${doc.id}`,
        },
      });
    });
    try {
      await this.storage.subir(key, params.contenido, 'application/pdf');
      return await this.prisma.$transaction(async (tx) => {
        await bloquearAlmacenamiento(tx, params.tenantId);
        await this.exigirPendiente(tx, params.tenantId, archivoId);
        await exigirEspacio(tx, params.tenantId, bytes, archivoId);
        const publicado = await tx.documentoPdf.updateMany({
          where: {
            id: doc.id,
            tenantId: params.tenantId,
            estado: 'PROCESANDO',
            leaseToken: params.leaseToken,
            leaseHasta: { gt: new Date() },
          },
          data: {
            estado: 'LISTO',
            generadoEl: new Date(),
            contenidoHash: createHash('sha256')
              .update(params.contenido)
              .digest('hex'),
            leaseToken: null,
            leaseHasta: null,
            errorCodigo: null,
            errorMensaje: null,
          },
        });
        if (publicado.count !== 1) throw new Error('PDF_LEASE_PERDIDO');
        await tx.tenant.update({
          where: { id: params.tenantId },
          data: { bytesArchivos: { increment: bytes } },
        });
        return tx.archivo.update({
          where: { id: archivoId, tenantId: params.tenantId },
          data: {
            estado: ArchivoEstado.LISTO,
            documentoPdfId: doc.id,
            bytesReservados: 0n,
            reservaHasta: null,
          },
        });
      });
    } catch (error) {
      await this.cancelarPendiente(params.tenantId, archivoId).catch(
        () => undefined,
      );
      throw error;
    }
  }

  // ── Lectura ──────────────────────────────────────────────────────────

  async listar(query: ListarArchivosDto): Promise<ArchivoDto[]> {
    const campo = CAMPO_POR_SCOPE[query.scope];
    const archivos = await this.prisma.archivo.findMany({
      where: {
        scope: query.scope,
        estado: ArchivoEstado.LISTO,
        // Los PDF que genera el sistema no son adjuntos del usuario: no van
        // en la misma lista que el arte que subió.
        generado: false,
        ...(campo && query.entidadId ? { [campo]: query.entidadId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { subidoPor: { select: { nombreCompleto: true, email: true } } },
    });
    return archivos.map((a) => this.aDto(a));
  }

  /**
   * Todos los archivos de una orden en una sola request: los del documento y
   * los de cada item. El tab de la ficha los necesita juntos, y pedirlos con
   * N+1 requests (una por item) haría parpadear la vista item por item.
   */
  async deOrden(ordenId: string): Promise<ArchivosDeOrden> {
    const orden = await this.prisma.ordenTrabajo.findFirst({
      where: { id: ordenId },
      select: {
        id: true,
        items: {
          orderBy: { ordenIndice: 'asc' },
          select: { id: true, nombre: true, ordenIndice: true },
        },
      },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada.');

    const archivos = await this.prisma.archivo.findMany({
      where: {
        estado: ArchivoEstado.LISTO,
        generado: false,
        OR: [
          { ordenId, scope: ArchivoScope.ORDEN },
          { ordenItemId: { in: orden.items.map((i) => i.id) } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: { subidoPor: { select: { nombreCompleto: true, email: true } } },
    });

    const porItem = new Map<string, ArchivoDto[]>();
    const documento: ArchivoDto[] = [];
    for (const a of archivos) {
      const dto = this.aDto(a);
      if (a.ordenItemId) {
        const lista = porItem.get(a.ordenItemId) ?? [];
        lista.push(dto);
        porItem.set(a.ordenItemId, lista);
      } else {
        documento.push(dto);
      }
    }

    return {
      documento,
      items: orden.items.map((i) => ({
        itemId: i.id,
        nombre: i.nombre,
        archivos: porItem.get(i.id) ?? [],
      })),
    };
  }

  /**
   * Convertir presupuesto → OT: los archivos del presupuesto pasan a colgar de
   * la orden. NO se copian bytes ni se duplican filas: se agrega `ordenId` y
   * se conserva `cotizacionId` como traza de origen (el CHECK de la tabla lo
   * contempla). Corre dentro de la conversión, así que un fallo acá no puede
   * dejar la orden a medias — por eso traga el error y sólo loguea: perder el
   * vínculo de un adjunto no justifica abortar la conversión de una venta.
   */
  async revincularCotizacionAOrden(
    cotizacionId: string,
    ordenId: string,
  ): Promise<number> {
    try {
      const { count } = await this.prisma.archivo.updateMany({
        where: {
          cotizacionId,
          scope: ArchivoScope.COTIZACION,
          estado: ArchivoEstado.LISTO,
          // El PDF del presupuesto se queda en el presupuesto: es SU
          // documento. La orden genera el suyo cuando corresponde.
          generado: false,
        },
        data: { scope: ArchivoScope.ORDEN, ordenId },
      });
      return count;
    } catch (error) {
      this.logger.warn(
        `No pude re-vincular los archivos del presupuesto ${cotizacionId} a la orden ${ordenId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /**
   * URL de descarga. El API firma DESPUÉS de comprobar que la fila es del
   * tenant; el bucket nunca es público. La banda no pasa por acá: el
   * controller responde 302 y el navegador va derecho al storage.
   */
  async urlDeDescarga(id: string): Promise<string> {
    const archivo = await this.buscarPropio(id);
    if (archivo.estado !== ArchivoEstado.LISTO) {
      throw new NotFoundException('El archivo no está disponible.');
    }
    return this.firmarDescargaDe(archivo);
  }

  /** Bytes crudos, para el servidor (embeber el logo en un PDF). */
  leerContenido(key: string): Promise<Buffer | null> {
    return this.storage.leer(key);
  }

  // ── Logo del tenant ──────────────────────────────────────────────────

  async logoDeTenant(
    tenantId: string,
  ): Promise<{ archivoId: string; nombre: string } | null> {
    const archivo = await this.archivoDelLogo(tenantId);
    return archivo
      ? { archivoId: archivo.id, nombre: archivo.nombreOriginal }
      : null;
  }

  /**
   * Logo como data URI, listo para embeber en el HTML de un PDF.
   *
   * Va cacheado en memoria por id de archivo: el logo cambia una vez cada
   * nunca y esto corre en cada render de presupuesto o factura. La entrada
   * vieja queda huérfana al cambiar el logo (id nuevo, clave nueva), así que
   * el mapa no crece con el uso normal.
   */
  async logoDataUri(tenantId: string): Promise<string | null> {
    const archivo = await this.archivoDelLogo(tenantId);
    if (!archivo) return null;

    const cacheado = this.cacheLogos.get(archivo.id);
    if (cacheado !== undefined) return cacheado;

    const bytes = await this.storage.leer(archivo.key);
    const uri = bytes
      ? `data:${archivo.mimeType};base64,${bytes.toString('base64')}`
      : null;
    this.cacheLogos.set(archivo.id, uri);
    return uri;
  }

  /**
   * URL firmada del logo para las vistas PÚBLICAS (tracking, presupuesto por
   * link). Se llama SIN sesión: quien autoriza es el token de la orden o del
   * presupuesto, que ya fue validado por el caller. El id del logo sale del
   * propio tenant de esa orden, así que no hay forma de pedir el de otro.
   */
  async urlDeLogoPublico(tenantId: string): Promise<string | null> {
    const archivo = await this.archivoDelLogo(tenantId);
    return archivo ? this.firmarDescargaDe(archivo) : null;
  }

  /** Deja el archivo como logo y manda el anterior a la papelera. */
  async definirLogo(
    auth: CurrentAuth,
    archivoId: string,
  ): Promise<{ archivoId: string; nombre: string }> {
    const archivo = await this.buscarPropio(archivoId);
    if (archivo.scope !== ArchivoScope.TENANT_BRANDING) {
      throw new BadRequestException('Ese archivo no es un logo.');
    }
    if (archivo.estado !== ArchivoEstado.LISTO) {
      throw new BadRequestException('El logo todavía no terminó de subirse.');
    }

    const anterior = await this.archivoDelLogo(auth.tenantId);
    await this.prisma.tenant.update({
      where: { id: auth.tenantId },
      data: { logoArchivoId: archivo.id },
    });
    // El logo viejo no le sirve a nadie: se va a la papelera (30 días de
    // gracia por si el cambio fue un error).
    if (anterior && anterior.id !== archivo.id) {
      await this.eliminar(auth, anterior.id);
    }

    return { archivoId: archivo.id, nombre: archivo.nombreOriginal };
  }

  async quitarLogo(auth: CurrentAuth): Promise<void> {
    const anterior = await this.archivoDelLogo(auth.tenantId);
    await this.prisma.tenant.update({
      where: { id: auth.tenantId },
      data: { logoArchivoId: null },
    });
    if (anterior) await this.eliminar(auth, anterior.id);
  }

  private async archivoDelLogo(tenantId: string): Promise<Archivo | null> {
    // `Tenant` está exento del tenant-guard (es la tabla raíz), así que acá se
    // filtra a mano por el id de la sesión.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoArchivoId: true },
    });
    if (!tenant?.logoArchivoId) return null;
    return this.prisma.archivo.findFirst({
      where: { id: tenant.logoArchivoId, estado: ArchivoEstado.LISTO },
    });
  }

  // ── Edición y borrado ────────────────────────────────────────────────

  async actualizar(id: string, dto: ActualizarArchivoDto): Promise<ArchivoDto> {
    await this.buscarPropio(id);
    const actualizado = await this.prisma.archivo.update({
      where: { id },
      data: {
        ...(dto.publico !== undefined ? { publico: dto.publico } : {}),
        ...(dto.descripcion !== undefined
          ? { descripcion: dto.descripcion }
          : {}),
      },
    });
    return this.aDto(actualizado);
  }

  /**
   * Borrado LÓGICO. El objeto sobrevive `DIAS_DE_PAPELERA` por si el click
   * fue un error; recién ahí lo purga el cron. La cuota, en cambio, se libera
   * en el acto: cobrarle al tenant por algo que ya no ve sería raro.
   */
  async eliminar(auth: CurrentAuth, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await bloquearAlmacenamiento(tx, auth.tenantId);
      const archivo = await tx.archivo.findFirst({
        where: { id, tenantId: auth.tenantId },
      });
      if (!archivo) throw new NotFoundException('Archivo no encontrado.');
      if (
        archivo.estado === ArchivoEstado.ELIMINADO ||
        archivo.estado === ArchivoEstado.PURGANDO
      )
        return;
      if (archivo.generado) {
        // Borrarlo a mano dejaría al presupuesto o al comprobante sin su
        // documento hasta que alguien lo vuelva a pedir. Si el contenido
        // cambió, se re-materializa: no se borra.
        throw new BadRequestException(
          'Ese documento lo genera el sistema y no se borra a mano.',
        );
      }
      const referenciasDocumentales = await tx.archivoRevision.count({
        where: { archivoId: archivo.id },
      });
      const geometriasProducto = await tx.geometriaProducto.count({
        where: { archivoId: archivo.id },
      });
      if (referenciasDocumentales > 0 || geometriasProducto > 0) {
        throw new BadRequestException(
          'El archivo forma parte de una revisión controlada y debe conservarse en el historial.',
        );
      }

      if (archivo.estado === ArchivoEstado.PENDIENTE) {
        await tx.archivo.update({
          where: { id },
          data: {
            estado: ArchivoEstado.PURGANDO,
            bytesReservados: 0n,
            reservaHasta: this.vencimientoSubida(),
          },
        });
        return;
      }
      await tx.archivo.update({
        where: { id },
        data: { estado: ArchivoEstado.ELIMINADO, eliminadoEl: new Date() },
      });
      await tx.tenant.update({
        where: { id: auth.tenantId },
        data: { bytesArchivos: { decrement: archivo.bytes } },
      });
    });
  }

  // ── Papelera ─────────────────────────────────────────────────────────

  /**
   * Lo eliminado que todavía se puede recuperar. Sin esto, la papelera de 30
   * días no existía: el diálogo de borrado la prometía y no había forma de
   * volver atrás — el objeto seguía en el bucket pero era inalcanzable.
   */
  async papelera(query: ListarArchivosDto): Promise<ArchivoEnPapelera[]> {
    const campo = CAMPO_POR_SCOPE[query.scope];
    const archivos = await this.prisma.archivo.findMany({
      where: {
        scope: query.scope,
        estado: ArchivoEstado.ELIMINADO,
        generado: false,
        eliminadoEl: { not: null },
        ...(campo && query.entidadId ? { [campo]: query.entidadId } : {}),
      },
      orderBy: { eliminadoEl: 'desc' },
      include: { subidoPor: { select: { nombreCompleto: true, email: true } } },
    });
    const ahora = Date.now();
    return (
      archivos
        .map((a) => {
          const vence =
            a.eliminadoEl!.getTime() + DIAS_DE_PAPELERA * 24 * 60 * 60 * 1000;
          return {
            ...this.aDto(a),
            eliminadoEl: a.eliminadoEl!.toISOString(),
            diasRestantes: Math.ceil((vence - ahora) / (24 * 60 * 60 * 1000)),
          };
        })
        // Los ya vencidos siguen en la base hasta que pase el cron: no tiene
        // sentido ofrecer restaurar algo que se va esta noche.
        .filter((a) => a.diasRestantes > 0)
    );
  }

  /** Devuelve un archivo de la papelera a la vista. */
  async restaurar(auth: CurrentAuth, id: string): Promise<ArchivoDto> {
    const archivo = await this.buscarPropio(id, auth.tenantId);
    if (archivo.estado === ArchivoEstado.LISTO) return this.aDto(archivo);
    if (archivo.estado !== ArchivoEstado.ELIMINADO || !archivo.eliminadoEl) {
      throw new BadRequestException('Ese archivo no está en la papelera.');
    }

    // El objeto puede no estar: si el cron ya pasó, la fila sigue unos
    // minutos pero el byte no. Mejor decirlo que restaurar un fantasma.
    const meta = await this.storage.cabecera(archivo.key);
    if (!meta) {
      throw new NotFoundException(
        'El archivo ya se purgó del almacenamiento y no se puede recuperar.',
      );
    }

    const actualizado = await this.prisma.$transaction(async (tx) => {
      await bloquearAlmacenamiento(tx, auth.tenantId);
      const actual = await tx.archivo.findFirst({
        where: { id, tenantId: auth.tenantId },
      });
      if (actual?.estado === ArchivoEstado.LISTO) return actual;
      if (
        actual?.estado !== ArchivoEstado.ELIMINADO ||
        !actual.eliminadoEl ||
        actual.eliminadoEl.getTime() <=
          Date.now() - DIAS_DE_PAPELERA * 86400000 ||
        actual.bytes <= 0n
      ) {
        throw new BadRequestException(
          'El archivo ya no se puede recuperar de la papelera.',
        );
      }
      const bytes = BigInt(meta.bytes);
      await exigirEspacio(tx, auth.tenantId, bytes);
      const fila = await tx.archivo.update({
        where: { id },
        data: { estado: ArchivoEstado.LISTO, eliminadoEl: null, bytes },
        include: {
          subidoPor: { select: { nombreCompleto: true, email: true } },
        },
      });
      await tx.tenant.update({
        where: { id: auth.tenantId },
        data: { bytesArchivos: { increment: bytes } },
      });
      return fila;
    });
    return this.aDto(actualizado);
  }

  // ── Uso ──────────────────────────────────────────────────────────────

  /**
   * Cuánto espacio ocupa el tenant y en qué. Hasta ahora la cuota sólo se
   * manifestaba como un error al subir; esto la hace legible antes de chocar.
   *
   * El total sale del contador denormalizado (que es el que la cuota
   * consulta) y el desglose de un groupBy, así que si alguna vez se
   * desincronizan se ve acá, comparando `bytes` contra `bytesDetalle`.
   */
  async uso(tenantId: string): Promise<UsoAlmacenamiento> {
    return this.prisma.$transaction(
      async (tx) => {
        const [cuota, porScope, papelera] = await Promise.all([
          cupoAlmacenamiento(tx, tenantId),
          tx.archivo.groupBy({
            by: ['scope'],
            where: { tenantId, estado: ArchivoEstado.LISTO },
            _sum: { bytes: true },
            _count: { _all: true },
          }),
          tx.archivo.aggregate({
            where: { tenantId, estado: ArchivoEstado.ELIMINADO },
            _sum: { bytes: true },
            _count: { _all: true },
          }),
        ]);

        const detalle = porScope
          .map((s) => ({
            scope: s.scope,
            bytes: Number(s._sum.bytes ?? 0),
            cantidad: s._count._all,
          }))
          .sort((a, b) => b.bytes - a.bytes);

        const bytes = Number(cuota.bytes);
        const tope =
          cuota.cuotaBytes === null ? null : Number(cuota.cuotaBytes);
        const bytesReservados = Number(cuota.bytesReservados);
        const comprometidos = bytes + bytesReservados;

        return {
          bytes,
          bytesReservados,
          cargasPendientes: cuota.cargasPendientes,
          bytesComprometidos: comprometidos,
          excedidoBytes: tope === null ? 0 : Math.max(0, comprometidos - tope),
          cuotaBytes: tope,
          cuotaOrigen: cuota.origen,
          // No baja de cero: pasarse de la cuota es posible (el ajuste puede
          // bajarse después de subidas ya hechas) y "-1,2 GB restantes" no dice nada.
          restanteBytes:
            tope === null ? null : Math.max(0, tope - comprometidos),
          porcentaje: tope
            ? Math.min(100, Math.round((comprometidos / tope) * 100))
            : null,
          bytesDetalle: detalle.reduce((n, s) => n + s.bytes, 0),
          porScope: detalle,
          papelera: {
            bytes: Number(papelera._sum.bytes ?? 0),
            cantidad: papelera._count._all,
          },
          plan: cuota.plan,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  // ── Mantenimiento (corre sin contexto de tenant: es cross-tenant) ─────

  /** Las reservas vencen aunque todavía no haya pasado el cron. */
  async barrerPendientes(): Promise<number> {
    const ahora = new Date();
    return this.purgar({
      OR: [
        { estado: ArchivoEstado.PENDIENTE, reservaHasta: { lte: ahora } },
        {
          estado: ArchivoEstado.PENDIENTE,
          reservaHasta: null,
          createdAt: {
            lt: new Date(Date.now() - HORAS_PARA_BARRER_PENDIENTES * 3600000),
          },
        },
        {
          estado: ArchivoEstado.PURGANDO,
          OR: [{ reservaHasta: null }, { reservaHasta: { lte: ahora } }],
        },
      ],
    });
  }

  /** Lee la suma DESPUÉS de tomar el mismo lock que las cargas: nunca pisa
   * el contador con un cálculo anterior a una confirmación concurrente. */
  async resincronizarContadores(): Promise<number> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    let corregidos = 0;
    for (const t of tenants) {
      corregidos += await this.prisma.$transaction(async (tx) => {
        await bloquearAlmacenamiento(tx, t.id);
        const [tenant, suma] = await Promise.all([
          tx.tenant.findUniqueOrThrow({
            where: { id: t.id },
            select: { bytesArchivos: true },
          }),
          tx.archivo.aggregate({
            where: { tenantId: t.id, estado: ArchivoEstado.LISTO },
            _sum: { bytes: true },
          }),
        ]);
        const real = suma._sum.bytes ?? 0n;
        if (real === tenant.bytesArchivos) return 0;
        await tx.tenant.update({
          where: { id: t.id },
          data: { bytesArchivos: real },
        });
        this.logger.warn(
          `Contador de archivos corregido en ${t.id}: ${tenant.bytesArchivos} → ${real}.`,
        );
        return 1;
      });
    }
    return corregidos;
  }

  async purgarPapelera(): Promise<number> {
    return this.purgar({
      estado: ArchivoEstado.ELIMINADO,
      eliminadoEl: { lt: new Date(Date.now() - DIAS_DE_PAPELERA * 86400000) },
    });
  }

  // ── Interno ──────────────────────────────────────────────────────────

  private vencimientoSubida() {
    return new Date(Date.now() + HORAS_PARA_BARRER_PENDIENTES * 3600000);
  }

  private async exigirPendiente(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const fila = await tx.archivo.findFirst({
      where: { id, tenantId, estado: ArchivoEstado.PENDIENTE },
    });
    if (!fila || (fila.reservaHasta && fila.reservaHasta <= new Date())) {
      throw new BadRequestException(
        'La subida venció o fue cancelada. Volvé a intentarlo.',
      );
    }
  }

  /** Cancela sólo cargas incompletas. Un confirmar cuya respuesta se perdió
   * puede haber terminado: nunca se elimina un LISTO al limpiar un error. */
  async cancelarSubida(auth: CurrentAuth, id: string): Promise<void> {
    const archivo = await this.buscarPropio(id, auth.tenantId);
    if (archivo.generado)
      throw new BadRequestException('Esa carga la administra el sistema.');
    await this.cancelarPendiente(auth.tenantId, id);
  }

  private async cancelarPendiente(tenantId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await bloquearAlmacenamiento(tx, tenantId);
      await tx.archivo.updateMany({
        where: { id, tenantId, estado: ArchivoEstado.PENDIENTE },
        data: {
          estado: ArchivoEstado.PURGANDO,
          bytesReservados: 0n,
          // Conservamos la clave un día: una URL ya emitida o un PUT en curso
          // puede terminar después de cancelar. El cron limpiará también ese objeto.
          reservaHasta: this.vencimientoSubida(),
        },
      });
    });
  }

  private async purgar(where: Prisma.ArchivoWhereInput): Promise<number> {
    const candidatos = await this.prisma.archivo.findMany({
      where,
      select: { id: true, tenantId: true },
      take: 500,
    });
    let purgados = 0;
    for (const candidato of candidatos) {
      try {
        const fila = await this.prisma.$transaction(async (tx) => {
          await bloquearAlmacenamiento(tx, candidato.tenantId);
          const actual = await tx.archivo.findFirst({
            where: {
              AND: [where, { id: candidato.id, tenantId: candidato.tenantId }],
            },
          });
          if (!actual) return null; // Se confirmó/restauró antes de obtener el lock.
          return tx.archivo.update({
            where: { id: actual.id },
            data: {
              estado: ArchivoEstado.PURGANDO,
              bytesReservados: 0n,
              reservaHasta: null,
            },
          });
        });
        if (!fila) continue;
        // Ya no es restaurable/confirmable mientras hacemos I/O. Un fallo
        // conserva la fila PURGANDO para reintentar sin perder la clave.
        if (fila.multipartUploadId)
          await this.storage.abortarMultipart(fila.key, fila.multipartUploadId);
        await this.storage.borrar(fila.key);
        const eliminado = await this.prisma.archivo.deleteMany({
          where: {
            id: fila.id,
            tenantId: fila.tenantId,
            estado: ArchivoEstado.PURGANDO,
          },
        });
        purgados += eliminado.count;
      } catch (error) {
        this.logger.warn(
          `No pude purgar ${candidato.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return purgados;
  }

  /** El tenant-guard filtra por tenant; el 404 acá ya es "no es tuyo". */
  private async buscarPropio(id: string, tenantId?: string): Promise<Archivo> {
    const archivo = await this.prisma.archivo.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!archivo) throw new NotFoundException('Archivo no encontrado.');
    return archivo;
  }

  firmarDescargaDe(archivo: Archivo): Promise<string> {
    const ext = extensionDe(archivo.nombreOriginal);
    return this.storage.firmarDescarga(archivo.key, {
      disposition: dispositionDe(archivo.nombreOriginal, ext),
      contentType: archivo.mimeType,
    });
  }

  /**
   * La entidad tiene que existir Y ser del tenant. El guard de Prisma inyecta
   * el tenant en el `where` de cada findFirst, así que un id ajeno da 404 acá
   * y nunca llega a crearse la fila.
   */
  private async verificarEntidad(
    scope: ArchivoScope,
    entidadId: string | null,
  ): Promise<void> {
    if (scope === ArchivoScope.TENANT_BRANDING) return;
    if (!entidadId) {
      throw new BadRequestException('Falta la entidad a la que se adjunta.');
    }

    const where = { where: { id: entidadId }, select: { id: true } };
    const existe = await (async () => {
      switch (scope) {
        case ArchivoScope.CAMPANA:
          return this.prisma.proyectoCampana.findFirst(where);
        case ArchivoScope.CLIENTE:
          return this.prisma.cliente.findFirst(where);
        case ArchivoScope.ORDEN:
          return this.prisma.ordenTrabajo.findFirst(where);
        case ArchivoScope.ORDEN_ITEM:
          return this.prisma.ordenTrabajoItem.findFirst(where);
        case ArchivoScope.COTIZACION:
          return this.prisma.cotizacion.findFirst(where);
        case ArchivoScope.COMPROBANTE:
          return this.prisma.comprobante.findFirst(where);
        case ArchivoScope.COBRO:
          return this.prisma.cobro.findFirst(where);
        case ArchivoScope.PRODUCTO:
          return this.prisma.producto.findFirst(where);
        case ArchivoScope.PROVEEDOR:
          return this.prisma.proveedor.findFirst(where);
        case ArchivoScope.EGRESO:
          return this.prisma.egreso.findFirst(where);
        // TENANT_BRANDING no está: el early return de arriba ya lo sacó del
        // tipo, y agregarlo acá no compila.
      }
      /*
        SIN `default`. El `never` hace que agregar un scope nuevo y no
        enseñarle acá a buscar su entidad NO COMPILE.

        Esto lo aprendimos caro: `EGRESO` se agregó con su campo en
        `CAMPO_POR_SCOPE` —que es un Record exhaustivo y el compilador sí
        exigió— pero acá había un `default: return null` que se lo tragó en
        silencio. Resultado: adjuntar la factura de un egreso devolvía 404
        "No encontré la entidad", desde el primer día y sin que nada avisara.
      */
      const exhaustivo: never = scope;
      return exhaustivo;
    })();

    if (!existe) {
      throw new NotFoundException(
        'No encontré la entidad a la que se adjunta.',
      );
    }
  }

  /**
   * `bytes` es BigInt en la base y `JSON.stringify` no sabe serializarlo
   * (tira TypeError). Se convierte acá, en el único lugar donde la fila sale
   * hacia el HTTP.
   */
  private aDto(
    archivo: Archivo & {
      subidoPor?: { nombreCompleto: string | null; email: string } | null;
    },
  ): ArchivoDto {
    return {
      id: archivo.id,
      scope: archivo.scope,
      nombre: archivo.nombreOriginal,
      mimeType: archivo.mimeType,
      bytes: Number(archivo.bytes),
      publico: archivo.publico,
      descripcion: archivo.descripcion,
      autogeneradoPor: archivo.autogeneradoPor,
      esImagen: archivo.mimeType.startsWith('image/'),
      createdAt: archivo.createdAt.toISOString(),
      subidoPor:
        archivo.subidoPor?.nombreCompleto ?? archivo.subidoPor?.email ?? null,
    };
  }
}
