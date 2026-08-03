import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Request del preview del TPV Centro de copiado (POST /centro-copiado/cotizar).
 * Cada documento llega ya resuelto (los "valores por defecto / aplicar a todos"
 * del modal se aplican en el front). Un mismo `grupoId` agrupa documentos en un
 * tomo; los `grupos` traen los `juegos` del tomo.
 */
export class DocumentoCentroCopiadoDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsInt()
  @Min(1)
  paginas!: number;

  @IsInt()
  @Min(1)
  copias!: number;

  /** Nombre del formato (etiqueta), ej. "A4", "SRA3". */
  @IsString()
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
  @IsIn(['borrador', 'normal', 'alta'])
  cobertura?: string;

  /** Terminaciones (pasos opcionales) de un documento suelto. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  terminaciones?: string[];

  @IsOptional()
  @IsString()
  grupoId?: string | null;
}

export class GrupoCentroCopiadoDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsInt()
  @Min(1)
  juegos!: number;

  /** Terminaciones (pasos opcionales) del tomo entero. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  terminaciones?: string[];
}

export class CotizarCentroCopiadoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentoCentroCopiadoDto)
  documentos!: DocumentoCentroCopiadoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrupoCentroCopiadoDto)
  grupos?: GrupoCentroCopiadoDto[];
}

/**
 * Persiste la carga como N CotizacionItem (un renglón por documento), agrupados
 * por `grupoTomoId`. Se agregan a la cotización `cotizacionId` (borrador) o a una
 * nueva. La OrdenTrabajoItem se crea después, por el flujo normal de la OT.
 */
export class AgregarAOrdenCentroCopiadoDto extends CotizarCentroCopiadoDto {
  /** Cotización borrador a la que agregar; si falta, se crea una. */
  @IsOptional()
  @IsUUID()
  cotizacionId?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  /** Id de esta carga (agrupa todos sus renglones en la ficha). Se genera si falta. */
  @IsOptional()
  @IsString()
  grupoCargaId?: string;
}
