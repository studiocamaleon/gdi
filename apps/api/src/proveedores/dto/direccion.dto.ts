import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PAISES_LATAM } from '../../common/paises';

export enum TipoDireccionDto {
  principal = 'principal',
  facturacion = 'facturacion',
  entrega = 'entrega',
}

export class ProveedorDireccionDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  descripcion: string;

  @IsString()
  @Length(2, 2)
  @IsIn(PAISES_LATAM as unknown as string[], {
    message: 'El país de la dirección no pertenece al catálogo disponible.',
  })
  pais: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigoPostal?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  direccion: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  numero?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  ciudad: string;

  @IsEnum(TipoDireccionDto)
  tipo: TipoDireccionDto;

  @IsBoolean()
  principal: boolean;
}
