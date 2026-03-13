import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpdateVariantePrecioReferenciaDto {
  @IsNumber()
  @Min(0)
  precioReferencia: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  moneda?: string;
}
