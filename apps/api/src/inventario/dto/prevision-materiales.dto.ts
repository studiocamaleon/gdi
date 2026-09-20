import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
export class MaterialPrevisionDto {
  @IsString() @MaxLength(120) varianteId: string;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0)
  @Max(999999999999)
  cantidad: number | null;
  @IsOptional() @IsString() @MaxLength(32) unidad: string | null;
  @IsBoolean() consumible: boolean;
}
export class PrevisionMaterialesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => MaterialPrevisionDto)
  materiales: MaterialPrevisionDto[];
  @IsInt() @Min(0) @Max(10000) pendientes: number;
}
