import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { monedas } from '../../common/monedas';

const CODIGOS_MONEDA = monedas.map((m) => m.codigo);

/**
 * Todo opcional menos el nombre: una imprenta que recién arranca carga el
 * teléfono hoy y la web el mes que viene, y no tiene por qué completar la
 * pantalla entera para guardar un dato.
 */
export class GuardarDatosEmpresaDto {
  /** Nombre comercial. Vive en `Tenant.nombre`, no en `DatosEmpresa`. */
  @IsString()
  @MinLength(1, { message: 'El nombre de la empresa no puede quedar vacío' })
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsString()
  telefonoCodigo?: string;

  @IsOptional()
  @IsString()
  telefonoNumero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  paisCodigo?: string;

  @IsOptional()
  @IsString()
  whatsappCodigo?: string;

  @IsOptional()
  @IsString()
  whatsappNumero?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  sitioWeb?: string;

  @IsOptional()
  @IsString()
  domicilioComercial?: string;

  @IsOptional()
  @IsString()
  localidad?: string;

  @IsOptional()
  @IsString()
  provincia?: string;

  @IsOptional()
  @IsString()
  horarioAtencion?: string;

  @IsOptional()
  @IsString()
  urlResenas?: string;

  /** ISO 4217, contra el catálogo. Etiqueta y formato, nunca conversión. */
  @IsOptional()
  @IsIn(CODIGOS_MONEDA, { message: 'Moneda desconocida' })
  monedaCodigo?: string;

  /**
   * Zona IANA ("America/Santiago"). No se valida contra una lista acá: la
   * valida el service contra la base de zonas de ICU, que es la que después
   * la va a interpretar.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  zonaHoraria?: string;

  @IsOptional()
  @IsIn(['moneda', 'entero'], { message: 'Redondeo desconocido' })
  redondeoPrecio?: string;
}
