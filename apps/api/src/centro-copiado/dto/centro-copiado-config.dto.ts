import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Actualización de la config del Centro de copiado. Los campos JSON son CURACIÓN
 * opcional: OMITIRLOS deja el valor como está; enviarlos en `null` LIMPIA (vuelve
 * al default). `@IsOptional` acepta null y undefined, así se distingue "no tocar"
 * (undefined) de "limpiar" (null) en el service.
 */
class PapelConfigDto {
  @IsUUID()
  materiaPrimaId!: string;

  /** Gramajes ofrecidos de ese papel; vacío/ausente = todos. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  gramajes?: number[];
}

class TramoMargenCentroCopiadoDto {
  /** Primera cantidad de hojas a la que aplica el tramo. */
  @IsInt()
  @Min(1)
  @Max(1000000)
  desdeCantidad!: number;

  @IsNumber()
  @Min(0)
  @Max(99)
  margenPct!: number;
}

export class ActualizarCentroCopiadoConfigDto {
  /** Versión leída por el cliente; 0 representa una configuración aún inexistente. */
  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  /** Cobrar preparación/limpieza de máquina en cada documento (default false). */
  @IsOptional()
  @IsBoolean()
  cobraSetup?: boolean;

  /** Margen % del producto plantilla de CC (precio = costo × margen). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  margenPct?: number;

  /** Margen mínimo % (piso de rentabilidad) del producto plantilla de CC. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  margenMinimoPct?: number;

  /** Política comercial aplicada por el motor universal. */
  @IsOptional()
  @IsIn(['MARGEN_FIJO', 'MARGEN_POR_VOLUMEN'])
  politicaPrecio?: 'MARGEN_FIJO' | 'MARGEN_POR_VOLUMEN';

  /** Tramos "desde N hojas" para MARGEN_POR_VOLUMEN. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TramoMargenCentroCopiadoDto)
  tramosMargen?: TramoMargenCentroCopiadoDto[];

  /** Cantidad mínima de hojas facturables por documento. 0 = sin mínimo. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  minimoHojasFacturables?: number;

  /** Minutos de preparación (setup) por documento; override propio de CC. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1440)
  setupMin?: number;

  /** Minutos de limpieza (cleanup) por documento; override propio de CC. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1440)
  cleanupMin?: number;

  /** Máquina láser de color; null = auto-resolver por rol. */
  @IsOptional()
  @IsUUID()
  maquinaColorId?: string | null;

  /** Máquina láser B/N; null = auto-resolver por rol. */
  @IsOptional()
  @IsUUID()
  maquinaBnId?: string | null;

  /** Anilladora para el "Anillado"; null = la única activa (o sin anillado). */
  @IsOptional()
  @IsUUID()
  maquinaAnilladoraId?: string | null;

  /** Materia prima de la tapa frontal (transparente); null = auto/heurística. */
  @IsOptional()
  @IsUUID()
  tapaFrontalMateriaPrimaId?: string | null;

  /** Materia prima de la contratapa (plástica de color); null = auto/heurística. */
  @IsOptional()
  @IsUUID()
  tapaContratapaMateriaPrimaId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PapelConfigDto)
  papeles?: PapelConfigDto[] | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tamanos?: string[] | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1)
  @ArrayUnique()
  @IsIn(['Anillado'], { each: true })
  terminaciones?: string[] | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsIn(['ESPIRAL_PLASTICO', 'WIRE_O'], { each: true })
  tiposAnillo?: string[] | null;
}
