import { IsEnum, IsNumberString, IsString, MinLength } from 'class-validator';

export enum TipoComisionDto {
  porcentaje = 'porcentaje',
  fijo = 'fijo',
}

export class EmpleadoComisionDto {
  @IsString()
  @MinLength(1)
  descripcion: string;

  @IsEnum(TipoComisionDto)
  tipo: TipoComisionDto;

  @IsNumberString()
  valor: string;
}
