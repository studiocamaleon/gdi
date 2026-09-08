import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { createHash } from 'node:crypto';
import { CurrentSession } from '../../auth/current-auth.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { Permiso } from '../../auth/permiso.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../../archivos/storage/storage.driver';
import { ejecutarDxfNativo } from './dxf-nativo';
import type { FuenteGuardada } from './interpretar-vector';
import { recuperarCapasGuardadas } from './recuperar-capas';

class CapasFabricacionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsUUID('4', { each: true })
  geometriaIds!: string[];
}

class InstanciaDto {
  @IsUUID() geometriaId!: string;
  @IsString() @MaxLength(64) archivoHash!: string;
  @IsOptional() @IsString() @MaxLength(160) nombrePieza?: string;
  @IsArray()
  @ArrayMinSize(6)
  @ArrayMaxSize(6)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  transformacion!: number[];
  @IsBoolean() soloComplementos!: boolean;
}
export class ExportarFabricacionDto {
  @IsString() @MaxLength(2 * 1024 * 1024) baseDxf!: string;
  @IsNumber() @Min(0.001) @Max(100000) altoMm!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => InstanciaDto)
  instancias!: InstanciaDto[];
}

@Controller('productos-servicios/geometrias')
@Permiso('comercial.ver', 'produccion.ver', 'costos.ver')
export class ExportarFabricacionController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  private async leerOriginal(
    g: {
      hash: string;
      archivo: { key: string; bytes: bigint; tenantId: string };
    },
    tenantId: string,
  ) {
    if (g.archivo.tenantId !== tenantId || g.archivo.bytes > 524288n)
      throw new Error('No se pudo acceder al archivo original.');
    const bytes = await this.storage.leer(g.archivo.key);
    if (
      !bytes ||
      bytes.length > 524288 ||
      createHash('sha256').update(bytes).digest('hex') !== g.hash
    )
      throw new Error('El archivo original cambió o ya no está disponible.');
    return bytes.toString('utf8');
  }

  @Post('capas-fabricacion')
  async capas(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: CapasFabricacionDto,
  ) {
    const ids = [...new Set(dto.geometriaIds)];
    const guardadas = await this.prisma.geometriaProducto.findMany({
      where: { tenantId: auth.tenantId, id: { in: ids } },
      include: { archivo: true },
    });
    if (guardadas.length !== ids.length)
      throw new BadRequestException(
        'No se encontró una interpretación en esta cuenta.',
      );
    try {
      const documentos = [];
      for (const g of guardadas) {
        const fuente = g.fuenteJson as unknown as FuenteGuardada;
        const completa =
          fuente.fabricacion &&
          (fuente.formatoOrigen !== 'DXF' || fuente.fabricacion.dxfNativo)
            ? fuente
            : await recuperarCapasGuardadas(
                fuente,
                await this.leerOriginal(g, auth.tenantId),
                (g.interpretacionJson as { excluidas?: string[] } | undefined)
                  ?.excluidas,
              );
        if (!completa.fabricacion)
          throw new Error(
            `Revisá las capas de «${fuente.nombreArchivo}» antes de descargar los archivos de producción.`,
          );
        documentos.push(completa.fabricacion);
      }
      return { documentos };
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'No se pudieron recuperar las capas.',
      );
    }
  }

  @Post('exportar-dxf')
  async exportar(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: ExportarFabricacionDto,
  ) {
    const ids = [...new Set(dto.instancias.map((i) => i.geometriaId))];
    if (ids.length > 100)
      throw new BadRequestException(
        'La placa admite hasta 100 diseños distintos.',
      );
    // Sólo se aceptan giros y traslaciones: la escala pertenece a la interpretación guardada.
    for (const i of dto.instancias) {
      const [a, b, c, d, x, y] = i.transformacion;
      if (
        Math.abs(a * a + b * b - 1) > 1e-6 ||
        Math.abs(c * c + d * d - 1) > 1e-6 ||
        Math.abs(a * c + b * d) > 1e-6 ||
        Math.abs(a * d - b * c - 1) > 1e-6 ||
        Math.max(Math.abs(x), Math.abs(y)) > 200000
      )
        throw new BadRequestException(
          'La transformación de fabricación no es válida.',
        );
    }
    const guardadas = await this.prisma.geometriaProducto.findMany({
      where: { tenantId: auth.tenantId, id: { in: ids } },
      include: { archivo: true },
    });
    if (guardadas.length !== ids.length)
      throw new BadRequestException(
        'No se encontró una interpretación en esta cuenta.',
      );
    try {
      const fuentes = [];
      for (const g of guardadas) {
        const contenido = await this.leerOriginal(g, auth.tenantId);
        const fuente = await recuperarCapasGuardadas(
          g.fuenteJson as unknown as FuenteGuardada,
          contenido,
          (g.interpretacionJson as { excluidas?: string[] } | undefined)
            ?.excluidas,
        );
        const instancias = dto.instancias.filter((i) => i.geometriaId === g.id);
        if (
          !fuente.fabricacion?.dxfNativo ||
          instancias.some((i) => i.archivoHash !== g.hash)
        )
          throw new Error(
            'La placa no coincide con la interpretación guardada del DXF.',
          );
        fuentes.push({
          id: g.id,
          nombrePieza:
            [
              ...new Set(
                instancias.map((i) => i.nombrePieza?.trim()).filter(Boolean),
              ),
            ].length === 1
              ? instancias
                  .find((i) => i.nombrePieza?.trim())!
                  .nombrePieza!.trim()
              : undefined,
          nombreArchivo: fuente.nombreArchivo,
          contenido,
          fabricacion: fuente.fabricacion,
          cerrarExterior: fuente.procedencia.cierreConfirmado,
          instancias,
        });
      }
      return await ejecutarDxfNativo<{ dxf: string }>({
        accion: 'exportar',
        baseDxf: dto.baseDxf,
        altoMm: dto.altoMm,
        fuentes,
      });
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'No se pudo exportar el DXF.',
      );
    }
  }
}
