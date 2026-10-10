import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Sólo instrucciones comerciales: los importes se resuelven en el servidor. */
export class DescuentoOrdenDto {
  @IsISO8601() expectedVersion!: string;
  @IsIn(['manual', 'cupon', 'quitar']) modo!: 'manual' | 'cupon' | 'quitar';
  @IsOptional() @IsIn(['PORCENTAJE', 'MONTO']) tipo?: 'PORCENTAJE' | 'MONTO';
  @IsOptional() @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsString() @MaxLength(100) codigo?: string;
}
