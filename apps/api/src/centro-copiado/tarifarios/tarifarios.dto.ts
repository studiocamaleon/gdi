import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CrearTarifarioDto {
  @IsString()
  @Length(1, 120)
  nombre!: string;

  @IsObject()
  contenido!: object;
}

export class EditarTarifarioDto extends CrearTarifarioDto {
  @IsInt()
  @Min(1)
  @Max(2147483646)
  revision!: number;
}

export class PublicarTarifarioDto {
  @IsInt()
  @Min(1)
  @Max(2147483646)
  revision!: number;

  @IsIn(['INMEDIATA', 'PROGRAMADA'])
  tipoVigencia!: 'INMEDIATA' | 'PROGRAMADA';

  @IsOptional()
  @IsString()
  vigenteDesde?: string;
}

export class PaginaTarifariosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  desplazamiento = 0;
}
