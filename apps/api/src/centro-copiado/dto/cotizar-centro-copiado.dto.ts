import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CENTRO_COPIADO_COBERTURAS,
  CENTRO_COPIADO_TERMINACIONES,
  CENTRO_COPIADO_TIPOS_ANILLO,
} from '../centro-copiado.domain';

/**
 * Request del preview del TPV Centro de copiado (POST /centro-copiado/cotizar).
 * Cada documento llega ya resuelto (los "valores por defecto / aplicar a todos"
 * del modal se aplican en el front). Un mismo `grupoId` agrupa documentos en un
 * tomo; los `grupos` traen los `juegos` del tomo.
 */
export class DocumentoCentroCopiadoDto {
  @IsString()
  @MaxLength(100)
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @IsInt()
  @Min(1)
  paginas!: number;

  @IsInt()
  @Min(1)
  copias!: number;

  /** Nombre del formato (etiqueta), ej. "A4", "SRA3". */
  @IsString()
  @MaxLength(40)
  tamano!: string;

  /** Medidas del pliego (del catálogo de formatos del sistema). */
  @IsNumber()
  @Min(1)
  tamanoAnchoMm!: number;

  @IsNumber()
  @Min(1)
  tamanoAltoMm!: number;

  /** TIPO de papel (materia prima); el tamaño define el formato. */
  @IsUUID()
  papelMateriaPrimaId!: string;

  /** Gramaje elegido (si el tipo tiene más de uno). */
  @IsOptional()
  @IsInt()
  @Min(1)
  gramaje?: number;

  @IsIn(['BN', 'COLOR'])
  color!: 'BN' | 'COLOR';

  @IsIn([1, 2])
  faz!: 1 | 2;

  /** Cobertura de tóner del documento; ausente = 'alta'. */
  @IsOptional()
  @IsIn(CENTRO_COPIADO_COBERTURAS)
  cobertura?: string;

  /** Terminaciones (pasos opcionales) de un documento suelto. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1)
  @ArrayUnique()
  @IsIn(CENTRO_COPIADO_TERMINACIONES, { each: true })
  terminaciones?: string[];

  /** Tipo de anillo elegido (ESPIRAL_PLASTICO | WIRE_O) para el anillado. */
  @IsOptional()
  @IsIn(CENTRO_COPIADO_TIPOS_ANILLO)
  tipoAnillo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  grupoId?: string | null;
}

export class GrupoCentroCopiadoDto {
  @IsString()
  @MaxLength(100)
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @IsInt()
  @Min(1)
  juegos!: number;

  /** Terminaciones (pasos opcionales) del tomo entero. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1)
  @ArrayUnique()
  @IsIn(CENTRO_COPIADO_TERMINACIONES, { each: true })
  terminaciones?: string[];

  /** Tipo de anillo elegido (ESPIRAL_PLASTICO | WIRE_O) para el anillado. */
  @IsOptional()
  @IsIn(CENTRO_COPIADO_TIPOS_ANILLO)
  tipoAnillo?: string;
}

export class CotizarCentroCopiadoDto {
  /** Cliente de la cotización. Permite al motor aplicar su precio especial. */
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DocumentoCentroCopiadoDto)
  documentos!: DocumentoCentroCopiadoDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GrupoCentroCopiadoDto)
  grupos?: GrupoCentroCopiadoDto[];
}

/**
 * Persiste la carga en una cotización: un renglón por documento suelto y uno por
 * tomo compuesto. Se agrega a `cotizacionId` (borrador) o a una nueva. La
 * OrdenTrabajoItem se crea después, por el flujo normal de la OT.
 */
export class AgregarAOrdenCentroCopiadoDto extends CotizarCentroCopiadoDto {
  /** Evita duplicados ante doble clic o reintento de red. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;

  /** Cotización borrador a la que agregar; si falta, se crea una. */
  @IsOptional()
  @IsUUID()
  cotizacionId?: string;

  /** Id de esta carga (agrupa todos sus renglones en la ficha). Se genera si falta. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  grupoCargaId?: string;
}
