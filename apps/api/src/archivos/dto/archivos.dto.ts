import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
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
