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
import { ClienteContactoDto } from './contacto.dto';
import { ClienteDireccionDto } from './direccion.dto';

export class UpsertClienteDto {
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
  @Type(() => ClienteContactoDto)
  contactos: ClienteContactoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClienteDireccionDto)
  direcciones: ClienteDireccionDto[];
}
