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
  'hecho',
  'bloqueado',
] as const;

export type OrdenTrabajoPasoEstado =
  (typeof ORDEN_TRABAJO_PASO_ESTADOS)[number];

export const ORDEN_TRABAJO_PASO_ACCIONES = [
  'iniciar',
  'completar',
  'bloquear',
  'desbloquear',
  'reabrir',
] as const;

export type OrdenTrabajoPasoAccion =
  (typeof ORDEN_TRABAJO_PASO_ACCIONES)[number];

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
