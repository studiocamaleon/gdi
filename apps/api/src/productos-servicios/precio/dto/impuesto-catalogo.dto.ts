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
const TRASLADOS = ['POR_FUERA', 'POR_DENTRO'] as const;
const ALCANCES = ['PRODUCTO', 'TENANT'] as const;

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

  /** NETO (default) | BRUTO_COBRADO (ej. imp. al cheque). */
  @IsOptional()
  @IsIn(BASES_CALCULO)
  baseCalculo?: (typeof BASES_CALCULO)[number];

  /** POR_FUERA (IVA: se agrega y discrimina) | POR_DENTRO (default: costo embebido). */
  @IsOptional()
  @IsIn(TRASLADOS)
  traslado?: (typeof TRASLADOS)[number];

  /** PRODUCTO (default: se asocia por producto) | TENANT (aplica a todo el tenant). */
  @IsOptional()
  @IsIn(ALCANCES)
  alcance?: (typeof ALCANCES)[number];

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
  @IsIn(BASES_CALCULO)
  baseCalculo?: (typeof BASES_CALCULO)[number];

  @IsOptional()
  @IsIn(TRASLADOS)
  traslado?: (typeof TRASLADOS)[number];

  @IsOptional()
  @IsIn(ALCANCES)
  alcance?: (typeof ALCANCES)[number];

  @IsOptional()
  @IsObject()
  detalleJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
