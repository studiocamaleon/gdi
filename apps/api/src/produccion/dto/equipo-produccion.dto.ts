import {
  IsBoolean,
  IsInt,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { CalendarioEstacion } from '../calendario';

export class EquipoProduccionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre: string;

  @IsInt()
  @Min(1)
  @Max(99)
  personas: number;

  @IsBoolean()
  activo: boolean;

  @IsObject()
  calendario: CalendarioEstacion;
}
