import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export enum ModoCalculoCargoDto {
  MONTO_FIJO_PLANO = 'MONTO_FIJO_PLANO',
  PORCENTAJE_SOBRE_BASE = 'PORCENTAJE_SOBRE_BASE',
  POR_UNIDAD_INPUT = 'POR_UNIDAD_INPUT',
}

export enum ModoActivacionCargoDto {
  OBLIGATORIO = 'OBLIGATORIO',
  OPCIONAL = 'OPCIONAL',
  CONDICIONAL = 'CONDICIONAL',
}

export class CrearCargoDirectoDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  @Matches(/^[a-z0-9_]+$/, { message: 'Código solo minúsculas/números/_' })
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsEnum(ModoCalculoCargoDto)
  modoCalculo!: ModoCalculoCargoDto;

  @IsOptional()
  @IsArray()
  @IsEnum(ModoActivacionCargoDto, { each: true })
  modosActivacionSoportados?: ModoActivacionCargoDto[];

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;
}

export class ActualizarCargoDirectoDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsEnum(ModoCalculoCargoDto)
  modoCalculo?: ModoCalculoCargoDto;

  @IsOptional()
  @IsArray()
  @IsEnum(ModoActivacionCargoDto, { each: true })
  modosActivacionSoportados?: ModoActivacionCargoDto[];

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

// ============================================================================
// Asociación de cargos a producto/paso (F.3.10)
// ============================================================================

export class AsociarCargoCotizacionDto {
  @IsUUID()
  cargoDirectoCatalogoId!: string;

  @IsEnum(ModoActivacionCargoDto)
  modoActivacion!: ModoActivacionCargoDto;

  @IsOptional()
  @IsObject()
  condicionActivacionJson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  configOverrideJson?: Record<string, unknown> | null;
}

export class AsociarCargoPasoDto {
  @IsUUID()
  cargoDirectoCatalogoId!: string;

  @IsEnum(ModoActivacionCargoDto)
  modoActivacion!: ModoActivacionCargoDto;

  @IsOptional()
  @IsObject()
  condicionActivacionJson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  configOverrideJson?: Record<string, unknown> | null;
}

export class ActualizarAsociacionCargoDto {
  @IsOptional()
  @IsEnum(ModoActivacionCargoDto)
  modoActivacion?: ModoActivacionCargoDto;

  @IsOptional()
  @IsObject()
  condicionActivacionJson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  configOverrideJson?: Record<string, unknown> | null;
}
