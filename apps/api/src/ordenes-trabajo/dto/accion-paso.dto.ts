import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  ORDEN_TRABAJO_PASO_ACCIONES,
  type OrdenTrabajoPasoAccion,
} from '../ordenes-trabajo.types';

/** Acción de ejecución sobre un paso de producción (Tablero). */
export class AccionPasoOrdenTrabajoDto {
  @IsIn(ORDEN_TRABAJO_PASO_ACCIONES)
  accion: OrdenTrabajoPasoAccion;

  /** Obligatorio al bloquear: qué está frenando el paso. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}
