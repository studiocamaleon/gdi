import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsNumber,
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
import { ClienteContactoDto } from './contacto.dto';
import { ClienteDireccionDto } from './direccion.dto';
import { PAISES_CLIENTES } from './paises';

/**
 * Condiciones fiscales del receptor (AR). Junto con la del emisor definen
 * la letra del comprobante — ver docs/modulo-administracion-diseno.md.
 */
export const CONDICIONES_FISCALES = [
  'RI',
  'monotributo',
  'exento',
  'consumidor_final',
  'exterior',
] as const;

export type CondicionFiscal = (typeof CONDICIONES_FISCALES)[number];

export class UpsertClienteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  razonSocial?: string;

  /** CUIT con o sin guiones; se normaliza a 11 dígitos. */
  @IsOptional()
  @IsString()
  @Matches(/^[\d-]*$/, {
    message: 'El CUIT sólo puede tener números y guiones',
  })
  @MaxLength(13)
  cuit?: string;

  /** DNI sin puntos. Va aparte del CUIT: ARCA los declara con tipos
   *  distintos (96 = DNI, 80 = CUIT). */
  @IsOptional()
  @Matches(/^\d{7,9}$/, { message: 'El DNI no parece válido.' })
  documentoNumero?: string;

  @IsOptional()
  @IsIn(CONDICIONES_FISCALES as unknown as string[], {
    message: `condicionFiscal debe ser uno de: ${CONDICIONES_FISCALES.join(', ')}`,
  })
  condicionFiscal?: CondicionFiscal;

  @IsOptional()
  @IsNumber()
  @Min(0)
  limiteCredito?: number | null;

  /** Null = venta común; número = cuenta corriente con ese plazo. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  plazoCuentaCorrienteDias?: number | null;

  @ValidateIf(
    (_, value) => value !== undefined && value !== null && value !== '',
  )
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
  @IsIn(PAISES_CLIENTES as unknown as string[], {
    message: 'El país no pertenece al catálogo disponible.',
  })
  pais: string;

  @IsOptional()
  @IsBoolean()
  aceptaWhatsapp?: boolean | null;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ClienteContactoDto)
  contactos: ClienteContactoDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ClienteDireccionDto)
  direcciones: ClienteDireccionDto[];
}

export class UpdateClienteDto extends UpsertClienteDto {
  @IsISO8601()
  updatedAt: string;
}

export class EstadoClienteDto {
  @IsBoolean()
  activo: boolean;
}

export class ImportarClientesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpsertClienteDto)
  clientes: UpsertClienteDto[];
}

/**
 * Alta desde el DNI escaneado en el mostrador. Pide lo mínimo que hace falta
 * para no perder de vista quién es el cliente: nombre y documento salen del
 * propio documento, el celular es opcional y el email no se pide.
 */
export class AltaPorDocumentoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  nombre: string;

  /** Sólo dígitos, tal como sale del PDF417. */
  @IsString()
  @Matches(/^\d{7,9}$/, { message: 'El documento no parece un DNI.' })
  documento: string;

  /** CUIL derivado del documento; null si no se pudo calcular. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/)
  cuit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  telefonoCodigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefonoNumero?: string;
}
