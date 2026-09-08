import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolverGatePasoDto {
  @IsIn(['MATERIAL', 'CALIDAD'])
  tipo!: 'MATERIAL' | 'CALIDAD';

  @IsIn(['CUMPLIDO', 'PENDIENTE'])
  estado!: 'CUMPLIDO' | 'PENDIENTE';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  detalle?: string;
}
