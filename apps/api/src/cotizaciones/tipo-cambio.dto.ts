import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

export class CrearTipoCambioDto {
  @IsOptional()
  @IsIn(['automatico', 'manual'])
  modo?: 'automatico' | 'manual';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  @Max(1_000_000_000)
  tasa?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  referencia?: string;
}
