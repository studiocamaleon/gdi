import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PAISES_LATAM } from '../../common/paises';
import { ProveedorContactoDto } from './contacto.dto';
import { ProveedorDireccionDto } from './direccion.dto';

export class UpsertProveedorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  razonSocial?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  telefonoCodigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefonoNumero?: string;

  @IsString()
  @Length(2, 2)
  @IsIn(PAISES_LATAM as unknown as string[], {
    message: 'El país no pertenece al catálogo disponible.',
  })
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
  @MaxLength(60)
  cbuAlias?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProveedorContactoDto)
  contactos: ProveedorContactoDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProveedorDireccionDto)
  direcciones: ProveedorDireccionDto[];
}

export class UpdateProveedorDto extends UpsertProveedorDto {
  @IsISO8601()
  updatedAt: string;
}

export class EstadoProveedorDto {
  @IsBoolean()
  activo: boolean;
}

export class ImportarProveedoresDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpsertProveedorDto)
  proveedores: UpsertProveedorDto[];
}
