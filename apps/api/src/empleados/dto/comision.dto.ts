import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum TipoComisionDto {
  porcentaje = 'porcentaje',
  fijo = 'fijo',
}

export class EmpleadoComisionDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  descripcion: string;

  @IsEnum(TipoComisionDto)
  tipo: TipoComisionDto;

  @Matches(/^\d+(?:[.,]\d{1,2})?$/, {
    message:
      'El valor de la comisión debe ser positivo y tener hasta 2 decimales.',
  })
  valor: string;
}
