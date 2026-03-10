import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
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
  nombreCompleto: string;

  @IsEmail()
  email: string;

  @IsString()
  telefonoCodigo: string;

  @IsString()
  telefonoNumero: string;

  @IsString()
  @MinLength(1)
  sector: string;

  @IsOptional()
  @IsString()
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
  usuarioSistema: boolean;

  @IsOptional()
  @IsEmail()
  emailAcceso?: string;

  @IsOptional()
  @IsEnum(RolSistemaDto)
  rolSistema?: RolSistemaDto;

  @IsBoolean()
  comisionesHabilitadas: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpleadoDireccionDto)
  direcciones: EmpleadoDireccionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmpleadoComisionDto)
  comisiones: EmpleadoComisionDto[];
}
