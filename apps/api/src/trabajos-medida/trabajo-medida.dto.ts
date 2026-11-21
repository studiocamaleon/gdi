import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class GastoEstimadoDto {
  @IsString() @MinLength(1) @MaxLength(160) nombre!: string;
  @IsNumber() @Min(0) @Max(1e10) costo!: number;
}

export class CostosTrabajoDto {
  @IsOptional() @IsIn(['TOTAL', 'DESGLOSADO']) modo?: 'TOTAL' | 'DESGLOSADO';
  @IsOptional() @IsNumber() @Min(0) @Max(1e10) totalEstimado?: number;
  /** Todos los costos se ingresan por el trabajo completo, en la moneda del documento. */
  @IsNumber() @Min(0) @Max(1e10) materiales!: number;
  @IsOptional() @IsString() @MaxLength(2000) detalleMateriales?: string;
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => GastoEstimadoDto)
  otros!: GastoEstimadoDto[];
}

export class OperacionMedidaDto {
  @IsUUID() clave!: string;
  @IsOptional() @IsUUID() estacionId?: string | null;
  @IsString() @MinLength(1) @MaxLength(160) nombre!: string;
  @IsString() @MaxLength(100) familiaCodigo!: string;
  @IsOptional() @IsUUID() centroCostoId?: string | null;
  @IsOptional() @IsUUID() maquinaId?: string | null;
  @IsOptional() @IsNumber() @Min(0) @Max(100000) horas?: number | null;
}

export class DescuentoMedidaDto {
  @IsIn(['PORCENTAJE', 'MONTO']) tipo!: 'PORCENTAJE' | 'MONTO';
  @IsNumber() @Min(0) @Max(1e10) valor!: number;
}

export class TrabajoMedidaDto {
  @IsString() @MinLength(1) @MaxLength(200) nombre!: string;
  @IsString() @MaxLength(4000) descripcion!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(1e7) cantidad!: number;
  @IsIn(['unidad', 'm2', 'metro_lineal', 'libros', 'hojas']) unidad!: string;
  @IsNumber() @Min(0) @Max(1e10) precio!: number;
  @IsIn(['TOTAL', 'UNITARIO']) basePrecio!: 'TOTAL' | 'UNITARIO';
  @IsIn(['FINAL', 'NETO']) tipoPrecio!: 'FINAL' | 'NETO';
  @IsIn(['general', 'reducida', 'exento']) categoriaFiscal!:
    | 'general'
    | 'reducida'
    | 'exento';
  @IsDefined()
  @ValidateNested()
  @Type(() => CostosTrabajoDto)
  costos!: CostosTrabajoDto;
  @IsBoolean() produccion!: boolean;
  @IsArray()
  @ArrayMaxSize(60)
  @ArrayUnique((o: OperacionMedidaDto) => o.clave)
  @ValidateNested({ each: true })
  @Type(() => OperacionMedidaDto)
  operaciones!: OperacionMedidaDto[];
  @IsOptional() @IsUUID() rutaOrigenId?: string | null;
  @IsOptional() @IsUUID() tipoCambioId?: string;
  @IsOptional() @IsUUID() clienteId?: string | null;
  @IsOptional() @IsUUID() cotizacionId?: string;
  /** Referencia histórica; nunca se edita el snapshot de origen. */
  @IsOptional() @IsUUID() anteriorItemId?: string;
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  periodo?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => DescuentoMedidaDto)
  descuento?: DescuentoMedidaDto | null;
  /** Evita guardar tarifas/impuestos distintos a los que se revisaron. */
  @IsOptional() @IsString() @Matches(/^[a-f0-9]{64}$/) huellaCalculo?: string;
}
