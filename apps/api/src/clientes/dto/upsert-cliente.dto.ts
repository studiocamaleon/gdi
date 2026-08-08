import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ClienteContactoDto } from './contacto.dto';
import { ClienteDireccionDto } from './direccion.dto';

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
  nombre: string;

  @IsOptional()
  @IsString()
  razonSocial?: string;

  /** CUIT con o sin guiones; se normaliza a 11 dígitos. */
  @IsOptional()
  @IsString()
  @Matches(/^[\d-]*$/, {
    message: 'El CUIT sólo puede tener números y guiones',
  })
  cuit?: string;

  @IsOptional()
  @IsIn(CONDICIONES_FISCALES as unknown as string[], {
    message: `condicionFiscal debe ser uno de: ${CONDICIONES_FISCALES.join(', ')}`,
  })
  condicionFiscal?: CondicionFiscal;

  @IsOptional()
  @IsNumber()
  @Min(0)
  limiteCredito?: number | null;

  @IsEmail()
  email: string;

  @IsString()
  telefonoCodigo: string;

  @IsString()
  telefonoNumero: string;

  @IsString()
  @Length(2, 2)
  pais: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClienteContactoDto)
  contactos: ClienteContactoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClienteDireccionDto)
  direcciones: ClienteDireccionDto[];
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
