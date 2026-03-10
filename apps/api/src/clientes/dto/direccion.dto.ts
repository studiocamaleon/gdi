import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export enum TipoDireccionDto {
  principal = 'principal',
  facturacion = 'facturacion',
  entrega = 'entrega',
}

export class ClienteDireccionDto {
  @IsString()
  @MinLength(1)
  descripcion: string;

  @IsString()
  @Length(2, 2)
  pais: string;

  @IsOptional()
  @IsString()
  codigoPostal?: string;

  @IsString()
  @MinLength(1)
  direccion: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsString()
  @MinLength(1)
  ciudad: string;

  @IsEnum(TipoDireccionDto)
  tipo: TipoDireccionDto;

  @IsBoolean()
  principal: boolean;
}
