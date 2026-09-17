import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  ArrayUnique,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { CurrentSession } from '../../auth/current-auth.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { Permiso } from '../../auth/permiso.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../../archivos/storage/storage.driver';
import { inspeccionarDxfNativo } from './dxf-nativo';
import { inspeccionarVector, interpretarVector } from './interpretar-vector';
import {
  detectarPiezasArchivo,
  compactarPiezaArchivo,
  separarPiezasArchivo,
  sugerirPiezasArchivo,
} from './piezas-archivo';

class ArchivoGeometriaDto {
  @IsUUID() archivoId!: string;
}
class OperacionDto {
  @IsString() @MaxLength(160) entidadId!: string;
  @IsIn(['CORTE_INTERIOR', 'CORTE_PARCIAL', 'HENDIDO']) tipo!:
    | 'CORTE_INTERIOR'
    | 'CORTE_PARCIAL'
    | 'HENDIDO';
}
class InterpretarDto extends ArchivoGeometriaDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  exteriorIds?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  excluidas?: string[];
  @IsString() @MaxLength(160) exteriorId!: string;
  @IsString() @MaxLength(30) unidad!: string;
  @IsBoolean() cerrarExterior!: boolean;
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => OperacionDto)
  operaciones!: OperacionDto[];
}

@Controller('productos-servicios/productos/:productoId/geometrias')
// Interpretaciones inmutables para recetas y cotizaciones; no modifica el producto.
@Permiso('costos.gestionar', 'comercial.gestionar')
export class GeometriasProductoController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  private async leer(auth: CurrentAuth, productoId: string, archivoId: string) {
    const archivo = await this.prisma.archivo.findFirst({
      where: {
        id: archivoId,
        tenantId: auth.tenantId,
        productoId,
        scope: 'PRODUCTO',
        estado: 'LISTO',
      },
    });
    if (!archivo || archivo.bytes > 524288n)
      throw new BadRequestException(
        'Subí un vector de hasta 512 KB a este producto.',
      );
    const bytes = await this.storage.leer(archivo.key);
    if (!bytes || bytes.length > 524288)
      throw new BadRequestException('No se pudo leer el archivo original.');
    return { archivo, bytes };
  }

  private async inspeccion(bytes: Buffer, nombre: string) {
    const inspeccion = nombre.toLowerCase().endsWith('.dxf')
      ? await inspeccionarDxfNativo(bytes.toString('utf8'))
      : inspeccionarVector(bytes.toString('utf8'), nombre);
    return {
      ...inspeccion,
      piezas: detectarPiezasArchivo(inspeccion),
      piezasSugeridas: sugerirPiezasArchivo(inspeccion),
    };
  }

  @Post('interpretaciones-lote')
  async guardarLote(
    @CurrentSession() auth: CurrentAuth,
    @Param('productoId', ParseUUIDPipe) productoId: string,
    @Body() dto: InterpretarDto,
  ) {
    const { archivo, bytes } = await this.leer(auth, productoId, dto.archivoId);
    const hash = createHash('sha256').update(bytes).digest('hex');
    try {
      const inspeccion = await this.inspeccion(bytes, archivo.nombreOriginal);
      // La vía histórica mantiene su interpretación de una sola silueta.
      const partes = dto.exteriorIds
        ? separarPiezasArchivo(inspeccion, {
            ...dto,
            exteriorIds: dto.exteriorIds,
          })
        : [{ inspeccion, seleccion: dto }];
      const registros = partes.map((parte) => {
        const id = randomUUID();
        const fuente = interpretarVector(parte.inspeccion, parte.seleccion, {
          nombreArchivo: archivo.nombreOriginal,
          archivoId: archivo.id,
          geometriaId: id,
          hash,
        });
        return {
          id,
          fuente: dto.exteriorIds ? compactarPiezaArchivo(fuente) : fuente,
          seleccion: parte.seleccion,
        };
      });
      // Una carga es atómica: nunca queda importada sólo una parte del DXF.
      await this.prisma.$transaction(
        registros.map(({ id, fuente, seleccion }) =>
          this.prisma.geometriaProducto.create({
            data: {
              id,
              tenantId: auth.tenantId,
              productoId,
              archivoId: archivo.id,
              hash,
              interpretacionJson: JSON.parse(
                JSON.stringify(seleccion),
              ) as Prisma.InputJsonValue,
              fuenteJson: fuente as unknown as Prisma.InputJsonValue,
            },
          }),
        ),
      );
      return { fuentes: registros.map((r) => r.fuente) };
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error
          ? e.message
          : 'No se pudieron importar las piezas del archivo.',
      );
    }
  }

  @Post('inspeccionar')
  async inspeccionar(
    @CurrentSession() auth: CurrentAuth,
    @Param('productoId', ParseUUIDPipe) productoId: string,
    @Body() dto: ArchivoGeometriaDto,
  ) {
    const { archivo, bytes } = await this.leer(auth, productoId, dto.archivoId);
    try {
      return await this.inspeccion(bytes, archivo.nombreOriginal);
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'No se pudo interpretar el vector.',
      );
    }
  }

  @Post('interpretaciones')
  async guardar(
    @CurrentSession() auth: CurrentAuth,
    @Param('productoId', ParseUUIDPipe) productoId: string,
    @Body() dto: InterpretarDto,
  ) {
    const { archivo, bytes } = await this.leer(auth, productoId, dto.archivoId);
    const id = randomUUID(),
      hash = createHash('sha256').update(bytes).digest('hex');
    try {
      // Nunca aceptamos polígonos normalizados del navegador como copia del original.
      const fuente = interpretarVector(
        await this.inspeccion(bytes, archivo.nombreOriginal),
        dto,
        {
          nombreArchivo: archivo.nombreOriginal,
          archivoId: archivo.id,
          geometriaId: id,
          hash,
        },
      );
      await this.prisma.geometriaProducto.create({
        data: {
          id,
          tenantId: auth.tenantId,
          productoId,
          archivoId: archivo.id,
          hash,
          interpretacionJson: JSON.parse(
            JSON.stringify(dto),
          ) as Prisma.InputJsonValue,
          fuenteJson: fuente as unknown as Prisma.InputJsonValue,
        },
      });
      return fuente;
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error
          ? e.message
          : 'No se pudo guardar la interpretación.',
      );
    }
  }
}
