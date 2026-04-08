import { Type } from 'class-transformer';
import {
  IsArray,
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

export enum PlantillaMaquinariaDto {
  router_cnc = 'router_cnc',
  corte_laser = 'corte_laser',
  guillotina = 'guillotina',
  laminadora_bopp_rollo = 'laminadora_bopp_rollo',
  redondeadora_puntas = 'redondeadora_puntas',
  perforadora = 'perforadora',
  impresora_3d = 'impresora_3d',
  impresora_dtf = 'impresora_dtf',
  impresora_dtf_uv = 'impresora_dtf_uv',
  impresora_uv_mesa_extensora = 'impresora_uv_mesa_extensora',
  impresora_uv_cilindrica = 'impresora_uv_cilindrica',
  impresora_uv_flatbed = 'impresora_uv_flatbed',
  impresora_uv_rollo = 'impresora_uv_rollo',
  impresora_solvente = 'impresora_solvente',
  impresora_inyeccion_tinta = 'impresora_inyeccion_tinta',
  impresora_latex = 'impresora_latex',
  impresora_sublimacion_gran_formato = 'impresora_sublimacion_gran_formato',
  impresora_laser = 'impresora_laser',
  plotter_cad = 'plotter_cad',
  mesa_de_corte = 'mesa_de_corte',
  plotter_de_corte = 'plotter_de_corte',
}

export enum EstadoConfiguracionProcesoDto {
  borrador = 'borrador',
  incompleta = 'incompleta',
  lista = 'lista',
}

export enum TipoOperacionProcesoDto {
  preprensa = 'preprensa',
  prensa = 'prensa',
  postprensa = 'postprensa',
  instalacion = 'instalacion',
  entrega_despacho = 'entrega_despacho',
  // Legacy: accepted on input, remapped on output
  acabado = 'acabado',
  servicio = 'servicio',
}

export enum ModoProductividadProcesoDto {
  fija = 'fija',
  variable = 'variable',
}

export enum ModoProductividadNivelDto {
  fija = 'fija',
  variable_manual = 'variable_manual',
  variable_perfil = 'variable_perfil',
}

export enum UnidadProcesoDto {
  ninguna = 'ninguna',
  hora = 'hora',
  minuto = 'minuto',
  hoja = 'hoja',
  copia = 'copia',
  a4_equiv = 'a4_equiv',
  m2 = 'm2',
  metro_lineal = 'metro_lineal',
  pieza = 'pieza',
  corte = 'corte',
  ciclo = 'ciclo',
  unidad = 'unidad',
  kg = 'kg',
  litro = 'litro',
  lote = 'lote',
}

export enum BaseCalculoProductividadDto {
  cantidad = 'cantidad',
  area_total_m2 = 'area_total_m2',
  metro_lineal_total = 'metro_lineal_total',
  perimetro_total_ml = 'perimetro_total_ml',
}

export class ProcesoOperacionItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  codigo?: string;

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
  orden?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  setupMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  runMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cleanupMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tiempoFijoMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  multiplicadorDobleFaz?: number;

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
  mermaSetup?: number;

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
  @IsObject()
  detalle?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(BaseCalculoProductividadDto)
  baseCalculoProductividad?: BaseCalculoProductividadDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcesoOperacionNivelDto)
  niveles?: ProcesoOperacionNivelDto[];

  @IsBoolean()
  activo: boolean;
}

export class ProcesoOperacionNivelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  id?: string;

  @IsString()
  @MinLength(1)
  nombre: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsEnum(ModoProductividadNivelDto)
  modoProductividadNivel: ModoProductividadNivelDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tiempoFijoMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  multiplicadorDobleFaz?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  productividadBase?: number;

  @IsOptional()
  @IsEnum(UnidadProcesoDto)
  unidadSalida?: UnidadProcesoDto;

  @IsOptional()
  @IsEnum(UnidadProcesoDto)
  unidadTiempo?: UnidadProcesoDto;

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
  @IsObject()
  detalle?: Record<string, unknown>;
}

export class UpsertProcesoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  codigo?: string;

  @IsString()
  @MinLength(1)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsEnum(EstadoConfiguracionProcesoDto)
  estadoConfiguracion?: EstadoConfiguracionProcesoDto;

  @IsBoolean()
  activo: boolean;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcesoOperacionItemDto)
  operaciones: ProcesoOperacionItemDto[];
}
