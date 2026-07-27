import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
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
  nombre: string;

  @IsOptional()
  @IsEnum(CategoriaComponenteCostoCentroDto)
  categoria?: CategoriaComponenteCostoCentroDto;

  // ── Gasto general ────────────────────────────────────────────────────────
  @ValidateIf(esGastoGeneral)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorMensual?: number;

  // ── Empleado ─────────────────────────────────────────────────────────────
  @ValidateIf(esEmpleado)
  @IsOptional()
  @IsString()
  ocupacion?: string;

  /**
   * Qué parte de las horas del centro le dedica la persona. Se carga como
   * porcentaje porque es como se piensa —"20% acá, 80% allá"— y la ficha
   * muestra al lado las horas que salen de aplicarlo a las del centro.
   * No escala el costo: la línea vale el sueldo con sus cargas.
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
  salarioMensual?: number;

  @ValidateIf(esEmpleado)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
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
  valorActual?: number;

  @ValidateIf(esActivoFijo)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorFinalVida?: number;

  @IsOptional()
  @IsString()
  notas?: string;
}

export class ReplaceCentroLineasDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CentroCostoLineaItemDto)
  lineas: CentroCostoLineaItemDto[];
}
