import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  Matches,
  IsIn,
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const METODO_PAGO_TIPOS = [
  'efectivo',
  'transferencia',
  'billetera_qr',
  'tarjeta_debito',
  'tarjeta_credito',
  'cheque_echeq',
  'debito_automatico',
] as const;

export type MetodoPagoTipo = (typeof METODO_PAGO_TIPOS)[number];

export class ReglaRetencionDto {
  @IsUUID() id: string;
  @IsIn([
    'SIRCREB',
    'SIRTAC',
    'SIRCUPA',
    'IIBB_CONVENIO',
    'SICORE_GANANCIAS',
    'IVA_RG2854',
    'PERCEPCION_IIBB',
    'otro',
  ])
  regimen: string;
  @IsString() @MaxLength(60) jurisdiccion: string;
  @IsIn(['procesador', 'banco', 'cliente']) agente:
    | 'procesador'
    | 'banco'
    | 'cliente';
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(100) alicuota: number;
  @IsIn(['bruto', 'neto_liquidacion']) baseCalculo:
    | 'bruto'
    | 'neto_liquidacion';
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) vigenteDesde?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) vigenteHasta?: string;
}

export class UpsertMetodoPagoDto {
  @IsOptional()
  @IsIn(['habiles_bancarios', 'corridos'])
  calendarioAcreditacion?: 'habiles_bancarios' | 'corridos';
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(370)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  feriadosAdicionales?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ReglaRetencionDto)
  retencionesConfig?: ReglaRetencionDto[];

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre: string;

  @IsIn(METODO_PAGO_TIPOS)
  tipo: MetodoPagoTipo;

  @IsNumber()
  @Min(0)
  @Max(100)
  comisionPct: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  ivaComisionPct: number;

  @IsInt()
  @Min(0)
  @Max(365)
  plazoAcreditacionDias: number;

  @IsBoolean()
  sufreRetencion: boolean;

  @IsOptional()
  @IsUUID()
  cuentaDestinoId?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
