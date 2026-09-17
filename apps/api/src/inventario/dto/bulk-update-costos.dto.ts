import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import {
  EquivalenciaMaterialDto,
  UnidadMateriaPrimaDto,
} from './upsert-materia-prima.dto';

const toDecimalNumber = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return Number.NaN;
    return Number(normalized);
  }
  return value;
};

export class BulkCostoVarianteDto {
  @IsOptional()
  @IsEnum(UnidadMateriaPrimaDto)
  unidadUso?: UnidadMateriaPrimaDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EquivalenciaMaterialDto)
  equivalencias?: EquivalenciaMaterialDto[];

  @IsOptional()
  @IsEnum(UnidadMateriaPrimaDto)
  unidadPrecio?: UnidadMateriaPrimaDto | null;

  @IsOptional()
  @Transform(toDecimalNumber)
  @IsNumber()
  @IsPositive()
  equivalenciaCompra?: number | null;

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
  @IsOptional()
  @IsEnum(UnidadMateriaPrimaDto)
  unidadUso?: UnidadMateriaPrimaDto;

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
