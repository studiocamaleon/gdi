import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProveedorContactoDto } from './contacto.dto';
import { ProveedorDireccionDto } from './direccion.dto';

export class UpsertProveedorDto {
  @IsString()
  @MinLength(1)
  nombre: string;

  @IsOptional()
  @IsString()
  razonSocial?: string;

  @IsEmail()
  email: string;

  @IsString()
  telefonoCodigo: string;

  @IsString()
  telefonoNumero: string;

  @IsString()
  @Length(2, 2)
  pais: string;

  /**
   * Datos para PAGARLE (docs/egresos-y-cuentas-por-pagar-diseno.md §4.6).
   * Hasta que existió Egresos, el proveedor servía para referenciar materiales
   * y tercerizar pasos, no para registrar una factura de compra ni pagarla.
   */
  @IsOptional()
  @Matches(/^\d{11}$/, { message: 'El CUIT son 11 dígitos, sin guiones.' })
  cuit?: string;

  @IsOptional()
  @IsIn(['RI', 'MONOTRIBUTO', 'EXENTO', 'CF'])
  condicionIva?: string;

  /** Días de plazo que da. Precarga el vencimiento al cargar su factura. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  condicionPagoDias?: number;

  @IsOptional()
  @IsString()
  @Length(0, 60)
  cbuAlias?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProveedorContactoDto)
  contactos: ProveedorContactoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProveedorDireccionDto)
  direcciones: ProveedorDireccionDto[];
}
