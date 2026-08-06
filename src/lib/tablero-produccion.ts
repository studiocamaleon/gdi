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
  /**
   * Paso de la ruta que lo originó. Es la clave con la que la vista
   * consolidada de Costos empareja el tiempo REAL de este paso con la tarifa
   * y el costo COTIZADOS del snapshot. Null en pasos materializados sin
   * `rutaPasoId` en la trazabilidad (órdenes viejas): ahí se cae al índice.
   */
  rutaPasoId: string | null;
  nombre: string;
  familiaCodigo: string;
  /** Si el paso es una INSTANCIA del tenant, de qué plantilla del catálogo
   *  hereda. Los mapas de UI y el ruteo a estaciones caen acá cuando el
   *  código propio (un UUID) no matchea. docs/pasos-tenant-por-plantilla */
  plantillaCodigo?: string | null;
  /** Categoría de alto nivel de la familia (agrupa la vista Por estación). */
  categoriaFamilia: string;
  centroCostoId: string | null;
  /** Centro de costo que tarifó el paso — proxy de "estación" en fase 1. */
  centroCostoNombre: string | null;
  /** Máquina que ejecutó el paso: señal REAL para el ruteo a estaciones (rediseño
   *  por reglas). Null en pasos sin máquina o en órdenes viejas. */
  maquinaId?: string | null;
  /** Tecnología de esa máquina (derivada). Base del ruteo "por tecnología". */
  tecnologia?: string | null;
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
  diseno_grafico: "Layout",
  impresion_por_hoja: "Printer",
  impresion_por_area: "Plot",
  impresion_por_pieza: "Printer",
  aplicacion_transfer: "Stamp",
  aplicacion_transfer_textil: "Stamp",
  grabado_laser: "Beam",
  corte_guillotina: "Scissors",
  plotter_corte: "Cut",
  corte_laser: "Beam",
  troquelado_digital: "Stamp",
  cnc: "Cnc",
  plegado: "Fold",
  corte_manual: "Scissors",
  laminado: "Brush",
  plastificado_pouch: "Brush",
  pintura_superficial: "Brush",
  encuadernado_anillado: "Book",
  engomado_emblocado: "Book",
  montaje_sobre_sustrato: "Tool",
  ensamble_estructural: "Tool",
  embalaje: "Package",
  trabajo_manual: "Tool",
  modificacion_pre: "Tool",
  modificacion_post: "Tool",
  colocacion_ojales: "Tool",
  instalacion_in_situ: "Wrench",
};

export function familiaIcono(
  familiaCodigo: string,
  plantillaCodigo?: string | null,
): string {
  // Una instancia del tenant tiene por código un UUID: cae al ícono de su
  // plantilla antes que al genérico.
  return (
    FAMILIA_ICONOS[familiaCodigo] ??
    (plantillaCodigo ? FAMILIA_ICONOS[plantillaCodigo] : undefined) ??
    "Tool"
  );
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
  maquinas: Array<{ id?: string | null; centroCostoId: string | null }>;
  /** Reglas nuevas (rediseño): 'tecnologia' | 'paso' (+ 'maquina'/'familia'). */
  reglas?: Array<{ tipo: string; valor: string }>;
};

type PasoRuteo = Pick<
  TableroPasoData,
  | "familiaCodigo"
  | "plantillaCodigo"
  | "centroCostoId"
  | "maquinaId"
  | "tecnologia"
>;

/**
 * Ruteo paso → estación (rediseño "estaciones por reglas",
 * docs/estaciones-reglas-diseno.md). La estación declara qué agrupa; el paso no
 * declara estación. Se prueba por prioridad, de lo más específico a lo general:
 *
 *   1. por MÁQUINA (la máquina del paso está en la estación) — señal real;
 *   2. por TECNOLOGÍA (regla) — la máquina del paso es de esa tecnología;
 *   3. por PASO concreto (regla) — separa pasos de la misma familia;
 *   4. por FAMILIA — la estación general (sin máquinas) de esa familia, o la
 *      única candidata. (Fase D: se retiró el ruteo por centro de costo, que era
 *      un eje de costeo, no de piso de taller.)
 *
 * Determinista: primer match por nivel. Sin match → null ("Sin estación").
 */
export function resolverEstacionDePaso<T extends EstacionRuteo>(
  estaciones: T[],
  paso: PasoRuteo,
): T | null {
  const activas = estaciones.filter((estacion) => estacion.activo);

  // 1. Por máquina: la máquina que ejecutó el paso está asignada a la estación.
  if (paso.maquinaId) {
    const porMaquina = activas.find((estacion) =>
      estacion.maquinas.some((maquina) => maquina.id === paso.maquinaId),
    );
    if (porMaquina) return porMaquina;
  }
  // 2. Por tecnología (regla nueva).
  if (paso.tecnologia) {
    const porTecnologia = activas.find((estacion) =>
      (estacion.reglas ?? []).some(
        (regla) => regla.tipo === "tecnologia" && regla.valor === paso.tecnologia,
      ),
    );
    if (porTecnologia) return porTecnologia;
  }
  // 3. Por paso concreto (regla nueva; identidad del paso = su familiaCodigo).
  // La regla puede apuntar al paso propio (su UUID) o a la plantilla de la
  // que hereda: la instancia HEREDA la estación y puede tener la suya.
  const porPaso = activas.find((estacion) =>
    (estacion.reglas ?? []).some(
      (regla) =>
        regla.tipo === "paso" &&
        (regla.valor === paso.familiaCodigo ||
          (paso.plantillaCodigo != null &&
            regla.valor === paso.plantillaCodigo)),
    ),
  );
  if (porPaso) return porPaso;

  // 4. Por familia: la estación general (sin máquinas) de esa familia, o —si no
  //    hay general— la única candidata. Sin centro de costo (Fase D).
  const candidatas = activas.filter(
    (estacion) =>
      estacion.familias.includes(paso.familiaCodigo) ||
      (paso.plantillaCodigo != null &&
        estacion.familias.includes(paso.plantillaCodigo)),
  );
  if (candidatas.length === 0) return null;
  const general = candidatas.find((estacion) => estacion.maquinas.length === 0);
  if (general) return general;
  if (candidatas.length === 1) return candidatas[0];
  return null;
}

/** Clave del bucket de pasos sin estación asignada. */
export const SIN_ESTACION_KEY = "sin-estacion";

/**
 * Clave del bucket sintético de pasos TERCERIZADOS (compras a proveedor). Como
 * "Sin estación", existe para todos los tenants sin ser una `Estacion` real: el
 * trabajo tercerizado no se ejecuta en el piso, se gestiona desde Compras de la
 * OT, pero se agrupa acá para verlo junto.
 */
export const TERCERIZADOS_KEY = "proveedor-tercerizado";
