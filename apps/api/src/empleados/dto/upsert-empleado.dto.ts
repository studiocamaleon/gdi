import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsISO8601,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EmpleadoComisionDto } from './comision.dto';
import { EmpleadoDireccionDto } from './direccion.dto';

export enum SexoEmpleadoDto {
  masculino = 'masculino',
  femenino = 'femenino',
  no_binario = 'no_binario',
  prefiero_no_decir = 'prefiero_no_decir',
}

export enum RolSistemaDto {
  administrador = 'administrador',
  supervisor = 'supervisor',
  operador = 'operador',
}

export class UpsertEmpleadoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  nombreCompleto: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MaxLength(8)
  telefonoCodigo: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  telefonoNumero: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  sector: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  ocupacion?: string;

  @IsOptional()
  @IsEnum(SexoEmpleadoDto)
  sexo?: SexoEmpleadoDto;

  @IsDateString()
  fechaIngreso: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsBoolean()
  comisionesHabilitadas: boolean;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EmpleadoDireccionDto)
  direcciones: EmpleadoDireccionDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EmpleadoComisionDto)
  comisiones: EmpleadoComisionDto[];
}

export class UpdateEmpleadoDto extends UpsertEmpleadoDto {
  @IsISO8601()
  updatedAt: string;
}

export class EstadoEmpleadoDto {
  @IsBoolean()
  activo: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

export class EstadoEmpleadosDto extends EstadoEmpleadoDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  ids: string[];
}

export class ImportarEmpleadosDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpsertEmpleadoDto)
  empleados: UpsertEmpleadoDto[];
}
