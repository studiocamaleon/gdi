import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { UnidadMateriaPrimaDto } from './upsert-materia-prima.dto';

const toDecimalNumber = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return Number.NaN;
    return Number(normalized);
  }
  return value as unknown;
};

export class BulkCostoVarianteDto {
  @IsUUID()
  id: string;

  @IsOptional()
  @Transform(toDecimalNumber)
  @IsNumber()
  @Min(0)
  precioReferencia?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  moneda?: string;

  @IsOptional()
  @IsEnum(UnidadMateriaPrimaDto)
  unidadStock?: UnidadMateriaPrimaDto;

  @IsOptional()
  @IsEnum(UnidadMateriaPrimaDto)
  unidadCompra?: UnidadMateriaPrimaDto;
}

export class BulkCostoMaterialDto {
  @IsUUID()
  id: string;

  @IsOptional()
  @IsEnum(UnidadMateriaPrimaDto)
  unidadStock?: UnidadMateriaPrimaDto;

  @IsOptional()
  @IsEnum(UnidadMateriaPrimaDto)
  unidadCompra?: UnidadMateriaPrimaDto;
}

export class BulkUpdateCostosDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCostoVarianteDto)
  variantes?: BulkCostoVarianteDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCostoMaterialDto)
  materiales?: BulkCostoMaterialDto[];
}
