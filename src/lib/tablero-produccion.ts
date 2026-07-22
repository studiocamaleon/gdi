/**
 * Tablero de producción — contrato de datos REAL.
 *
 * Reemplaza a `tablero-produccion-mock.ts` como fuente de tipos de la vista.
 * El backend materializa los pasos de producción (`OrdenTrabajoItemPaso`)
 * desde la trazabilidad del snapshot del cotizador al emitir la OT, y este
 * módulo define lo que devuelve `GET /ordenes-trabajo/tablero` más los
 * derivados de presentación (prioridad, vencimiento, estado del item).
 * Ver docs/tablero-produccion-conexion-diseno.md
 */

import { fechaLocalDesdeIso, formatFechaOrden } from "@/lib/ordenes-trabajo";

// ── Contrato con el backend ──────────────────────────────────────────────

export type TableroPasoEstado =
  | "pendiente"
  | "en_curso"
  | "pausado"
  | "hecho"
  | "bloqueado";

/** Registro de tiempos (docs/registro-tiempos-produccion-diseno.md D1). */
export type TableroPasoModoRegistro = "cronometro" | "solo_completar";

/** Calidad/origen del tiempo real asentado en un paso hecho (D3). */
export type TableroPasoTiempoFuente =
  | "medido"
  | "medido_lote"
  | "declarado"
  | "estimado"
  | "invalido";

/** Cronómetro corriendo sobre el paso: quién y desde cuándo. */
export type TableroPasoTramoAbierto = {
  usuarioNombre: string;
  /** ISO datetime. */
  inicioEl: string;
  esMio: boolean;
};

export type TableroPasoData = {
  id: string;
  indice: number;
  nombre: string;
  familiaCodigo: string;
  /** Categoría de alto nivel de la familia (agrupa la vista Por estación). */
  categoriaFamilia: string;
  centroCostoId: string | null;
  /** Centro de costo que tarifó el paso — proxy de "estación" en fase 1. */
  centroCostoNombre: string | null;
  duracionEstimadaMin: number | null;
  estado: TableroPasoEstado;
  motivoBloqueo: string | null;
  /** ISO datetime o null. */
  iniciadoEl: string | null;
  completadoEl: string | null;
  /** cronometro (Iniciar→Pausar/Continuar→Completar) o solo_completar. */
  modoRegistro: TableroPasoModoRegistro;
  /** Tiempo real asentado al completar; null hasta 'hecho'. */
  tiempoRealMin: number | null;
  tiempoFuente: TableroPasoTiempoFuente | null;
  /** Atribución de operador (D5). */
  iniciadoPorNombre: string | null;
  completadoPorNombre: string | null;
  tramoAbierto: TableroPasoTramoAbierto | null;
  /** Etiqueta humana de por qué está pausado (solo estado 'pausado'). */
  motivoPausa: string | null;
  /** Minutos ya trabajados en tramos cerrados (evalúa el prompt D8). */
  tiempoAcumuladoMin: number;
  /** El paso está en MI mesa de trabajo (reclamo persistente por usuario). */
  mesaEsMia: boolean;
  /** Quién lo tiene en su mesa (para el resto del taller); null = nadie. */
  mesaUsuarioNombre: string | null;
  /** === Tercerización (F2) ===: 'interno' (tablero) | 'tercerizado' (Compras). */
  tipoEjecucion: string;
  proveedorNombre: string | null;
  plazoProveedorDias: number | null;
  /** Sólo tercerizados: 'pendiente' | 'pedido' | 'recibido' | 'entregado'. */
  estadoCompra: string | null;
};

export type TableroItemData = {
  /** Id del OrdenTrabajoItem. */
  id: string;
  ordenId: string;
  ordenNumero: string;
  ordenEstado: string;
  itemIndice: number;
  codigo: string;
  nombre: string;
  clienteNombre: string;
  vendedorNombre: string;
  cantidad: number;
  cantidadUnidad: string;
  specs: Array<{ etiqueta: string; valor: string }>;
  /** ISO date o null (a nivel orden). */
  fechaEntrega: string | null;
  /** Cuántos archivos tiene el item (arte de producción). */
  archivosCount: number;
  /** Item manual/histórico sin snapshot: no tiene ruta de producción. */
  sinRuta: boolean;
  pasos: TableroPasoData[];
};

export type TableroPasoAccion =
  | "iniciar"
  | "pausar"
  | "continuar"
  | "completar"
  | "bloquear"
  | "desbloquear"
  | "reabrir";

/** Motivos de pausa elegibles (espejo de MOTIVOS_PAUSA del backend, D7). */
export const MOTIVOS_PAUSA: Array<{ codigo: string; etiqueta: string }> = [
  { codigo: "falta_material", etiqueta: "Falta material" },
  { codigo: "falta_informacion", etiqueta: "Falta información" },
  { codigo: "cambio_prioridad", etiqueta: "Cambio de prioridad" },
  { codigo: "mantenimiento_maquina", etiqueta: "Mantenimiento de máquina" },
  { codigo: "fin_turno", etiqueta: "Fin de turno" },
  { codigo: "otro", etiqueta: "Otro" },
];

/** Etiqueta corta de la fuente del tiempo (para chips/tooltips). */
export const TIEMPO_FUENTE_LABELS: Record<TableroPasoTiempoFuente, string> = {
  medido: "medido",
  medido_lote: "medido en tanda",
  declarado: "declarado",
  estimado: "estimado",
  invalido: "sin tiempo",
};

// ── Metadatos de familias de pasos (espejo del catálogo del backend) ─────

/** Icono visual por familia de paso (claves del set de iconos del tablero). */
export const FAMILIA_ICONOS: Record<string, string> = {
  pre_prensa: "Check",
  proof: "Check",
  diseno_grafico: "Layout",
  impresion_por_hoja: "Printer",
  impresion_por_area: "Plot",
  impresion_por_pieza: "Printer",
  aplicacion_transfer: "Stamp",
  grabado_laser: "Beam",
  corte_guillotina: "Scissors",
  plotter_corte: "Cut",
  corte_laser: "Beam",
  troquelado_digital: "Stamp",
  cnc: "Cnc",
  plegado: "Fold",
  perforado: "Stamp",
  corte_manual: "Scissors",
  laminado: "Brush",
  plastificado_pouch: "Brush",
  barniz: "Brush",
  acabado_decorativo: "Brush",
  pintura_superficial: "Brush",
  lijado_canteado: "Tool",
  encuadernado_engrapado: "Book",
  encuadernado_anillado: "Book",
  engomado_emblocado: "Book",
  armado_cajas: "Tool",
  soldadura: "Tool",
  montaje_sobre_sustrato: "Tool",
  ensamble_estructural: "Tool",
  instalacion_electrica: "Wrench",
  embalaje: "Package",
  conteo_manual: "Package",
  atado_banding: "Package",
  etiquetado_manual: "Package",
  control_calidad: "Shield",
  trabajo_manual: "Tool",
  modificacion_pre: "Tool",
  modificacion_post: "Tool",
  colocacion_ojales: "Tool",
  envio: "Truck",
  instalacion_in_situ: "Wrench",
  toma_medidas: "Tool",
};

export function familiaIcono(familiaCodigo: string): string {
  return FAMILIA_ICONOS[familiaCodigo] ?? "Tool";
}

/** Orden y nombre visible de las categorías (vista Por estación). */
export const CATEGORIAS_FAMILIA: Array<{ key: string; nm: string }> = [
  { key: "servicios_profesionales", nm: "Servicios profesionales" },
  { key: "pre_prensa", nm: "Pre-prensa" },
  { key: "produccion_impresion", nm: "Impresión" },
  { key: "corte_y_formado", nm: "Corte y formado" },
  { key: "terminaciones", nm: "Terminaciones" },
  { key: "encuadernacion_armado", nm: "Encuadernación y armado" },
  { key: "estructural_montaje", nm: "Estructural y montaje" },
  { key: "operaciones_manuales", nm: "Operaciones manuales" },
  { key: "logistica_instalacion", nm: "Logística e instalación" },
];

// ── Derivados de presentación ────────────────────────────────────────────

export type TableroPrioridad = "urgent" | "high" | "normal";

/** "OT-2026-0184" + índice 0 → "OT-0184 · A" (código visible del item). */
export function codigoVisibleItem(ordenNumero: string, itemIndice: number): string {
  const corto = ordenNumero.replace(/^OT-\d{4}-/, "OT-");
  const letra = String.fromCharCode(65 + (itemIndice % 26));
  return `${corto} · ${letra}`;
}

/** Días de diferencia entre la fecha de entrega (date-only) y hoy. */
export function diasHastaEntrega(fechaEntrega: string | null): number | null {
  if (!fechaEntrega) return null;
  const entrega = fechaLocalDesdeIso(fechaEntrega);
  if (!entrega) return null;
  const ahora = new Date();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return Math.round((entrega.getTime() - hoy.getTime()) / 86_400_000);
}

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "Vie 30 may", como el diseño (arrays fijos: sin depender del locale). */
export function etiquetaEntrega(fechaEntrega: string | null): string {
  const dias = diasHastaEntrega(fechaEntrega);
  if (dias === null) return "Sin fecha";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  const fecha = fechaEntrega ? fechaLocalDesdeIso(fechaEntrega) : null;
  if (!fecha) return formatFechaOrden(fechaEntrega);
  return `${DIAS_SEMANA[fecha.getDay()]} ${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
}

export function etiquetaRestante(fechaEntrega: string | null): string {
  const dias = diasHastaEntrega(fechaEntrega);
  if (dias === null) return "—";
  if (dias === 0) return "Hoy";
  if (dias < 0) return `Vencida ${Math.abs(dias)}d`;
  return `${dias}d`;
}

/**
 * Prioridad DERIVADA del vencimiento (no hay campo real todavía):
 * vencida u hoy → urgente · ≤2 días → alta · resto → normal.
 */
export function prioridadDerivada(fechaEntrega: string | null): TableroPrioridad {
  const dias = diasHastaEntrega(fechaEntrega);
  if (dias === null) return "normal";
  if (dias <= 0) return "urgent";
  if (dias <= 2) return "high";
  return "normal";
}

export function itemTerminado(item: TableroItemData): boolean {
  return (
    item.pasos.length > 0 && item.pasos.every((paso) => paso.estado === "hecho")
  );
}

export function itemBloqueado(item: TableroItemData): boolean {
  return item.pasos.some((paso) => paso.estado === "bloqueado");
}

export function itemIniciado(item: TableroItemData): boolean {
  return item.pasos.some((paso) => paso.estado !== "pendiente");
}

/** Primer paso que no está hecho: donde está parado el trabajo. */
export function pasoActual(item: TableroItemData): TableroPasoData | undefined {
  return item.pasos.find((paso) => paso.estado !== "hecho");
}

/**
 * La ruta es una SECUENCIA: el paso ACTIVO es el que está listo para
 * hacerse — es el primero, o todos los anteriores ya están hechos. Las
 * vistas operativas (Por estación) muestran únicamente pasos activos: los
 * futuros todavía no son trabajo de nadie.
 */
export function pasoActivo(item: TableroItemData, paso: TableroPasoData): boolean {
  if (paso.estado === "hecho") return false;
  return item.pasos
    .filter((otro) => otro.indice < paso.indice)
    .every((otro) => otro.estado === "hecho");
}

/** Deshacer sólo en la frontera: nada posterior puede haber arrancado. */
export function pasoReabrible(item: TableroItemData, paso: TableroPasoData): boolean {
  if (paso.estado !== "hecho") return false;
  return item.pasos
    .filter((otro) => otro.indice > paso.indice)
    .every((otro) => otro.estado === "pendiente");
}

export function progresoItem(item: TableroItemData): number {
  if (item.pasos.length === 0) return 0;
  const hechos = item.pasos.filter((paso) => paso.estado === "hecho").length;
  return Math.round((hechos / item.pasos.length) * 100);
}

/** Vencida y sin terminar (no hay plan por paso todavía). */
export function itemConRetraso(item: TableroItemData): boolean {
  const dias = diasHastaEntrega(item.fechaEntrega);
  return dias !== null && dias < 0 && !itemTerminado(item);
}

export function lineaEstado(item: TableroItemData): string {
  if (item.sinRuta) return "Sin ruta de producción cargada";
  const actual = pasoActual(item);
  if (!actual) return "Todos los pasos completados";
  // El motivo del bloqueo se muestra aparte (blockedReason): acá sólo el dónde.
  if (actual.estado === "bloqueado") return `Bloqueado en ${actual.nombre}`;
  if (actual.estado === "en_curso") return `${actual.nombre} · en curso`;
  if (actual.estado === "pausado") return `${actual.nombre} · pausado`;
  if (!itemIniciado(item)) return `Por iniciar · primer paso: ${actual.nombre}`;
  return `Próximo paso: ${actual.nombre}`;
}

/** "45 min" / "2h 30m" / "12 h" a partir de minutos estimados. */
export function etiquetaDuracion(min: number | null): string | null {
  if (min == null || min <= 0) return null;
  if (min < 60) return `${Math.round(min)} min`;
  const horas = Math.floor(min / 60);
  const resto = Math.round(min % 60);
  return resto > 0 ? `${horas}h ${resto}m` : `${horas} h`;
}

/** "16/07 14:32" para timestamps de ejecución. */
export function etiquetaMomento(iso: string | null): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const hh = String(fecha.getHours()).padStart(2, "0");
  const mi = String(fecha.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

type EstacionRuteo = {
  id: string;
  activo: boolean;
  familias: string[];
  maquinas: Array<{ centroCostoId: string | null }>;
};

/**
 * Ruteo paso → estación (estaciones ACTIVAS): el paso llega por su FAMILIA,
 * y las máquinas de la estación son FILTROS — si la estación tiene máquinas,
 * sólo recibe los pasos que usan esas máquinas (vía el centro de costo del
 * paso, que identifica la máquina). Resolución determinista:
 *   1. estación con la familia cuya máquina matchea el centro del paso;
 *   2. estación general (con la familia y sin máquinas);
 *   3. paso manual (sin centro) con única candidata;
 *   4. sin estación (null).
 */
export function resolverEstacionDePaso<T extends EstacionRuteo>(
  estaciones: T[],
  paso: Pick<TableroPasoData, "familiaCodigo" | "centroCostoId">,
): T | null {
  const candidatas = estaciones.filter(
    (estacion) => estacion.activo && estacion.familias.includes(paso.familiaCodigo),
  );
  if (candidatas.length === 0) return null;

  if (paso.centroCostoId) {
    const porMaquina = candidatas.find((estacion) =>
      estacion.maquinas.some((maquina) => maquina.centroCostoId === paso.centroCostoId),
    );
    if (porMaquina) return porMaquina;
  }

  const general = candidatas.find((estacion) => estacion.maquinas.length === 0);
  if (general) return general;

  if (!paso.centroCostoId && candidatas.length === 1) return candidatas[0];
  return null;
}

/** Clave del bucket de pasos sin estación asignada. */
export const SIN_ESTACION_KEY = "sin-estacion";
