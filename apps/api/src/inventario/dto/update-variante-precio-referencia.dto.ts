import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpdateVariantePrecioReferenciaDto {
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.').trim();
      if (!normalized) {
        return Number.NaN;
      }
      return Number(normalized);
    }
    return value;
  })
  @IsNumber()
  @Min(0)
  precioReferencia: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  moneda?: string;
}
