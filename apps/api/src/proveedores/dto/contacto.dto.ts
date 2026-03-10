import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class ProveedorContactoDto {
  @IsString()
  @MinLength(1)
  nombre: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefonoCodigo?: string;

  @IsOptional()
  @IsString()
  telefonoNumero?: string;

  @IsBoolean()
  principal: boolean;
}
