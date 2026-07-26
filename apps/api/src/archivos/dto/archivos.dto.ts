import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ArchivoScope } from '@prisma/client';

/** El único scope que no cuelga de ninguna entidad. */
const SIN_ENTIDAD: ArchivoScope[] = [ArchivoScope.TENANT_BRANDING];

export class IniciarSubidaDto {
  @IsEnum(ArchivoScope)
  scope!: ArchivoScope;

  /** Id de la entidad a la que se adjunta. Obligatorio salvo branding. */
  @ValidateIf((o: IniciarSubidaDto) => !SIN_ENTIDAD.includes(o.scope))
  @IsUUID()
  entidadId?: string;

  @IsString()
  @MaxLength(255)
  nombre!: string;

  /** MIME declarado por el navegador. Se verifica de nuevo al confirmar. */
  @IsString()
  @MaxLength(150)
  mimeType!: string;

  /** Tamaño declarado — sólo para chequear la cuota antes de subir. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bytes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  publico?: boolean;

  /**
   * Qué automatismo lo produjo ("sello"). Lo manda el front cuando el archivo
   * lo generó el sistema y no una persona: es lo que después permite
   * reemplazarlo sin tocar los adjuntos de nadie.
   */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  autogeneradoPor?: string;
}

export class ParteSubidaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numero!: number;

  /** ETag que devolvió el PUT de esa parte (S3 lo manda entre comillas). */
  @IsString()
  @MaxLength(200)
  etag!: string;
}

export class ConfirmarSubidaDto {
  /** Sólo en subidas en partes: sin esto el multipart no se puede cerrar. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10_000)
  @ValidateNested({ each: true })
  @Type(() => ParteSubidaDto)
  partes?: ParteSubidaDto[];
}

export class ActualizarArchivoDto {
  @IsOptional()
  @IsBoolean()
  publico?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}

export class ListarArchivosDto {
  @IsEnum(ArchivoScope)
  scope!: ArchivoScope;

  @ValidateIf((o: ListarArchivosDto) => !SIN_ENTIDAD.includes(o.scope))
  @IsUUID()
  entidadId?: string;
}
