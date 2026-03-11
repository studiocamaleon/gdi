import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertPlantaDto {
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
