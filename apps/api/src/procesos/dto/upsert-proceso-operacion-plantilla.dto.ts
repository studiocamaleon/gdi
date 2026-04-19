import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  BaseCalculoProductividadDto,
  ModoProductividadProcesoDto,
  TipoOperacionProcesoDto,
  UnidadProcesoDto,
} from './upsert-proceso.dto';

export class UpsertProcesoOperacionPlantillaDto {
  @IsString()
  @MinLength(1)
  nombre: string;

  @IsEnum(TipoOperacionProcesoDto)
  tipoOperacion: TipoOperacionProcesoDto;

  @IsOptional()
  @IsUUID()
  centroCostoId?: string;

  @IsOptional()
  @IsUUID()
  maquinaId?: string;

  @IsOptional()
  @IsUUID()
  perfilOperativoId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  setupMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cleanupMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tiempoFijoMin?: number;

  @IsOptional()
  @IsEnum(ModoProductividadProcesoDto)
  modoProductividad?: ModoProductividadProcesoDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  productividadBase?: number;

  @IsOptional()
  @IsEnum(UnidadProcesoDto)
  unidadEntrada?: UnidadProcesoDto;

  @IsOptional()
  @IsEnum(UnidadProcesoDto)
  unidadSalida?: UnidadProcesoDto;

  @IsOptional()
  @IsEnum(UnidadProcesoDto)
  unidadTiempo?: UnidadProcesoDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mermaRunPct?: number;

  @IsOptional()
  @IsObject()
  reglaVelocidad?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  reglaMerma?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(BaseCalculoProductividadDto)
  baseCalculoProductividad?: BaseCalculoProductividadDto;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsUUID()
  estacionId?: string;

  // ── Extensiones modelo universal (P3.a.1) ───────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(80)
  familiaV2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unidadProductivaV2?: string;

  @IsOptional()
  @IsIn(['OBLIGATORIO', 'OPCIONAL', 'CONDICIONAL'])
  activacionV2?: 'OBLIGATORIO' | 'OPCIONAL' | 'CONDICIONAL';

  @IsOptional()
  @IsObject()
  condicionV2?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leeDelTrabajoV2?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leeDePasosV2?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  produceV2?: string[];

  @IsOptional()
  @IsObject()
  configNestingV2?: Record<string, unknown>;
  // ────────────────────────────────────────────────────────────────────

  @IsBoolean()
  activo: boolean;
}
