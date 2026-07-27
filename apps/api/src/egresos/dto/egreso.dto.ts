import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NaturalezaEgreso } from '@prisma/client';

import { TIPOS_COMPROBANTE_COMPRA } from '../egresos.types';

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
  neto: number;

  @IsOptional()
  @IsNumber()
  iva?: number;

  @IsOptional()
  @IsNumber()
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
  neto?: number;

  @IsOptional()
  @IsNumber()
  iva?: number;

  @IsOptional()
  @IsNumber()
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

export class RegistrarPagoDto {
  @IsUUID()
  metodoPagoId: string;

  @IsUUID()
  cuentaOrigenId: string;

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
