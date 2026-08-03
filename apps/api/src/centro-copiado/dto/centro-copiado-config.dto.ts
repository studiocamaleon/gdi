import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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
  @IsInt({ each: true })
  @Min(1, { each: true })
  gramajes?: number[];
}

export class ActualizarCentroCopiadoConfigDto {
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
  margenPct?: number;

  /** Margen mínimo % (piso de rentabilidad) del producto plantilla de CC. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  margenMinimoPct?: number;

  /** Minutos de preparación (setup) por documento; override propio de CC. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  setupMin?: number;

  /** Minutos de limpieza (cleanup) por documento; override propio de CC. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  cleanupMin?: number;

  /** Máquina láser de color; null = auto-resolver por rol. */
  @IsOptional()
  @IsUUID()
  maquinaColorId?: string | null;

  /** Máquina láser B/N; null = auto-resolver por rol. */
  @IsOptional()
  @IsUUID()
  maquinaBnId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PapelConfigDto)
  papeles?: PapelConfigDto[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tamanos?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  terminaciones?: string[] | null;
}
