import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PiezaJobContextDto {
  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsNumber()
  @Min(0)
  anchoMm!: number;

  @IsNumber()
  @Min(0)
  altoMm!: number;
}

export class JobContextDto {
  @IsInt()
  @Min(0)
  cantidad!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PiezaJobContextDto)
  piezas?: PiezaJobContextDto[];

  @IsOptional()
  @IsObject()
  medidaCustomMm?: { anchoMm: number; altoMm: number };

  @IsOptional()
  @IsInt()
  caras?: 1 | 2;

  @IsOptional()
  @IsInt()
  tipoCopia?: 1 | 2 | 3;

  @IsOptional()
  @IsInt()
  numerosXTalonario?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tintasAdicionales?: string[];

  @IsOptional()
  @IsString()
  modoColor?: string;

  @IsOptional()
  @IsObject()
  modoColorPorPaso?: Record<string, string>;

  @IsOptional()
  @IsString()
  tecnologia?: string;

  @IsOptional()
  @IsNumber()
  distanciaKm?: number;

  @IsOptional()
  @IsNumber()
  m2_instalados?: number;

  @IsOptional()
  @IsString()
  zonaInstalacion?: string;

  @IsOptional()
  @IsObject()
  opcionalesActivados?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  slotMateriales?: Record<string, string>;

  @IsOptional()
  @IsObject()
  configPasoRuntime?: Record<string, Record<string, unknown>>;

  @IsOptional()
  @IsString()
  modoCotizacionLineal?: string;

  @IsOptional()
  @IsNumber()
  cantidadComercialPricing?: number;

  @IsOptional()
  @IsNumber()
  cantidadComercial?: number;

  @IsOptional()
  @IsNumber()
  metrosLineales?: number;

  @IsOptional()
  @IsNumber()
  anchoMaterialMm?: number;

  @IsOptional()
  @IsNumber()
  largoMaterialMm?: number;
}

export class CotizarDto {
  @IsUUID()
  productoId!: string;

  @IsOptional()
  @IsUUID()
  rutaAlternativaId?: string | null;

  @ValidateNested()
  @Type(() => JobContextDto)
  jobContext!: JobContextDto;

  @IsOptional()
  @IsUUID()
  clienteId?: string | null;

  @IsOptional()
  @IsString()
  periodo?: string | null;
}
