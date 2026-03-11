import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class UpsertAreaCostoDto {
  @IsUUID()
  plantaId: string;

  @IsString()
  @MinLength(1)
  codigo: string;

  @IsString()
  @MinLength(1)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
