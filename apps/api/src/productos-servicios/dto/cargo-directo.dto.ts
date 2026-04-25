import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export enum ModoCalculoCargoDto {
  MONTO_FIJO_PLANO = 'MONTO_FIJO_PLANO',
  PORCENTAJE_SOBRE_BASE = 'PORCENTAJE_SOBRE_BASE',
  POR_UNIDAD_INPUT = 'POR_UNIDAD_INPUT',
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
  @IsString({ each: true })
  modosActivacionSoportados?: string[];

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
  @IsString({ each: true })
  modosActivacionSoportados?: string[];

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
