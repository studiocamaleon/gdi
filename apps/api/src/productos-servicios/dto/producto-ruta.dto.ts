import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
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
export class UpsertMaquinaCandidataDto {
  @IsUUID()
  maquinaId!: string;

  @IsOptional()
  @IsUUID()
  perfilDefaultId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modoColorAllowedModes?: string[];

  @IsOptional()
  @IsBoolean()
  esPreferida?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}

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
  @IsString()
  @Length(1, 120)
  nombreVisible?: string | null;

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dotacionOperarios?: number;

  /**
   * `rutaPasoId` de los pasos que este paso NECESITA: al activarse los
   * enciende aunque sean OPCIONALES (ojales requiere el refuerzo).
   * Ver docs/modificaciones-fisicas-lona-diseno.md
   */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  requiereRutaPasoIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertSlotMaterialDto)
  slotsMateriales?: UpsertSlotMaterialDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertMaquinaCandidataDto)
  maquinasCandidatas?: UpsertMaquinaCandidataDto[];

  // === Tercerización (docs/productos-tercerizados-diseno.md) ===
  @IsOptional()
  @IsBoolean()
  tercerizado?: boolean;

  @IsOptional()
  @IsUUID()
  proveedorId?: string | null;

  @IsOptional()
  @IsIn(['tarifa_magnitud', 'matriz', 'fijo'])
  fuenteCostoTercerizado?: string | null;

  @IsOptional()
  @IsObject()
  tercerizadoConfigJson?: Record<string, unknown> | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  plazoProveedorDias?: number | null;

  /** Filas de la matriz (sólo fuente 'matriz'); el claveMatch lo deriva el server. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertPasoTercerizadoEntradaDto)
  tercerizadoEntradas?: UpsertPasoTercerizadoEntradaDto[];
}

export class UpsertPasoTercerizadoEntradaDto {
  /** { ejeClave: valorClave } — la combinación de esta fila. */
  @IsObject()
  valores!: Record<string, unknown>;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;

  /** Costo NETO del proveedor para esa tanda. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costo!: number;
}

export class UpsertSlotMaterialDto {
  @IsString()
  slotCodigo!: string;

  @IsOptional()
  @IsString()
  slotNombre?: string | null;

  @IsOptional()
  @IsString()
  slotRol?: string | null;

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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cantidadFactor?: number | null;

  @IsOptional()
  @IsString()
  cantidadBase?: string | null;

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

  /** true = usa todas las variantes activas del material (absorbe las nuevas);
   *  false = la lista fija `varianteIds`. */
  @IsOptional()
  @IsBoolean()
  todasLasVariantes?: boolean;
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

  /** Ruta alternativa del producto a la que aplica el extra (scope por ruta). */
  @IsOptional()
  @IsUUID()
  rutaAlternativaId?: string | null;

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

  /** Centro de costo para pasos manuales sin máquina. */
  @IsOptional()
  @IsUUID()
  centroCostoId?: string;
}

/**
 * Actualización de un paso extra existente. Todos los campos opcionales:
 * sólo se aplican los presentes (PATCH). `condicionActivacionJson: null`
 * limpia la regla.
 */
export class ActualizarPasoExtraDto {
  @IsOptional()
  @IsUUID()
  insertarDespuesDeRutaPasoId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordenInterno?: number;

  @IsOptional()
  @IsString()
  nombreVisible?: string | null;

  @IsOptional()
  @IsString()
  modoActivacion?: string;

  @IsOptional()
  @IsObject()
  condicionActivacionJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  modoTiempo?: string;

  @IsOptional()
  @IsString()
  mecanismoCantidad?: string;

  @IsOptional()
  @IsObject()
  mecanismoCantidadConfigJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  multiplicadoresActivos?: string[];

  @IsOptional()
  @IsObject()
  paramsPasoJson?: Record<string, unknown>;

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
  @IsNumber()
  setupOverrideMin?: number | null;

  @IsOptional()
  @IsNumber()
  cleanupOverrideMin?: number | null;

  @IsOptional()
  @IsNumber()
  tiempoFijoOverrideMin?: number | null;

  /**
   * Sub-fase 3 — config inline embebida del paso extra. Slots reutilizan el
   * mismo shape que los pasos normales; los cargos referencian ids de catálogo.
   * Enviar `[]` limpia el arreglo.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertSlotMaterialDto)
  configSlotsMaterialesJson?: UpsertSlotMaterialDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PasoExtraCargoDirectoDto)
  configCargosDirectosJson?: PasoExtraCargoDirectoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PasoExtraMaquinaCandidataDto)
  configMaquinasCandidatasJson?: PasoExtraMaquinaCandidataDto[];

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/**
 * Cargo directo a nivel paso de un paso extra (embebido). Referencia el
 * catálogo por id; el motor hidrata nombre/modoCalculo/configJson en cotización.
 */
export class PasoExtraCargoDirectoDto {
  @IsUUID()
  cargoDirectoCatalogoId!: string;

  @IsString()
  modoActivacion!: string;

  @IsOptional()
  @IsObject()
  condicionActivacionJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  configOverrideJson?: Record<string, unknown> | null;
}

/**
 * Máquina candidata M-2 de un paso extra (embebida). Mismo shape que
 * UpsertMaquinaCandidataDto; el motor y el detalle del producto hidratan
 * la máquina/perfiles por id en cada lectura.
 */
export class PasoExtraMaquinaCandidataDto {
  @IsUUID()
  maquinaId!: string;

  @IsOptional()
  @IsUUID()
  perfilDefaultId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modoColorAllowedModes?: string[];

  @IsOptional()
  @IsBoolean()
  esPreferida?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}
