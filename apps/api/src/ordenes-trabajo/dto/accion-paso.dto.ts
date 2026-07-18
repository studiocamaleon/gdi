import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ORDEN_TRABAJO_PASO_ACCIONES,
  type OrdenTrabajoPasoAccion,
} from '../ordenes-trabajo.types';

/** Acción de ejecución sobre un paso de producción (Tablero). */
export class AccionPasoOrdenTrabajoDto {
  @IsIn(ORDEN_TRABAJO_PASO_ACCIONES)
  accion: OrdenTrabajoPasoAccion;

  /**
   * Obligatorio al bloquear (texto libre: qué frena el paso) y al pausar
   * (código del catálogo MOTIVOS_PAUSA).
   */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;

  /** Texto libre cuando el motivo de pausa es 'otro'. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivoDetalle?: string;

  /**
   * Al completar en modo cronómetro con tiempo medido inválido, el operario
   * puede declarar cuánto le llevó aprox (micro-prompt, D8).
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  tiempoDeclaradoMin?: number;
}
