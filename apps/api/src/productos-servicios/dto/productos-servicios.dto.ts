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

export enum TipoInsercionRouteEffectDto {
  append = 'append',
  before_step = 'before_step',
  after_step = 'after_step',
}

export enum ReglaCostoAdicionalEfectoDto {
  flat = 'flat',
  por_unidad = 'por_unidad',
  por_pliego = 'por_pliego',
  porcentaje_sobre_total = 'porcentaje_sobre_total',
  tiempo_extra_min = 'tiempo_extra_min',
}

export enum TipoChecklistPreguntaDto {
  binaria = 'binaria',
  single_select = 'single_select',
}

export enum TipoChecklistAccionReglaDto {
  activar_paso = 'activar_paso',
  seleccionar_variante_paso = 'seleccionar_variante_paso',
  costo_extra = 'costo_extra',
  material_extra = 'material_extra',
  set_atributo_tecnico = 'set_atributo_tecnico',
}

export enum ReglaCostoChecklistDto {
  tiempo_min = 'tiempo_min',
  flat = 'flat',
  por_unidad = 'por_unidad',
  por_pliego = 'por_pliego',
  porcentaje_sobre_total = 'porcentaje_sobre_total',
}

export enum MetodoCalculoPrecioProductoDto {
  margen_variable = 'margen_variable',
  por_margen = 'por_margen',
  precio_fijo = 'precio_fijo',
  fijado_por_cantidad = 'fijado_por_cantidad',
  fijo_con_margen_variable = 'fijo_con_margen_variable',
  variable_por_cantidad = 'variable_por_cantidad',
  precio_fijo_para_margen_minimo = 'precio_fijo_para_margen_minimo',
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
  @IsBoolean()
  usarMaquinariaTerminacion?: boolean;

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tiempoFijoMinFallback?: number;

  @IsOptional()
  @IsObject()
  overridesProductividad?: Record<string, unknown>;
}

export class UpsertProductoAdicionalRouteInsertionDto {
  @IsEnum(TipoInsercionRouteEffectDto)
  modo: TipoInsercionRouteEffectDto;

  @IsOptional()
  @IsUUID()
  pasoPlantillaId?: string;
}

export class UpsertProductoAdicionalRouteEffectDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UpsertProductoAdicionalRouteEffectPasoDto)
  pasos: UpsertProductoAdicionalRouteEffectPasoDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertProductoAdicionalRouteInsertionDto)
  insertion?: UpsertProductoAdicionalRouteInsertionDto;
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

export class UpsertProductoImpuestoDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  porcentaje: number;

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;

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

export class UpsertProductoRutaBaseMatchingItemDto {
  @IsOptional()
  @IsEnum(TipoImpresionProductoVarianteDto)
  tipoImpresion?: TipoImpresionProductoVarianteDto | null;

  @IsOptional()
  @IsEnum(CarasProductoVarianteDto)
  caras?: CarasProductoVarianteDto | null;

  @IsUUID()
  pasoPlantillaId: string;

  @IsUUID()
  perfilOperativoId: string;
}

export class UpsertProductoRutaBaseMatchingVarianteDto {
  @IsUUID()
  varianteId: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UpsertProductoRutaBaseMatchingItemDto)
  matching: UpsertProductoRutaBaseMatchingItemDto[];
}

export class UpsertProductoRutaPasoFijoItemDto {
  @IsUUID()
  pasoPlantillaId: string;

  @IsUUID()
  perfilOperativoId: string;
}

export class UpsertProductoRutaPasoFijoVarianteDto {
  @IsUUID()
  varianteId: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UpsertProductoRutaPasoFijoItemDto)
  pasos: UpsertProductoRutaPasoFijoItemDto[];
}

export class UpdateProductoRutaPolicyDto {
  @IsBoolean()
  usarRutaComunVariantes: boolean;

  @IsOptional()
  @IsUUID()
  procesoDefinicionDefaultId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(DimensionOpcionProductivaDto, { each: true })
  dimensionesBaseConsumidas?: DimensionOpcionProductivaDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => UpsertProductoRutaBaseMatchingVarianteDto)
  matchingBasePorVariante?: UpsertProductoRutaBaseMatchingVarianteDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => UpsertProductoRutaPasoFijoVarianteDto)
  pasosFijosPorVariante?: UpsertProductoRutaPasoFijoVarianteDto[];
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

export class UpdateProductoPrecioDto {
  @IsEnum(MetodoCalculoPrecioProductoDto)
  metodoCalculo: MetodoCalculoPrecioProductoDto;

  @IsOptional()
  @IsString()
  measurementUnit?: string | null;

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  impuestos?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  comisiones?: Record<string, unknown>;
}

export class UpdateProductoPrecioEspecialClientesDto {
  @IsArray()
  items: Record<string, unknown>[];
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

export class CotizarChecklistRespuestaDto {
  @IsUUID()
  preguntaId: string;

  @IsUUID()
  respuestaId: string;
}

export class CotizarSeleccionBaseDto {
  @IsEnum(DimensionOpcionProductivaDto)
  dimension: DimensionOpcionProductivaDto;

  @IsEnum(ValorOpcionProductivaDto)
  valor: ValorOpcionProductivaDto;
}

export class UpsertChecklistReglaNivelDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  nombreNivel: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsEnum(ReglaCostoChecklistDto)
  costoRegla?: ReglaCostoChecklistDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  costoValor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tiempoMin?: number;
}

export class UpsertChecklistReglaDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsEnum(TipoChecklistAccionReglaDto)
  accion: TipoChecklistAccionReglaDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsUUID()
  pasoPlantillaId?: string;

  @IsOptional()
  @IsUUID()
  variantePasoId?: string;

  @IsOptional()
  @IsEnum(DimensionOpcionProductivaDto)
  atributoTecnicoDimension?: DimensionOpcionProductivaDto;

  @IsOptional()
  @IsEnum(ValorOpcionProductivaDto)
  atributoTecnicoValor?: ValorOpcionProductivaDto;

  @IsOptional()
  @IsEnum(ReglaCostoChecklistDto)
  costoRegla?: ReglaCostoChecklistDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  costoValor?: number;

  @IsOptional()
  @IsUUID()
  costoCentroCostoId?: string;

  @IsOptional()
  @IsUUID()
  materiaPrimaVarianteId?: string;

  @IsOptional()
  @IsEnum(TipoConsumoAdicionalMaterialDto)
  tipoConsumo?: TipoConsumoAdicionalMaterialDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  factorConsumo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  mermaPct?: number;

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;

}

export class UpsertChecklistRespuestaDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  texto: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsUUID()
  preguntaSiguienteId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => UpsertChecklistReglaDto)
  reglas?: UpsertChecklistReglaDto[];
}

export class UpsertChecklistPreguntaDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  texto: string;

  @IsOptional()
  @IsEnum(TipoChecklistPreguntaDto)
  tipoPregunta?: TipoChecklistPreguntaDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UpsertChecklistRespuestaDto)
  respuestas: UpsertChecklistRespuestaDto[];
}

export class UpsertProductoChecklistDto {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UpsertChecklistPreguntaDto)
  preguntas: UpsertChecklistPreguntaDto[];
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
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CotizarChecklistRespuestaDto)
  checklistRespuestas?: CotizarChecklistRespuestaDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CotizarSeleccionBaseDto)
  seleccionesBase?: CotizarSeleccionBaseDto[];
}

export class PreviewImposicionProductoVarianteDto {
  @IsOptional()
  @IsObject()
  parametros?: Record<string, unknown>;
}
