import { IsBooleanString, IsOptional, IsUUID } from 'class-validator';

export class GetStockQueryDto {
  @IsOptional()
  @IsUUID()
  varianteId?: string;

  @IsOptional()
  @IsUUID()
  materiaPrimaId?: string;

  @IsOptional()
  @IsUUID()
  almacenId?: string;

  @IsOptional()
  @IsUUID()
  ubicacionId?: string;

  @IsOptional()
  @IsBooleanString()
  soloConStock?: string;
}
