import { IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';

export class UpsertEstacionDto {
  @IsString()
  @MinLength(1)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsBoolean()
  activo: boolean;
}
