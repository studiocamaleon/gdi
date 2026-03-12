import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class RegistrarTransferenciaStockDto {
  @IsUUID()
  varianteId: string;

  @IsUUID()
  ubicacionOrigenId: string;

  @IsUUID()
  ubicacionDestinoId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  cantidad: number;

  @IsOptional()
  @IsString()
  referenciaTipo?: string;

  @IsOptional()
  @IsString()
  referenciaId?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
