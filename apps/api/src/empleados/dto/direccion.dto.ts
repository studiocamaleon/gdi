import {
  IsIn,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MinLength,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { PAISES_LATAM } from '../../common/paises';

export enum TipoDireccionDto {
  principal = 'principal',
  facturacion = 'facturacion',
  entrega = 'entrega',
}

export class EmpleadoDireccionDto {
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
    message: 'El país no pertenece al catálogo disponible.',
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
  @MaxLength(40)
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
