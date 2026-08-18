import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NaturalezaEgreso } from '@prisma/client';

import {
  REGIMENES_RETENCION,
  TIPOS_COMPROBANTE_COMPRA,
} from '../egresos.types';

/**
 * Pago que viaja JUNTO con el egreso: es el "ya está pagado" del formulario.
 *
 * El 80% de los egresos de una imprenta son de contado (la nafta, la limpieza,
 * el flete), y hacer que el usuario cargue el gasto y después lo pague en dos
 * pantallas sería burocracia. Abajo son dos filas; arriba es un solo gesto.
 */
export class PagoInlineDto {
  @IsUUID()
  metodoPagoId: string;

  @IsUUID()
  cuentaOrigenId: string;

  /** Default: la fecha de competencia del egreso. */
  @IsOptional()
  @IsISO8601()
  fecha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  referencia?: string;
}

export class CrearEgresoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  descripcion: string;

  @IsUUID()
  categoriaEgresoId: string;

  /** Null/ausente = egreso sin proveedor (multa, adelanto, flete sin factura). */
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  /**
   * A quién se le paga. Obligatorio SÓLO si no hay proveedor: con proveedor se
   * congela su nombre, sin proveedor hay que escribirlo o el egreso queda sin
   * beneficiario y nadie sabe a quién se le pagó.
   */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  beneficiarioNombre?: string;

  /** A qué mes PERTENECE el gasto. Default: hoy. */
  @IsOptional()
  @IsISO8601()
  fechaCompetencia?: string;

  /**
   * Ausente = contado: no entra en Cuentas por pagar y exige `pago`.
   * Con valor = diferido.
   */
  @IsOptional()
  @IsISO8601()
  fechaVencimiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  moneda?: string;

  @IsNumber()
  @Min(0)
  neto: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  iva?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otrosImpuestos?: number;

  @IsOptional()
  @IsIn(TIPOS_COMPROBANTE_COMPRA)
  tipoComprobante?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  puntoVenta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroComprobante?: string;

  @IsOptional()
  @IsUUID()
  centroCostoId?: string;

  @IsOptional()
  @IsUUID()
  gastoFijoEstructuraId?: string;

  @IsOptional()
  @IsUUID()
  empleadoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;

  /** Presente = el egreso nace pagado (switch "ya está pagado"). */
  @IsOptional()
  @ValidateNested()
  @Type(() => PagoInlineDto)
  pago?: PagoInlineDto;

  /**
   * Cuotas: en vez de un egreso con N vencimientos se crean N egresos
   * hermanados, uno por cuota. Es lo que se ve en el listado igual, se paga
   * por separado sin lógica nueva, y cada cuota envejece por su cuenta en el
   * aging. Sólo con vencimiento (una compra en cuotas no es de contado).
   */
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(36)
  cuotas?: number;
}

export class EditarEgresoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  descripcion?: string;

  @IsOptional()
  @IsUUID()
  categoriaEgresoId?: string;

  @IsOptional()
  @IsISO8601()
  fechaCompetencia?: string;

  @IsOptional()
  @IsISO8601()
  fechaVencimiento?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  neto?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  iva?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otrosImpuestos?: number;

  @IsOptional()
  @IsUUID()
  centroCostoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class AnularDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motivo: string;
}

export class ImputacionPagoDto {
  @IsUUID()
  egresoId: string;

  @IsNumber()
  @Min(0.01)
  monto: number;
}

/** Retención PRACTICADA: se la retenemos al proveedor al pagarle. */
export class RetencionPracticadaDto {
  @IsIn(REGIMENES_RETENCION)
  regimen: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  jurisdiccion?: string;

  @IsNumber()
  @Min(0.01)
  base: number;

  @IsNumber()
  @Min(0.001)
  alicuota: number;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nroComprobante?: string;
}

/** Cheque PROPIO emitido: la factura queda paga pero la plata no salió. */
export class ChequePropioDto {
  @IsString()
  @MaxLength(30)
  numero: string;

  @IsString()
  @MaxLength(80)
  banco: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  identificadorBancario?: string;

  @IsIn(['fisico', 'echeq'])
  formato: string;

  @IsOptional()
  @IsIn(['comun', 'diferido'])
  modalidad?: 'comun' | 'diferido';

  @IsOptional()
  @IsISO8601()
  fechaEmision?: string;

  /** Con fecha futura es diferido; es lo que define cuándo sale la plata. */
  @IsOptional()
  @IsISO8601()
  fechaPago?: string;
}

export class RegistrarPagoDto {
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @IsUUID()
  metodoPagoId: string;

  /** No corresponde al endosar un cheque de tercero. */
  @IsOptional()
  @IsUUID()
  cuentaOrigenId?: string;

  @IsOptional()
  @IsISO8601()
  fecha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  referencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;

  /** Uno o varios egresos: un pago puede cerrar varias facturas de una. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImputacionPagoDto)
  imputaciones: ImputacionPagoDto[];

  /** Reducen lo que SALE sin reducir lo que se salda. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RetencionPracticadaDto)
  retenciones?: RetencionPracticadaDto[];

  /**
   * Cheque PROPIO que se emite. Con método cheque_echeq va esto o `valorId`.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ChequePropioDto)
  cheque?: ChequePropioDto;

  /**
   * Cheque DE TERCERO que se endosa: el que entró por un cobro y está en
   * cartera. Es la otra mitad del pago con cheque y en una imprenta pesa
   * tanto como emitir uno propio — el cheque que dio un cliente se usa para
   * pagarle al papelero, y así la plata nunca pasa por el banco.
   */
  @IsOptional()
  @IsUUID()
  valorId?: string;
}

export class DebitarValorDto {
  @IsOptional()
  @IsISO8601()
  fecha?: string;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class RechazarValorPropioDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo: string;

  @IsOptional()
  @IsISO8601()
  fecha?: string;

  /** Identifica el contramovimiento si el cheque ya se había debitado. */
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}

export class CrearCategoriaEgresoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre: string;

  @IsIn(Object.values(NaturalezaEgreso))
  naturaleza: NaturalezaEgreso;
}

export class EditarCategoriaEgresoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsNumber()
  orden?: number;
}
