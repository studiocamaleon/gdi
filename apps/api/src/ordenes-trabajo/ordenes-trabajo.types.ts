/**
 * Órdenes de trabajo — tipos y ciclo de vida.
 * Contrato espejo del frontend: src/lib/ordenes-trabajo.ts.
 * Ver docs/ordenes-trabajo-persistencia-diseno.md
 */

/**
 * El ciclo normal, EN ORDEN. Es una secuencia, no un conjunto: varias cuentas
 * dependen de la posición (el progreso, la matriz de transiciones).
 * `cancelada` NO está acá a propósito — no es una etapa más adelante, es una
 * salida lateral que puede pasar desde casi cualquier punto.
 */
export const ORDEN_TRABAJO_FLUJO = [
  'borrador',
  'pendiente',
  'produccion',
  'finalizada',
  'entregada',
] as const;

export const ORDEN_TRABAJO_ESTADOS = [
  ...ORDEN_TRABAJO_FLUJO,
  'cancelada',
] as const;

export type OrdenTrabajoEstado = (typeof ORDEN_TRABAJO_ESTADOS)[number];

/** Terminal: de acá no se sale. Se cancela una vez y queda. */
export const ESTADO_CANCELADA = 'cancelada' as const;

/**
 * Desde dónde se puede cancelar: mientras el trabajo todavía no está hecho.
 *
 * `finalizada` y `entregada` quedan afuera a propósito, y no es una restricción
 * caprichosa: el trabajo YA existe. El material se consumió y las horas se
 * pagaron, así que "cancelar" no describe nada real. Peor: al salir del eje
 * comercial se llevaría puesta la venta Y el costo juntos —salen de la misma
 * fila del reporte—, con lo cual el taller dejaría de ver que produjo algo que
 * no cobró. Un trabajo hecho y no cobrado es una PÉRDIDA, y hacerla desaparecer
 * de los números es exactamente lo que un sistema de costeo no puede hacer.
 *
 * Si una orden se finalizó por error, el camino es reabrir un paso desde el
 * tablero —eso la devuelve a producción— y cancelarla ahí. Es un acto
 * consciente y queda registrado.
 *
 * `borrador` sí: nunca salió al taller, no cuenta como venta y no hay otra
 * forma de descartarlo.
 */
export const ESTADOS_CANCELABLES = [
  'borrador',
  'pendiente',
  'produccion',
] as const satisfies readonly OrdenTrabajoEstado[];

export function esCancelable(estado: string): boolean {
  return (ESTADOS_CANCELABLES as readonly string[]).includes(estado);
}

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
  'cancelacion',
] as const;

export type OrdenTrabajoEventoTipo =
  (typeof ORDEN_TRABAJO_EVENTO_TIPOS)[number];

export const ORDEN_TRABAJO_ESTADO_LABELS: Record<OrdenTrabajoEstado, string> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  produccion: 'En producción',
  finalizada: 'Finalizada',
  entregada: 'Entregada',
  cancelada: 'Cancelada',
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

/**
 * Etiqueta humana del motivo de cierre de un tramo (para la card pausada):
 * "pausa:falta_material" → "Falta material"; cierres de sistema con nombre
 * propio; null si no aplica.
 */
export function etiquetaMotivoFin(
  motivoFin: string | null,
  motivoDetalle: string | null,
): string | null {
  if (!motivoFin) return null;
  if (motivoFin === 'fin_jornada') return 'Fin de jornada';
  if (motivoFin === 'auto_pausa') return 'Pausa automática';
  if (motivoFin.startsWith('pausa:')) {
    const codigo = motivoFin.slice('pausa:'.length) as MotivoPausa;
    if (codigo === 'otro' && motivoDetalle) return motivoDetalle;
    return MOTIVO_PAUSA_LABELS[codigo] ?? codigo;
  }
  return null;
}

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
    // Una cancelada no tiene avance que mostrar: quedó donde quedó, y decir
    // "40%" invitaría a leerlo como algo que todavía puede terminar.
    case 'cancelada':
      return null;
  }
}
