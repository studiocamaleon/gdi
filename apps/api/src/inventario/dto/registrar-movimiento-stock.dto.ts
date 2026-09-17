import { UnidadMateriaPrimaDto } from './upsert-materia-prima.dto';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export enum TipoMovimientoStockMateriaPrimaDto {
  ingreso = 'ingreso',
  egreso = 'egreso',
  ajuste_entrada = 'ajuste_entrada',
  ajuste_salida = 'ajuste_salida',
}

export enum OrigenMovimientoStockMateriaPrimaDto {
  compra = 'compra',
  consumo_produccion = 'consumo_produccion',
  ajuste_manual = 'ajuste_manual',
  transferencia = 'transferencia',
  devolucion = 'devolucion',
  otro = 'otro',
}

export class RegistrarMovimientoStockDto {
  @IsOptional()
  @IsEnum(UnidadMateriaPrimaDto)
  unidad?: UnidadMateriaPrimaDto;

  /** Cantidad efectivamente recibida en stock, sólo para ingresos por peso. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  cantidadStock?: number;

  @IsUUID()
  varianteId: string;

  @IsUUID()
  ubicacionId: string;

  @IsEnum(TipoMovimientoStockMateriaPrimaDto)
  tipo: TipoMovimientoStockMateriaPrimaDto;

  @IsEnum(OrigenMovimientoStockMateriaPrimaDto)
  origen: OrigenMovimientoStockMateriaPrimaDto;

  @Type(() => Number)
  @IsNumber()
  @Min(0.00000001)
  cantidad: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costoUnitario?: number;

  @IsOptional()
  @IsString()
  referenciaTipo?: string;

  @IsOptional()
  @IsString()
  referenciaId?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
