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
 * Progreso efectivo que reporta la API: derivado del estado salvo que
 * producción haya informado un valor real (futuro tablero).
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
