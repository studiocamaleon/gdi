import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  CONDICIONES_EMISOR,
  LEYENDAS_A,
} from '../letra-comprobante';

export const PROVEEDORES_FACTURACION = ['manual', 'tusfacturas'] as const;
export const MODALIDADES_PUNTO_VENTA = [
  'web_services',
  'portal',
  'talonario',
] as const;

export class UpsertConfiguracionFiscalDto {
  @IsString()
  @MinLength(1)
  razonSocial: string;

  @IsString()
  @Matches(/^[\d-]+$/, { message: 'El CUIT sólo puede tener números y guiones' })
  cuit: string;

  @IsIn(CONDICIONES_EMISOR as unknown as string[], {
    message: `condicionFiscal debe ser uno de: ${CONDICIONES_EMISOR.join(', ')}`,
  })
  condicionFiscal: (typeof CONDICIONES_EMISOR)[number];

  @IsOptional()
  @IsString()
  ingresosBrutos?: string;

  @IsOptional()
  @IsString()
  domicilioFiscal?: string;

  /** ISO date (YYYY-MM-DD). */
  @IsOptional()
  @IsString()
  inicioActividades?: string;

  @IsOptional()
  @IsIn(LEYENDAS_A as unknown as string[], {
    message: `leyendaFacturaA debe ser una de: ${LEYENDAS_A.join(' | ')}`,
  })
  leyendaFacturaA?: (typeof LEYENDAS_A)[number] | null;

  @IsOptional()
  @IsIn(PROVEEDORES_FACTURACION as unknown as string[])
  proveedorFacturacion?: (typeof PROVEEDORES_FACTURACION)[number];
}

export class UpsertPuntoVentaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99999)
  numero: number;

  @IsString()
  @MinLength(1)
  nombre: string;

  @IsOptional()
  @IsIn(MODALIDADES_PUNTO_VENTA as unknown as string[])
  modalidad?: (typeof MODALIDADES_PUNTO_VENTA)[number];

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
