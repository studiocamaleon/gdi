import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class TiempoColaDto {
  @IsUUID('4') pasoId!: string;
  @IsOptional() @IsNumber() @Min(1) tiempoDeclaradoMin?: number;
  @IsOptional() @IsBoolean() sinTiempoConfirmado?: boolean;
}
export class CompletarColaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  pasoIds!: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TiempoColaDto)
  tiempos?: TiempoColaDto[];
}
