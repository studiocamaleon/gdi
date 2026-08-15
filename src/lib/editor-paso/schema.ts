/**
 * Editor declarativo del paso — LA fuente de opciones
 * (docs/editor-declarativo-diseno.md).
 *
 * Cada opción configurable de un paso se declara UNA vez: pregunta en
 * idioma de taller, ayuda, visibilidad, resumen de estado con su origen,
 * y control (declarativo simple o componente rico registrado). El guiado
 * renderiza TODO el esquema — abierto si pendiente, colapsado con
 * resumen + "Cambiar" si resuelto — y el test de paridad (schema.test)
 * rompe si el censo y el esquema divergen.
 *
 * Migración por secciones (sub-fases A-E): las secciones aún no migradas
 * viven en SECCIONES_PENDIENTES del test; moverlas acá es un acto
 * consciente, nunca un olvido.
 */
import type {
  LookupsConfigPaso,
  UpsertConfigPasoPayload,
  UpsertSlotMaterialPayload,
} from "../productos-servicios-api";
import type { FamiliaListItem } from "../productos-servicios";
import type { PendientePasoTipo } from "../pendientes-paso";
import {
  getRuleFields,
  jsonLogicToRuleGroup,
  summarizeRuleGroup,
} from "../rule-builder";
import {
  familiaConParamsEditables,
  etiquetaValorParam,
} from "../params-familia";
import {
  declaraEfectoDemasia,
  leerEfectoDemasia,
  resumirEfectoDemasia,
  soportaDemasiaMedida,
} from "../efectos-paso";
import {
  NIVEL_COBERTURA_LABELS,
  type NivelCobertura,
} from "../cobertura-toner";
import {
  MONTAJE_SOURCE_OPTIONS,
  T2_TIME_CALCULATION_MODE_OPTIONS,
  T2_RITMO_OPTIONS,
  TIEMPO_ORIGEN_OPTIONS,
  TIEMPO_FORMA_OPTIONS,
  TIEMPO_COMERCIAL_NIVEL_OPTIONS,
  ritmoEquivalenteDeBatch,
  getT2ProductivityUnitSuffix,
  getT2BatchUnitSuffix,
  normalizeT2ProductivityUnit,
  getDefaultT2ProductivityUnit,
  getDefaultT2TimeCalculationMode,
  getDefaultT2QuantitySource,
  getDefaultMecanismoCantidad,
  getT2QuantitySourceOptions,
  etiquetaFuenteDerivada,
  humanizarOutputCanonico,
  getTiempoManualConfig,
  requiereMecanismoCantidad,
  getModoColorConfig,
  modoColorAplica,
  nestingAplica,
} from "./catalogo-tiempo";
import {
  SELECCION_MATERIAL_OPTIONS,
  FORMULA_OPTIONS,
  CRITERIO_AUTO_OPTIONS,
  costingStrategyOptions,
  CANTIDAD_BASE_SLOT_OPTIONS,
} from "./catalogo-materiales";
import { mecanismoCantidadLabels } from "../labels-humanos";
import { leerNivelesPaso } from "../niveles-paso";
import { resumirTiemposExtra } from "../tiempos-extra-paso";

// "ajustes" (escape hatches) se eliminó como sección: los dos escapes
// genuinos (algoritmo y layout manual de paneles) viven dentro del card
// de Acomodado (oficio.acomodado), igual que en el detallado.
/**
 * El EJE al que pertenece una opción: UNA decisión del paso, aunque el modelo
 * la guarde en varios campos. Reemplaza a `seccion` como agrupador de la UI —
 * la sección sobrevive porque el detallado congelado y el test de paridad
 * todavía la usan. Ver docs/editor-pasos-preguntas-orden.md §4.
 */
export type EjePaso =
  | "identidad"
  | "activacion"
  | "maquina"
  | "materiales"
  | "trabajo"
  | "cantidad"
  | "tiempo";

export type SeccionPaso =
  | "quien"
  | "activacion"
  | "tiempo"
  | "maquina"
  | "materiales"
  | "oficio";

/** Otro paso de la misma ruta (para co-ejecución y herencia). */
export interface PasoVecino {
  id: string;
  nombre: string;
  /** Modo de activación EFECTIVO del vecino (config → default de familia).
   *  Lo usa el arrastre: un OBLIGATORIO corre igual — tildarlo no cambia
   *  nada — y un NO_EJECUTAR no corre nunca; ninguno de los dos se ofrece. */
  modoActivacion?: string | null;
  /** Orden del vecino en la ruta (para distinguir aguas arriba/abajo). */
  orden?: number | null;
  /** Outputs GEOMÉTRICOS que publica el vecino (bastidor → tiras de cenefa,
   *  chapa de fondo…). Se puebla SÓLO para pasos anteriores; es la fuente de
   *  medida que un paso de montaje puede consumir. Paridad con el detallado.
   *  Ver docs/fuente-de-medida-de-consumo-diseno.md §6. */
  outputsGeometricos?: Array<{ key: string; etiqueta: string }>;
}

/** Declaración del slot en la familia (subset de slotsRequeridos). */
export interface SlotDeclarado {
  codigo: string;
  nombre: string;
  requerido: boolean;
  tipo?: string;
  /** Derivadores (E2): la cantidad del slot la deriva la geometría del paso
   *  (el consumo no sale de la fórmula; el costeo por placas no aplica). */
  magnitudDerivada?: string;
  /** Derivadores (E2): consumo fijo por trabajo (la fuente LED: 1). */
  cantidadFija?: number;
}

/** Contexto de UN slot de material (sub-fase C): las claves materiales.*
 *  se evalúan una vez por slot con este campo poblado. */
export interface SlotEnContexto {
  payload: UpsertSlotMaterialPayload;
  decl: SlotDeclarado | null;
  esAdicional: boolean;
}

export interface ContextoOpcion {
  cfg: UpsertConfigPasoPayload;
  familia: FamiliaListItem | undefined;
  paramsPaso: Record<string, unknown>;
  /** Los demás pasos de la ruta (sin el actual), en orden. */
  otrosPasos: PasoVecino[];
  /** Máquinas, centros y materias primas del tenant (sub-fase B). */
  lookups: LookupsConfigPaso;
  /** El slot activo cuando la sección Materiales itera por slot. */
  slot?: SlotEnContexto;
}

export type PatchOpcion =
  | { tipo: "config"; patch: Partial<UpsertConfigPasoPayload> }
  | { tipo: "params"; patch: Record<string, unknown> }
  /** Patch atómico sobre config Y params: la bifurcación Fijo↔Ritmo cambia
   *  `modoTiempo` (config) y a la vez limpia los relojes del camino que se
   *  abandona (params) — la regla "no apilar relojes" del plan de tiempo. */
  | {
      tipo: "config-y-params";
      config: Partial<UpsertConfigPasoPayload>;
      params: Record<string, unknown>;
    }
  /** Patch sobre el slot del contexto (materiales.*): el renderer lo
   *  aplica al slot de cfg.slotsMateriales con ese slotCodigo. */
  | { tipo: "slot"; patch: Partial<UpsertSlotMaterialPayload> };

export type OrigenValor =
  | "config"
  | "default-paso"
  | "default-maquina"
  | "sin-definir";

export type ControlOpcion =
  | {
      tipo: "texto";
      placeholder?: (ctx: ContextoOpcion) => string;
      valor: (ctx: ContextoOpcion) => string;
      aplicar: (ctx: ContextoOpcion, v: string) => PatchOpcion;
    }
  | {
      tipo: "pills" | "select";
      /** `tarjetas`: en vez de botones chicos, tarjetas con radio + título +
       *  descripción (una decisión importante, como "quién elige el material"). */
      presentacion?: "tarjetas";
      opciones: (ctx: ContextoOpcion) => Array<{
        value: string;
        label: string;
        descripcion?: string;
      }>;
      valor: (ctx: ContextoOpcion) => string;
      aplicar: (ctx: ContextoOpcion, v: string) => PatchOpcion;
    }
  | {
      tipo: "toggles";
      opciones: (ctx: ContextoOpcion) => Array<{ value: string; label: string }>;
      activos: (ctx: ContextoOpcion) => string[];
      aplicar: (ctx: ContextoOpcion, valores: string[]) => PatchOpcion;
    }
  | {
      tipo: "numero";
      min?: number;
      step?: number;
      /** Contador con − y + : para números chicos y acotados (personas). */
      stepper?: boolean;
      max?: number;
      /** Sufijo de unidad mostrado junto al input ("min", "unid./h"). */
      sufijo?: (ctx: ContextoOpcion) => string;
      placeholder?: (ctx: ContextoOpcion) => string;
      valor: (ctx: ContextoOpcion) => number | null;
      aplicar: (ctx: ContextoOpcion, v: number | null) => PatchOpcion;
    }
  | {
      /** Control rico registrado en el renderer (RuleBuilder, buscador de
       *  material, candidatas del detallado, panel tercerizado…). */
      tipo: "componente";
      id:
        | "regla-condicional"
        | "co-ejecucion"
        | "tiempo-fijo-valor"
        | "tiempo-maquina-panel"
        | "ritmo-productividad"
        | "ritmo-batch"
        | "herencia-origen"
        | "maquina-m1"
        | "perfil-m1"
        | "candidatas-detallado"
        | "cobertura-toner"
        | "modo-color-detallado"
        | "agregar-slot"
        | "material-fijo-detallado"
        | "candidatos-slot-detallado"
        | "base-consumo"
        | "consumo-formula"
        | "tercerizado-panel"
        | "acomodado-detallado"
        | "params-familia"
        | "activacion-modo"
        | "tiempo-comercial-ayudas"
        | "centro-productivo"
        | "cantidad-unificada"
        | "efectos-paso"
        | "tiempos-extra-paso"
        | "niveles-paso";
    };

/**
 * Sub-bloque del eje: un eje ("cuánto tarda") se lee mejor partido en dos o
 * tres ideas con nombre ("dónde se hace", "ritmo de trabajo") que como una
 * lista de campos sueltos. Ver docs/editor-pasos-preguntas-orden.md §3.
 */
export interface GrupoEje {
  id: string;
  /** Sin título = el grupo no se anuncia (la bifurcación raíz del eje). */
  titulo?: string;
  ayuda?: string | ((ctx: ContextoOpcion) => string);
  /** `bifurcacion` = la decisión que apaga el resto del eje, en dos tarjetas
   *  grandes. `campos` = etiqueta + control, en grilla. */
  estilo?: "bifurcacion" | "campos";
  /** `grid-template-columns` del bloque. Un select ancho al lado de un
   *  contador chico se lee mejor que dos columnas iguales. */
  columnas?: string;
  /**
   * Dónde va el encabezado del bloque. `lado` (default) ahorra alto cuando
   * los controles son angostos; `arriba` es para bloques cuyo contenido usa
   * todo el ancho (chips, filas de regla), donde una columna de título los
   * apretaría. Los bloques `arriba` se separan con línea horizontal.
   */
  encabezado?: "lado" | "arriba";
  /**
   * Alineación vertical de los controles del bloque en su grilla. Default
   * `start` (arriba). `end` sirve cuando conviven controles con etiqueta y sin
   * etiqueta en la misma fila: alinea los controles por su base para que no
   * queden a distinta altura.
   */
  alinearItems?: "start" | "end" | "center";
}

export interface OpcionPaso {
  /** 'seccion.campo' — la clave del test de paridad. */
  clave: string;
  seccion: SeccionPaso;
  /** El eje que la contiene. Sin declarar, la opción sigue el viejo camino
   *  por sección (quedan las que todavía no se convirtieron). */
  eje?: EjePaso;
  /**
   * La pregunta completa, en idioma de taller. Es lo que se muestra cuando la
   * opción vive sola en su tarjeta.
   */
  pregunta: string;
  /**
   * Etiqueta corta para cuando la opción se renderiza DENTRO de un eje, donde
   * la pregunta larga ya la contesta el título del grupo: "¿En qué centro
   * productivo se realiza este paso?" se vuelve "Centro productivo".
   */
  etiqueta?: string | ((ctx: ContextoOpcion) => string);
  /** Sub-bloque del eje al que pertenece (id de un `GrupoEje`). */
  grupo?: string;
  /** Dentro del eje ocupa la fila entera: los controles anchos (el ritmo con
   *  su unidad, un segmented de tres) se parten feo en media columna. */
  anchoCompleto?: boolean;
  /** Orden dentro de su grupo (menor primero). Sin declarar, sigue el orden
   *  de declaración en ESQUEMA_PASO. */
  orden?: number;
  ayuda?: string | ((ctx: ContextoOpcion) => string);
  visible: (ctx: ContextoOpcion) => boolean;
  resumen: (ctx: ContextoOpcion) => string;
  origenValor: (ctx: ContextoOpcion) => OrigenValor;
  /** Si el motor de pendientes (E.3.1) tiene un tipo asociado, la opción
   *  arranca ABIERTA cuando ese pendiente está vivo. */
  pendiente?: PendientePasoTipo;
  control: ControlOpcion;
}

// ─────────────────────────────────────────────────────────────────────
// Sección ACTIVACIÓN (sub-fase A) — completa.
// ─────────────────────────────────────────────────────────────────────

const MODO_ACTIVACION_LABELS: Record<string, string> = {
  OBLIGATORIO: "Obligatorio",
  OPCIONAL: "Opcional",
  CONDICIONAL: "Condicional",
  NO_EJECUTAR: "Omitir en este producto",
};

/** Qué implica el modo elegido, en una frase. Va debajo del control: elegir
 *  entre cuatro etiquetas cortas sin saber qué hace cada una es adivinar. */
export const MODO_ACTIVACION_CONSECUENCIA: Record<string, string> = {
  OBLIGATORIO:
    "Corre en todas las OT que pasen por esta ruta. No hace falta que nadie lo active.",
  OPCIONAL:
    "Aparece apagado en el presupuesto. El comercial lo enciende cuando el trabajo lo pide.",
  CONDICIONAL:
    "Se enciende solo cuando el pedido cumple la condición de abajo.",
  NO_EJECUTAR:
    "Queda fuera de esta ruta. El paso sigue disponible en las demás rutas donde esté configurado.",
};

export { MODO_ACTIVACION_LABELS };

// Los multiplicadores llegan como claves técnicas del motor (caras,
// tipoCopia): acá se traducen a idioma de taller (feedback del usuario).
const MULTIPLICADOR_LABELS: Record<string, string> = {
  caras: "Las caras (simple o doble faz)",
  tipoCopia: "El tipo de copia (original, duplicado…)",
};

function labelMultiplicador(valor: string): string {
  return MULTIPLICADOR_LABELS[valor] ?? valor;
}

/** Derivadores (E2): el slot declarado por la familia puede traer la
 *  selección por capacidad DE FÁBRICA (`criterioCapacidadDefault`). Si el
 *  slot de config no fija criterio, el motor usa ese default: el editor lo
 *  muestra resuelto en vez de marcarlo pendiente (H11 del relevamiento). */
function criterioDeFabricaDelSlot(ctx: ContextoOpcion) {
  const codigo = ctx.slot?.payload.slotCodigo;
  if (!codigo) return undefined;
  return ctx.familia?.slotsRequeridos?.find((s) => s.codigo === codigo)
    ?.criterioCapacidadDefault;
}

export function modosActivacionOfrecidos(ctx: ContextoOpcion): string[] {
  // La familia puede FIJAR su activación (Etapa D): se ofrecen sólo los
  // soportados; NO_EJECUTAR siempre se puede (apagar el paso por ruta).
  const soportados = ctx.familia?.modosActivacionSoportados ?? [
    "OBLIGATORIO",
    "OPCIONAL",
    "CONDICIONAL",
  ];
  return [...new Set([...soportados, "NO_EJECUTAR"])];
}

// ─────────────────────────────────────────────────────────────────────
// Helpers de las secciones Tiempo y Máquina (sub-fase B) — todos puros.
// ─────────────────────────────────────────────────────────────────────

function numOpcional(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Modo de tiempo efectivo: el elegido, o el primero que soporta el paso. */
function modoTiempoEfectivo(ctx: ContextoOpcion): string | null {
  return (
    ctx.cfg.modoTiempo ?? ctx.familia?.modosTiempoSoportados?.[0] ?? null
  );
}

/** Capa comercial del árbol de tiempo (⑤): no / puede / debe.
 *  `tiempoManual.habilitado` + `obligatorio` mapean a los tres estados;
 *  el legacy `modoTiempo: 'T-4'` (etiqueta sin rama en el motor) se lee
 *  como "debe". docs/tiempo-pasos-analisis-y-plan.md §3-§4. */
function comercialNivelEfectivo(ctx: ContextoOpcion): "no" | "puede" | "debe" {
  const config = getTiempoManualConfig(ctx.cfg.paramsPasoJson);
  if (config.habilitado === true) {
    return config.obligatorio === true ? "debe" : "puede";
  }
  return ctx.cfg.modoTiempo === "T-4" ? "debe" : "no";
}

/** Con "debe", el tiempo base no participa (el comercial SIEMPRE lo pisa):
 *  las preguntas de fijo/ritmo se suprimen. Con "puede" quedan visibles —
 *  el base es la sugerencia/fallback (F0.2/F0.4: un solo número; esconderlo
 *  era el bug de los dos defaults de Diseño de Tarjetas). */
function comercialEstimaTiempo(ctx: ContextoOpcion): boolean {
  return comercialNivelEfectivo(ctx) === "debe";
}

/** Pregunta ① del árbol: máquina agrupa T-3; taller agrupa T-1/T-2. */
function origenTiempoEfectivo(ctx: ContextoOpcion): "taller" | "maquina" {
  return modoTiempoEfectivo(ctx) === "T-3" ? "maquina" : "taller";
}

function familiaSoportaOrigenMaquina(ctx: ContextoOpcion): boolean {
  return (ctx.familia?.modosTiempoSoportados ?? []).includes("T-3");
}

function familiaSoportaOrigenTaller(ctx: ContextoOpcion): boolean {
  const modos = ctx.familia?.modosTiempoSoportados ?? [];
  return modos.includes("T-1") || modos.includes("T-2");
}

/** Pregunta ② del árbol: fijo si el modo es T-1, o si es T-2 con horas
 *  cargadas / intención tiempo_fijo (el "fijo escondido" — F0.3). */
function formaTiempoEfectiva(ctx: ContextoOpcion): "fijo" | "ritmo" {
  const modo = modoTiempoEfectivo(ctx);
  if (modo === "T-1") return "fijo";
  if (modo === "T-2" && ritmoModoEfectivo(ctx) === "tiempo_fijo") return "fijo";
  return "ritmo";
}

/** Vecinos que el arrastre puede encender de verdad: opcionales o
 *  condicionales. Un OBLIGATORIO corre igual y un NO_EJECUTAR nunca —
 *  ofrecerlos era ruido (feedback del usuario). Vecinos sin modo conocido
 *  (legacy) se ofrecen por las dudas. */
export function pasosArrastrables(ctx: ContextoOpcion): PasoVecino[] {
  return ctx.otrosPasos.filter(
    (p) =>
      p.modoActivacion == null ||
      (p.modoActivacion !== "OBLIGATORIO" &&
        p.modoActivacion !== "NO_EJECUTAR"),
  );
}

/** Fuentes de "Qué monta" para un paso de montaje: las fijas
 *  (MONTAJE_SOURCE_OPTIONS) MÁS los outputs GEOMÉTRICOS que publican los pasos
 *  anteriores (bastidor → tiras de cenefa, chapa de fondo…). Paridad Guiado ↔
 *  Detallado. docs/fuente-de-medida-de-consumo-diseno.md §6. */
export function opcionesPiezasMontar(
  ctx: ContextoOpcion,
): Array<{ value: string; label: string; descripcion?: string }> {
  return [
    ...MONTAJE_SOURCE_OPTIONS.map((o) => ({
      value: o.value,
      label: o.label,
      descripcion: o.description,
    })),
    ...ctx.otrosPasos.flatMap((p) =>
      (p.outputsGeometricos ?? []).map((o) => ({
        value: `output:${o.key}`,
        label: `${o.etiqueta} · ${p.nombre}`,
        descripcion: `Mide sobre "${o.etiqueta}" que publica el paso "${p.nombre}".`,
      })),
    ),
  ];
}

/** El valor del tiempo fijo, unificando los dos storages históricos:
 *  T-1 guarda minutos en config; T-2 guarda horas en params. */
function tiempoFijoEfectivoMin(ctx: ContextoOpcion): {
  min: number | null;
  origen: OrigenValor;
} {
  if (modoTiempoEfectivo(ctx) === "T-1") {
    if (ctx.cfg.tiempoFijoOverrideMin != null) {
      return { min: Number(ctx.cfg.tiempoFijoOverrideMin), origen: "config" };
    }
    const delPaso = ctx.familia?.defaults?.tiempoFijoMin;
    return delPaso != null
      ? { min: Number(delPaso), origen: "default-paso" }
      : { min: null, origen: "sin-definir" };
  }
  const horas = Number(ctx.paramsPaso.horasEstimadas ?? NaN);
  if (Number.isFinite(horas) && horas > 0) {
    return { min: horas * 60, origen: "config" };
  }
  return { min: null, origen: "sin-definir" };
}

function unidadRitmoEfectiva(ctx: ContextoOpcion): string {
  const raw = ctx.paramsPaso.productivityUnit;
  return typeof raw === "string"
    ? normalizeT2ProductivityUnit(raw)
    : getDefaultT2ProductivityUnit(ctx.familia);
}

/**
 * El NOMBRE de lo que el paso cuenta, cuando el sistema lo sabe (H1/H2):
 *  - familia con derivador → su `unidadPrincipal` declarada ("ml de perfil").
 *  - herencia por output (`campoOutput`) → el output humanizado.
 *  - herencia con origen explícito y capacidad → esa capacidad humanizada.
 * null = no hay nombre mejor que "unidades". Exportada standalone para que
 * el CONTROL abierto del ritmo diga lo mismo que el resumen (T3b).
 */
export function unidadCantidadDe(
  cfg: UpsertConfigPasoPayload,
  familia: FamiliaListItem | undefined,
): string | null {
  const mecanismo =
    cfg.mecanismoCantidad ??
    getDefaultMecanismoCantidad(
      familia,
      familia?.mecanismosCantidadSoportados ?? [],
    );
  if (mecanismo === "CALCULADO_POR_PASO") {
    return familia?.derivador?.unidadPrincipal ?? null;
  }
  if (mecanismo === "HEREDAR_DEL_OUTPUT_CANONICO") {
    const config = (cfg.mecanismoCantidadConfigJson ?? {}) as {
      origen?: { capacidad?: string };
      campoOutput?: string;
    };
    const campo =
      typeof config.campoOutput === "string" && config.campoOutput.trim()
        ? config.campoOutput
        : typeof config.origen?.capacidad === "string"
          ? config.origen.capacidad
          : null;
    return campo ? campo.replaceAll("_", " ") : null;
  }
  return null;
}

function unidadCantidadEfectiva(ctx: ContextoOpcion): string | null {
  return unidadCantidadDe(ctx.cfg, ctx.familia);
}

function ritmoModoEfectivo(ctx: ContextoOpcion): string {
  // Un paso con horas cargadas ES de tiempo fijo, aunque tenga guardado otro
  // modo: el motor le da prioridad a `horasEstimadas` sobre el ritmo. Mostrar
  // "Productividad por hora" ahí sería mentir sobre lo que va a pasar.
  const horas = Number(ctx.paramsPaso.horasEstimadas ?? NaN);
  if (Number.isFinite(horas) && horas > 0) return "tiempo_fijo";
  const raw = ctx.paramsPaso.timeCalculationMode;
  const valor =
    typeof raw === "string"
      ? raw
      : getDefaultT2TimeCalculationMode(ctx.familia);
  return T2_TIME_CALCULATION_MODE_OPTIONS.some((o) => o.value === valor)
    ? valor
    : getDefaultT2TimeCalculationMode(ctx.familia);
}

function fuenteRitmoEfectiva(ctx: ContextoOpcion): string {
  const unidad = unidadRitmoEfectiva(ctx);
  const raw = ctx.paramsPaso.productivityQuantitySource;
  const crudo =
    typeof raw === "string"
      ? raw
      : getDefaultT2QuantitySource(ctx.familia, unidad);
  const normalizado =
    ctx.familia?.ritmoDefault?.fuenteCantidad === "cantidad_montaje" &&
    unidad === "unidades_h" &&
    crudo === "cantidad"
      ? "cantidad_montaje"
      : crudo;
  const opciones = getT2QuantitySourceOptions(unidad, ctx.familia, ctx.paramsPaso);
  return opciones.some((o) => o.value === normalizado)
    ? normalizado
    : getDefaultT2QuantitySource(ctx.familia, unidad);
}

/** Unidad nombrada para los sufijos del ritmo: la fuente derivada manda
 *  ("cortes de hierro"), después lo que el paso cuenta ("ml de perfil"). */
function unidadRitmoNombrada(ctx: ContextoOpcion): string | null {
  return (
    etiquetaFuenteDerivada(ctx.familia, fuenteRitmoEfectiva(ctx)) ??
    unidadCantidadEfectiva(ctx)
  );
}

function esT2(ctx: ContextoOpcion): boolean {
  return modoTiempoEfectivo(ctx) === "T-2";
}

/** El ritmo se muestra como ORACIÓN con la magnitud inline ("6 puntos de
 *  soldadura por hora" / "3 pliegos cada 1 min") — vale para productividad
 *  Y tanda (feedback del usuario: la tanda tenía la magnitud suelta abajo,
 *  duplicada con la cantidad del paso). */
function esRitmoConOracionInline(ctx: ContextoOpcion): boolean {
  return (
    esT2(ctx) &&
    !comercialEstimaTiempo(ctx) &&
    formaTiempoEfectiva(ctx) === "ritmo"
  );
}

function mecanismoCantidadEfectivo(ctx: ContextoOpcion): string | null {
  return (
    ctx.cfg.mecanismoCantidad ??
    getDefaultMecanismoCantidad(
      ctx.familia,
      ctx.familia?.mecanismosCantidadSoportados ?? [],
    )
  );
}

function labelMecanismoCantidad(
  ctx: ContextoOpcion,
  mecanismo: string,
): string {
  // [Tanda B] Si la ficha declara qué hereda por default, el resumen lo
  // nombra (antes sólo corte_manual, con el copy cableado).
  if (
    mecanismo === "HEREDAR_DEL_OUTPUT_CANONICO" &&
    ctx.familia?.outputHeredadoDefault
  ) {
    return `${humanizarOutputCanonico(
      ctx.familia.outputHeredadoDefault,
    )} del paso anterior`;
  }
  return mecanismoCantidadLabels[mecanismo]?.label ?? mecanismo;
}

function maquinaElegida(ctx: ContextoOpcion) {
  return ctx.lookups.maquinas.find((m) => m.id === ctx.cfg.maquinaM1Id);
}

/** El paso imprime con láser (tóner) → aplica la cobertura por nivel. */
function pasoUsaLaser(ctx: ContextoOpcion): boolean {
  const ids =
    (ctx.cfg.maquinasCandidatas?.length ?? 0) > 0
      ? ctx.cfg.maquinasCandidatas!.map((c) => c.maquinaId)
      : ctx.cfg.maquinaM1Id
        ? [ctx.cfg.maquinaM1Id]
        : [];
  return ids.some((mid) => {
    const plantilla = ctx.lookups.maquinas.find((m) => m.id === mid)?.plantilla;
    // El lookup trae el enum de DB en MAYÚSCULAS (IMPRESORA_LASER).
    return String(plantilla ?? "").toUpperCase() === "IMPRESORA_LASER";
  });
}

/** La máquina es obligatoria si el tiempo sale de ella (T-3) o si la
 *  familia sólo soporta M-1 (sin variante manual M-0). */
function maquinaRequerida(ctx: ContextoOpcion): boolean {
  const relacion = ctx.familia?.relacionMaquinaSoportada ?? [];
  return (
    modoTiempoEfectivo(ctx) === "T-3" ||
    (relacion.includes("M-1") && !relacion.includes("M-0"))
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers de la sección Materiales (sub-fase C) — todos puros.
// ─────────────────────────────────────────────────────────────────────

function esConsumibleMaquina(slot: { tipo?: string }): boolean {
  return slot.tipo === "CONSUMIBLE_MAQUINA";
}

/** Slots que declara la familia y configura el modelador (sin los
 *  consumibles automáticos de máquina). */
function slotsManualesDeFamilia(ctx: ContextoOpcion) {
  return (ctx.familia?.slotsRequeridos ?? []).filter(
    (slot) => !esConsumibleMaquina(slot),
  );
}

/** Nombre humano de una variante buscándola en los lookups. */
function nombreVariante(
  ctx: ContextoOpcion,
  varianteId: string | null | undefined,
): string | null {
  if (!varianteId) return null;
  for (const materia of ctx.lookups.materiasPrimas) {
    const variante = materia.variantes.find((v) => v.id === varianteId);
    if (variante) {
      return variante.nombreVariante
        ? `${materia.nombre} — ${variante.nombreVariante}`
        : materia.nombre;
    }
  }
  return null;
}

function labelDe(
  opciones: Array<{ value: string; label: string }>,
  value: string,
): string {
  return opciones.find((o) => o.value === value)?.label ?? value;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers de Tercerización y oficio (sub-fase D) — todos puros.
// ─────────────────────────────────────────────────────────────────────

/** ¿La familia declara el paso como tercerizado (E.1/E.2)? */
function familiaDeclaraTercerizado(ctx: ContextoOpcion): boolean {
  return ctx.familia?.defaults?.tercerizado === true;
}

const FUENTE_TERCERIZADO_LABELS: Record<string, string> = {
  matriz: "con matriz de precios",
  tarifa_magnitud: "por tarifa",
  fijo: "a precio fijo por trabajo",
  manual: "cotiza cada trabajo",
};

/** ¿La grilla/tarifa/costo del proveedor está cargada? (espejo del motor
 *  de pendientes: sin esto el paso cotiza $0). */
function grillaTercerizadoCompleta(ctx: ContextoOpcion): boolean {
  const fuente = ctx.cfg.fuenteCostoTercerizado ?? "matriz";
  if (fuente === "matriz") {
    return (ctx.cfg.tercerizadoEntradas?.length ?? 0) > 0;
  }
  // `manual`: el costo llega AL COTIZAR (lo carga el comercial con la
  // cotización del proveedor); el estimado de referencia es opcional. No hay
  // precio que falte en la config: el paso está completo por definición.
  if (fuente === "manual") return true;
  const configTerc = (ctx.cfg.tercerizadoConfigJson ?? {}) as Record<
    string,
    unknown
  >;
  const crudo =
    fuente === "tarifa_magnitud"
      ? configTerc.tarifa
      : // `costo` es lo que guarda el panel (FijoEditor); costoFijo/monto
        // quedan por compatibilidad con configs viejas.
        (configTerc.costo ?? configTerc.costoFijo ?? configTerc.monto);
  const numero = typeof crudo === "string" ? Number(crudo) : crudo;
  return typeof numero === "number" && Number.isFinite(numero);
}

const CLAVES_LARGO_ROLLO = [
  "largoRolloMm",
  "largoRolloM",
  "rollLengthMm",
  "rollLengthM",
  "longitudRolloMm",
  "longitudRolloM",
];

function atributosLucenRollo(
  attrs: Record<string, unknown> | null | undefined,
): boolean {
  if (!attrs) return false;
  return CLAVES_LARGO_ROLLO.some((clave) => {
    const valor = attrs[clave];
    const numero = typeof valor === "string" ? Number(valor) : valor;
    return typeof numero === "number" && Number.isFinite(numero);
  });
}

/** ¿El sustrato del paso es (o puede ser) un rollo? Espeja la señal que
 *  usa el card de Acomodado para ocultar el costeo del sustrato: en rollo
 *  ese ajuste no es configurable y el motor lo ignora. */
function sustratoLuceRollo(ctx: ContextoOpcion): boolean {
  const slot = (ctx.cfg.slotsMateriales ?? []).find(
    (item) => item.slotCodigo === "sustrato_principal",
  );
  if (!slot) return false;
  if (slot.materialVarianteId) {
    for (const materia of ctx.lookups.materiasPrimas) {
      const variante = materia.variantes.find(
        (item) => item.id === slot.materialVarianteId,
      );
      if (variante) return atributosLucenRollo(variante.atributosVarianteJson);
    }
  }
  return (slot.candidatos ?? []).some((candidato) => {
    const materia = ctx.lookups.materiasPrimas.find(
      (item) => item.id === candidato.materiaPrimaId,
    );
    if (!materia) return false;
    const texto = [
      materia.codigo,
      materia.nombre,
      materia.familia,
      materia.subfamilia,
    ]
      .filter(Boolean)
      .join(" ")
      .toUpperCase();
    if (texto.includes("ROLLO") || texto.includes("ROLL")) return true;
    const habilitadas = new Set(candidato.varianteIds);
    return materia.variantes.some(
      (variante) =>
        (habilitadas.size === 0 || habilitadas.has(variante.id)) &&
        atributosLucenRollo(variante.atributosVarianteJson),
    );
  });
}

export const ESQUEMA_PASO: OpcionPaso[] = [
  // ───────────────────────────────────────────────────────────────────
  // Sección QUIÉN LO HACE (sub-fase D) — la bifurcación tercerizado.
  // Si la familia lo declara (E.1/E.2), la pregunta NO se repite:
  // aparece colapsada "— declarado en el paso" (corrección del usuario).
  // ───────────────────────────────────────────────────────────────────
  {
    clave: "quien.tercerizado",
    eje: "identidad",
    grupo: "identidad",
    // A la derecha: el nombre del paso va primero (izquierda), quién lo hace
    // después (derecha) — pedido del usuario.
    orden: 1,
    etiqueta: "Es tercerizado",
    seccion: "quien",
    pregunta: "¿Es un paso tercerizado a otro proveedor?",
    ayuda:
      "Interno lo produce el taller; tercerizado se compra hecho y el costo lo define el proveedor.",
    visible: () => true,
    resumen: (ctx) => {
      if (!ctx.cfg.tercerizado) return "No — lo produce la empresa";
      return familiaDeclaraTercerizado(ctx)
        ? "Sí — declarado en el paso"
        : "Sí — lo hace un proveedor";
    },
    origenValor: (ctx) => {
      const declarado = familiaDeclaraTercerizado(ctx);
      if (declarado) return ctx.cfg.tercerizado ? "default-paso" : "config";
      return ctx.cfg.tercerizado ? "config" : "default-paso";
    },
    control: {
      tipo: "pills",
      opciones: () => [
        { value: "empresa", label: "No" },
        { value: "proveedor", label: "Sí" },
      ],
      valor: (ctx) => (ctx.cfg.tercerizado ? "proveedor" : "empresa"),
      aplicar: (_ctx, v) => ({
        tipo: "config",
        patch: { tercerizado: v === "proveedor" },
      }),
    },
  },
  {
    clave: "quien.proveedor",
    eje: "identidad",
    grupo: "proveedor",
    anchoCompleto: true,
    // El panel trae su propio contenido; se renderiza como su propia card
    // "El proveedor", así que no lleva label arriba.
    etiqueta: " ",
    seccion: "quien",
    pregunta: "¿A quién se le compra y a qué precio?",
    ayuda:
      "El proveedor, cómo cotiza (matriz de cantidades, tarifa por magnitud o precio fijo) y su plazo de entrega.",
    visible: (ctx) => ctx.cfg.tercerizado === true,
    resumen: (ctx) => {
      if (!ctx.cfg.proveedorId) return "Sin proveedor elegido";
      const fuente = ctx.cfg.fuenteCostoTercerizado ?? "matriz";
      const partes = [
        `Proveedor elegido — ${FUENTE_TERCERIZADO_LABELS[fuente] ?? fuente}`,
      ];
      if (!grillaTercerizadoCompleta(ctx)) partes.push("faltan los precios");
      else if (ctx.cfg.plazoProveedorDias != null)
        partes.push(`entrega en ${ctx.cfg.plazoProveedorDias} días`);
      return partes.join(" · ");
    },
    origenValor: (ctx) =>
      ctx.cfg.proveedorId && grillaTercerizadoCompleta(ctx)
        ? "config"
        : "sin-definir",
    pendiente: "proveedor",
    control: { tipo: "componente", id: "tercerizado-panel" },
  },
  {
    clave: "activacion.nombre",
    eje: "identidad",
    grupo: "identidad",
    orden: 0,
    etiqueta: "Nombre del paso",
    seccion: "activacion",
    pregunta: "¿Cómo se llama este paso acá?",
    ayuda:
      "El nombre que ven el cotizador, la OT y el tablero. Vacío = el nombre del paso.",
    visible: () => true,
    resumen: (ctx) =>
      ctx.cfg.nombreVisible?.trim()
        ? `"${ctx.cfg.nombreVisible.trim()}"`
        : (ctx.familia?.nombre ?? "El nombre del paso"),
    origenValor: (ctx) =>
      ctx.cfg.nombreVisible?.trim() ? "config" : "default-paso",
    control: {
      tipo: "texto",
      placeholder: (ctx) => ctx.familia?.nombre ?? "Nombre del paso",
      valor: (ctx) => ctx.cfg.nombreVisible ?? "",
      // SIN trim acá: aplica en cada tecla sobre un input controlado, y el
      // trim se comía el espacio recién tipeado ("Hendido Perforado" era
      // imposible de escribir). El guardado trimea antes de persistir.
      aplicar: (_ctx, v) => ({
        tipo: "config",
        patch: { nombreVisible: v || null },
      }),
    },
  },
  {
    clave: "activacion.cuando",
    eje: "activacion",
    grupo: "raiz",
    // El título de la card ya es la pregunta: repetirla arriba del control
    // sería decir dos veces lo mismo.
    etiqueta: "",
    seccion: "activacion",
    pregunta: "¿Cuándo se ejecuta?",
    ayuda:
      "El punto de partida lo sugiere el paso; esta ruta puede cambiarlo. «Nunca» lo apaga sólo acá.",
    visible: () => true,
    resumen: (ctx) => {
      const modo = ctx.cfg.modoActivacion ?? "OBLIGATORIO";
      const etiqueta = MODO_ACTIVACION_LABELS[modo] ?? modo;
      const fijado =
        (ctx.familia?.modosActivacionSoportados?.length ?? 4) === 1;
      return fijado ? `${etiqueta} — fijado por el paso` : etiqueta;
    },
    origenValor: (ctx) =>
      ctx.cfg.modoActivacion &&
      ctx.cfg.modoActivacion !== ctx.familia?.modoActivacionDefault
        ? "config"
        : "default-paso",
    control: { tipo: "componente", id: "activacion-modo" },
  },
  {
    clave: "activacion.regla",
    eje: "activacion",
    grupo: "regla",
    etiqueta: " ",
    anchoCompleto: true,
    seccion: "activacion",
    pregunta: "¿Con qué regla se activa?",
    visible: (ctx) => ctx.cfg.modoActivacion === "CONDICIONAL",
    // La regla EN HUMANO ("Tipo de copia es mayor o igual que 2"), no el
    // opaco "Regla definida" (H17). Si usa operadores/campos que el builder
    // no modela, al menos avisa que es avanzada.
    resumen: (ctx) => {
      const json = ctx.cfg.condicionActivacionJson;
      if (!json) return "Sin regla todavía";
      const parsed = jsonLogicToRuleGroup(
        json,
        getRuleFields({ includeMeasureFields: true }),
      );
      return parsed.supported
        ? summarizeRuleGroup(
            parsed.group,
            getRuleFields({ includeMeasureFields: true }),
          )
        : "Regla avanzada (abrila para verla)";
    },
    origenValor: (ctx) =>
      ctx.cfg.condicionActivacionJson ? "config" : "sin-definir",
    pendiente: "regla_condicional",
    control: { tipo: "componente", id: "regla-condicional" },
  },
  {
    clave: "activacion.coejecucion",
    eje: "activacion",
    grupo: "arrastre",
    etiqueta: " ",
    anchoCompleto: true,
    seccion: "activacion",
    pregunta: "¿Arrastra otros pasos al activarse?",
    ayuda:
      "Al activarse este paso, enciende también los que marques aunque sean opcionales (los ojales arrastran el refuerzo).",
    // [Decisión del usuario, 2026-08-11 — revierte H-7] El arrastre sólo se
    // ofrece cuando la activación de ESTE paso es condicional ("Lo activa el
    // comercial" o "Según una regla"): en un paso que corre SIEMPRE,
    // arrastrar equivale a configurar los destinos como "Siempre" — la
    // sección era ruido. (El motor sí arrastra desde obligatorios: configs
    // legacy con selecciones guardadas siguen visibles para limpiarlas.)
    // Los DESTINOS también se filtran: un obligatorio corre igual y un
    // NO_EJECUTAR nunca — sólo se ofrecen opcionales/condicionales. Sin
    // candidatos, la sección entera se oculta.
    visible: (ctx) => {
      const seleccionados = ctx.cfg.requiereRutaPasoIds?.length ?? 0;
      if (seleccionados > 0 && ctx.cfg.modoActivacion !== "NO_EJECUTAR") {
        return true;
      }
      const modo =
        ctx.cfg.modoActivacion ??
        ctx.familia?.modoActivacionDefault ??
        "OBLIGATORIO";
      return (
        (modo === "OPCIONAL" || modo === "CONDICIONAL") &&
        pasosArrastrables(ctx).length > 0
      );
    },
    resumen: (ctx) => {
      const ids = new Set(ctx.cfg.requiereRutaPasoIds ?? []);
      if (ids.size === 0) return "No arrastra otros pasos";
      const nombres = ctx.otrosPasos
        .filter((p) => ids.has(p.id))
        .map((p) => p.nombre);
      return `Arrastra: ${nombres.join(", ")}`;
    },
    origenValor: (ctx) =>
      (ctx.cfg.requiereRutaPasoIds?.length ?? 0) > 0
        ? "config"
        : "default-paso",
    control: { tipo: "componente", id: "co-ejecucion" },
  },
  {
    clave: "activacion.multiplicadores",
    seccion: "activacion",
    pregunta: "¿Qué variables multiplican el trabajo acá?",
    ayuda:
      "Caras, tipo de copia… multiplican el tiempo del paso. En materiales, las caras se definen por slot.",
    visible: (ctx) =>
      (ctx.familia?.multiplicadoresSoportados?.length ?? 0) > 0,
    resumen: (ctx) => {
      const activos = ctx.cfg.multiplicadoresActivos ?? [];
      return activos.length > 0
        ? `Multiplica por: ${activos
            .map((m) => labelMultiplicador(m).toLowerCase())
            .join(" · ")}`
        : "Sin multiplicadores";
    },
    origenValor: (ctx) =>
      (ctx.cfg.multiplicadoresActivos?.length ?? 0) > 0
        ? "config"
        : "default-paso",
    control: {
      tipo: "toggles",
      opciones: (ctx) =>
        (ctx.familia?.multiplicadoresSoportados ?? []).map((m) => ({
          value: m,
          label: labelMultiplicador(m),
        })),
      activos: (ctx) => ctx.cfg.multiplicadoresActivos ?? [],
      aplicar: (_ctx, valores) => ({
        tipo: "config",
        patch: { multiplicadoresActivos: valores },
      }),
    },
  },

  // ───────────────────────────────────────────────────────────────────
  // Sección TIEMPO Y COSTO — el árbol de tiempo
  // (docs/tiempo-pasos-analisis-y-plan.md §4):
  //   ① ¿de dónde sale el tiempo? → ② ¿fijo o ritmo? → ③ ¿unidad o tanda?
  //   ⑤ capa comercial (No/Puede/Debe) al final — no es un modo, se apoya
  //   sobre el base. Sólo "Debe" suprime el base (con "Puede" el base ES
  //   la sugerencia: esconderlo era el bug de los dos defaults).
  // ───────────────────────────────────────────────────────────────────
  {
    clave: "tiempo.origen",
    seccion: "tiempo",
    eje: "tiempo",
    grupo: "raiz",
    pregunta: "¿De dónde sale el tiempo de este paso?",
    ayuda:
      "Quién define el reloj: un tiempo o ritmo que declarás acá (el taller), o la velocidad del perfil de la máquina.",
    visible: (ctx) =>
      familiaSoportaOrigenMaquina(ctx) &&
      familiaSoportaOrigenTaller(ctx) &&
      !comercialEstimaTiempo(ctx),
    resumen: (ctx) =>
      TIEMPO_ORIGEN_OPTIONS.find((o) => o.value === origenTiempoEfectivo(ctx))
        ?.label ?? origenTiempoEfectivo(ctx),
    origenValor: (ctx) => (ctx.cfg.modoTiempo ? "config" : "default-paso"),
    control: {
      tipo: "pills",
      opciones: () =>
        TIEMPO_ORIGEN_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          descripcion: o.description,
        })),
      valor: (ctx) => origenTiempoEfectivo(ctx),
      aplicar: (ctx, v) => ({
        tipo: "config",
        patch: {
          modoTiempo:
            v === "maquina"
              ? "T-3"
              : (ctx.familia?.modosTiempoSoportados ?? []).includes("T-2")
                ? "T-2"
                : "T-1",
        },
      }),
    },
  },
  {
    // ① = máquina → panel que EXPLICA, cero perillas: el reloj lo definen
    // el perfil (y la primitiva del oficio si la familia declara una, como
    // el plan de corte de la guillotina). Patrón "la perilla sólo donde
    // decide el modelador" (mismo que geometría en materiales).
    clave: "tiempo.maquina_panel",
    seccion: "tiempo",
    eje: "tiempo",
    anchoCompleto: true,
    grupo: "ritmo",
    etiqueta: " ",
    pregunta: "Cómo calcula la máquina",
    visible: (ctx) =>
      origenTiempoEfectivo(ctx) === "maquina" && !comercialEstimaTiempo(ctx),
    resumen: (ctx) =>
      ctx.familia?.primitivaTiempo
        ? "Lo define su plan de trabajo"
        : "Lo define el perfil operativo que use la máquina",
    origenValor: () => "default-maquina",
    control: { tipo: "componente", id: "tiempo-maquina-panel" },
  },
  {
    clave: "tiempo.forma",
    seccion: "tiempo",
    eje: "tiempo",
    grupo: "ritmo",
    // Sin etiqueta: las dos pills YA dicen "Tiempo fijo / Tiempo variable" —
    // repetirlo arriba era ruido (feedback del usuario).
    etiqueta: " ",
    pregunta: "¿Tiempo fijo o variable?",
    ayuda:
      "Fijo: tarda lo mismo sin importar la cantidad (diseño, preparación). Variable: depende de cuánto se produce — definís la regla.",
    visible: (ctx) =>
      origenTiempoEfectivo(ctx) === "taller" &&
      !comercialEstimaTiempo(ctx) &&
      // Sin T-2 en el menú no hay ritmo posible: la forma queda fija y la
      // pregunta sobra (diseño gráfico, pre-prensa).
      (ctx.familia?.modosTiempoSoportados ?? []).includes("T-2"),
    resumen: (ctx) =>
      TIEMPO_FORMA_OPTIONS.find((o) => o.value === formaTiempoEfectiva(ctx))
        ?.label ?? formaTiempoEfectiva(ctx),
    origenValor: (ctx) =>
      ctx.cfg.modoTiempo ||
      typeof ctx.paramsPaso.timeCalculationMode === "string" ||
      numOpcional(ctx.paramsPaso.horasEstimadas) != null
        ? "config"
        : "default-paso",
    control: {
      tipo: "pills",
      opciones: () =>
        TIEMPO_FORMA_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          descripcion: o.description,
        })),
      valor: (ctx) => formaTiempoEfectiva(ctx),
      aplicar: (ctx, v) => {
        const soportaT1 = (ctx.familia?.modosTiempoSoportados ?? []).includes(
          "T-1",
        );
        if (v === "fijo") {
          if (soportaT1) {
            // F0.3: el fijo nuevo se escribe como T-1 (minutos en config);
            // si venía de T-2 con horas, el valor se conserva convertido.
            const horas = numOpcional(ctx.paramsPaso.horasEstimadas);
            return {
              tipo: "config-y-params",
              config: {
                modoTiempo: "T-1",
                ...(ctx.cfg.tiempoFijoOverrideMin == null && horas != null
                  ? { tiempoFijoOverrideMin: horas * 60 }
                  : {}),
              },
              params: { horasEstimadas: null, timeCalculationMode: null },
            };
          }
          // Familia sin T-1 en el menú (pintura, montaje): el fijo vive en
          // T-2 como siempre (horasEstimadas + intención tiempo_fijo).
          return {
            tipo: "params",
            patch: { timeCalculationMode: "tiempo_fijo" },
          };
        }
        // Ritmo: limpiar los relojes del camino abandonado. horasEstimadas
        // porque el motor la prefiere sobre el ritmo; tiempoFijoOverrideMin
        // porque es ADITIVO en todos los modos y contaría doble.
        const teniaBatch =
          numOpcional(ctx.paramsPaso.batchTimeMin) != null &&
          numOpcional(ctx.paramsPaso.batchSize) != null;
        return {
          tipo: "config-y-params",
          config: { modoTiempo: "T-2", tiempoFijoOverrideMin: null },
          params: {
            horasEstimadas: null,
            timeCalculationMode: teniaBatch ? "batch_time" : null,
          },
        };
      },
    },
  },
  {
    // El VALOR del tiempo fijo, unificando los dos storages históricos
    // (T-1 minutos en config / T-2 horas en params — el componente decide
    // dónde escribir según el menú de la familia, F0.3).
    clave: "tiempo.fijo_valor",
    seccion: "tiempo",
    eje: "tiempo",
    grupo: "ritmo",
    etiqueta: "Cuánto lleva",
    pregunta: "¿Cuánto lleva?",
    ayuda:
      "El tiempo del paso, independiente de la cantidad. Si el paso ya declara uno, se usa ese.",
    visible: (ctx) =>
      origenTiempoEfectivo(ctx) === "taller" &&
      formaTiempoEfectiva(ctx) === "fijo" &&
      !comercialEstimaTiempo(ctx),
    resumen: (ctx) => {
      const { min, origen } = tiempoFijoEfectivoMin(ctx);
      if (min == null) return "Sin definir";
      const texto =
        min >= 60 && min % 30 === 0 ? `${min / 60} h` : `${min} min`;
      return origen === "default-paso" ? `Usando el del paso: ${texto}` : texto;
    },
    origenValor: (ctx) => tiempoFijoEfectivoMin(ctx).origen,
    pendiente: "tiempo_fijo",
    control: { tipo: "componente", id: "tiempo-fijo-valor" },
  },
  {
    // Capa ⑤ del árbol: se apoya sobre el tiempo base, no lo reemplaza como
    // pregunta. "Puede" deja visible el base (es la sugerencia/fallback);
    // sólo "Debe" suprime las preguntas de fijo/ritmo.
    clave: "tiempo.comercial",
    seccion: "tiempo",
    eje: "tiempo",
    grupo: "ayudas",
    etiqueta: "¿Puede ajustar el tiempo?",
    pregunta: "¿El comercial puede ajustar el tiempo al cotizar?",
    ayuda:
      "Para trabajos donde el tiempo lo sabe el vendedor (diseño, trabajo manual difícil de estimar). Lo que cargue reemplaza el cálculo; setup y limpieza se suman igual.",
    // Comandado por máquina, el tiempo lo define ella — la capa comercial
    // no se ofrece (feedback del usuario). Configs legacy con tiempoManual
    // en pasos T-3 siguen visibles para poder apagarlas.
    visible: (ctx) =>
      origenTiempoEfectivo(ctx) !== "maquina" ||
      comercialNivelEfectivo(ctx) !== "no",
    resumen: (ctx) => {
      const nivel = comercialNivelEfectivo(ctx);
      if (nivel === "no") return "No — se calcula solo";
      if (nivel === "debe") return "Debe cargarlo — sin su tiempo no cotiza";
      const { min } = tiempoFijoEfectivoMin(ctx);
      return min != null
        ? `Puede ajustarlo (sugerencia: ${min} min)`
        : "Puede ajustarlo";
    },
    origenValor: (ctx) =>
      comercialNivelEfectivo(ctx) !== "no" ? "config" : "default-paso",
    control: {
      tipo: "pills",
      opciones: () =>
        TIEMPO_COMERCIAL_NIVEL_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          descripcion: o.description,
        })),
      valor: (ctx) => comercialNivelEfectivo(ctx),
      aplicar: (ctx, v) => {
        if (v === "no") {
          // Borrar la capa; el legacy T-4 (etiqueta sin rama) también se
          // normaliza al salir — vuelve al modo base del menú.
          const patchParams = { tiempoManual: null };
          if (ctx.cfg.modoTiempo === "T-4") {
            return {
              tipo: "config-y-params",
              config: {
                modoTiempo: (ctx.familia?.modosTiempoSoportados ?? []).includes(
                  "T-2",
                )
                  ? "T-2"
                  : "T-1",
              },
              params: patchParams,
            };
          }
          return { tipo: "params", patch: patchParams };
        }
        const config = getTiempoManualConfig(ctx.cfg.paramsPasoJson);
        return {
          tipo: "params",
          patch: {
            tiempoManual: {
              ...config,
              habilitado: true,
              obligatorio: v === "debe",
            },
          },
        };
      },
    },
  },
  {
    // Las ayudas al comercial se separan de la pregunta para poder caer al
    // final del eje: son opcionales y no deberían competir con lo que sí hay
    // que definir. Ver docs/editor-pasos-preguntas-orden.md.
    clave: "tiempo.comercial_ayudas",
    seccion: "tiempo",
    eje: "tiempo",
    grupo: "ayudas",
    anchoCompleto: true,
    etiqueta: " ",
    pregunta: "¿Qué ayudas le damos al comercial para estimar?",
    ayuda:
      "Un rango aceptado evita que dos comerciales coticen el mismo trabajo con tiempos muy distintos.",
    visible: (ctx) => comercialNivelEfectivo(ctx) !== "no",
    resumen: (ctx) => {
      const config = getTiempoManualConfig(ctx.cfg.paramsPasoJson);
      const partes: string[] = [];
      const sugerido = numOpcional(config.defaultMin);
      if (sugerido != null) partes.push(`sugerido ${sugerido} min`);
      const min = numOpcional(config.minMin);
      const max = numOpcional(config.maxMin);
      if (min != null || max != null) {
        partes.push(`entre ${min ?? "—"} y ${max ?? "—"} min`);
      }
      if (config.obligatorio === true) partes.push("obligatorio");
      return partes.length > 0 ? partes.join(" · ") : "Sin ayudas cargadas";
    },
    origenValor: (ctx) => {
      const config = getTiempoManualConfig(ctx.cfg.paramsPasoJson);
      return config.defaultMin != null ||
        config.minMin != null ||
        config.maxMin != null ||
        config.obligatorio === true
        ? "config"
        : "default-paso";
    },
    control: { tipo: "componente", id: "tiempo-comercial-ayudas" },
  },
  {
    // El "fijo + variable" del oficio: la preparación y el traslado no escalan
    // con la cantidad, pueden ir a otro centro y con otra dotación, y sus
    // minutos entran igual al tiempo del paso (la ETA los cuenta).
    // Ver docs/cargos-por-paso-analisis-y-plan.md §7.
    clave: "tiempo.extra",
    seccion: "tiempo",
    eje: "tiempo",
    grupo: "extra",
    anchoCompleto: true,
    // El título del grupo y su ayuda ya lo dicen; el control abre directo con
    // la lista o con el botón de agregar (mismo criterio que `tiempo.niveles`).
    etiqueta: "",
    pregunta: "¿Hay tiempo que no depende de la cantidad?",
    ayuda:
      "Preparar el trabajo, trasladarse. Se cobra una vez por trabajo; puede tarifarse en otro centro de costo y con otra dotación.",
    visible: () => true,
    resumen: (ctx) =>
      resumirTiemposExtra(ctx.cfg.paramsPasoJson) ??
      "Sólo el tiempo del trabajo",
    origenValor: (ctx) =>
      resumirTiemposExtra(ctx.cfg.paramsPasoJson) ? "config" : "default-paso",
    control: { tipo: "componente", id: "tiempos-extra-paso" },
  },
  {
    // Un paso, varias variantes que elige el comercial (zona de colocación,
    // dificultad de diseño). Evita modelar un paso por caso.
    // Ver docs/cargos-por-paso-analisis-y-plan.md §8.
    clave: "tiempo.niveles",
    seccion: "tiempo",
    eje: "tiempo",
    grupo: "niveles",
    anchoCompleto: true,
    // El título del grupo ya dice "Niveles" y el control abre con su propia
    // pregunta: rotularlo arriba sería decir tres veces lo mismo (mismo
    // criterio que `activacion.cuando`).
    etiqueta: "",
    pregunta: "¿Este paso viene en niveles que elige el comercial?",
    ayuda:
      "Un mismo paso que se cobra distinto según dónde o con qué dificultad se haga. El comercial elige uno al cotizar; el nivel pisa el tiempo, el ritmo, la dotación o los minutos del tiempo extra.",
    visible: () => true,
    resumen: (ctx) => {
      const niveles = leerNivelesPaso(ctx.cfg.paramsPasoJson);
      if (!niveles) return "Sin niveles: corre siempre igual";
      return `${niveles.opciones.length} niveles — "${niveles.etiqueta}"`;
    },
    origenValor: (ctx) =>
      leerNivelesPaso(ctx.cfg.paramsPasoJson) ? "config" : "default-paso",
    control: { tipo: "componente", id: "niveles-paso" },
  },
  {
    clave: "tiempo.centro",
    seccion: "tiempo",
    eje: "tiempo",
    grupo: "donde",
    etiqueta: "Centro productivo",
    pregunta: "¿En qué centro productivo se realiza este paso?",
    ayuda:
      "El centro define la tarifa horaria del paso. Si el paso usa máquina, el centro lo pone la máquina.",
    // Siempre visible: si el paso usa máquina, en vez de esconder el selector
    // se muestra —read-only— el centro que pone la máquina (feedback usuario).
    visible: () => true,
    resumen: (ctx) => {
      // Con máquina, el centro lo pone ella.
      if (ctx.cfg.maquinaM1Id) {
        const maq = ctx.lookups.maquinas.find(
          (m) => m.id === ctx.cfg.maquinaM1Id,
        );
        const nombre = maq?.centroCostoPrincipal?.nombre;
        return nombre ? `${nombre} · lo pone la máquina` : "Lo pone la máquina";
      }
      const elegido = ctx.lookups.centrosCosto.find(
        (c) => c.id === ctx.cfg.centroCostoId,
      );
      if (elegido) return elegido.nombre;
      const defaultId = ctx.familia?.defaults?.centroCostoId;
      if (defaultId) {
        const nombre =
          ctx.lookups.centrosCosto.find((c) => c.id === defaultId)?.nombre ??
          "default";
        return `Usando el del paso: ${nombre}`;
      }
      return "Sin centro elegido";
    },
    origenValor: (ctx) =>
      ctx.cfg.maquinaM1Id
        ? "default-maquina"
        : ctx.cfg.centroCostoId
          ? "config"
          : ctx.familia?.defaults?.centroCostoId
            ? "default-paso"
            : "sin-definir",
    // Sin máquina y sin centro sigue siendo un pendiente; con máquina no, porque
    // el centro ya está resuelto (origenValor no es "sin-definir").
    pendiente: "centro",
    control: { tipo: "componente", id: "centro-productivo" },
  },
  {
    clave: "tiempo.dotacion",
    seccion: "tiempo",
    eje: "tiempo",
    grupo: "donde",
    etiqueta: "Operarios",
    pregunta: "¿Cuántas personas trabajan?",
    ayuda:
      "Multiplica sólo la mano de obra (2 personas = doble de horas-hombre); la máquina no cambia.",
    // Con máquina la perilla es INERTE en el motor (el costo multiplica
    // dotación SÓLO sin máquina — la MO no se cobra sobre su runtime):
    // mostrarla en pasos dominados por máquina era inconsistente (feedback
    // del usuario).
    visible: (ctx) =>
      !ctx.cfg.maquinaM1Id && (ctx.cfg.maquinasCandidatas?.length ?? 0) === 0,
    resumen: (ctx) => {
      const n = ctx.cfg.dotacionOperarios ?? 1;
      return n === 1 ? "1 persona" : `${n} personas`;
    },
    origenValor: (ctx) =>
      (ctx.cfg.dotacionOperarios ?? 1) !== 1 ? "config" : "default-paso",
    control: {
      tipo: "numero",
      min: 1,
      max: 20,
      step: 1,
      stepper: true,
      valor: (ctx) => ctx.cfg.dotacionOperarios ?? 1,
      aplicar: (_ctx, v) => ({
        tipo: "config",
        patch: { dotacionOperarios: Math.max(1, Math.round(v ?? 1)) },
      }),
    },
  },
  {
    clave: "tiempo.ritmo_modo",
    seccion: "tiempo",
    eje: "tiempo",
    anchoCompleto: true,
    grupo: "ritmo",
    etiqueta: "Tipo de ritmo",
    pregunta: "¿Por unidad o por tanda?",
    ayuda:
      "Por hora (120 pliegos/h) o por tanda (2 pliegos cada 1 minuto) — lo que sea natural contar en el taller.",
    // FUSIONADA en la regla del tiempo variable (feedback del usuario: con la
    // oración "[N] [magnitud] cada [T] [min|h]" el tipo de ritmo sobra —
    // productividad ES "cada 1 hora"). La diferencia real entre los modos
    // (la tanda redondea hacia arriba) vive como interruptor "tandas
    // enteras" dentro de la propia regla.
    visible: () => false,
    resumen: (ctx) => {
      const modo = ritmoModoEfectivo(ctx);
      return (
        T2_RITMO_OPTIONS.find((o) => o.value === modo)?.label ?? modo
      );
    },
    origenValor: (ctx) =>
      typeof ctx.paramsPaso.timeCalculationMode === "string"
        ? "config"
        : "default-paso",
    control: {
      tipo: "pills",
      opciones: () =>
        T2_RITMO_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          descripcion: o.description,
        })),
      valor: (ctx) => ritmoModoEfectivo(ctx),
      aplicar: (_ctx, v) => ({
        tipo: "params",
        // Las horas estimadas no pueden quedar: el motor las prefiere sobre
        // el ritmo elegido (regla "no apilar relojes").
        patch: { timeCalculationMode: v, horasEstimadas: null },
      }),
    },
  },
  {
    // LA regla del tiempo variable — una sola oración para lo que antes eran
    // "Productividad por hora" y "Tiempo por lote" (feedback del usuario):
    // "[N] [magnitud ▾] cada [T] [min|h ▾]" + interruptor "tandas enteras"
    // (la única diferencia real entre los dos modos: la tanda redondea).
    clave: "tiempo.productividad",
    seccion: "tiempo",
    eje: "tiempo",
    anchoCompleto: true,
    grupo: "ritmo",
    etiqueta: "La regla",
    pregunta: "¿A qué ritmo?",
    ayuda:
      "Cuánto produce el paso y en cuánto tiempo. No es por persona: sumar gente no lo acelera (ver Dónde se hace). Si el paso ya declara un ritmo, se usa ese.",
    visible: (ctx) =>
      esT2(ctx) &&
      formaTiempoEfectiva(ctx) === "ritmo" &&
      !comercialEstimaTiempo(ctx),
    resumen: (ctx) => {
      if (ritmoModoEfectivo(ctx) === "batch_time") {
        const tiempo = numOpcional(ctx.paramsPaso.batchTimeMin);
        const tamano = numOpcional(ctx.paramsPaso.batchSize);
        if (tiempo != null && tamano != null) {
          const base = `${tamano} ${getT2BatchUnitSuffix(
            unidadRitmoEfectiva(ctx),
            fuenteRitmoEfectiva(ctx),
            unidadRitmoNombrada(ctx),
          )} cada ${tiempo} min`;
          const equivalente = ritmoEquivalenteDeBatch(tamano, tiempo);
          return equivalente != null ? `${base} (≈ ${equivalente}/h)` : base;
        }
        return "Sin definir todavía";
      }
      const valor = numOpcional(ctx.paramsPaso.productivityValue);
      if (valor != null) {
        return `${valor} ${getT2ProductivityUnitSuffix(
          unidadRitmoEfectiva(ctx),
          fuenteRitmoEfectiva(ctx),
          unidadRitmoNombrada(ctx),
        )}`;
      }
      const delPaso = ctx.familia?.defaults?.productividadHora;
      return delPaso != null
        ? `Usando el del paso: ${delPaso}/h`
        : "Sin ritmo cargado";
    },
    origenValor: (ctx) =>
      ritmoModoEfectivo(ctx) === "batch_time"
        ? numOpcional(ctx.paramsPaso.batchTimeMin) != null &&
          numOpcional(ctx.paramsPaso.batchSize) != null
          ? "config"
          : "sin-definir"
        : numOpcional(ctx.paramsPaso.productivityValue) != null
          ? "config"
          : ctx.familia?.defaults?.productividadHora != null
            ? "default-paso"
            : "sin-definir",
    pendiente: "ritmo",
    control: { tipo: "componente", id: "ritmo-productividad" },
  },
  {
    clave: "tiempo.batch",
    seccion: "tiempo",
    eje: "tiempo",
    anchoCompleto: true,
    grupo: "ritmo",
    etiqueta: "Tanda",
    pregunta: "¿Cuánto tarda una tanda y de cuántas?",
    ayuda:
      "Ejemplo: 2 pliegos cada 1 minuto. El motor convierte la tanda a ritmo por hora.",
    // FUSIONADA en tiempo.productividad (la regla única del tiempo
    // variable). La definición queda por el censo y el detallado congelado.
    visible: () => false,
    resumen: (ctx) => {
      const tiempo = numOpcional(ctx.paramsPaso.batchTimeMin);
      const tamano = numOpcional(ctx.paramsPaso.batchSize);
      if (tiempo != null && tamano != null) {
        const base = `${tamano} ${getT2BatchUnitSuffix(
          unidadRitmoEfectiva(ctx),
          fuenteRitmoEfectiva(ctx),
          unidadRitmoNombrada(ctx),
        )} cada ${tiempo} min`;
        // F0.5 — pseudo-batch honesto: una tanda de 1 es un ritmo disfrazado;
        // el resumen lo dice (la conversión real queda a un click, no en
        // silencio: la tanda redondea hacia arriba y el ritmo no).
        const equivalente = ritmoEquivalenteDeBatch(tamano, tiempo);
        return equivalente != null ? `${base} (≈ ${equivalente}/h)` : base;
      }
      return "Sin definir todavía";
    },
    origenValor: (ctx) =>
      numOpcional(ctx.paramsPaso.batchTimeMin) != null &&
      numOpcional(ctx.paramsPaso.batchSize) != null
        ? "config"
        : "sin-definir",
    pendiente: "ritmo",
    control: { tipo: "componente", id: "ritmo-batch" },
  },
  {
    clave: "tiempo.cantidad_operativa",
    seccion: "tiempo",
    eje: "tiempo",
    anchoCompleto: true,
    grupo: "cantidad",
    // Cuando el reloj cuenta OTRA magnitud (perímetro, m²), esta sección no
    // multiplica al ritmo: define la cantidad del paso para materiales y
    // herencias — la etiqueta no debe mentir (feedback del usuario: "¿'El
    // ritmo cuenta' y 'se multiplica por' no es lo mismo?").
    etiqueta: (ctx) =>
      esRitmoConOracionInline(ctx) &&
      fuenteRitmoEfectiva(ctx) !== "cantidad"
        ? "La cantidad del paso"
        : "El ritmo se multiplica por",
    pregunta: "¿Sobre cuántas piezas trabaja?",
    ayuda: (ctx) =>
      esRitmoConOracionInline(ctx) && fuenteRitmoEfectiva(ctx) !== "cantidad"
        ? "El reloj ya cuenta otra magnitud (está en la oración del ritmo). Esta cantidad alimenta los materiales del paso y lo que heredan los siguientes."
        : "El número que multiplica al ritmo cuando entra una orden: la cantidad pedida, la que calcula el paso, o una magnitud que dejó un paso anterior (puntos de soldadura, m² a pintar…).",
    visible: (ctx) =>
      requiereMecanismoCantidad(ctx.cfg, ctx.familia) &&
      (ctx.familia?.mecanismosCantidadSoportados?.length ?? 4) > 1 &&
      // Comandado por máquina, la cantidad la definen la máquina y el
      // acomodado — nada que preguntar acá (feedback del usuario; el
      // detallado sigue ofreciendo el mecanismo para casos finos).
      origenTiempoEfectivo(ctx) !== "maquina" &&
      // Con la oración del ritmo (productividad Y tanda), la magnitud —y el
      // mecanismo cuando cuenta "cantidad"— se eligen INLINE ahí: repetir la
      // sección era la duplicación que marcó el usuario. Sólo reaparece si
      // el reloj cuenta otra magnitud (ahí la cantidad sigue importando para
      // materiales/herencias, y NO está en la oración).
      (!esRitmoConOracionInline(ctx) ||
        fuenteRitmoEfectiva(ctx) !== "cantidad"),
    // Resumen ÚNICO: fusiona el mecanismo y la magnitud heredada (antes eran
    // dos filas — "Base de cantidad" + "Hereda de"). Si hereda por output,
    // nombra la magnitud; si no, el método.
    resumen: (ctx) => {
      const mecanismo = mecanismoCantidadEfectivo(ctx);
      if (!mecanismo) return "Sin definir";
      if (mecanismo === "HEREDAR_DEL_OUTPUT_CANONICO") {
        const magnitud = unidadCantidadDe(ctx.cfg, ctx.familia);
        if (magnitud) {
          return magnitud.charAt(0).toUpperCase() + magnitud.slice(1);
        }
        return "La del paso anterior";
      }
      return labelMecanismoCantidad(ctx, mecanismo);
    },
    origenValor: (ctx) =>
      ctx.cfg.mecanismoCantidad ? "config" : "default-paso",
    control: { tipo: "componente", id: "cantidad-unificada" },
  },
  {
    clave: "tiempo.herencia",
    seccion: "tiempo",
    eje: "tiempo",
    anchoCompleto: true,
    grupo: "cantidad",
    etiqueta: "Hereda de",
    pregunta: "¿De qué paso hereda la cantidad?",
    ayuda:
      "Este paso trabaja sobre un número que dejó un paso anterior (los pliegos impresos, los puntos de soldadura, los m² a pintar…). Señalá el paso, o la magnitud publicada que corresponda; sin origen, toma el del paso anterior que publica cantidad.",
    // El editor guiado fusionó esto en `tiempo.cantidad_operativa` (un solo
    // control que ya expande las magnitudes heredables). Se mantiene la
    // definición para el detallado y el resumen, pero no se renderiza aparte.
    visible: () => false,
    resumen: (ctx) => {
      const config = (ctx.cfg.mecanismoCantidadConfigJson ?? {}) as {
        origen?: { rutaPasoId?: string; capacidad?: string };
        campoOutput?: string;
      };
      const rutaPasoId = config.origen?.rutaPasoId;
      if (rutaPasoId) {
        const nombre =
          ctx.otrosPasos.find((p) => p.id === rutaPasoId)?.nombre ??
          "un paso de la ruta";
        const capacidad = config.origen?.capacidad;
        return capacidad
          ? `Hereda de ${nombre} (${capacidad.replaceAll("_", " ")})`
          : `Hereda de ${nombre}`;
      }
      // Herencia POR OUTPUT: hereda una magnitud publicada (puntos de
      // soldadura, m² de pintura…) sin fijar de qué paso viene — la emite
      // el que la publique. Origen tan válido como el explícito (H6).
      if (typeof config.campoOutput === "string" && config.campoOutput.trim()) {
        return `Hereda «${config.campoOutput.replaceAll("_", " ")}» del paso que lo publica`;
      }
      return "Del paso anterior (automático)";
    },
    origenValor: (ctx) => {
      const config = (ctx.cfg.mecanismoCantidadConfigJson ?? {}) as {
        origen?: { rutaPasoId?: string };
        campoOutput?: string;
      };
      if (config.origen?.rutaPasoId) return "config";
      if (typeof config.campoOutput === "string" && config.campoOutput.trim())
        return "config";
      return "default-paso";
    },
    pendiente: "herencia_origen",
    control: { tipo: "componente", id: "herencia-origen" },
  },
  {
    clave: "tiempo.calcular_segun",
    seccion: "tiempo",
    eje: "tiempo",
    grupo: "ritmo",
    etiqueta: "El ritmo cuenta",
    pregunta: "¿El ritmo cuenta piezas, m² o metros?",
    // En productividad la magnitud ya viaja en la misma oración del ritmo
    // ("30 metros de borde por hora"): repetirla acá era preguntar dos veces
    // lo mismo. En tanda y tiempo fijo no hay oración, así que sigue.
    ayuda:
      "Qué magnitud cronometra la productividad: cantidad, área, metros lineales o perímetro.",
    // Fusionada en la ORACIÓN del ritmo (productividad y tanda usan el mismo
    // selector unificado de magnitud): "El ritmo cuenta" como fila aparte era
    // la mitad de la duplicación que marcó el usuario. La definición queda
    // por el resumen y el detallado congelado.
    visible: () => false,
    resumen: (ctx) => {
      const fuente = fuenteRitmoEfectiva(ctx);
      const base =
        getT2QuantitySourceOptions(unidadRitmoEfectiva(ctx), ctx.familia, ctx.paramsPaso).find((o) => o.value === fuente)?.label ?? fuente;
      // "Cantidad efectiva del paso" es un misterio cuando la efectiva es
      // derivada o heredada: se aclara QUÉ cuenta (H2 del relevamiento).
      const unidad = fuente === "cantidad" ? unidadCantidadEfectiva(ctx) : null;
      return unidad ? `${base} (${unidad})` : base;
    },
    origenValor: (ctx) =>
      typeof ctx.paramsPaso.productivityQuantitySource === "string"
        ? "config"
        : "default-paso",
    control: {
      tipo: "select",
      opciones: (ctx) => {
        // Mismo criterio que el resumen (T3b): la opción "Cantidad efectiva
        // del paso" NOMBRA qué cuenta cuando el sistema lo sabe.
        const unidad = unidadCantidadEfectiva(ctx);
        return getT2QuantitySourceOptions(
          unidadRitmoEfectiva(ctx),
          ctx.familia,
          ctx.paramsPaso,
        ).map((o) => ({
          value: o.value,
          label:
            o.value === "cantidad" && unidad ? `${o.label} (${unidad})` : o.label,
          descripcion: o.description,
        }));
      },
      valor: (ctx) => fuenteRitmoEfectiva(ctx),
      aplicar: (_ctx, v) => ({
        tipo: "params",
        patch: { productivityQuantitySource: v },
      }),
    },
  },
  // "Qué monta" (fuentePiezasMontaje) se retiró como bloque separado: la fuente
  // del tiempo ahora va INLINE en la frase de "La regla" ("… de [Tiras de
  // cenefa] …"), heredada del material con override. Ver
  // project_tiempo_frase_natural y el componente de La regla en
  // config-pasos-editor-view.tsx.
  // (tiempo.tiempo_fijo se fusionó en tiempo.fijo_valor: un solo concepto
  //  "Fijo" para los dos storages históricos — árbol de tiempo, F0.3.)

  // ───────────────────────────────────────────────────────────────────
  // Sección MÁQUINA Y PERFIL (sub-fase B). Candidatas y modo de color
  // usan LA UI del detallado extraída como componentes (corrección del
  // usuario: las cards v2 de botones se descartan).
  // ───────────────────────────────────────────────────────────────────
  {
    clave: "maquina.maquina",
    eje: "maquina",
    grupo: "cual",
    etiqueta: "Máquina",
    seccion: "maquina",
    pregunta: "¿En qué máquina se hace?",
    ayuda:
      "La máquina fija de este paso: pone su centro de costo y, si el tiempo es por máquina, su velocidad.",
    // En familias M-2 (comercial elige) la máquina —y su perfil— se definen
    // SIEMPRE en las TARJETAS de candidatas (el diseño único: agregar máquina →
    // marcar preferida setea el maquinaM1Id). El dropdown fijo sólo aplica a
    // familias M-1 PURAS; si no, convivían dos diseños (feedback del usuario).
    visible: (ctx) => {
      const rel = ctx.familia?.relacionMaquinaSoportada ?? [];
      return rel.includes("M-1") && !rel.includes("M-2");
    },
    resumen: (ctx) => {
      const maquina = maquinaElegida(ctx);
      if (maquina) return maquina.nombre;
      return maquinaRequerida(ctx)
        ? "Sin máquina elegida"
        : "Sin máquina (paso manual)";
    },
    origenValor: (ctx) =>
      ctx.cfg.maquinaM1Id
        ? "config"
        : maquinaRequerida(ctx)
          ? "sin-definir"
          : "default-paso",
    pendiente: "maquina",
    control: { tipo: "componente", id: "maquina-m1" },
  },
  {
    clave: "maquina.perfil",
    eje: "maquina",
    grupo: "cual",
    etiqueta: "Perfil",
    seccion: "maquina",
    pregunta: "¿Con qué perfil?",
    ayuda:
      "El perfil operativo define velocidad y modos de color de la máquina para este paso.",
    // Igual que la máquina fija: en M-2 el perfil vive en la tarjeta de la
    // candidata. Acá sólo para familias M-1 puras.
    visible: (ctx) => {
      const rel = ctx.familia?.relacionMaquinaSoportada ?? [];
      return (
        Boolean(ctx.cfg.maquinaM1Id) &&
        rel.includes("M-1") &&
        !rel.includes("M-2")
      );
    },
    resumen: (ctx) => {
      const perfil = maquinaElegida(ctx)?.perfilesOperativos.find(
        (p) => p.id === ctx.cfg.perfilM1Id,
      );
      return perfil ? perfil.nombre : "Sin perfil elegido";
    },
    origenValor: (ctx) => (ctx.cfg.perfilM1Id ? "config" : "sin-definir"),
    pendiente: "perfil",
    control: { tipo: "componente", id: "perfil-m1" },
  },
  {
    clave: "maquina.candidatas",
    eje: "maquina",
    grupo: "lista",
    // El componente trae toda la UI (lista + config inline); el encabezado del
    // eje "En qué máquina" ya dice de qué va, así que la opción no lleva label
    // ni ayuda propios — repetirlo era decir dos veces lo mismo.
    etiqueta: " ",
    anchoCompleto: true,
    seccion: "maquina",
    pregunta: "¿Entre qué máquinas elige el comercial?",
    visible: (ctx) =>
      (ctx.familia?.relacionMaquinaSoportada ?? []).includes("M-2"),
    resumen: (ctx) => {
      const candidatas = ctx.cfg.maquinasCandidatas ?? [];
      if (candidatas.length === 0) return "Sin candidatas elegidas";
      const nombres = candidatas
        .map(
          (c) =>
            ctx.lookups.maquinas.find((m) => m.id === c.maquinaId)?.nombre ??
            "máquina",
        )
        .join(", ");
      return `${candidatas.length === 1 ? "1 candidata" : `${candidatas.length} candidatas`}: ${nombres}`;
    },
    origenValor: (ctx) =>
      (ctx.cfg.maquinasCandidatas?.length ?? 0) > 0 ? "config" : "sin-definir",
    pendiente: "candidatas",
    control: { tipo: "componente", id: "candidatas-detallado" },
  },
  {
    clave: "maquina.cobertura",
    eje: "maquina",
    grupo: "ajustes",
    etiqueta: "Cobertura de tóner",
    seccion: "maquina",
    pregunta: "¿Cuánto tóner gasta por defecto?",
    ayuda:
      "Cobertura de tóner por defecto de este paso (Borrador / Normal / Alta). Sólo aplica a impresoras láser; el perfil lo sigue eligiendo el sistema automáticamente. Ajusta el consumo de tóner, no el precio de venta.",
    visible: (ctx) => pasoUsaLaser(ctx),
    resumen: (ctx) => {
      const params = (ctx.cfg.paramsPasoJson ?? {}) as Record<string, unknown>;
      const nivel =
        typeof params.coberturaDefault === "string"
          ? (params.coberturaDefault as NivelCobertura)
          : "alta";
      const etiqueta = NIVEL_COBERTURA_LABELS[nivel] ?? "Alta";
      return `Cobertura ${etiqueta.toLowerCase()} de tóner`;
    },
    origenValor: () => "config",
    control: { tipo: "componente", id: "cobertura-toner" },
  },
  {
    clave: "maquina.modo_color",
    eje: "maquina",
    grupo: "ajustes",
    etiqueta: "Modo de color",
    seccion: "maquina",
    pregunta: "¿Se imprime a color o en negro?",
    ayuda:
      "Limita los modos de color que se pueden cotizar en este producto. En familias con candidatas, los modos se definen por máquina dentro de la tarjeta de cada una.",
    // En M-2 el modo de color se define SIEMPRE por máquina (tarjeta de la
    // candidata), nunca como control suelto a nivel producto: antes aparecía
    // con CERO máquinas y un rótulo "…de esta máquina" sin máquina — al quitar
    // la última candidata saltaba de la nada (feedback del usuario).
    visible: (ctx) =>
      modoColorAplica(ctx.familia, ctx.cfg) &&
      !(ctx.familia?.relacionMaquinaSoportada ?? []).includes("M-2"),
    resumen: (ctx) => {
      const config = getModoColorConfig(ctx.cfg.paramsPasoJson);
      if (config.enabled !== true) {
        return "Todos los modos de la máquina y el perfil";
      }
      const permitidos = Array.isArray(config.allowedModes)
        ? config.allowedModes.filter((m): m is string => typeof m === "string")
        : [];
      return permitidos.length > 0
        ? `Limitado: ${permitidos.join(", ")}`
        : "Limitado para este producto";
    },
    origenValor: (ctx) =>
      getModoColorConfig(ctx.cfg.paramsPasoJson).enabled === true
        ? "config"
        : "default-maquina",
    control: { tipo: "componente", id: "modo-color-detallado" },
  },

  // ───────────────────────────────────────────────────────────────────
  // Sección MATERIALES (sub-fase C). materiales.agregar es a nivel paso;
  // el resto se evalúa POR SLOT (ctx.slot poblado). El rol del slot está
  // PODADO del guiado (decisión del usuario). Material fijo y candidatos
  // usan LA UI del detallado extraída como componentes.
  // ───────────────────────────────────────────────────────────────────
  {
    clave: "materiales.agregar",
    seccion: "materiales",
    pregunta: "¿Qué materiales gasta acá?",
    ayuda:
      "Cada slot es un tipo de material que el paso necesita (papel, tinta, film…). Sumá los que declara el paso o un componente propio.",
    visible: (ctx) =>
      !ctx.slot &&
      (slotsManualesDeFamilia(ctx).length > 0 ||
        Boolean(ctx.familia?.permiteSlotsAdicionales)),
    resumen: (ctx) => {
      const configurados = (ctx.cfg.slotsMateriales ?? []).length;
      if (configurados === 0) return "Sin materiales configurados";
      return configurados === 1
        ? "1 material configurado"
        : `${configurados} materiales configurados`;
    },
    origenValor: (ctx) => {
      const configurados = new Set(
        (ctx.cfg.slotsMateriales ?? []).map((slot) => slot.slotCodigo),
      );
      const faltaRequerido = slotsManualesDeFamilia(ctx).some(
        (slot) => slot.requerido && !configurados.has(slot.codigo),
      );
      if (faltaRequerido) return "sin-definir";
      return configurados.size > 0 ? "config" : "default-paso";
    },
    control: { tipo: "componente", id: "agregar-slot" },
  },
  {
    clave: "materiales.nombre",
    seccion: "materiales",
    grupo: "cual",
    etiqueta: "Nombre",
    pregunta: "¿Cómo se llama?",
    ayuda:
      "El nombre operativo del componente o accesorio dentro del paso (portabanner, solapa, ojales…).",
    visible: (ctx) => Boolean(ctx.slot?.esAdicional),
    resumen: (ctx) =>
      ctx.slot?.payload.slotNombre?.trim()
        ? `"${ctx.slot.payload.slotNombre.trim()}"`
        : "Sin nombre",
    origenValor: (ctx) =>
      ctx.slot?.payload.slotNombre?.trim() ? "config" : "sin-definir",
    control: {
      tipo: "texto",
      placeholder: () => "Ej. Portabanner, Solapa, Ojales",
      valor: (ctx) => ctx.slot?.payload.slotNombre ?? "",
      aplicar: (_ctx, v) => ({
        tipo: "slot",
        patch: { slotNombre: v || null },
      }),
    },
  },
  {
    clave: "materiales.quien",
    seccion: "materiales",
    grupo: "quien",
    etiqueta: " ",
    anchoCompleto: true,
    pregunta: "¿Quién decide cuál se usa?",
    ayuda:
      "Material fijo (lo dejás definido acá), el comercial elige al cotizar, o el sistema elige solo con un criterio.",
    visible: (ctx) => Boolean(ctx.slot),
    resumen: (ctx) =>
      labelDe(
        SELECCION_MATERIAL_OPTIONS,
        ctx.slot?.payload.modoSeleccion ?? "HARDCODED",
      ),
    origenValor: () => "config",
    control: {
      tipo: "pills",
      opciones: () =>
        SELECCION_MATERIAL_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          descripcion: o.description,
        })),
      presentacion: "tarjetas",
      valor: (ctx) => ctx.slot?.payload.modoSeleccion ?? "HARDCODED",
      aplicar: (_ctx, v) => ({
        tipo: "slot",
        patch: {
          modoSeleccion: (v || "HARDCODED") as
            | "HARDCODED"
            | "COMERCIAL_ELIGE"
            | "MOTOR_ELIGE_AUTO",
        },
      }),
    },
  },
  {
    clave: "materiales.material",
    seccion: "materiales",
    grupo: "cual",
    anchoCompleto: true,
    etiqueta: " ",
    pregunta: "¿Cuál exactamente?",
    // Sin ayuda: el componente ("Qué material se usa") ya trae su propio hint.
    visible: (ctx) => ctx.slot?.payload.modoSeleccion === "HARDCODED",
    resumen: (ctx) => {
      const varianteId = ctx.slot?.payload.materialVarianteId;
      if (!varianteId) return "Sin material elegido";
      return nombreVariante(ctx, varianteId) ?? "Material definido";
    },
    origenValor: (ctx) =>
      ctx.slot?.payload.materialVarianteId ? "config" : "sin-definir",
    pendiente: "material_slot",
    control: { tipo: "componente", id: "material-fijo-detallado" },
  },
  {
    clave: "materiales.candidatos",
    seccion: "materiales",
    grupo: "cual",
    etiqueta: " ",
    anchoCompleto: true,
    pregunta: "¿Entre cuáles se elige?",
    // Sin ayuda: el componente ("Materiales candidatos") ya trae su hint.
    visible: (ctx) =>
      Boolean(ctx.slot) &&
      ctx.slot?.payload.modoSeleccion !== "HARDCODED",
    resumen: (ctx) => {
      const candidatos = ctx.slot?.payload.candidatos ?? [];
      if (candidatos.length === 0) return "Sin candidatos elegidos";
      // H19: con `todasLasVariantes` el junction va vacío — decir "0
      // variantes" era mentira (se ofrecen todas las activas del material).
      const conTodas = candidatos.some((c) => c.todasLasVariantes);
      const explicitas = candidatos.reduce(
        (total, candidato) => total + candidato.varianteIds.length,
        0,
      );
      const materiales = `${candidatos.length} material${candidatos.length === 1 ? "" : "es"}`;
      if (conTodas && explicitas === 0)
        return `${materiales} · todas sus variantes activas`;
      if (conTodas)
        return `${materiales} · todas las variantes + ${explicitas} explícita${explicitas === 1 ? "" : "s"}`;
      return `${materiales} · ${explicitas} variante${explicitas === 1 ? "" : "s"}`;
    },
    origenValor: (ctx) =>
      (ctx.slot?.payload.candidatos?.length ?? 0) > 0
        ? "config"
        : "sin-definir",
    pendiente: "material_slot",
    control: { tipo: "componente", id: "candidatos-slot-detallado" },
  },
  {
    clave: "materiales.criterio",
    seccion: "materiales",
    grupo: "criterio",
    etiqueta: "Criterio del sistema",
    pregunta: "¿Con qué criterio elige el sistema?",
    ayuda:
      "Entre los candidatos: el más barato, el de mejor aprovechamiento, o la capacidad mínima que cumpla.",
    visible: (ctx) => ctx.slot?.payload.modoSeleccion === "MOTOR_ELIGE_AUTO",
    resumen: (ctx) => {
      const criterio = ctx.slot?.payload.criterioMotorAuto;
      if (criterio) return labelDe(CRITERIO_AUTO_OPTIONS, criterio);
      // Sin criterio en el slot: la familia puede traerlo DE FÁBRICA
      // (selección por capacidad declarada — la fuente LED elige por watts).
      // No falta nada; se muestra el default resuelto.
      if (criterioDeFabricaDelSlot(ctx)) {
        return labelDe(CRITERIO_AUTO_OPTIONS, "MENOR_CAPACIDAD_QUE_CUMPLA");
      }
      return "Sin criterio elegido";
    },
    origenValor: (ctx) =>
      ctx.slot?.payload.criterioMotorAuto
        ? "config"
        : criterioDeFabricaDelSlot(ctx)
          ? "default-paso"
          : "sin-definir",
    control: {
      tipo: "pills",
      opciones: () =>
        CRITERIO_AUTO_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          descripcion: o.description,
        })),
      valor: (ctx) => ctx.slot?.payload.criterioMotorAuto ?? "",
      aplicar: (_ctx, v) => ({
        tipo: "slot",
        patch: { criterioMotorAuto: v || null },
      }),
    },
  },
  {
    // Fuente de medida POR SLOT (docs/fuente-de-medida-de-consumo-diseno.md §6/§8):
    // de dónde sale la medida que ESTE material consume. Override del default a
    // nivel paso. Se muestra sólo en slots SUSTRATO y sólo cuando hay una fuente
    // real para elegir (un paso anterior publica outputs geométricos).
    clave: "materiales.fuente_medida",
    seccion: "materiales",
    // Va con "Cómo se calcula el consumo" (grupo descuento), no con la
    // selección del material: las dos preguntas del consumo —SOBRE QUÉ mide y
    // CON QUÉ fórmula— juntas y en orden se entienden; separadas confundían
    // (feedback del usuario).
    grupo: "descuento",
    anchoCompleto: true,
    etiqueta: "Sobre qué mide",
    pregunta: "¿Sobre qué mide este material?",
    ayuda:
      "De dónde sale la medida que este material consume: las piezas del trabajo, la medida visible terminada, o un output que publica un paso anterior (el bastidor: tiras de cenefa, chapa de fondo…).",
    visible: (ctx) => {
      const esSustrato =
        ctx.slot?.decl?.tipo === "SUSTRATO" ||
        ctx.slot?.payload.slotRol === "SUSTRATO";
      return (
        Boolean(ctx.slot) &&
        esSustrato &&
        opcionesPiezasMontar(ctx).length > MONTAJE_SOURCE_OPTIONS.length
      );
    },
    resumen: (ctx) => {
      const valor = String(
        ctx.slot?.payload.fuenteMedida ?? "piezas_jobcontext",
      );
      return (
        opcionesPiezasMontar(ctx).find((o) => o.value === valor)?.label ?? valor
      );
    },
    origenValor: (ctx) =>
      ctx.slot?.payload.fuenteMedida ? "config" : "default-paso",
    control: {
      tipo: "pills",
      opciones: (ctx) => opcionesPiezasMontar(ctx),
      valor: (ctx) =>
        String(ctx.slot?.payload.fuenteMedida ?? "piezas_jobcontext"),
      aplicar: (_ctx, v) => ({
        tipo: "slot",
        patch: { fuenteMedida: v || null },
      }),
    },
  },
  {
    clave: "materiales.consumo",
    seccion: "materiales",
    grupo: "descuento",
    // Sin etiqueta: el componente de las 3 formas se auto-titula (cada forma
    // lleva su propio encabezado con ícono). Ancho completo para la frase.
    etiqueta: "",
    anchoCompleto: true,
    pregunta: "¿Cómo se calcula el consumo?",
    ayuda:
      "La fórmula del motor para saber cuánto material gasta: por pieza, por m², por metro lineal… En slots derivados no hay fórmula: la geometría del paso decide.",
    visible: (ctx) => Boolean(ctx.slot),
    resumen: (ctx) => {
      // Slot derivado (E2): el consumo no sale de la fórmula — lo deriva la
      // geometría del paso (ml de cable, pares de anclaje). El perfil además
      // se compra en BARRAS enteras cuando la variante declara su largo
      // (packing del despiece) — el editor lo dice, no lo esconde (H5).
      // Regla 2: si el modelador definió su propia regla, esa manda y el
      // resumen la muestra.
      const decl = ctx.slot?.decl;
      if (decl?.magnitudDerivada || decl?.cantidadFija !== undefined) {
        const base = ctx.slot?.payload.cantidadBase;
        if (base) {
          const factor = ctx.slot?.payload.cantidadFactor ?? 1;
          return `Regla propia: ${factor} por ${labelDe(
            CANTIDAD_BASE_SLOT_OPTIONS,
            base,
          ).toLowerCase()}`;
        }
        return decl.codigo === "perfil_estructural"
          ? "Derivado de la geometría · barras enteras si la variante declara largo de barra"
          : "Derivado de la geometría del paso";
      }
      return labelDe(
        FORMULA_OPTIONS,
        ctx.slot?.payload.formula ?? "por_unidad_productiva",
      );
    },
    origenValor: (ctx) =>
      ctx.slot?.decl?.magnitudDerivada
        ? "default-paso"
        : ctx.slot?.payload.formula
          ? "config"
          : "default-paso",
    // Componente: en un slot normal es el select de fórmula de siempre; en
    // uno DERIVADO muestra qué decide la geometría (con ejemplo calculado)
    // en vez de una perilla que el motor ignora.
    control: { tipo: "componente", id: "consumo-formula" },
  },
  // [Costeo del sustrato → nesting] La pregunta `materiales.costeo` se
  // eliminó: el costeo del sustrato lo POSEE el nesting (Acomodo), no el
  // material — las estrategias que cobran desperdicio son función del
  // resultado geométrico y hay una sola corrida de nesting por paso. El
  // material aporta precio + consumo; la estrategia vive en
  // `nestingConfig.costing` (Acomodo) como fuente única.
  // Ver docs/editor-pasos-preguntas-orden.md §10.5 y nesting-abstraccion §3.3.
  {
    clave: "materiales.base",
    seccion: "materiales",
    grupo: "descuento",
    anchoCompleto: true,
    pregunta: "¿Por cada cuántos se gasta uno?",
    ayuda:
      "Base × factor: 2 broches por talonario, 1 cartón por pila, 4 ojales por pieza.",
    // Plegado dentro de "materiales.consumo" (las 3 formas): "Regla propia" ES
    // esta base × factor. Se deja la clave para el resumen/tests, pero no se
    // muestra como control separado.
    visible: () => false,
    resumen: (ctx) => {
      const slot = ctx.slot;
      if (!slot) return "";
      // H12: sin `cantidadBase` guardada el motor usa la FÓRMULA — también
      // en slots adicionales (el default "cantidad pedida" era solo de la
      // UI de alta y mentía sobre pasos ya guardados).
      const base = slot.payload.cantidadBase ?? "formula";
      if (base === "formula") return "Según fórmula del consumo";
      const factor = slot.payload.cantidadFactor ?? 1;
      return `${factor} por ${labelDe(
        CANTIDAD_BASE_SLOT_OPTIONS,
        base,
      ).toLowerCase()}`;
    },
    origenValor: (ctx) =>
      ctx.slot?.payload.cantidadBase != null ||
      ctx.slot?.payload.cantidadFactor != null
        ? "config"
        : "default-paso",
    control: { tipo: "componente", id: "base-consumo" },
  },
  {
    clave: "materiales.caras",
    seccion: "materiales",
    grupo: "descuento",
    etiqueta: "Doble faz",
    pregunta: "¿La doble faz gasta doble?",
    ayuda:
      "Si el trabajo va a dos caras, el consumo de este material se multiplica por las caras.",
    // H9: en una familia sin multiplicador `caras` (herrería, LED) la
    // pregunta era ruido. Se muestra solo donde puede multiplicar — o si
    // alguien ya la activó (no esconder config existente).
    visible: (ctx) =>
      Boolean(ctx.slot) &&
      Boolean(
        ctx.familia?.multiplicadoresSoportados?.includes("caras") ||
          ctx.slot?.payload.aplicaMultiCaras,
      ),
    resumen: (ctx) =>
      ctx.slot?.payload.aplicaMultiCaras
        ? "Sí — multiplica por caras"
        : "No — el consumo no cambia",
    origenValor: (ctx) =>
      ctx.slot?.payload.aplicaMultiCaras ? "config" : "default-paso",
    control: {
      tipo: "pills",
      opciones: () => [
        { value: "no", label: "No" },
        { value: "si", label: "Sí, multiplica" },
      ],
      valor: (ctx) => (ctx.slot?.payload.aplicaMultiCaras ? "si" : "no"),
      aplicar: (_ctx, v) => ({
        tipo: "slot",
        patch: { aplicaMultiCaras: v === "si" },
      }),
    },
  },

  // ───────────────────────────────────────────────────────────────────
  // Sección AJUSTES DEL TRABAJO / oficio (sub-fase D). Setup y cleanup
  // declarativos; el acomodado (algoritmo, demasía, pliego, panelizado,
  // márgenes y costeo del sustrato — censo E.0 filas 4-19) es UNA card
  // cohesiva del detallado extraída como componente. El tiempo fijo
  // override (fila 3) ya migró como tiempo.tiempo_fijo.
  // ───────────────────────────────────────────────────────────────────
  {
    clave: "oficio.params_familia",
    seccion: "oficio",
    eje: "trabajo",
    grupo: "labores",
    anchoCompleto: true,
    pregunta: "¿Con qué parámetros trabaja este paso?",
    ayuda:
      "Los parámetros propios del oficio (refuerzos del bastidor, densidad del sembrado, lados y demasía del refuerzo…). Son los números que el motor usa para calcular este paso.",
    visible: (ctx) =>
      Boolean(
        familiaConParamsEditables(ctx.familia) &&
          // `modoTalonarioIncompleto` no cuenta: lo edita el control de
          // Imposición del pliego, no esta tabla (evita una tabla vacía en
          // impresión por hoja, cuyo único param propio es ese).
          (ctx.familia?.paramsPasoSchema?.filter(
            (p) => p.campo !== "modoTalonarioIncompleto",
          ).length ?? 0) > 0,
      ),
    resumen: (ctx) => {
      // Nombra los VALORES (regla T3b: el resumen dice lo que hay, no un
      // opaco "parámetros definidos").
      const schema = (ctx.familia?.paramsPasoSchema ?? []).filter(
        (p) => p.campo !== "modoTalonarioIncompleto",
      );
      const partes: string[] = [];
      for (const param of schema) {
        const crudo = ctx.paramsPaso[param.campo] ?? param.default;
        if (crudo === null || crudo === undefined || crudo === "") continue;
        if (Array.isArray(crudo)) {
          if (crudo.length === 0) continue;
          partes.push(
            `${param.etiqueta.split("(")[0].trim()}: ${crudo
              .map((v) => etiquetaValorParam(String(v)))
              .join(" + ")}`,
          );
          continue;
        }
        const valor =
          typeof crudo === "boolean"
            ? crudo
              ? "sí"
              : "no"
            : etiquetaValorParam(String(crudo));
        partes.push(`${param.etiqueta.split("(")[0].trim()}: ${valor}`);
      }
      if (partes.length === 0) return "Con los valores por defecto";
      const visibles = partes.slice(0, 3).join(" · ");
      return partes.length > 3
        ? `${visibles} · +${partes.length - 3} más`
        : visibles;
    },
    origenValor: (ctx) => {
      const schema = (ctx.familia?.paramsPasoSchema ?? []).filter(
        (p) => p.campo !== "modoTalonarioIncompleto",
      );
      return schema.some(
        (param) =>
          ctx.paramsPaso[param.campo] !== undefined &&
          ctx.paramsPaso[param.campo] !== null,
      )
        ? "config"
        : "default-paso";
    },
    control: { tipo: "componente", id: "params-familia" },
  },
  {
    // [Efectos] Lo que el paso le EXIGE al trabajo, más allá de consumir
    // tiempo y materiales: el tensado de una lona necesita 100 mm por lado
    // para envolver el bastidor. Antes esto sólo existía como una familia
    // aparte ("Modificación previa"), un paso fantasma que no producía nada.
    clave: "oficio.efectos",
    seccion: "oficio",
    eje: "trabajo",
    grupo: "labores",
    anchoCompleto: true,
    pregunta: "¿Este paso le exige algo al trabajo?",
    ayuda:
      "Si para hacerlo la pieza tiene que venir más grande (envolver un bastidor, coser un bolsillo, dejar borde para perforar), decilo acá: el material se agranda antes de imprimir, aunque este paso vaya al final.",
    visible: (ctx) => soportaDemasiaMedida(ctx.familia),
    resumen: (ctx) => {
      const efecto = leerEfectoDemasia(ctx.paramsPaso);
      if (efecto) return `Material extra: ${resumirEfectoDemasia(efecto)}`;
      return declaraEfectoDemasia(ctx.paramsPaso)
        ? "Pide material extra, pero falta el lado o los milímetros"
        : "No exige nada: trabaja sobre la medida que llega";
    },
    origenValor: (ctx) =>
      declaraEfectoDemasia(ctx.paramsPaso) ? "config" : "default-paso",
    control: { tipo: "componente", id: "efectos-paso" },
  },
  {
    clave: "oficio.setup",
    seccion: "oficio",
    eje: "tiempo",
    grupo: "prep",
    etiqueta: "Preparar la máquina",
    pregunta: "¿Preparar la máquina lleva un tiempo distinto acá?",
    ayuda:
      "Sobrescribe el setup del perfil de máquina sólo para este producto. Vacío = el del perfil.",
    visible: (ctx) => Boolean(ctx.cfg.maquinaM1Id),
    resumen: (ctx) =>
      ctx.cfg.setupOverrideMin != null
        ? `${ctx.cfg.setupOverrideMin} min`
        : "El del perfil de la máquina",
    origenValor: (ctx) =>
      ctx.cfg.setupOverrideMin != null ? "config" : "default-maquina",
    control: {
      tipo: "numero",
      min: 0,
      step: 0.5,
      sufijo: () => "min",
      placeholder: () => "Hereda del perfil",
      valor: (ctx) => ctx.cfg.setupOverrideMin ?? null,
      aplicar: (_ctx, v) => ({
        tipo: "config",
        patch: { setupOverrideMin: v },
      }),
    },
  },
  {
    clave: "oficio.cleanup",
    seccion: "oficio",
    eje: "tiempo",
    grupo: "prep",
    etiqueta: "Limpieza al terminar",
    pregunta: "¿Y la limpieza al terminar?",
    ayuda:
      "Sobrescribe el cierre/post-proceso del perfil de máquina sólo para este producto. Vacío = el del perfil.",
    visible: (ctx) => Boolean(ctx.cfg.maquinaM1Id),
    resumen: (ctx) =>
      ctx.cfg.cleanupOverrideMin != null
        ? `${ctx.cfg.cleanupOverrideMin} min`
        : "El del perfil de la máquina",
    origenValor: (ctx) =>
      ctx.cfg.cleanupOverrideMin != null ? "config" : "default-maquina",
    control: {
      tipo: "numero",
      min: 0,
      step: 0.5,
      sufijo: () => "min",
      placeholder: () => "Hereda del perfil",
      valor: (ctx) => ctx.cfg.cleanupOverrideMin ?? null,
      aplicar: (_ctx, v) => ({
        tipo: "config",
        patch: { cleanupOverrideMin: v },
      }),
    },
  },
  {
    clave: "oficio.acomodado",
    seccion: "oficio",
    eje: "trabajo",
    grupo: "labores",
    anchoCompleto: true,
    // El componente trae su propio encabezado ("Acomodado de las piezas"): la
    // etiqueta en blanco evita repetir la pregunta arriba.
    etiqueta: " ",
    pregunta: "¿Cómo se acomodan y cobran las piezas en el material?",
    ayuda:
      "Demasía por pieza, pliego de impresión, panelizado, márgenes extra y —en materia prima finita— cómo se cobra la última unidad a medio usar.",
    // H10: una familia con DERIVADOR deriva geometría, no acomoda piezas: la
    // card de Acomodado ahí era ruido puro. (El otro caso que se excluía —la
    // familia que mutaba medidas— murió con `modificacion_pre`: ahora la
    // demasía es un EFECTO y el paso que la declara sí puede acomodar.)
    visible: (ctx) =>
      nestingAplica(ctx.familia, ctx.cfg) && !ctx.familia?.derivador,
    resumen: (ctx) => {
      const nesting = ctx.paramsPaso.nestingConfig as
        | {
            costing?: { strategy?: unknown };
            paneling?: { enabled?: unknown };
          }
        | undefined;
      const estrategia =
        typeof nesting?.costing?.strategy === "string"
          ? nesting.costing.strategy
          : "simple";
      const partes: string[] = [];
      // Imposición de cuadernillo (H14): si el paso la tiene configurada,
      // es LO más importante del acomodo — nombrarla, no "Acomodo estándar".
      const imposicion = (
        nesting as { imposicion?: { esquema?: unknown; hojas?: unknown } } | undefined
      )?.imposicion;
      if (imposicion?.esquema === "caballete") {
        const hojas =
          imposicion.hojas === "tapa"
            ? "hojas de tapa"
            : imposicion.hojas === "interior"
              ? "hojas de interior"
              : "todas las hojas";
        partes.push(`Imposición a caballete (${hojas})`);
      }
      // El costeo se nombra sólo si se salió del default Y el sustrato es
      // placa: en rollo la card no lo ofrece (el motor lo ignora), así que
      // mostrar una estrategia guardada de antes sería un dato muerto.
      if (estrategia !== "simple" && !sustratoLuceRollo(ctx)) {
        partes.push(
          `Costeo: ${labelDe(
            costingStrategyOptions(
              // [Tanda B] El sustantivo lo da la superficie declarada.
              ctx.familia?.nestingConfig?.superficie === "pliego" ||
                ctx.familia?.nestingConfig?.superficie === "pliegos_multiples"
                ? "pliego"
                : "placa",
            ),
            estrategia,
          ).toLowerCase()}`,
        );
      }
      if (nesting?.paneling?.enabled === true) partes.push("Panelizado");
      if (partes.length > 0) return partes.join(" · ");
      // En rollo el acomodo tiene nombre: por ancho útil del material.
      return sustratoLuceRollo(ctx)
        ? "Acomodo en rollo (por ancho útil del material)"
        : "Acomodo estándar";
    },
    origenValor: (ctx) =>
      ctx.paramsPaso.nestingConfig != null ? "config" : "default-paso",
    control: { tipo: "componente", id: "acomodado-detallado" },
    orden: 0,
  },
];

/**
 * Los sub-bloques del eje "cuánto tarda", en orden de lectura.
 *
 * El texto de ayuda dice lo que hace el MOTOR, no lo que suena razonable: la
 * dotación no acorta el trabajo, multiplica la mano de obra (y sólo en pasos
 * sin máquina, donde la capacidad se mide en horas-hombre). Ver
 * `calcularTiempoYCosto` en motor.service.ts.
 */
/** "Dónde se hace" es su propia CARD (feedback del usuario: el centro y los
 *  operarios definen quién/dónde ejecuta y la tarifa — no el reloj; no
 *  pertenecen a "Tiempo que consume"). El grupo no repite título: lo pone
 *  la card. */
export const GRUPOS_DONDE: GrupoEje[] = [
  {
    id: "donde",
    estilo: "campos",
    columnas: "minmax(0, 1fr) 168px",
  },
];

const GRUPOS_TIEMPO: GrupoEje[] = [
  { id: "raiz", estilo: "bifurcacion" },
  {
    id: "ritmo",
    titulo: "Cómo se calcula",
    ayuda: (ctx) =>
      origenTiempoEfectivo(ctx) === "maquina"
        ? "El reloj lo define la máquina; acá no hay perillas."
        : "Es lo único que cambia los minutos por ítem.",
    estilo: "campos",
    columnas: "minmax(0, 1fr)",
  },
  {
    id: "cantidad",
    titulo: "Sobre qué cantidad se aplica",
    ayuda: (ctx) =>
      comercialEstimaTiempo(ctx)
        ? "Cuántas piezas procesa el paso. Con el tiempo cargado a mano no cambia los minutos, pero sí lo que el paso consume."
        : "Qué número multiplica al ritmo cuando entra una orden.",
    estilo: "campos",
    columnas: "minmax(0, 360px)",
  },
  {
    // Setup/cleanup son TIEMPO puro (minutos fijos por orden): viven acá, no
    // en "El trabajo" —que quedó para acomodado y parámetros del oficio.
    id: "prep",
    titulo: "Preparación y limpieza",
    ayuda:
      "Minutos fijos antes y después del trabajo, si difieren del perfil de la máquina.",
    estilo: "campos",
    columnas: "minmax(0, 1fr) minmax(0, 260px)",
  },
  {
    // Bloque propio: no es la preparación de la MÁQUINA (eso es `prep`), es
    // trabajo del paso que no escala con la cantidad y puede tarifarse en otro
    // centro. Ver docs/cargos-por-paso-analisis-y-plan.md §7.
    id: "extra",
    titulo: "Tiempo extra",
    ayuda:
      "Trabajo que lleva el paso pero no depende de la cantidad: preparar, trasladarse, etc.",
    estilo: "campos",
    columnas: "minmax(0, 1fr)",
  },
  {
    // El mismo paso cobrado distinto según dónde o con qué dificultad se haga.
    // Va después del tiempo extra porque un nivel pisa sus minutos.
    id: "niveles",
    titulo: "Niveles",
    ayuda:
      "Variantes del mismo paso entre las que elige el comercial al cotizar. Evita modelar un paso por zona o por dificultad.",
    estilo: "campos",
    columnas: "minmax(0, 1fr)",
  },
  {
    // Último a propósito: la capa comercial se APOYA sobre el tiempo base
    // (árbol de tiempo, ⑤) — primero se define el base, después si el
    // comercial puede pisarlo.
    id: "ayudas",
    titulo: "El comercial al cotizar",
    ayuda:
      "Define si el tiempo de este paso puede ser modificado por el comercial.",
    estilo: "campos",
    columnas: "minmax(0, 1fr)",
  },
];

const GRUPOS_IDENTIDAD: GrupoEje[] = [
  {
    id: "identidad",
    estilo: "campos",
    // `encabezado: "arriba"` mata la barra vertical del costado (era de los
    // campos "que cuelgan de una bifurcación") pero conserva las columnas:
    // Nombre del paso a la izquierda, Quién lo hace (pills) a la derecha.
    // auto-fit para que apilen prolijo cuando el panel es angosto.
    encabezado: "arriba",
    columnas: "repeat(auto-fit, minmax(240px, 1fr))",
  },
  {
    // El proveedor se renderiza como su PROPIA card (EjeGuiado aparte en el
    // editor), no como un sub-bloque de "Qué paso es". Grupo sin estilo: el
    // panel ocupa todo el ancho, sin barra ni título propio.
    id: "proveedor",
  },
];

const GRUPOS_ACTIVACION: GrupoEje[] = [
  {
    id: "raiz",
    estilo: "campos",
    columnas: "minmax(0, 1fr)",
    encabezado: "arriba",
  },
  {
    id: "regla",
    titulo: "La condición",
    ayuda:
      "El paso corre sólo cuando esto se cumple. Podés combinar medidas del ítem, opciones elegidas y tecnología.",
    estilo: "campos",
    columnas: "minmax(0, 1fr)",
    encabezado: "arriba",
  },
  // Sin título: el control dibuja su propio encabezado, porque el contador
  // ("2 de 7") y el "Ninguno" van en esa misma línea.
  {
    id: "arrastre",
    estilo: "campos",
    columnas: "minmax(0, 1fr)",
    encabezado: "arriba",
  },
];

const GRUPOS_MAQUINA: GrupoEje[] = [
  { id: "cual", estilo: "campos", columnas: "minmax(0, 1fr) minmax(0, 260px)" },
  // La lista de candidatas (M-2) trae su propia UI a todo el ancho: va en un
  // grupo sin `estilo` para que EjeGuiado no le cuelgue la línea vertical de
  // "campos" (esa barra es para los campos sueltos del M-1, no para la lista).
  { id: "lista" },
  {
    id: "ajustes",
    titulo: "Cómo se configura",
    ayuda: "Lo que cambia el consumo y el tiempo de esta máquina.",
    estilo: "campos",
    columnas: "repeat(auto-fit, minmax(200px, 1fr))",
  },
];

/** Los sub-bloques del eje "El trabajo": el acomodado y ajustes de oficio,
 *  y la preparación/limpieza de máquina. */
const GRUPOS_TRABAJO: GrupoEje[] = [
  {
    id: "labores",
    estilo: "campos",
    columnas: "minmax(0, 1fr)",
    encabezado: "arriba",
  },
];

/** Los sub-bloques de la card de UN material (se repite por slot). */
export const GRUPOS_MATERIAL: GrupoEje[] = [
  {
    id: "quien",
    titulo: "Quién elige el material",
    estilo: "campos",
    columnas: "minmax(0, 1fr)",
    encabezado: "arriba",
  },
  {
    // Sin título propio: el picker (materiales.material / .candidatos) trae su
    // encabezado —"Qué material se usa" / "Materiales candidatos"— y repetir
    // "El material" arriba era decir dos veces lo mismo.
    id: "cual",
    estilo: "campos",
    columnas: "minmax(0, 1fr)",
    encabezado: "arriba",
  },
  {
    id: "criterio",
    titulo: "Con qué criterio elige",
    ayuda: "Entre los candidatos, cuál toma cuando hay más de uno que sirve.",
    estilo: "campos",
    columnas: "minmax(0, 1fr)",
    encabezado: "arriba",
  },
  {
    id: "descuento",
    titulo: "Cómo se calcula el consumo",
    ayuda:
      "El consumo se declara de una de tres formas y se lee como una regla: lo mide el paso, una regla propia (N por base), o lo deriva la geometría. Abajo, sobre qué mide y cómo se cobra lo que sobra.",
    estilo: "campos",
    columnas: "minmax(0, 1fr) minmax(0, 260px)",
    encabezado: "arriba",
    alinearItems: "start",
  },
];

/** Los sub-bloques de cada eje, en orden de lectura. */
export const GRUPOS_EJE: Record<EjePaso, GrupoEje[]> = {
  identidad: GRUPOS_IDENTIDAD,
  activacion: GRUPOS_ACTIVACION,
  maquina: GRUPOS_MAQUINA,
  trabajo: GRUPOS_TRABAJO,
  tiempo: GRUPOS_TIEMPO,
  materiales: [],
  cantidad: [],
};

/** Las opciones visibles de un EJE, en orden de declaración. */
export function opcionesDeEje(
  eje: EjePaso,
  ctx: ContextoOpcion,
): OpcionPaso[] {
  return ESQUEMA_PASO.filter((op) => op.eje === eje && op.visible(ctx));
}

/** Las opciones de UN material (todas las de materiales salvo "agregar"),
 *  evaluadas con el slot en el contexto. */
export function opcionesDeMaterial(ctx: ContextoOpcion): OpcionPaso[] {
  return ESQUEMA_PASO.filter(
    (op) =>
      op.seccion === "materiales" &&
      op.clave !== "materiales.agregar" &&
      op.visible(ctx),
  );
}

/** Las opciones visibles de una sección, en orden de declaración. */
export function opcionesDeSeccion(
  seccion: SeccionPaso,
  ctx: ContextoOpcion,
): OpcionPaso[] {
  return ESQUEMA_PASO.filter(
    (op) => op.seccion === seccion && op.visible(ctx),
  );
}

/** Secciones ya migradas al esquema (crece por sub-fase). Con la D
 *  (quien + oficio) el censo quedó cubierto COMPLETO: el detallado ya no
 *  es fuente de ninguna opción. */
export const SECCIONES_MIGRADAS: SeccionPaso[] = [
  "quien",
  "activacion",
  "tiempo",
  "maquina",
  "materiales",
  "oficio",
];
