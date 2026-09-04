import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

const MAX_PIEZAS_JOB_CONTEXT = 1_000;
const MAX_NODOS_JOB_CONTEXT = 10_000;
const MAX_PROFUNDIDAD_JOB_CONTEXT = 8;
const CLAVES_INSEGURAS = new Set(['__proto__', 'prototype', 'constructor']);

function esNumeroFinito(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function esNumeroPositivo(value: unknown): value is number {
  return esNumeroFinito(value) && value > 0;
}

function esEnteroPositivo(value: unknown): value is number {
  return Number.isSafeInteger(value) && esNumeroPositivo(value);
}

function esConfiguracionCapasValida(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  if (
    config.schemaVersion !== 1 ||
    !Array.isArray(config.niveles) ||
    config.niveles.length < 1 ||
    config.niveles.length > 8 ||
    !Array.isArray(config.asignaciones) ||
    config.asignaciones.length > 500
  ) {
    return false;
  }
  const nivelIds = new Set<string>();
  for (const raw of config.niveles) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const nivel = raw as Record<string, unknown>;
    if (
      typeof nivel.id !== 'string' ||
      nivel.id.length === 0 ||
      nivel.id.length > 80 ||
      nivelIds.has(nivel.id) ||
      typeof nivel.nombre !== 'string' ||
      nivel.nombre.length > 80 ||
      !Number.isInteger(nivel.orden) ||
      (nivel.orden as number) < 1 ||
      (nivel.orden as number) > 8 ||
      !Number.isInteger(nivel.colorVisual) ||
      (nivel.colorVisual as number) < 1 ||
      (nivel.colorVisual as number) > 5
    ) {
      return false;
    }
    nivelIds.add(nivel.id);
  }
  const objetoIds = new Set<string>();
  for (const raw of config.asignaciones) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const asignacion = raw as Record<string, unknown>;
    if (
      typeof asignacion.objetoId !== 'string' ||
      asignacion.objetoId.length === 0 ||
      asignacion.objetoId.length > 80 ||
      objetoIds.has(asignacion.objetoId) ||
      typeof asignacion.nivelId !== 'string' ||
      !nivelIds.has(asignacion.nivelId) ||
      !['pieza', 'encastre'].includes(String(asignacion.modo))
    ) {
      return false;
    }
    objetoIds.add(asignacion.objetoId);
  }
  return true;
}

function esFuenteVectorialValida(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const fuente = value as Record<string, unknown>;
  return !(
    (fuente.schemaVersion !== 1 && fuente.schemaVersion !== 2) ||
    typeof fuente.nombreArchivo !== 'string' ||
    fuente.nombreArchivo.length === 0 ||
    fuente.nombreArchivo.length > 255 ||
    typeof fuente.svg !== 'string' ||
    fuente.svg.length === 0 ||
    Buffer.byteLength(fuente.svg, 'utf8') > 512 * 1024 ||
    !esNumeroPositivo(fuente.anchoFinalMm) ||
    (fuente.formatoOrigen !== undefined &&
      fuente.formatoOrigen !== 'SVG' &&
      fuente.formatoOrigen !== 'DXF') ||
    (fuente.altoFinalMm !== undefined &&
      !esNumeroPositivo(fuente.altoFinalMm)) ||
    (fuente.configuracionCapas !== undefined &&
      !esConfiguracionCapasValida(fuente.configuracionCapas)) ||
    (fuente.schemaVersion === 2 &&
      !esConfiguracionCapasValida(fuente.configuracionCapas))
  );
}

/**
 * El JobContext mezcla un núcleo estable con campos dinámicos declarados por
 * cada producto/paso. No puede transformarse a un DTO anidado con whitelist:
 * eso borraría selecciones runtime legítimas. Este validador preserva esas
 * claves, pero blinda el núcleo financiero y evita valores no finitos,
 * estructuras desmedidas y claves capaces de contaminar prototipos.
 */
export function jobContextCotizacionValido(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ctx = value as Record<string, unknown>;

  if (!esEnteroPositivo(ctx.cantidad)) return false;

  if (ctx.piezas !== undefined) {
    if (
      !Array.isArray(ctx.piezas) ||
      ctx.piezas.length === 0 ||
      ctx.piezas.length > MAX_PIEZAS_JOB_CONTEXT
    ) {
      return false;
    }
    for (const pieza of ctx.piezas) {
      if (!pieza || typeof pieza !== 'object' || Array.isArray(pieza)) {
        return false;
      }
      const p = pieza as Record<string, unknown>;
      if (
        !esEnteroPositivo(p.cantidad) ||
        !esNumeroPositivo(p.anchoMm) ||
        !esNumeroPositivo(p.altoMm) ||
        (p.perimetroMm !== undefined &&
          (!esNumeroFinito(p.perimetroMm) || p.perimetroMm < 0))
      ) {
        return false;
      }
    }
  }

  if (ctx.medidaCustomMm !== undefined) {
    if (
      !ctx.medidaCustomMm ||
      typeof ctx.medidaCustomMm !== 'object' ||
      Array.isArray(ctx.medidaCustomMm)
    ) {
      return false;
    }
    const medida = ctx.medidaCustomMm as Record<string, unknown>;
    if (!esNumeroPositivo(medida.anchoMm) || !esNumeroPositivo(medida.altoMm)) {
      return false;
    }
  }

  if (ctx.disenoVectorialFuente !== undefined) {
    if (!esFuenteVectorialValida(ctx.disenoVectorialFuente)) {
      return false;
    }
  }
  if (ctx.geometriasVectoriales !== undefined) {
    if (
      !ctx.geometriasVectoriales ||
      typeof ctx.geometriasVectoriales !== 'object' ||
      Array.isArray(ctx.geometriasVectoriales)
    ) {
      return false;
    }
    const fuentes = Object.entries(
      ctx.geometriasVectoriales as Record<string, unknown>,
    );
    if (
      fuentes.length > 30 ||
      fuentes.some(
        ([id, fuente]) =>
          !/^[a-z0-9][a-z0-9_-]{0,59}$/.test(id) ||
          !esFuenteVectorialValida(fuente),
      )
    ) {
      return false;
    }
  }
  if (
    ctx.disenoVectorialCacheKey !== undefined &&
    (typeof ctx.disenoVectorialCacheKey !== 'string' ||
      !/^[a-f0-9]{64}$/.test(ctx.disenoVectorialCacheKey))
  ) {
    return false;
  }

  if (ctx.caras !== undefined && ctx.caras !== 1 && ctx.caras !== 2) {
    return false;
  }
  if (
    ctx.tipoCopia !== undefined &&
    ctx.tipoCopia !== 1 &&
    ctx.tipoCopia !== 2 &&
    ctx.tipoCopia !== 3
  ) {
    return false;
  }
  if (
    ctx.numerosXTalonario !== undefined &&
    !esEnteroPositivo(ctx.numerosXTalonario)
  ) {
    return false;
  }
  if (
    ctx.placasVectorialesManuales !== undefined &&
    !esEnteroPositivo(ctx.placasVectorialesManuales)
  ) {
    return false;
  }
  if (
    ctx.metrosCortePorPlacaVectorial !== undefined &&
    !esNumeroPositivo(ctx.metrosCortePorPlacaVectorial)
  ) {
    return false;
  }

  const noNegativos = [
    'distanciaKm',
    'm2_instalados',
    'piezaAreaTotalM2',
    'piezaPerimetroTotalM',
    'metrosLineales',
    'anchoMaterialMm',
    'largoMaterialMm',
    'placasVectorialesManuales',
    'metrosCortePorPlacaVectorial',
  ];
  for (const key of noNegativos) {
    const item = ctx[key];
    if (item !== undefined && (!esNumeroFinito(item) || item < 0)) return false;
  }
  for (const key of ['cantidadComercial', 'cantidadComercialPricing']) {
    const item = ctx[key];
    if (item !== undefined && !esNumeroPositivo(item)) return false;
  }

  let nodos = 0;
  const visitados = new WeakSet<object>();
  const visitar = (item: unknown, profundidad: number): boolean => {
    nodos += 1;
    if (
      nodos > MAX_NODOS_JOB_CONTEXT ||
      profundidad > MAX_PROFUNDIDAD_JOB_CONTEXT
    ) {
      return false;
    }
    if (typeof item === 'number') return Number.isFinite(item);
    if (
      item === null ||
      typeof item === 'string' ||
      typeof item === 'boolean'
    ) {
      return true;
    }
    if (Array.isArray(item)) {
      if (visitados.has(item)) return false;
      visitados.add(item);
      return (
        item.length <= MAX_PIEZAS_JOB_CONTEXT &&
        item.every((child) => visitar(child, profundidad + 1))
      );
    }
    if (typeof item !== 'object') return false;
    if (visitados.has(item)) return false;
    visitados.add(item);
    return Object.entries(item as Record<string, unknown>).every(
      ([key, child]) =>
        !CLAVES_INSEGURAS.has(key) && visitar(child, profundidad + 1),
    );
  };

  return visitar(ctx, 0);
}

@ValidatorConstraint({ name: 'jobContextCotizacion', async: false })
export class JobContextCotizacionConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return jobContextCotizacionValido(value);
  }

  defaultMessage(): string {
    return 'jobContext contiene cantidades, medidas o valores inválidos';
  }
}

/** Descuento comercial de la línea (sobre el neto, antes del IVA). */
export class DescuentoCotizarDto {
  @IsIn(['PORCENTAJE', 'MONTO'])
  tipo!: 'PORCENTAJE' | 'MONTO';

  @IsNumber()
  @Min(0)
  valor!: number;
}

export class PiezaJobContextDto {
  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsNumber()
  @Min(0)
  anchoMm!: number;

  @IsNumber()
  @Min(0)
  altoMm!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  perimetroMm?: number;
}

export class JobContextDto {
  @IsInt()
  @Min(0)
  cantidad!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PiezaJobContextDto)
  piezas?: PiezaJobContextDto[];

  @IsOptional()
  @IsObject()
  medidaCustomMm?: { anchoMm: number; altoMm: number };

  @IsOptional()
  @IsInt()
  caras?: 1 | 2;

  @IsOptional()
  @IsInt()
  tipoCopia?: 1 | 2 | 3;

  @IsOptional()
  @IsInt()
  numerosXTalonario?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tintasAdicionales?: string[];

  @IsOptional()
  @IsString()
  modoColor?: string;

  @IsOptional()
  @IsObject()
  modoColorPorPaso?: Record<string, string>;

  @IsOptional()
  @IsString()
  tecnologia?: string;

  @IsOptional()
  @IsNumber()
  distanciaKm?: number;

  @IsOptional()
  @IsNumber()
  m2_instalados?: number;

  @IsOptional()
  @IsString()
  zonaInstalacion?: string;

  @IsOptional()
  @IsObject()
  opcionalesActivados?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  slotMateriales?: Record<string, string>;

  @IsOptional()
  @IsObject()
  configPasoRuntime?: Record<string, Record<string, unknown>>;

  @IsOptional()
  @IsString()
  modoCotizacionLineal?: string;

  @IsOptional()
  @IsNumber()
  cantidadComercialPricing?: number;

  @IsOptional()
  @IsNumber()
  cantidadComercial?: number;

  @IsOptional()
  @IsNumber()
  metrosLineales?: number;

  @IsOptional()
  @IsNumber()
  piezaAreaTotalM2?: number;

  @IsOptional()
  @IsNumber()
  piezaPerimetroTotalM?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  placasVectorialesManuales?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  metrosCortePorPlacaVectorial?: number;

  @IsOptional()
  @IsNumber()
  anchoMaterialMm?: number;

  @IsOptional()
  @IsNumber()
  largoMaterialMm?: number;
}

export class CotizarDto {
  @IsUUID()
  productoId!: string;

  @IsOptional()
  @IsUUID()
  rutaAlternativaId?: string | null;

  @IsObject()
  @Validate(JobContextCotizacionConstraint)
  jobContext!: JobContextDto & Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  clienteId?: string | null;

  /** Descuento comercial de la línea. El motor lo aplica sobre el neto. */
  @IsOptional()
  @ValidateNested()
  @Type(() => DescuentoCotizarDto)
  descuento?: DescuentoCotizarDto | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'periodo debe tener formato YYYY-MM',
  })
  periodo?: string | null;

  @IsOptional()
  @IsUUID()
  cotizacionId?: string;
}

/** Solicitud durable para cálculos que pueden incluir uno o más nestings. */
export class CotizarAsincronoDto extends CotizarDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9:_-]{8,160}$/, {
    message: 'claveSolicitud tiene un formato inválido',
  })
  claveSolicitud?: string;
}

/** DTO concreto: los tipos utilitarios de TypeScript no existen en runtime. */
export class RecotizarItemDto {
  @IsOptional()
  @IsUUID()
  rutaAlternativaId?: string | null;

  @IsObject()
  @Validate(JobContextCotizacionConstraint)
  jobContext!: JobContextDto & Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  clienteId?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'periodo debe tener formato YYYY-MM',
  })
  periodo?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => DescuentoCotizarDto)
  descuento?: DescuentoCotizarDto | null;
}
