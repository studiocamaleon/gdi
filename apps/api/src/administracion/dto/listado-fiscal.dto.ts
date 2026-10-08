import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FacturacionPendientesQueryDto } from './facturacion-pendientes.dto';

export class FacturacionPaginaDto extends FacturacionPendientesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  pagina?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}

export class ComprobantesPaginaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  pagina?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsIn([
    'todos',
    'borrador',
    'en_proceso',
    'por_verificar',
    'emitido',
    'cae',
    'rechazado',
    'anulado',
  ])
  estado?: string;

  @IsOptional()
  @IsIn(['todos', 'factura', 'nota_credito', 'nota_debito'])
  tipo?: string;
}
