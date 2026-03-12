import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertAlmacenDto {
  @IsString()
  @MinLength(1)
  codigo: string;

  @IsString()
  @MinLength(1)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsBoolean()
  activo: boolean;
}
