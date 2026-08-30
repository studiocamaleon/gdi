import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DecisionAprobacionDocumento,
  EtapaDesarrolloDocumento,
  PropositoArchivoMaestro,
  RolSistema,
  TipoAprobacionDocumento,
} from '@prisma/client';

export class CrearArchivoMaestroDto {
  @IsUUID()
  proyectoCampanaId!: string;

  @IsString()
  @MaxLength(180)
  nombre!: string;

  @IsEnum(PropositoArchivoMaestro)
  proposito!: PropositoArchivoMaestro;

  @IsEnum(EtapaDesarrolloDocumento)
  etapa!: EtapaDesarrolloDocumento;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  requerido?: boolean;
}

export class CrearRevisionArchivoDto {
  @IsUUID()
  archivoId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  comentario?: string;
}

export class SolicitarAprobacionDocumentoDto {
  @IsEnum(TipoAprobacionDocumento)
  tipo!: TipoAprobacionDocumento;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  comentario?: string;

  @IsOptional()
  @IsUUID()
  asignadaAUsuarioId?: string;

  @IsOptional()
  @IsEnum(RolSistema)
  asignadaARol?: RolSistema;

  @IsOptional()
  @IsBoolean()
  permiteDecisionExterna?: boolean;

  @IsOptional()
  @IsDateString()
  expiraEl?: string;
}

export class DecidirAprobacionDocumentoDto {
  @IsEnum(DecisionAprobacionDocumento)
  decision!: DecisionAprobacionDocumento;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comentario?: string;

  @IsOptional()
  @IsUUID()
  evidenciaArchivoId?: string;
}

export class DecisionPublicaDocumentoDto {
  @IsEnum(DecisionAprobacionDocumento)
  decision!: DecisionAprobacionDocumento;

  @IsString()
  @MaxLength(160)
  actorNombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comentario?: string;
}

export class CrearGateDocumentoDto {
  @IsUUID()
  proyectoCampanaId!: string;

  @IsUUID()
  ordenId!: string;

  @IsOptional()
  @IsUUID()
  pasoId?: string;

  @IsUUID()
  archivoMaestroId!: string;

  @IsEnum(TipoAprobacionDocumento)
  tipoAprobacion!: TipoAprobacionDocumento;

  @IsString()
  @MaxLength(180)
  nombre!: string;
}

export class EmitirLinkAprobacionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  diasVigencia?: number;
}
