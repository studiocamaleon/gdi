import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  CrearOrdenTrabajoItemDto,
  ORDEN_CANALES_VENTA,
} from '../../ordenes-trabajo/dto/crear-orden-trabajo.dto';

/** Estados del ciclo (docs/presupuestos-modulo-estudio.md §4). */
export const PRESUPUESTO_ESTADOS = [
  'borrador',
  'pendiente_aprobacion',
  'enviado',
  'aprobado',
  'rechazado',
  'vencido',
  'convertido',
] as const;
export type PresupuestoEstado = (typeof PRESUPUESTO_ESTADOS)[number];

/** Picklist de motivos de pérdida — nunca texto libre solo. */
export const MOTIVOS_PERDIDA = [
  'precio',
  'plazo',
  'sin_respuesta',
  'competencia',
  'otro',
] as const;

/**
 * Emitir presupuesto: formaliza la Cotizacion (snapshots ya persistidos por
 * la ficha) con número, cliente, vendedor y la PROYECCIÓN de items que
 * usará la conversión a OT (mismo shape que CrearOrdenTrabajoDto.items).
 */
export class EmitirPresupuestoDto {
  @IsUUID()
  cotizacionId: string;

  @IsUUID()
  clienteId: string;

  @IsOptional()
  @IsUUID()
  vendedorEmpleadoId?: string;

  @IsOptional()
  @IsIn(ORDEN_CANALES_VENTA)
  canalVenta?: string;

  /** ISO date (YYYY-MM-DD) — entrega estimada que se prometería. */
  @IsOptional()
  @IsISO8601()
  fechaEntrega?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validezDias?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  senaSugeridaPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cargosDirectos?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearOrdenTrabajoItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  items: CrearOrdenTrabajoItemDto[];
}

export class ResolverPresupuestoDto {
  @IsIn(['aprobado', 'rechazado'])
  resultado: 'aprobado' | 'rechazado';

  @IsOptional()
  @IsIn(MOTIVOS_PERDIDA as unknown as string[])
  motivoPerdida?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivoPerdidaDetalle?: string;
}

export class ConvertirPresupuestoDto {
  /** cotizacionItemIds a convertir; omitido = todos (conversión total). */
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  itemIds?: string[];
}

export class DecisionPublicaDto {
  @IsIn(['aprobado', 'rechazado'])
  decision: 'aprobado' | 'rechazado';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}

export class ListarPresupuestosDto {
  @IsOptional()
  @IsIn(PRESUPUESTO_ESTADOS as unknown as string[])
  estado?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  busqueda?: string;
}

/** Resolución de una aprobación interna pendiente (SUPERVISOR/ADMIN). */
export class ResolverAprobacionDto {
  @IsIn(['aprobar', 'devolver'])
  decision: 'aprobar' | 'devolver';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}

export class ActualizarConfigPresupuestosDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validezDiasDefault?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  senaSugeridaPctDefault?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  condicionesTexto?: string;

  /** null = regla desactivada. */
  @IsOptional()
  @ValidateIf((o) => o.aprobacionMontoMax !== null)
  @IsNumber()
  @Min(0)
  aprobacionMontoMax?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.aprobacionMargenMinPct !== null)
  @IsNumber()
  @Min(0)
  @Max(100)
  aprobacionMargenMinPct?: number | null;

  /** Descuento máximo (%) sin aprobación (F3 descuentos). null = desactivada. */
  @IsOptional()
  @ValidateIf((o) => o.aprobacionDescuentoMaxPct !== null)
  @IsNumber()
  @Min(0)
  @Max(100)
  aprobacionDescuentoMaxPct?: number | null;
}
