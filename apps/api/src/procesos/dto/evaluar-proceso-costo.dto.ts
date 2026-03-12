import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class EvaluarProcesoCostoDto {
  @IsString()
  periodo: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  cantidadObjetivo: number;

  @IsOptional()
  @IsObject()
  contexto?: Record<string, unknown>;
}
