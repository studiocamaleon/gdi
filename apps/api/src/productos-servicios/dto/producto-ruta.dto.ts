import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

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

/**
 * DTO para upsert de la configuración de UN paso del producto.
 */
export class UpsertProductoConfigPasoDto {
  @IsUUID()
  rutaPasoId!: string;

  @IsOptional()
  @IsString()
  modoActivacion?: string | null;

  @IsOptional()
  @IsObject()
  condicionActivacionJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  modoTiempo?: string | null;

  @IsOptional()
  @IsString()
  mecanismoCantidad?: string | null;

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
  setupOverrideMin?: number | null;

  @IsOptional()
  cleanupOverrideMin?: number | null;

  @IsOptional()
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
  materialesCandidatosJson?: Array<Record<string, unknown>>;

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
