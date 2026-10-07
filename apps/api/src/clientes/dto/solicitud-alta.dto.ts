import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
const texto = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
export class SolicitudAltaDto {
  @Transform(texto) @IsString() @Length(3, 160) nombre!: string;
  @IsIn(['DNI', 'CUIT']) documentoTipo!: 'DNI' | 'CUIT';
  @IsString() @Matches(/^[\d .-]{7,15}$/) documentoNumero!: string;
  @IsIn(['consumidor_final', 'RI', 'monotributo', 'exento'])
  condicionFiscal!: string;
  @IsString() @Length(8, 30) @Matches(/^[+\d ()-]+$/) telefono!: string;
  @Transform(texto) @IsString() @Length(3, 200) direccion!: string;
  @Transform(texto) @IsString() @Length(2, 120) ciudad!: string;
  // Campo trampa, no visible para quien completa el formulario.
  @IsOptional() @IsString() @MaxLength(100) sitioWeb?: string;
}
export class ResolverAltaDto {
  @IsIn(['aprobar', 'rechazar', 'vincular']) accion!:
    | 'aprobar'
    | 'rechazar'
    | 'vincular';
  @IsOptional() @IsUUID() clienteId?: string;
  @IsOptional() @IsBoolean() confirmarCoincidencias?: boolean;
  @IsOptional() @Transform(texto) @IsString() @MaxLength(500) motivo?: string;
}
