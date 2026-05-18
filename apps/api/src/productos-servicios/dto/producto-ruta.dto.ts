import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export enum ModoActivacionPasoDto {
  OBLIGATORIO = 'OBLIGATORIO',
  OPCIONAL = 'OPCIONAL',
  CONDICIONAL = 'CONDICIONAL',
  NO_EJECUTAR = 'NO_EJECUTAR',
}

export enum ModoTiempoPasoDto {
  T1 = 'T-1',
  T2 = 'T-2',
  T3 = 'T-3',
  T4 = 'T-4',
}

export enum MecanismoCantidadPasoDto {
  DIRECT_FROM_JOBCONTEXT = 'DIRECT_FROM_JOBCONTEXT',
  HEREDAR_DEL_OUTPUT_CANONICO = 'HEREDAR_DEL_OUTPUT_CANONICO',
  CALCULADO_POR_PASO = 'CALCULADO_POR_PASO',
  CONVERSION = 'CONVERSION',
}

/**
 * DTO para asociar una RUTA ALTERNATIVA a un producto.
 */
export class CrearProductoRutaAlternativaDto {
  @IsUUID()
  rutaId!: string;

  @IsInt()
  @Min(1)
  rutaVersion!: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  nombre!: string;

  @IsOptional()
  @IsBoolean()
  esPreferida?: boolean;

  @IsOptional()
  @IsObject()
  reglaAutoSeleccionJson?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  orden?: number;
}

export class ActualizarProductoRutaAlternativaDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  esPreferida?: boolean;

  @IsOptional()
  @IsObject()
  reglaAutoSeleccionJson?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class DuplicarProductoRutaAlternativaDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  nombre?: string;
}

/**
 * DTO para upsert de la configuración de UN paso del producto.
 */
export class UpsertProductoConfigPasoDto {
  @IsUUID()
  rutaPasoId!: string;

  @IsOptional()
  @IsEnum(ModoActivacionPasoDto)
  modoActivacion?: ModoActivacionPasoDto | null;

  @IsOptional()
  @IsObject()
  condicionActivacionJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsEnum(ModoTiempoPasoDto)
  modoTiempo?: ModoTiempoPasoDto | null;

  @IsOptional()
  @IsEnum(MecanismoCantidadPasoDto)
  mecanismoCantidad?: MecanismoCantidadPasoDto | null;

  @IsOptional()
  @IsObject()
  mecanismoCantidadConfigJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  multiplicadoresActivos?: string[];

  @IsOptional()
  @IsObject()
  paramsPasoJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsUUID()
  maquinaM1Id?: string | null;

  @IsOptional()
  @IsUUID()
  perfilM1Id?: string | null;

  @IsOptional()
  @IsUUID()
  centroCostoId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  setupOverrideMin?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cleanupOverrideMin?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tiempoFijoOverrideMin?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertSlotMaterialDto)
  slotsMateriales?: UpsertSlotMaterialDto[];
}

export class UpsertSlotMaterialDto {
  @IsString()
  slotCodigo!: string;

  @IsString()
  modoSeleccion!: string;

  @IsOptional()
  @IsString()
  criterioMotorAuto?: string | null;

  @IsOptional()
  @IsString()
  criterioInputCampo?: string | null;

  @IsOptional()
  @IsString()
  criterioMaterialCampo?: string | null;

  @IsOptional()
  @IsUUID()
  materialVarianteId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertSlotMaterialCandidatoDto)
  candidatos?: UpsertSlotMaterialCandidatoDto[];

  @IsOptional()
  @IsString()
  estrategiaCosto?: string;

  @IsOptional()
  @IsString()
  formula?: string;

  @IsOptional()
  @IsBoolean()
  aplicaMultiCaras?: boolean;
}

export class UpsertSlotMaterialCandidatoDto {
  @IsUUID()
  materiaPrimaId!: string;

  @IsOptional()
  @IsUUID()
  defaultVarianteId?: string | null;

  @IsOptional()
  orden?: number;

  @IsArray()
  @IsUUID(undefined, { each: true })
  varianteIds!: string[];
}

/**
 * G-F3 — DTO para agregar un paso extra inline al producto.
 *
 * Pasos extras NO son reusables: viven dentro del producto y se insertan
 * en la ruta heredada. `insertarDespuesDeRutaPasoId` apunta a un RutaPaso
 * (de cualquier ruta alternativa); null = al inicio del flujo.
 */
export class AgregarPasoExtraDto {
  @IsString()
  @IsNotEmpty()
  familiaCodigo!: string;

  @IsOptional()
  @IsUUID()
  insertarDespuesDeRutaPasoId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordenInterno?: number;

  @IsOptional()
  @IsString()
  modoActivacion?: string;

  @IsOptional()
  @IsObject()
  condicionActivacionJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  modoTiempo?: string;

  @IsOptional()
  @IsString()
  mecanismoCantidad?: string;

  @IsOptional()
  @IsObject()
  paramsPasoJson?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  maquinaM1Id?: string;

  @IsOptional()
  @IsUUID()
  perfilM1Id?: string;
}
