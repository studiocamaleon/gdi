import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CrearImpuestoCatalogoDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  @Matches(/^[a-z0-9_]+$/, { message: 'Código solo minúsculas/números/_' })
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  nombre!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje!: number;

  @IsOptional()
  @IsObject()
  detalleJson?: Record<string, unknown>;
}

export class ActualizarImpuestoCatalogoDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  nombre?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje?: number;

  @IsOptional()
  @IsObject()
  detalleJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
