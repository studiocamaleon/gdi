import {
  IsBoolean,
  IsIn,
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

const BASES_CALCULO = ['NETO', 'BRUTO_COBRADO'] as const;

export class CrearComisionCatalogoDto {
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

  /** NETO (default: vendedor) | BRUTO_COBRADO (pasarela de pago/tarjeta). */
  @IsOptional()
  @IsIn(BASES_CALCULO)
  baseCalculo?: (typeof BASES_CALCULO)[number];

  /**
   * Forma esperada (preserva semántica del modelo viejo):
   * { tipo: 'financiera' | 'vendedor', empleadoId?: string, ... }
   */
  @IsOptional()
  @IsObject()
  detalleJson?: Record<string, unknown>;
}

export class ActualizarComisionCatalogoDto {
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
  @IsIn(BASES_CALCULO)
  baseCalculo?: (typeof BASES_CALCULO)[number];

  @IsOptional()
  @IsObject()
  detalleJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
