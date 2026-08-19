import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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
}
