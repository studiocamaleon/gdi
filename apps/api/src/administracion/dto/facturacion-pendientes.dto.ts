import { IsDateString, IsIn, IsOptional, Matches } from 'class-validator';

export class FacturacionPendientesQueryDto {
  @IsOptional()
  @IsIn(['cobradas_sin_facturar'])
  cobro?: 'cobradas_sin_facturar';

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  emisionDesde?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  emisionHasta?: string;
}
