import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Archivo, ArchivoEstado, ArchivoScope, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_DRIVER,
  type MultipartIniciado,
  type StorageDriver,
  type UrlFirmada,
} from './storage/storage.driver';
import { UMBRAL_MULTIPART } from './storage/multipart';
import {
  construirKey,
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
  CLIENTE: 'clienteId',
  ORDEN: 'ordenId',
  ORDEN_ITEM: 'ordenItemId',
  COTIZACION: 'cotizacionId',
  COMPROBANTE: 'comprobanteId',
  COBRO: 'cobroId',
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
  cuotaBytes: number | null;
  porcentaje: number | null;
  /** Suma del desglose. Si difiere de `bytes`, el contador se desincronizó. */
  bytesDetalle: number;
  porScope: Array<{ scope: ArchivoScope; bytes: number; cantidad: number }>;
  /** Ocupa bucket pero NO cuota: ya se liberó al borrar. */
  papelera: { bytes: number; cantidad: number };
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
    // La cuota se chequea ACÁ y no al confirmar: rechazar después de que el
    // usuario esperó a que suba 80 MB es hostil.
    await this.verificarCuota(auth.tenantId, dto.bytes);

    const archivoId = randomUUID();
    const key = construirKey({
      tenantId: auth.tenantId,
      scope: dto.scope,
      entidadId: dto.entidadId ?? null,
      archivoId,
      ext,
    });
    const campo = CAMPO_POR_SCOPE[dto.scope];

    // Por encima del umbral la subida va en partes: un solo PUT de 800 MB no
    // sobrevive a una conexión de imprenta, y no hay forma de reintentar el
    // pedazo que falló sin volver a mandar todo.
    const enPartes = dto.bytes > UMBRAL_MULTIPART;
    const multipart = enPartes
      ? await this.storage.iniciarMultipart(key, {
          contentType: dto.mimeType,
          bytes: dto.bytes,
        })
      : null;

    await this.prisma.archivo.create({
      data: {
        id: archivoId,
        tenantId: auth.tenantId,
        scope: dto.scope,
        key,
        nombreOriginal: dto.nombre,
        mimeType: dto.mimeType,
        bytes: BigInt(0),
        estado: ArchivoEstado.PENDIENTE,
        publico: dto.publico ?? false,
        descripcion: dto.descripcion ?? null,
        subidoPorId: auth.userId,
        multipartUploadId: multipart?.uploadId ?? null,
        ...(campo && dto.entidadId ? { [campo]: dto.entidadId } : {}),
      },
    });

    if (multipart) return { archivoId, multipart };

    const subida = await this.storage.firmarSubida(key, {
      contentType: dto.mimeType,
    });
    return { archivoId, subida };
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
    const archivo = await this.buscarPropio(id);
    if (archivo.estado === ArchivoEstado.LISTO) return this.aDto(archivo);
    if (archivo.estado === ArchivoEstado.ELIMINADO) {
      throw new NotFoundException('El archivo fue eliminado.');
    }

    // Subida en partes: hay que cerrarla antes de que el objeto exista. Si
    // falta el listado de partes, el archivo no está y nunca va a estar.
    if (archivo.multipartUploadId) {
      if (!dto?.partes?.length) {
        throw new BadRequestException(
          'Falta el detalle de las partes para cerrar la subida.',
        );
      }
      await this.storage.completarMultipart(
        archivo.key,
        archivo.multipartUploadId,
        dto.partes.map((p) => ({ numero: p.numero, etag: p.etag })),
      );
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
      await this.storage.borrar(archivo.key);
      await this.prisma.archivo.delete({ where: { id: archivo.id } });
      throw new BadRequestException(
        `El archivo subido supera el máximo de ${Math.round(this.maxBytes / 1024 / 1024)} MB.`,
      );
    }
    if (meta.contentType && !mimeCoherente(ext, meta.contentType)) {
      await this.storage.borrar(archivo.key);
      await this.prisma.archivo.delete({ where: { id: archivo.id } });
      throw new BadRequestException(
        `El contenido subido (${meta.contentType}) no coincide con la extensión .${ext}.`,
      );
    }

    const bytes = BigInt(meta.bytes);
    const [actualizado] = await this.prisma.$transaction([
      this.prisma.archivo.update({
        where: { id: archivo.id },
        data: { estado: ArchivoEstado.LISTO, bytes },
        include: {
          subidoPor: { select: { nombreCompleto: true, email: true } },
        },
      }),
      // Contador denormalizado en la MISMA transacción — mismo patrón que
      // Comprobante.saldoPendiente y OrdenTrabajo.facturadoTotal.
      this.prisma.tenant.update({
        where: { id: auth.tenantId },
        data: { bytesArchivos: { increment: bytes } },
      }),
    ]);
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
   * El objeto se sube ANTES de tocar la base: si la subida falla, la fila
   * vieja sigue siendo válida y el endpoint la sigue sirviendo. Al revés
   * dejaríamos apuntando a un objeto que no existe.
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
    await this.storage.subir(key, params.contenido, params.mimeType);

    const anterior = await this.generadoDe(params.scope, params.entidadId);
    const bytes = BigInt(params.contenido.length);

    let fila: Archivo;
    try {
      [fila] = await this.prisma.$transaction([
        this.prisma.archivo.create({
          data: {
            id: archivoId,
            tenantId: params.tenantId,
            scope: params.scope,
            key,
            nombreOriginal: params.nombre,
            mimeType: params.mimeType,
            bytes,
            estado: ArchivoEstado.LISTO,
            generado: true,
            [campo]: params.entidadId,
          },
        }),
        this.prisma.tenant.update({
          where: { id: params.tenantId },
          data: { bytesArchivos: { increment: bytes } },
        }),
      ]);
    } catch (error) {
      // El índice parcial `Archivo_generado_vigente_unico` dice que hay a lo
      // sumo un documento generado vigente por entidad. Si dos pedidos
      // simultáneos generaron el mismo PDF, el que llega segundo choca acá:
      // tira su objeto y devuelve el que ganó. Antes los dos quedaban
      // vigentes y el perdedor se filtraba en el bucket para siempre.
      if (esConflictoDeUnicidad(error)) {
        await this.storage.borrar(key).catch(() => undefined);
        const ganador = await this.generadoDe(params.scope, params.entidadId);
        if (ganador) return ganador;
      }
      throw error;
    }

    // El viejo se va a la papelera con el camino normal (el cron purga el
    // objeto), así que un fallo acá no deja el nuevo sin registrar.
    if (anterior) {
      await this.prisma.$transaction([
        this.prisma.archivo.update({
          where: { id: anterior.id },
          data: { estado: ArchivoEstado.ELIMINADO, eliminadoEl: new Date() },
        }),
        this.prisma.tenant.update({
          where: { id: params.tenantId },
          data: { bytesArchivos: { decrement: anterior.bytes } },
        }),
      ]);
    }

    return fila;
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
    const archivo = await this.buscarPropio(id);
    if (archivo.estado === ArchivoEstado.ELIMINADO) return;
    if (archivo.generado) {
      // Borrarlo a mano dejaría al presupuesto o al comprobante sin su
      // documento hasta que alguien lo vuelva a pedir. Si el contenido
      // cambió, se re-materializa: no se borra.
      throw new BadRequestException(
        'Ese documento lo genera el sistema y no se borra a mano.',
      );
    }

    const eraListo = archivo.estado === ArchivoEstado.LISTO;
    await this.prisma.$transaction([
      this.prisma.archivo.update({
        where: { id },
        data: { estado: ArchivoEstado.ELIMINADO, eliminadoEl: new Date() },
      }),
      ...(eraListo
        ? [
            this.prisma.tenant.update({
              where: { id: auth.tenantId },
              data: { bytesArchivos: { decrement: archivo.bytes } },
            }),
          ]
        : []),
    ]);
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
    const archivo = await this.buscarPropio(id);
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

    // Vuelve a ocupar cuota, así que vuelve a chequearse: si el tenant llenó
    // el espacio mientras tanto, restaurar no puede pasarlo de largo.
    await this.verificarCuota(auth.tenantId, Number(archivo.bytes));

    const [actualizado] = await this.prisma.$transaction([
      this.prisma.archivo.update({
        where: { id },
        data: { estado: ArchivoEstado.LISTO, eliminadoEl: null },
        include: {
          subidoPor: { select: { nombreCompleto: true, email: true } },
        },
      }),
      this.prisma.tenant.update({
        where: { id: auth.tenantId },
        data: { bytesArchivos: { increment: archivo.bytes } },
      }),
    ]);
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
    const [tenant, porScope, papelera] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { bytesArchivos: true, cuotaBytesArchivos: true },
      }),
      this.prisma.archivo.groupBy({
        by: ['scope'],
        where: { estado: ArchivoEstado.LISTO },
        _sum: { bytes: true },
        _count: { _all: true },
      }),
      this.prisma.archivo.aggregate({
        where: { estado: ArchivoEstado.ELIMINADO },
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

    const bytes = Number(tenant?.bytesArchivos ?? 0);
    const cuota = tenant?.cuotaBytesArchivos
      ? Number(tenant.cuotaBytesArchivos)
      : null;

    return {
      bytes,
      cuotaBytes: cuota,
      porcentaje: cuota
        ? Math.min(100, Math.round((bytes / cuota) * 100))
        : null,
      bytesDetalle: detalle.reduce((n, s) => n + s.bytes, 0),
      porScope: detalle,
      papelera: {
        bytes: Number(papelera._sum.bytes ?? 0),
        cantidad: papelera._count._all,
      },
    };
  }

  // ── Mantenimiento (corre sin contexto de tenant: es cross-tenant) ─────

  /** Filas PENDIENTE viejas: subidas que el usuario abandonó a mitad. */
  async barrerPendientes(): Promise<number> {
    const corte = new Date(
      Date.now() - HORAS_PARA_BARRER_PENDIENTES * 60 * 60 * 1000,
    );
    const huerfanos = await this.prisma.archivo.findMany({
      where: { estado: ArchivoEstado.PENDIENTE, createdAt: { lt: corte } },
      select: { id: true, key: true, multipartUploadId: true },
      take: 500,
    });

    // Las subidas en partes que nunca cerraron hay que ABORTARLAS: S3 y R2
    // cobran el espacio de las partes ya subidas de un multipart abierto, y
    // borrar la clave final no las toca porque ese objeto nunca existió.
    for (const h of huerfanos) {
      if (!h.multipartUploadId) continue;
      await this.storage
        .abortarMultipart(h.key, h.multipartUploadId)
        .catch((error: unknown) => {
          this.logger.warn(
            `No pude abortar el multipart de ${h.key}: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    }

    return this.purgar(huerfanos);
  }

  /**
   * Recalcula `Tenant.bytesArchivos` desde la suma real de sus archivos.
   *
   * El contador se mantiene transaccionalmente en cada alta y baja, así que en
   * régimen normal coincide. Pero es un denormalizado: cualquier escritura que
   * no pase por el service (una corrección a mano en la base, una migración,
   * un borrado en cascada de una entidad padre) lo deja corrido, y a partir de
   * ahí la cuota mide mal para siempre sin que nada lo note. Corre de noche y
   * sólo escribe los que difieren.
   */
  async resincronizarContadores(): Promise<number> {
    const sumas = await this.prisma.archivo.groupBy({
      by: ['tenantId'],
      where: { estado: ArchivoEstado.LISTO },
      _sum: { bytes: true },
    });
    const reales = new Map(sumas.map((s) => [s.tenantId, s._sum.bytes ?? 0n]));

    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, bytesArchivos: true },
    });

    let corregidos = 0;
    for (const t of tenants) {
      const real = reales.get(t.id) ?? 0n;
      if (t.bytesArchivos === real) continue;
      await this.prisma.tenant.update({
        where: { id: t.id },
        data: { bytesArchivos: real },
      });
      this.logger.warn(
        `Contador de archivos corregido en ${t.id}: ${t.bytesArchivos} → ${real}.`,
      );
      corregidos += 1;
    }
    return corregidos;
  }

  /** Papelera vencida: acá sí se borra el objeto y la fila. */
  async purgarPapelera(): Promise<number> {
    const corte = new Date(Date.now() - DIAS_DE_PAPELERA * 24 * 60 * 60 * 1000);
    const vencidos = await this.prisma.archivo.findMany({
      where: { estado: ArchivoEstado.ELIMINADO, eliminadoEl: { lt: corte } },
      select: { id: true, key: true },
      take: 500,
    });
    return this.purgar(vencidos);
  }

  // ── Interno ──────────────────────────────────────────────────────────

  private async purgar(filas: { id: string; key: string }[]): Promise<number> {
    let purgados = 0;
    for (const fila of filas) {
      try {
        // Primero el objeto: si falla, la fila queda y se reintenta mañana.
        // Al revés perderíamos la única referencia al objeto y quedaría
        // ocupando el bucket para siempre.
        await this.storage.borrar(fila.key);
        await this.prisma.archivo.delete({ where: { id: fila.id } });
        purgados += 1;
      } catch (error) {
        this.logger.warn(
          `No pude purgar ${fila.key}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return purgados;
  }

  /** El tenant-guard filtra por tenant; el 404 acá ya es "no es tuyo". */
  private async buscarPropio(id: string): Promise<Archivo> {
    const archivo = await this.prisma.archivo.findFirst({ where: { id } });
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
        default:
          return null;
      }
    })();

    if (!existe) {
      throw new NotFoundException(
        'No encontré la entidad a la que se adjunta.',
      );
    }
  }

  private async verificarCuota(tenantId: string, bytes: number): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { bytesArchivos: true, cuotaBytesArchivos: true },
    });
    if (!tenant?.cuotaBytesArchivos) return;
    if (tenant.bytesArchivos + BigInt(bytes) > tenant.cuotaBytesArchivos) {
      const gb = Number(tenant.cuotaBytesArchivos) / 1024 ** 3;
      throw new ForbiddenException(
        `Te quedaste sin espacio (cuota: ${gb.toFixed(1)} GB). Borrá archivos o ampliá el plan.`,
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
      esImagen: archivo.mimeType.startsWith('image/'),
      createdAt: archivo.createdAt.toISOString(),
      subidoPor:
        archivo.subidoPor?.nombreCompleto ?? archivo.subidoPor?.email ?? null,
    };
  }
}

/** P2002: violación de índice único (incluye los parciales hechos a mano). */
function esConflictoDeUnicidad(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
