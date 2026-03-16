import {
  ArrayMaxSize,
  ArrayMinSize,
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
  Max,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoProductoServicioDto {
  producto = 'producto',
  servicio = 'servicio',
}

export enum EstadoProductoServicioDto {
  activo = 'activo',
  inactivo = 'inactivo',
}

export enum TipoImpresionProductoVarianteDto {
  bn = 'bn',
  cmyk = 'cmyk',
}

export enum CarasProductoVarianteDto {
  simple_faz = 'simple_faz',
  doble_faz = 'doble_faz',
}

export enum TipoProductoAdicionalDto {
  servicio = 'servicio',
  acabado = 'acabado',
}

export enum MetodoCostoProductoAdicionalDto {
  time_only = 'time_only',
  time_plus_material = 'time_plus_material',
}

export enum TipoConsumoAdicionalMaterialDto {
  por_unidad = 'por_unidad',
  por_pliego = 'por_pliego',
  por_m2 = 'por_m2',
}

export enum DimensionOpcionProductivaDto {
  tipo_impresion = 'tipo_impresion',
  caras = 'caras',
}

export enum ValorOpcionProductivaDto {
  bn = 'bn',
  cmyk = 'cmyk',
  simple_faz = 'simple_faz',
  doble_faz = 'doble_faz',
}

export enum TipoProductoAdicionalEfectoDto {
  route_effect = 'route_effect',
  cost_effect = 'cost_effect',
  material_effect = 'material_effect',
}

export enum ReglaCostoAdicionalEfectoDto {
  flat = 'flat',
  por_unidad = 'por_unidad',
  por_pliego = 'por_pliego',
  porcentaje_sobre_total = 'porcentaje_sobre_total',
  tiempo_extra_min = 'tiempo_extra_min',
}


export class UpsertVarianteOpcionProductivaDimensionDto {
  @IsEnum(DimensionOpcionProductivaDto)
  dimension: DimensionOpcionProductivaDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsEnum(ValorOpcionProductivaDto, { each: true })
  valores: ValorOpcionProductivaDto[];
}

export class UpsertVarianteOpcionesProductivasDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => UpsertVarianteOpcionProductivaDimensionDto)
  dimensiones: UpsertVarianteOpcionProductivaDimensionDto[];
}

export class UpsertProductoAdicionalEfectoScopeDto {
  @IsOptional()
  @IsUUID()
  varianteId?: string;

  @IsOptional()
  @IsEnum(DimensionOpcionProductivaDto)
  dimension?: DimensionOpcionProductivaDto;

  @IsOptional()
  @IsEnum(ValorOpcionProductivaDto)
  valor?: ValorOpcionProductivaDto;
}

export class UpsertProductoAdicionalRouteEffectPasoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orden?: number;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsUUID()
  centroCostoId: string;

  @IsOptional()
  @IsUUID()
  maquinaId?: string;

  @IsOptional()
  @IsUUID()
  perfilOperativoId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  setupMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  runMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cleanupMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tiempoFijoMin?: number;
}

export class UpsertProductoAdicionalRouteEffectDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UpsertProductoAdicionalRouteEffectPasoDto)
  pasos: UpsertProductoAdicionalRouteEffectPasoDto[];
}

export class UpsertProductoAdicionalCostEffectDto {
  @IsEnum(ReglaCostoAdicionalEfectoDto)
  regla: ReglaCostoAdicionalEfectoDto;

  @Type(() => Number)
  @IsNumber()
  valor: number;

  @IsOptional()
  @IsUUID()
  centroCostoId?: string;

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;
}

export class UpsertProductoAdicionalMaterialEffectDto {
  @IsUUID()
  materiaPrimaVarianteId: string;

  @IsEnum(TipoConsumoAdicionalMaterialDto)
  tipoConsumo: TipoConsumoAdicionalMaterialDto;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  factorConsumo: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  mermaPct?: number;

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;
}

export class UpsertProductoAdicionalEfectoDto {
  @IsEnum(TipoProductoAdicionalEfectoDto)
  tipo: TipoProductoAdicionalEfectoDto;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UpsertProductoAdicionalEfectoScopeDto)
  scopes?: UpsertProductoAdicionalEfectoScopeDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertProductoAdicionalRouteEffectDto)
  routeEffect?: UpsertProductoAdicionalRouteEffectDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertProductoAdicionalCostEffectDto)
  costEffect?: UpsertProductoAdicionalCostEffectDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertProductoAdicionalMaterialEffectDto)
  materialEffect?: UpsertProductoAdicionalMaterialEffectDto;
}

export class UpsertProductoAdicionalMaterialDto {
  @IsUUID()
  materiaPrimaVarianteId: string;

  @IsEnum(TipoConsumoAdicionalMaterialDto)
  tipoConsumo: TipoConsumoAdicionalMaterialDto;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  factorConsumo: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  mermaPct?: number;

  @IsBoolean()
  activo: boolean;

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;
}

export class UpsertProductoAdicionalDto {
  @IsString()
  @IsOptional()
  codigo?: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsEnum(TipoProductoAdicionalDto)
  tipo: TipoProductoAdicionalDto;

  @IsEnum(MetodoCostoProductoAdicionalDto)
  metodoCosto: MetodoCostoProductoAdicionalDto;

  @IsOptional()
  @IsUUID()
  centroCostoId?: string;

  @IsBoolean()
  activo: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertProductoAdicionalMaterialDto)
  materiales: UpsertProductoAdicionalMaterialDto[];
}

export class UpsertProductoAdicionalServicioNivelDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpsertProductoAdicionalServicioReglaCostoDto {
  @IsString()
  @IsNotEmpty()
  nivelId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tiempoMin: number;
}

export class UpsertProductoAdicionalServicioPricingDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UpsertProductoAdicionalServicioNivelDto)
  niveles: UpsertProductoAdicionalServicioNivelDto[];

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => UpsertProductoAdicionalServicioReglaCostoDto)
  reglas: UpsertProductoAdicionalServicioReglaCostoDto[];
}

export class AssignProductoAdicionalDto {
  @IsUUID()
  adicionalId: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class SetVarianteAdicionalRestrictionDto {
  @IsUUID()
  adicionalId: string;

  @IsBoolean()
  permitido: boolean;
}

export class UpsertFamiliaProductoDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsBoolean()
  activo: boolean;
}

export class UpsertSubfamiliaProductoDto {
  @IsUUID()
  familiaProductoId: string;

  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  unidadComercial?: string;

  @IsBoolean()
  activo: boolean;
}

export class UpsertProductoServicioDto {
  @IsOptional()
  @IsEnum(TipoProductoServicioDto)
  tipo?: TipoProductoServicioDto;

  @IsString()
  @IsOptional()
  codigo?: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  motorCodigo?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  motorVersion?: number;

  @IsUUID()
  familiaProductoId: string;

  @IsOptional()
  @IsUUID()
  subfamiliaProductoId?: string;

  @IsEnum(EstadoProductoServicioDto)
  estado: EstadoProductoServicioDto;

  @IsBoolean()
  activo: boolean;
}

export class CreateProductoVarianteDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsNumber()
  @Min(1)
  anchoMm: number;

  @IsNumber()
  @Min(1)
  altoMm: number;

  @IsOptional()
  @IsUUID()
  papelVarianteId?: string;

  @IsEnum(TipoImpresionProductoVarianteDto)
  tipoImpresion: TipoImpresionProductoVarianteDto;

  @IsEnum(CarasProductoVarianteDto)
  caras: CarasProductoVarianteDto;

  @IsOptional()
  @IsUUID()
  procesoDefinicionId?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateProductoVarianteDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  anchoMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  altoMm?: number;

  @IsOptional()
  @IsUUID()
  papelVarianteId?: string;

  @IsOptional()
  @IsEnum(TipoImpresionProductoVarianteDto)
  tipoImpresion?: TipoImpresionProductoVarianteDto;

  @IsOptional()
  @IsEnum(CarasProductoVarianteDto)
  caras?: CarasProductoVarianteDto;

  @IsOptional()
  @IsUUID()
  procesoDefinicionId?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class AssignVarianteRutaDto {
  @IsOptional()
  @IsUUID()
  procesoDefinicionId?: string;
}

export class UpdateProductoRutaPolicyDto {
  @IsBoolean()
  usarRutaComunVariantes: boolean;

  @IsOptional()
  @IsUUID()
  procesoDefinicionDefaultId?: string | null;
}

export class AssignProductoVariantesRutaMasivaDto {
  @IsUUID()
  procesoDefinicionId: string;

  @IsOptional()
  @IsBoolean()
  incluirInactivas?: boolean;
}

export class AssignProductoMotorDto {
  @IsString()
  @IsNotEmpty()
  motorCodigo: string;

  @IsNumber()
  @Min(1)
  motorVersion: number;
}

export class UpsertProductoMotorConfigDto {
  @IsObject()
  parametros: Record<string, unknown>;
}

export class UpsertVarianteMotorOverrideDto {
  @IsObject()
  parametros: Record<string, unknown>;
}

export class CotizarAddonConfigDto {
  @IsUUID()
  addonId: string;

  @IsOptional()
  @IsString()
  nivelId?: string;
}

export class CotizarProductoVarianteDto {
  @IsNumber()
  @Min(1)
  cantidad: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  periodo?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  addonsSeleccionados?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CotizarAddonConfigDto)
  addonsConfig?: CotizarAddonConfigDto[];
}

export class PreviewImposicionProductoVarianteDto {
  @IsOptional()
  @IsObject()
  parametros?: Record<string, unknown>;
}
