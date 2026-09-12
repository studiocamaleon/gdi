import { calcularProgreso } from "./progreso-produccion";
import { claveFechaEnZona, diasEntreClaves, ZONA_DEFAULT } from "@/lib/zona";
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
  demandaHumana?: unknown;
  /** Intervalos registrados de ejecución; no incluyen pausas entre tramos. */
  tramosEjecucion?: Array<{ inicio: string; fin: string | null }>;
  /** Inicio aceptado del lote; la proyección no lo adelanta automáticamente. */
  planificadoDesde?: string | null;
  planificadoHasta?: string | null;
  atencionPlanificada?: unknown;
  id: string;
  indice: number;
  /** Null en OTs históricas: esas conservan la semántica lineal por índice. */
  nodoClave?: string | null;
  esTerminal?: boolean;
  predecesorPasoIds?: string[];
  /** Identidad de los trabajos que todavía debe esperar, incluso de otros ítems. */
  dependenciasPendientes?: {
    pasoId: string;
    pasoNombre: string;
    itemId: string;
    itemNombre: string;
    loteNombre: string | null;
  }[];
  /** Evaluado por API contra todos los ítems de la OT (incluye componentes). */
  predecesoresSatisfechos?: boolean;
  sucesorPasoIds?: string[];
  gatesOperativos?: Array<{
    id: string;
    tipo: "MATERIAL" | "CALIDAD";
    estado: "PENDIENTE" | "CUMPLIDO";
    detalle: string | null;
    resueltoEl: string | null;
    resueltoPorNombre: string | null;
  }>;
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
  /** La familia exige máquina; una OT histórica sin id no se considera manual. */
  requiereMaquina?: boolean;
  /** Tecnología derivada de la máquina; no determina una estación. */
  tecnologia?: string | null;
  duracionEstimadaMin: number | null;
  operacionesIncorporacionSnapshotJson?: Array<{
    codigo: string;
    nombre: string;
    componenteCodigo?: string;
    componenteNombre?: string;
    componentesCodigos?: string[];
    componentesNombres?: string[];
    modoTiempo: "FIJO" | "POR_UNIDAD";
    cantidadResuelta: number;
    unidadCantidad?: string | null;
    duracionMin: number;
    dotacionOperarios: number;
  }> | null;
  /** Una única operación representa el nesting consolidado de varios
   * componentes. El snapshot permite explicar material y asignaciones. */
  nestingLote?: {
    id: string | null;
    snapshot: unknown;
  } | null;
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
  /** Sólo escenarios internos; no se acepta desde la API. */
  prioridadPlanificacion?: number;
  /** Id del OrdenTrabajoItem. */
  id: string;
  /** Un componente fabricado es un subítem ejecutable del producto padre. */
  parentItemId?: string | null;
  loteEntregaId?: string | null;
  loteEntrega?: {
    id: string;
    nombre: string;
    cantidad: number;
    unidad: string;
    productoNombre: string;
    esProductoDelLote: boolean;
  } | null;
  componenteCodigo?: string | null;
  nodoIncorporacionClave?: string | null;
  componenteDe?: { id: string; nombre: string } | null;
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
  /** ISO date del lote/ítem, con respaldo en la fecha de la orden. */
  fechaEntrega: string | null;
  /** Cuántos archivos tiene el item (arte de producción). */
  archivosCount: number;
  /** Brief comercial de diseño; sólo se incluye cuando el producto lo usa. */
  briefDiseno?: unknown;
  /** Cantidad de caras necesaria para interpretar frente/dorso del brief. */
  caras?: 1 | 2;
  /** Item manual/histórico sin snapshot: no tiene ruta de producción. */
  sinRuta: boolean;
  pasos: TableroPasoData[];
};

export type AlcanceTableroProduccion = "completo" | "vendedor" | "operario";

export type TableroProduccionData = {
  items: TableroItemData[];
  alcance: AlcanceTableroProduccion;
  puedeGestionar: boolean;
  /** null = todas (supervisor); lista = estaciones habilitadas del empleado. */
  estacionIdsEjecutables: string[] | null;
  vendedorSinVinculo: boolean;
};

export function esItemEnCursoOperativo(item: {
  iniciado: boolean;
  terminado: boolean;
  bloqueado: boolean;
  atrasado: boolean;
}): boolean {
  return item.iniciado && !item.terminado && !item.bloqueado && !item.atrasado;
}

export function bucketKanbanProduccion(item: {
  iniciado: boolean;
  terminado?: boolean;
  atrasado: boolean;
  diasEntrega: number | null;
}): "not-started" | "today" | "delayed" | "active" | null {
  // El Kanban representa trabajo operativo pendiente. Un item terminado ya no
  // necesita ocupar una columna; sigue disponible en las demás vistas y en la
  // orden de trabajo para consulta histórica.
  if (item.terminado) return null;
  if (item.atrasado) return "delayed";
  if (item.diasEntrega === 0) return "today";
  if (!item.iniciado) return "not-started";
  return "active";
}

export function textoEntregaRelativa(
  diasEntrega: number | null,
  etiqueta: string,
): string {
  if (diasEntrega != null && diasEntrega < 0) {
    const dias = Math.abs(diasEntrega);
    return `${dias} ${dias === 1 ? "día" : "días"} de atraso`;
  }
  return etiqueta === "Hoy" ? "vence hoy" : `${etiqueta} restantes`;
}

export function debeRefrescarTablero(estado: {
  pestanaOculta: boolean;
  mutacionesEnCurso: number;
  arrastreActivo: boolean;
}): boolean {
  return (
    !estado.pestanaOculta &&
    estado.mutacionesEnCurso === 0 &&
    !estado.arrastreActivo
  );
}

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
  corte_hilo_caliente: "Scissors",
  laminado: "Brush",
  plastificado_pouch: "Brush",
  pintura_superficial: "Brush",
  encuadernado_anillado: "Book",
  engomado_emblocado: "Book",
  montaje_sobre_sustrato: "Tool",
  ensamble_estructural: "Tool",
  embalaje: "Package",
  trabajo_manual: "Tool",
  modificacion_post: "Tool",
  colocacion_ojales: "Tool",
  colocacion_raspadita: "Stamp",
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

/** "OT-2026-0184" + índice 0 → "OT-0184-A" (código visible del item). */
export function codigoVisibleItem(
  ordenNumero: string,
  itemIndice: number,
): string {
  const corto = ordenNumero.replace(/^OT-\d{4}-/, "OT-");
  const letra = String.fromCharCode(65 + (itemIndice % 26));
  return `${corto}-${letra}`;
}

/** Días de diferencia entre la fecha de entrega (date-only) y hoy. */
export function diasHastaEntrega(
  fechaEntrega: string | null,
  ahora: Date = new Date(),
  zona: string = ZONA_DEFAULT,
): number | null {
  if (!fechaEntrega) return null;
  return diasEntreClaves(
    claveFechaEnZona(ahora, zona),
    fechaEntrega.slice(0, 10),
  );
}

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** "Vie 30 may", como el diseño (arrays fijos: sin depender del locale). */
export function etiquetaEntrega(
  fechaEntrega: string | null,
  ahora = new Date(),
  zona = ZONA_DEFAULT,
): string {
  const dias = diasHastaEntrega(fechaEntrega, ahora, zona);
  if (dias === null) return "Sin fecha";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  const fecha = fechaEntrega ? fechaLocalDesdeIso(fechaEntrega) : null;
  if (!fecha) return formatFechaOrden(fechaEntrega);
  return `${DIAS_SEMANA[fecha.getDay()]} ${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
}

export function etiquetaRestante(
  fechaEntrega: string | null,
  ahora = new Date(),
  zona = ZONA_DEFAULT,
): string {
  const dias = diasHastaEntrega(fechaEntrega, ahora, zona);
  if (dias === null) return "—";
  if (dias === 0) return "Hoy";
  if (dias < 0) return `Vencida ${Math.abs(dias)}d`;
  return `${dias}d`;
}

/**
 * Prioridad DERIVADA del vencimiento (no hay campo real todavía):
 * vencida u hoy → urgente · ≤2 días → alta · resto → normal.
 */
export function prioridadDerivada(
  fechaEntrega: string | null,
  ahora: Date = new Date(),
  zona: string = ZONA_DEFAULT,
): TableroPrioridad {
  const dias = diasHastaEntrega(fechaEntrega, ahora, zona);
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

/**
 * El item todavía tiene trabajo pendiente, pero ninguna frontera de su DAG
 * está habilitada. En una OT compuesta esto significa que espera componentes
 * u otros pasos de la orden; operativamente está bloqueado, no completado.
 */
export function itemEsperandoDependencias(item: TableroItemData): boolean {
  return (
    !item.sinRuta &&
    item.pasos.some((paso) => paso.estado !== "hecho") &&
    pasosActivos(item).length === 0
  );
}

export function itemBloqueado(item: TableroItemData): boolean {
  return (
    item.pasos.some((paso) => paso.estado === "bloqueado") ||
    itemEsperandoDependencias(item)
  );
}

export function itemIniciado(item: TableroItemData): boolean {
  return item.pasos.some((paso) => {
    if (paso.estado !== "pendiente") return true;
    if (paso.tipoEjecucion !== "tercerizado") return false;

    // En un paso tercerizado la ejecución comienza con la orden de compra, no
    // con un cronómetro de taller. `pedido` y sus estados posteriores deben
    // sacar al item de "No iniciados" aunque el paso continúe pendiente hasta
    // que producción confirme la recepción/cierre.
    return ["pedido", "recibido", "entregado"].includes(
      (paso.estadoCompra ?? "").toLowerCase(),
    );
  });
}

/** Primera frontera visible; en un DAG puede haber varias activas a la vez. */
export function pasoActual(item: TableroItemData): TableroPasoData | undefined {
  return pasosActivos(item)[0];
}

/** Todas las fronteras visibles de la ruta; una ruta DAG puede tener varias. */
export function pasosActivos(item: TableroItemData): TableroPasoData[] {
  return item.pasos.filter((paso) => pasoActivo(item, paso));
}

/**
 * Una OT nueva usa precedencias explícitas y puede exponer varias fronteras
 * activas. Una OT histórica sin nodoClave conserva la secuencia por índice.
 */
export function pasoActivo(
  item: TableroItemData,
  paso: TableroPasoData,
): boolean {
  if (paso.estado === "hecho") return false;
  if (paso.nodoClave) {
    if (paso.predecesoresSatisfechos != null) {
      return paso.predecesoresSatisfechos;
    }
    const porId = new Map(
      item.pasos.map((candidato) => [candidato.id, candidato]),
    );
    return (paso.predecesorPasoIds ?? []).every(
      (id) => porId.get(id)?.estado === "hecho",
    );
  }
  return item.pasos
    .filter((otro) => otro.indice < paso.indice)
    .every((otro) => otro.estado === "hecho");
}

/** Deshacer sólo en la frontera: nada posterior puede haber arrancado. */
export function pasoReabrible(
  item: TableroItemData,
  paso: TableroPasoData,
): boolean {
  if (paso.estado !== "hecho") return false;
  if (paso.nodoClave) {
    const porId = new Map(
      item.pasos.map((candidato) => [candidato.id, candidato]),
    );
    const pendientes = [...(paso.sucesorPasoIds ?? [])];
    const visitados = new Set<string>();
    while (pendientes.length > 0) {
      const id = pendientes.pop()!;
      if (visitados.has(id)) continue;
      visitados.add(id);
      const descendiente = porId.get(id);
      if (!descendiente) continue;
      if (descendiente.estado !== "pendiente") return false;
      pendientes.push(...(descendiente.sucesorPasoIds ?? []));
    }
    return true;
  }
  return item.pasos
    .filter((otro) => otro.indice > paso.indice)
    .every((otro) => otro.estado === "pendiente");
}

export function progresoItem(item: TableroItemData): number {
  return calcularProgreso(item.pasos).porcentaje ?? 0;
}

/** Vencida y sin terminar (no hay plan por paso todavía). */
export function itemConRetraso(item: TableroItemData, ahora = new Date(), zona = ZONA_DEFAULT): boolean {
  const dias = diasHastaEntrega(item.fechaEntrega, ahora, zona);
  return dias !== null && dias < 0 && !itemTerminado(item);
}

export function lineaEstado(item: TableroItemData): string {
  if (item.sinRuta) return "Sin ruta de producción cargada";
  const actual = pasoActual(item);
  if (!actual) {
    // En un workflow DAG puede no haber una frontera ejecutable aunque todavía
    // queden pasos pendientes: sucede cuando el producto padre espera que
    // terminen rutas de componentes u otros nodos de la OT. No debe presentarse
    // como completado hasta que todos sus pasos estén realmente en `hecho`.
    return itemTerminado(item)
      ? "Todos los pasos completados"
      : "Esperando componentes o pasos anteriores";
  }
  if (actual.tipoEjecucion === "tercerizado") {
    const estadosCompra: Record<string, string> = {
      pendiente: "Compra a proveedor pendiente",
      pedido: "Pedido al proveedor",
      recibido: "Recibido del proveedor",
      entregado: "Entregado por el proveedor",
    };
    return estadosCompra[actual.estadoCompra ?? "pendiente"];
  }
  // El motivo del bloqueo se muestra aparte (blockedReason): acá sólo el dónde.
  if (actual.estado === "bloqueado") return `Bloqueado en ${actual.nombre}`;
  if (actual.estado === "en_curso") return `${actual.nombre} · en curso`;
  if (actual.estado === "pausado") return `${actual.nombre} · pausado`;
  if (!itemIniciado(item)) return `Por iniciar · primer paso: ${actual.nombre}`;
  return `Próximo paso: ${actual.nombre}`;
}

/** Rótulo breve de la operación visible en las cards del Kanban. */
export function etiquetaPasoKanban(
  estado: TableroPasoData["estado"] | undefined,
): "Paso en curso:" | "Paso pausado:" | "Próximo paso:" {
  if (estado === "en_curso") return "Paso en curso:";
  if (estado === "pausado") return "Paso pausado:";
  return "Próximo paso:";
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
  maquinas: Array<{ id?: string | null; activo?: boolean; centroCostoId: string | null }>;
  /** Lectura compatible de asignaciones anteriores. Tecnología ya no asigna tareas. */
  reglas?: Array<{ tipo: string; valor: string }>;
};

type PasoRuteo = Pick<TableroPasoData,
  "familiaCodigo" | "plantillaCodigo" | "centroCostoId" | "maquinaId" | "tecnologia" | "requiereMaquina"
> & Partial<Pick<TableroPasoData, "tipoEjecucion">>;

/** Una máquina sólo se ejecuta donde está asignada. Las reglas de pasos se
 * aplican exclusivamente sin máquina. Una asignación propia prevalece sobre
 * la heredada de su plantilla; una ambigüedad nunca se resuelve por orden.
 * Mantener idéntico en frontend y backend. */
export function resolverEstacionDePaso<T extends EstacionRuteo>(
  estaciones: T[], paso: PasoRuteo,
): T | null {
  if (paso.tipoEjecucion === "tercerizado") return null;
  const activas = estaciones.filter((e) => e.activo);
  if (paso.maquinaId) {
    const candidatas = activas.filter((e) => e.maquinas.some(
      (m) => m.id === paso.maquinaId && m.activo !== false,
    ));
    return candidatas.length === 1 ? candidatas[0] : null;
  }
  // No confundir una OT incompleta con una operación manual.
  if (paso.requiereMaquina || paso.tecnologia) return null;
  for (const codigo of [paso.familiaCodigo, paso.plantillaCodigo]) {
    if (!codigo) continue;
    // Compatibilidad: la antigua regla explícita tiene prioridad sobre familia.
    const explicitas = activas.filter((e) => (e.reglas ?? []).some(
      (r) => r.tipo === "paso" && r.valor === codigo,
    ));
    if (explicitas.length) return explicitas.length === 1 ? explicitas[0] : null;
    const heredadas = activas.filter((e) => e.familias.includes(codigo));
    if (heredadas.length) return heredadas.length === 1 ? heredadas[0] : null;
  }
  return null;
}

export function motivoSinEstacion(estaciones: EstacionRuteo[], paso: PasoRuteo): string | null {
  if (paso.tipoEjecucion === "tercerizado" || resolverEstacionDePaso(estaciones, paso)) return null;
  if (paso.maquinaId) return "Asigná la máquina cotizada a una estación activa y verificá que la máquina esté habilitada.";
  if (paso.requiereMaquina || paso.tecnologia) return "Este paso requiere máquina, pero la orden no identifica cuál. Revisá su configuración de origen.";
  return "Asigná este paso sin máquina a una única estación activa; revisá si falta la asignación o está repetida.";
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


/** La identidad del lote viene de su relación, nunca del nombre recortado. */
export function nombreTrabajoTablero(item: TableroItemData): string {
  return item.loteEntrega?.esProductoDelLote
    ? item.loteEntrega.productoNombre
    : item.nombre;
}

export function textoDependenciaTablero(
  dependencia: NonNullable<TableroPasoData["dependenciasPendientes"]>[number],
): string {
  return [dependencia.pasoNombre, dependencia.itemNombre, dependencia.loteNombre]
    .filter(Boolean).join(" · ");
}

type TareaOrdenEstacion = {
  isBlocked: boolean;
  overdue: boolean;
  isCurrent: boolean;
  item: {
    data: Pick<TableroItemData, "id" | "fechaEntrega" | "ordenNumero" | "itemIndice">;
  };
  step: { paso: Pick<TableroPasoData, "id" | "indice" | "planificadoDesde"> };
};

function fechaParaOrdenEstacion(fecha: string | null | undefined): number {
  const valor = fecha ? Date.parse(fecha) : NaN;
  return Number.isFinite(valor) ? valor : Number.MAX_SAFE_INTEGER;
}

/** Prioridad operativa existente; dentro del mismo estado, entrega más cercana.
 * Los empates se resuelven por planificación e identidad, no por el orden del API.
 */
export function compararTareasEstacion(a: TareaOrdenEstacion, b: TareaOrdenEstacion): number {
  const peso = (t: TareaOrdenEstacion) =>
    (t.isBlocked ? 0 : 1) + (t.overdue ? 0 : 2) + (t.isCurrent ? 1 : 4);
  return (
    peso(a) - peso(b) ||
    fechaParaOrdenEstacion(a.item.data.fechaEntrega) - fechaParaOrdenEstacion(b.item.data.fechaEntrega) ||
    fechaParaOrdenEstacion(a.step.paso.planificadoDesde) - fechaParaOrdenEstacion(b.step.paso.planificadoDesde) ||
    a.item.data.ordenNumero.localeCompare(b.item.data.ordenNumero, "es", { numeric: true }) ||
    a.item.data.itemIndice - b.item.data.itemIndice ||
    a.step.paso.indice - b.step.paso.indice ||
    a.item.data.id.localeCompare(b.item.data.id) ||
    a.step.paso.id.localeCompare(b.step.paso.id)
  );
}
