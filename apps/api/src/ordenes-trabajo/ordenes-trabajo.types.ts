/**
 * Órdenes de trabajo — tipos y ciclo de vida.
 * Contrato espejo del frontend: src/lib/ordenes-trabajo.ts.
 * Ver docs/ordenes-trabajo-persistencia-diseno.md
 */

export const ORDEN_TRABAJO_ESTADOS = [
  'borrador',
  'pendiente',
  'produccion',
  'finalizada',
  'entregada',
] as const;

export type OrdenTrabajoEstado = (typeof ORDEN_TRABAJO_ESTADOS)[number];

export const ORDEN_TRABAJO_EVENTO_TIPOS = [
  'emision',
  'numero_asignado',
  'borrador',
  'productos',
  'estado',
  'modificacion',
  'item_agregado',
  'item_modificado',
  'item_quitado',
  'paso',
  'nota',
] as const;

export type OrdenTrabajoEventoTipo =
  (typeof ORDEN_TRABAJO_EVENTO_TIPOS)[number];

export const ORDEN_TRABAJO_ESTADO_LABELS: Record<OrdenTrabajoEstado, string> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  produccion: 'En producción',
  finalizada: 'Finalizada',
  entregada: 'Entregada',
};

/**
 * Pasos de producción (Tablero). Estados de ejecución de un
 * OrdenTrabajoItemPaso y acciones que los transicionan.
 * Ver docs/tablero-produccion-conexion-diseno.md
 */
export const ORDEN_TRABAJO_PASO_ESTADOS = [
  'pendiente',
  'en_curso',
  'pausado',
  'hecho',
  'bloqueado',
] as const;

export type OrdenTrabajoPasoEstado =
  (typeof ORDEN_TRABAJO_PASO_ESTADOS)[number];

export const ORDEN_TRABAJO_PASO_ACCIONES = [
  'iniciar',
  'pausar',
  'continuar',
  'completar',
  'bloquear',
  'desbloquear',
  'reabrir',
] as const;

export type OrdenTrabajoPasoAccion =
  (typeof ORDEN_TRABAJO_PASO_ACCIONES)[number];

/**
 * Registro de tiempos (docs/registro-tiempos-produccion-diseno.md).
 * Motivos de pausa elegibles por el operario (D7); los cierres de sistema
 * ('fin_jornada' | 'auto_pausa' | 'bloqueo' | 'migracion') no se eligen.
 */
export const MOTIVOS_PAUSA = [
  'falta_material',
  'falta_informacion',
  'cambio_prioridad',
  'mantenimiento_maquina',
  'fin_turno',
  'otro',
] as const;

export type MotivoPausa = (typeof MOTIVOS_PAUSA)[number];

export const MOTIVO_PAUSA_LABELS: Record<MotivoPausa, string> = {
  falta_material: 'Falta material',
  falta_informacion: 'Falta información',
  cambio_prioridad: 'Cambio de prioridad',
  mantenimiento_maquina: 'Mantenimiento de máquina',
  fin_turno: 'Fin de turno',
  otro: 'Otro',
};

/** Calidad/origen del tiempo real asentado en un paso hecho (D3). */
export const TIEMPO_FUENTES = [
  'medido',
  'medido_lote',
  'declarado',
  'estimado',
  'invalido',
] as const;

export type TiempoFuente = (typeof TIEMPO_FUENTES)[number];

/**
 * Un completar en modo cronómetro con menos trabajo medido que este umbral
 * es el clásico "inicio y completo en 1 seg": el tiempo no vale (D8).
 */
export function tiempoMedidoValido(
  sumaMin: number,
  estimadoMin: number | null,
): boolean {
  return sumaMin >= Math.max(1, estimadoMin != null ? estimadoMin * 0.1 : 0);
}

/**
 * Progreso efectivo que reporta la API: derivado del estado salvo que
 * producción haya informado un valor real (tablero).
 */
export function progresoEfectivo(
  estado: OrdenTrabajoEstado,
  progresoPct: number | null,
): number | null {
  switch (estado) {
    case 'borrador':
      return null;
    case 'pendiente':
      return progresoPct ?? 0;
    case 'produccion':
      return progresoPct;
    case 'finalizada':
    case 'entregada':
      return 100;
  }
}
