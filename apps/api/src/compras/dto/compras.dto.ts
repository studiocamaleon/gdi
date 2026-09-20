import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { UnidadMateriaPrima } from '@prisma/client';
export class OfertaCompraDto {
  @IsUUID() proveedorId: string;
  @IsUUID() varianteId: string;
  @IsInt() @Min(0) version: number;
  @IsOptional() @IsString() @MaxLength(120) codigoProveedor?: string;
  @IsEnum(UnidadMateriaPrima) unidadCompra: UnidadMateriaPrima;
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  @Max(999999999)
  factorStock: number;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  @Max(99999999)
  precio?: number | null;
  @IsString() @Length(3, 3) moneda: string;
  @IsNumber({ maxDecimalPlaces: 8 }) @Min(0) @Max(999999999) minimo: number;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  @Max(999999999)
  multiplo?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(3650) reposicionDias?: number | null;
  @IsOptional() @IsIn(['HABILES', 'CORRIDOS']) reposicionTipo?: string | null;
  @IsOptional() @IsDateString({ strict: true }) vigenteHasta?: string | null;
  @IsBoolean() activo: boolean;
}
export class AsignacionCompraDto {
  @IsUUID() necesidadId: string;
  @IsString() @Length(64, 64) revision: string;
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  @Max(999999999999)
  cantidad: number;
}
export class LineaCompraDto {
  @IsUUID() varianteId: string;
  @IsEnum(UnidadMateriaPrima) unidadCompra: UnidadMateriaPrima;
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  @Max(999999999)
  factorStock: number;
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  @Max(999999999)
  cantidad: number;
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  @Max(99999999)
  precio: number;
  @IsOptional() @IsDateString({ strict: true }) fechaConfirmada?: string | null;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AsignacionCompraDto)
  asignaciones: AsignacionCompraDto[];
}
export class CrearCompraDto {
  @IsUUID() clave: string;
  @IsUUID() proveedorId: string;
  @IsUUID() ubicacionId: string;
  @IsDateString({ strict: true }) fechaPedido: string;
  @IsString() @Length(3, 3) moneda: string;
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  @Max(99999999)
  tipoCambio: number;
  @IsOptional() @IsString() @MaxLength(1000) notas?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LineaCompraDto)
  lineas: LineaCompraDto[];
}
export class AccionCompraDto {
  @IsUUID() clave: string;
  @IsInt() @Min(1) version: number;
  @IsIn(['emitir', 'cancelar', 'cerrar', 'fecha']) accion: string;
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
  @IsOptional() @IsUUID() lineaId?: string;
  @IsOptional() @IsDateString({ strict: true }) fechaConfirmada?: string | null;
}
export class LineaRecepcionDto {
  @IsUUID() lineaId: string;
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  @Max(999999999)
  cantidad: number;
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  @Max(999999999999)
  cantidadStock: number;
}
export class RecibirCompraDto {
  @IsUUID() clave: string;
  @IsInt() @Min(1) version: number;
  @IsUUID() ubicacionId: string;
  @IsOptional() @IsString() @MaxLength(160) referencia?: string;
  @IsOptional() @IsString() @MaxLength(500) notas?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LineaRecepcionDto)
  lineas: LineaRecepcionDto[];
}
