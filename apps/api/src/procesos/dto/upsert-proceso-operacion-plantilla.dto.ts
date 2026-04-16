import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  BaseCalculoProductividadDto,
  ModoProductividadProcesoDto,
  ProcesoOperacionNivelDto,
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
  @ValidateNested({ each: true })
  @Type(() => ProcesoOperacionNivelDto)
  niveles?: ProcesoOperacionNivelDto[];

  @IsOptional()
  @IsUUID()
  estacionId?: string;

  @IsBoolean()
  activo: boolean;
}
