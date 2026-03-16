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
  preflight = 'preflight',
  preprensa = 'preprensa',
  impresion = 'impresion',
  corte = 'corte',
  mecanizado = 'mecanizado',
  grabado = 'grabado',
  terminacion = 'terminacion',
  curado = 'curado',
  laminado = 'laminado',
  transferencia = 'transferencia',
  control_calidad = 'control_calidad',
  empaque = 'empaque',
  logistica = 'logistica',
  tercerizado = 'tercerizado',
  otro = 'otro',
}

export enum ModoProductividadProcesoDto {
  fija = 'fija',
  variable = 'variable',
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
  ciclo = 'ciclo',
  unidad = 'unidad',
  kg = 'kg',
  litro = 'litro',
  lote = 'lote',
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
  @IsUUID()
  requiresProductoAdicionalId?: string;

  @IsBoolean()
  activo: boolean;
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
  @IsEnum(PlantillaMaquinariaDto)
  plantillaMaquinaria?: PlantillaMaquinariaDto;

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
