import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../archivos/storage/storage.driver';
import type { CurrentAuth } from './auth.types';
import { bloquearIdentidad } from './mfa.service';

@Injectable()
export class PerfilService {
  private readonly logger = new Logger(PerfilService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  private propio(auth: CurrentAuth) {
    if (auth.impersonacion || auth.mcp)
      throw new ForbiddenException(
        'Usá tu sesión personal para editar el perfil.',
      );
  }

  async editar(auth: CurrentAuth, nombreCompleto: string) {
    this.propio(auth);
    const nombre = nombreCompleto.trim();
    if (!nombre || nombre.length > 120)
      throw new BadRequestException(
        'Ingresá un nombre de hasta 120 caracteres.',
      );
    return this.prisma.user.update({
      where: { id: auth.userId },
      data: { nombreCompleto: nombre },
      select: { nombreCompleto: true, fotoPerfilVersion: true },
    });
  }

  private key(userId: string, version: string) {
    return `usuarios/${userId}/perfil/${version}.webp`;
  }

  async guardarFoto(auth: CurrentAuth, contenido: string) {
    this.propio(auth);
    const original = Buffer.from(contenido, 'base64');
    if (original.length > 512_000 || !original.length)
      throw new BadRequestException('La foto debe pesar menos de 500 KB.');
    let foto: Buffer;
    try {
      const imagen = sharp(original, {
        limitInputPixels: 16_000_000,
        failOn: 'warning',
      });
      const meta = await imagen.metadata();
      if (
        !meta.format ||
        !['jpeg', 'png', 'webp'].includes(meta.format) ||
        (meta.pages ?? 1) > 1
      )
        throw new Error('Formato no admitido');
      // Decodificar y volver a generar quita metadatos y contenido ajeno a la imagen.
      foto = await imagen
        .rotate()
        .resize(512, 512, { fit: 'cover' })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'Usá una imagen PNG, JPG o WEBP válida, sin animación.',
      );
    }
    const version = randomUUID();
    const key = this.key(auth.userId, version);
    await this.storage.subir(key, foto, 'image/webp');
    let anterior: string | null;
    try {
      anterior = await this.prisma.$transaction(async (tx) => {
        await bloquearIdentidad(tx, auth.userId);
        const user = await tx.user.findUniqueOrThrow({
          where: { id: auth.userId },
          select: { fotoPerfilVersion: true },
        });
        await tx.user.update({
          where: { id: auth.userId },
          data: { fotoPerfilVersion: version },
        });
        return user.fotoPerfilVersion;
      });
    } catch (error) {
      await this.borrarObjeto(key);
      throw error;
    }
    if (anterior) await this.borrarObjeto(this.key(auth.userId, anterior));
    return { fotoPerfilVersion: version };
  }

  async quitarFoto(auth: CurrentAuth) {
    this.propio(auth);
    const anterior = await this.prisma.$transaction(async (tx) => {
      await bloquearIdentidad(tx, auth.userId);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: auth.userId },
        select: { fotoPerfilVersion: true },
      });
      await tx.user.update({
        where: { id: auth.userId },
        data: { fotoPerfilVersion: null },
      });
      return user.fotoPerfilVersion;
    });
    if (anterior) await this.borrarObjeto(this.key(auth.userId, anterior));
    return { fotoPerfilVersion: null };
  }

  async urlFoto(auth: CurrentAuth) {
    this.propio(auth);
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      select: { fotoPerfilVersion: true },
    });
    if (!user?.fotoPerfilVersion)
      throw new NotFoundException('No hay foto de perfil.');
    return this.storage.firmarDescarga(
      this.key(auth.userId, user.fotoPerfilVersion),
      {
        contentType: 'image/webp',
        disposition: 'inline; filename="perfil.webp"',
        expiraSegundos: 60,
      },
    );
  }

  private async borrarObjeto(key: string) {
    try {
      await this.storage.borrar(key);
    } catch {
      this.logger.warn('No se pudo limpiar una foto de perfil reemplazada.');
    }
  }
}
