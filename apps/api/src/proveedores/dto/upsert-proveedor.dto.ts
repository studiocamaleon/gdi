import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProveedorContactoDto } from './contacto.dto';
import { ProveedorDireccionDto } from './direccion.dto';

export class UpsertProveedorDto {
  @IsString()
  @MinLength(1)
  nombre: string;

  @IsOptional()
  @IsString()
  razonSocial?: string;

  @IsEmail()
  email: string;

  @IsString()
  telefonoCodigo: string;

  @IsString()
  telefonoNumero: string;

  @IsString()
  @Length(2, 2)
  pais: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProveedorContactoDto)
  contactos: ProveedorContactoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProveedorDireccionDto)
  direcciones: ProveedorDireccionDto[];
}
