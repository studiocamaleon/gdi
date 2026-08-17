import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export enum CategoriaComponenteCostoCentroDto {
  sueldos = 'sueldos',
  cargas = 'cargas',
  mantenimiento = 'mantenimiento',
  energia = 'energia',
  alquiler = 'alquiler',
  amortizacion = 'amortizacion',
  tercerizacion = 'tercerizacion',
  insumos_indirectos = 'insumos_indirectos',
  otros = 'otros',
}

export enum SeccionCentroCostoLineaDto {
  gasto_general = 'gasto_general',
  empleado = 'empleado',
  activo_fijo = 'activo_fijo',
}

const esGastoGeneral = (o: CentroCostoLineaItemDto) =>
  o.seccion === SeccionCentroCostoLineaDto.gasto_general;
const esEmpleado = (o: CentroCostoLineaItemDto) =>
  o.seccion === SeccionCentroCostoLineaDto.empleado;
const esActivoFijo = (o: CentroCostoLineaItemDto) =>
  o.seccion === SeccionCentroCostoLineaDto.activo_fijo;

/**
 * Una fila de la planilla del centro. Los campos que se piden dependen de la
 * sección, y el importe mensual NO viaja: lo calcula el servidor a partir de
 * estos campos. Si el total lo mandara el cliente, la planilla podría decir una
 * cosa y costar otra.
 */
export class CentroCostoLineaItemDto {
  @IsEnum(SeccionCentroCostoLineaDto)
  seccion: SeccionCentroCostoLineaDto;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsEnum(CategoriaComponenteCostoCentroDto)
  categoria?: CategoriaComponenteCostoCentroDto;

  // ── Gasto general ────────────────────────────────────────────────────────
  @ValidateIf(esGastoGeneral)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  valorMensual?: number;

  // ── Empleado ─────────────────────────────────────────────────────────────
  @ValidateIf(esEmpleado)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ocupacion?: string;

  /**
   * Qué parte de las horas del centro le dedica la persona. Se carga como
   * porcentaje porque es como se piensa —"20% acá, 80% allá"— y la ficha
   * muestra al lado las horas que salen de aplicarlo a las del centro.
   * SÍ escala el costo: el centro absorbe esa proporción del sueldo, no el
   * sueldo entero. Ausente vale 100%.
   */
  @ValidateIf(esEmpleado)
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  dedicacionPct?: number;

  @ValidateIf(esEmpleado)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  salarioMensual?: number;

  @ValidateIf(esEmpleado)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(1_000)
  cargasPct?: number;

  // ── Activo fijo ──────────────────────────────────────────────────────────
  @ValidateIf(esActivoFijo)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vidaUtilRestanteMeses?: number;

  @ValidateIf(esActivoFijo)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  valorActual?: number;

  @ValidateIf(esActivoFijo)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  valorFinalVida?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class ReplaceCentroLineasDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CentroCostoLineaItemDto)
  lineas: CentroCostoLineaItemDto[];
}
