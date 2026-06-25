import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Plantillas de maquinaria — modelo final v3.0 (2026-04-26).
 * Doc: `docs/motor-por-pasos-analisis/06-maquinas-y-perfiles.md` §4.
 */
export enum PlantillaMaquinariaDto {
  impresora_laser = 'impresora_laser',
  impresora_gran_formato_por_area = 'impresora_gran_formato_por_area',
  guillotina = 'guillotina',
  plotter_de_corte = 'plotter_de_corte',
  plotter_cad = 'plotter_cad',
  laminadora_bopp_rollo = 'laminadora_bopp_rollo',
  corte_laser = 'corte_laser',
  router_cnc = 'router_cnc',
  anilladora = 'anilladora',
  soldadora = 'soldadora',
  cabina_pintura = 'cabina_pintura',
  mesa_de_corte = 'mesa_de_corte',
}

export enum EstadoMaquinaDto {
  activa = 'activa',
  inactiva = 'inactiva',
  mantenimiento = 'mantenimiento',
  baja = 'baja',
}

export enum EstadoConfiguracionMaquinaDto {
  borrador = 'borrador',
  incompleta = 'incompleta',
  lista = 'lista',
}

export enum GeometriaTrabajoMaquinaDto {
  pliego = 'pliego',
  rollo = 'rollo',
  plano = 'plano',
  cilindrico = 'cilindrico',
  volumen = 'volumen',
}

export enum UnidadProduccionMaquinaDto {
  hora = 'hora',
  hoja = 'hoja',
  copia = 'copia',
  ppm = 'ppm',
  a4_equiv = 'a4_equiv',
  m2 = 'm2',
  m2_h = 'm2_h',
  metro_lineal = 'metro_lineal',
  piezas_h = 'piezas_h',
  pieza = 'pieza',
  ciclo = 'ciclo',
  cortes_min = 'cortes_min',
  golpes_min = 'golpes_min',
  pliegos_min = 'pliegos_min',
  m_min = 'm_min',
}

export enum TipoPerfilOperativoMaquinaDto {
  impresion = 'impresion',
  corte = 'corte',
  laminado = 'laminado',
  mecanizado = 'mecanizado',
  grabado = 'grabado',
  fabricacion = 'fabricacion',
  mixto = 'mixto',
}

export enum TipoConsumibleMaquinaDto {
  toner = 'toner',
  tinta = 'tinta',
  barniz = 'barniz',
  primer = 'primer',
  film = 'film',
  polvo = 'polvo',
  adhesivo = 'adhesivo',
  resina = 'resina',
  lubricante = 'lubricante',
  otro = 'otro',
}

export enum UnidadConsumoMaquinaDto {
  ml = 'ml',
  litro = 'litro',
  gramo = 'gramo',
  kg = 'kg',
  unidad = 'unidad',
  m2 = 'm2',
  metro_lineal = 'metro_lineal',
  pagina = 'pagina',
  a4_equiv = 'a4_equiv',
}

export enum TipoComponenteDesgasteMaquinaDto {
  fusor = 'fusor',
  drum = 'drum',
  drum_opc = 'drum_opc',
  developer = 'developer',
  developer_unit = 'developer_unit',
  charge_unit = 'charge_unit',
  drum_cleaning_blade = 'drum_cleaning_blade',
  correa_transferencia = 'correa_transferencia',
  transfer_belt_itb = 'transfer_belt_itb',
  transfer_roller = 'transfer_roller',
  fuser_belt = 'fuser_belt',
  pressure_roller = 'pressure_roller',
  fuser_cleaning_web = 'fuser_cleaning_web',
  wax_lubricant_bar = 'wax_lubricant_bar',
  fuser_stripper_finger = 'fuser_stripper_finger',
  waste_toner_subsystem = 'waste_toner_subsystem',
  cabezal = 'cabezal',
  lampara_uv = 'lampara_uv',
  fresa = 'fresa',
  cuchilla = 'cuchilla',
  filtro = 'filtro',
  kit_mantenimiento = 'kit_mantenimiento',
  otro = 'otro',
}

export enum UnidadDesgasteMaquinaDto {
  copias_a4_equiv = 'copias_a4_equiv',
  m2 = 'm2',
  metros_lineales = 'metros_lineales',
  horas = 'horas',
  ciclos = 'ciclos',
  piezas = 'piezas',
}

export class MaquinaPerfilOperativoItemDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(1)
  nombre: string;

  @IsEnum(TipoPerfilOperativoMaquinaDto)
  tipoPerfil: TipoPerfilOperativoMaquinaDto;

  @IsBoolean()
  activo: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  productivityValue?: number;

  @IsOptional()
  @IsEnum(UnidadProduccionMaquinaDto)
  productivityUnit?: UnidadProduccionMaquinaDto;

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
  feedReloadMin?: number;

  /**
   * v3.0: discriminantes específicos por plantilla viven en `detalle`.
   * Ej. IMPRESORA_LASER: { caras, colores, gramajeMinGr, gramajeMaxGr }.
   * GUILLOTINA: { gramajeMinGr, gramajeMaxGr,
   * pliegosMaxPorTanda }. Etc.
   */
  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;

  /** v3.0 (G-M8): regla declarativa JsonLogic para auto-selección por motor. */
  @IsOptional()
  @IsObject()
  reglaSeleccionJson?: Record<string, unknown>;
}

export class MaquinaConsumibleItemDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID(undefined, {
    message: 'Selecciona una variante valida para el consumible.',
  })
  materiaPrimaVarianteId: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsEnum(TipoConsumibleMaquinaDto)
  tipo?: TipoConsumibleMaquinaDto;

  @IsOptional()
  @IsEnum(UnidadConsumoMaquinaDto)
  unidad?: UnidadConsumoMaquinaDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rendimientoEstimado?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  consumoBase?: number;

  @IsOptional()
  @IsUUID()
  perfilOperativoId?: string;

  @IsBoolean()
  activo: boolean;

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class MaquinaComponenteDesgasteItemDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID(undefined, {
    message: 'Selecciona una variante valida para el componente de desgaste.',
  })
  materiaPrimaVarianteId: string;

  @IsString()
  @MinLength(1)
  nombre: string;

  @IsEnum(TipoComponenteDesgasteMaquinaDto)
  tipo: TipoComponenteDesgasteMaquinaDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  vidaUtilEstimada?: number;

  @IsEnum(UnidadDesgasteMaquinaDto)
  unidadDesgaste: UnidadDesgasteMaquinaDto;

  @IsOptional()
  @IsString()
  modoProrrateo?: string;

  @IsBoolean()
  activo: boolean;

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpsertMaquinaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  codigo?: string;

  @IsString()
  @MinLength(1)
  nombre: string;

  @IsEnum(PlantillaMaquinariaDto)
  plantilla: PlantillaMaquinariaDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  plantillaVersion?: number;

  @IsOptional()
  @IsString()
  fabricante?: string;

  @IsOptional()
  @IsString()
  modelo?: string;

  @IsOptional()
  @IsString()
  numeroSerie?: string;

  @IsUUID()
  plantaId: string;

  @IsOptional()
  @IsUUID()
  centroCostoPrincipalId?: string;

  @IsEnum(EstadoMaquinaDto)
  estado: EstadoMaquinaDto;

  @IsOptional()
  @IsEnum(EstadoConfiguracionMaquinaDto)
  estadoConfiguracion?: EstadoConfiguracionMaquinaDto;

  @IsEnum(GeometriaTrabajoMaquinaDto)
  geometriaTrabajo: GeometriaTrabajoMaquinaDto;

  @IsEnum(UnidadProduccionMaquinaDto)
  unidadProduccionPrincipal: UnidadProduccionMaquinaDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  anchoUtil?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  largoUtil?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  altoUtil?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  espesorMaximo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pesoMaximo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gramajeMaxGr?: number;

  @IsOptional()
  @IsDateString()
  fechaAlta?: string;

  @IsBoolean()
  activo: boolean;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsObject()
  parametrosTecnicos?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  capacidadesAvanzadas?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaquinaPerfilOperativoItemDto)
  perfilesOperativos: MaquinaPerfilOperativoItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaquinaConsumibleItemDto)
  consumibles: MaquinaConsumibleItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaquinaComponenteDesgasteItemDto)
  componentesDesgaste: MaquinaComponenteDesgasteItemDto[];
}
