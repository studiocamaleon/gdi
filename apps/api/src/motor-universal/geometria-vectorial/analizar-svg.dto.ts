import {
  IsBoolean,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConfiguracionEncastresVectorialesDto {
  @IsIn(['cola_milano', 'recta'])
  tipoUnion!: 'cola_milano' | 'recta';

  @IsNumber()
  @Min(1)
  @Max(500)
  anchoEncastreMm!: number;

  @IsNumber()
  @Min(1)
  @Max(500)
  profundidadEncastreMm!: number;

  @IsIn(['por_distancia', 'cantidad_fija'])
  modoCantidad!: 'por_distancia' | 'cantidad_fija';

  @IsNumber()
  @Min(10)
  @Max(10_000)
  distanciaMaximaMm!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  cantidadFija!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  cantidadMinima!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  cantidadMaxima!: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  kerfMm!: number;
}

export class AnalizarSvgFabricacionDto {
  @IsString()
  @MaxLength(524_288)
  svg!: string;

  @IsString()
  @MaxLength(255)
  nombreArchivo!: string;

  @IsNumber()
  @Min(1)
  @Max(100_000)
  anchoFinalMm!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100_000)
  altoFinalMm?: number;

  @IsInt()
  @Min(1)
  @Max(1_000)
  cantidad!: number;

  @IsNumber()
  @Min(1)
  @Max(100_000)
  anchoPlacaMm!: number;

  @IsNumber()
  @Min(1)
  @Max(100_000)
  altoPlacaMm!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000)
  margenMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000)
  separacionMm?: number;

  @IsOptional()
  @IsBoolean()
  permitirRotacion?: boolean;

  @IsOptional()
  @IsBoolean()
  preservarComposicionOriginalSiEntra?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConfiguracionEncastresVectorialesDto)
  configuracionEncastres?: ConfiguracionEncastresVectorialesDto;
}
