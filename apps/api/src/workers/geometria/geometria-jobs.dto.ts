import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PuntoNestingOpenNestDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class AnilloNestingOpenNestDto {
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(20_000)
  @ValidateNested({ each: true })
  @Type(() => PuntoNestingOpenNestDto)
  puntos!: PuntoNestingOpenNestDto[];
}

export class PiezaNestingOpenNestDto {
  @IsString()
  @MaxLength(200)
  id!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  cantidad!: number;

  @IsInt()
  @Min(1)
  @Max(3_600)
  rotaciones!: number;

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(20_000)
  @ValidateNested({ each: true })
  @Type(() => PuntoNestingOpenNestDto)
  contorno!: PuntoNestingOpenNestDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(250)
  @ValidateNested({ each: true })
  @Type(() => AnilloNestingOpenNestDto)
  huecos?: AnilloNestingOpenNestDto[];
}

export class PlacaNestingOpenNestDto {
  @IsNumber()
  @Min(1)
  @Max(100_000)
  anchoMm!: number;

  @IsNumber()
  @Min(1)
  @Max(100_000)
  altoMm!: number;

  @IsNumber()
  @Min(0)
  @Max(10_000)
  margenMm!: number;

  @IsInt()
  @Min(1)
  @Max(1_000)
  maxPlacas!: number;
}

export class CrearTrabajoNestingOpenNestDto {
  @IsOptional()
  @IsIn(['collision', 'nfp'])
  motor?: 'collision' | 'nfp';

  @ValidateNested()
  @Type(() => PlacaNestingOpenNestDto)
  placa!: PlacaNestingOpenNestDto;

  @IsNumber()
  @Min(0)
  @Max(10_000)
  separacionMm!: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(60 * 60 * 1_000)
  timeoutMs?: number;

  @IsOptional()
  @IsInt()
  semilla?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PiezaNestingOpenNestDto)
  piezas!: PiezaNestingOpenNestDto[];

  /** Un scope identifica la misma intención mientras el usuario la edita. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  claveSolicitud?: string;
}
