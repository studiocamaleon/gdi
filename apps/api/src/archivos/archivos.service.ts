import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Archivo, ArchivoEstado, ArchivoScope } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_DRIVER,
  type StorageDriver,
  type UrlFirmada,
} from './storage/storage.driver';
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
  IniciarSubidaDto,
  ListarArchivosDto,
} from './dto/archivos.dto';

const MAX_BYTES_DEFAULT = 100 * 1024 * 1024; // 100 MB
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
  ): Promise<{ archivoId: string; subida: UrlFirmada }> {
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
        ...(campo && dto.entidadId ? { [campo]: dto.entidadId } : {}),
      },
    });

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
  async confirmar(auth: CurrentAuth, id: string): Promise<ArchivoDto> {
    const archivo = await this.buscarPropio(id);
    if (archivo.estado === ArchivoEstado.LISTO) return this.aDto(archivo);
    if (archivo.estado === ArchivoEstado.ELIMINADO) {
      throw new NotFoundException('El archivo fue eliminado.');
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

  // ── Lectura ──────────────────────────────────────────────────────────

  async listar(query: ListarArchivosDto): Promise<ArchivoDto[]> {
    const campo = CAMPO_POR_SCOPE[query.scope];
    const archivos = await this.prisma.archivo.findMany({
      where: {
        scope: query.scope,
        estado: ArchivoEstado.LISTO,
        ...(campo && query.entidadId ? { [campo]: query.entidadId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { subidoPor: { select: { nombreCompleto: true, email: true } } },
    });
    return archivos.map((a) => this.aDto(a));
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

  // ── Mantenimiento (corre sin contexto de tenant: es cross-tenant) ─────

  /** Filas PENDIENTE viejas: subidas que el usuario abandonó a mitad. */
  async barrerPendientes(): Promise<number> {
    const corte = new Date(
      Date.now() - HORAS_PARA_BARRER_PENDIENTES * 60 * 60 * 1000,
    );
    const huerfanos = await this.prisma.archivo.findMany({
      where: { estado: ArchivoEstado.PENDIENTE, createdAt: { lt: corte } },
      select: { id: true, key: true },
      take: 500,
    });
    return this.purgar(huerfanos);
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
