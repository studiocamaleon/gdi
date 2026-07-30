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
} from "../productos-servicios-api";
import type { FamiliaListItem } from "../productos-servicios";
import type { PendientePasoTipo } from "../pendientes-paso";
import {
  MONTAJE_SOURCE_OPTIONS,
  TALONARIO_MODE_OPTIONS,
  T2_TIME_CALCULATION_MODE_OPTIONS,
  getT2ProductivityUnitSuffix,
  getT2BatchUnitSuffix,
  getDefaultT2ProductivityUnit,
  getDefaultT2TimeCalculationMode,
  getDefaultT2QuantitySource,
  getDefaultMecanismoCantidad,
  getT2QuantitySourceOptions,
  getTiempoManualConfig,
  requiereMecanismoCantidad,
  getModoColorConfig,
  modoColorAplica,
} from "./catalogo-tiempo";
import {
  modoTiempoLabels,
  mecanismoCantidadLabels,
} from "../labels-humanos";

export type SeccionPaso =
  | "quien"
  | "activacion"
  | "tiempo"
  | "maquina"
  | "materiales"
  | "oficio"
  | "ajustes";

/** Otro paso de la misma ruta (para co-ejecución y herencia). */
export interface PasoVecino {
  id: string;
  nombre: string;
}

export interface ContextoOpcion {
  cfg: UpsertConfigPasoPayload;
  familia: FamiliaListItem | undefined;
  paramsPaso: Record<string, unknown>;
  /** Los demás pasos de la ruta (sin el actual), en orden. */
  otrosPasos: PasoVecino[];
  /** Máquinas, centros y materias primas del tenant (sub-fase B). */
  lookups: LookupsConfigPaso;
}

export type PatchOpcion =
  | { tipo: "config"; patch: Partial<UpsertConfigPasoPayload> }
  | { tipo: "params"; patch: Record<string, unknown> };

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
        | "tiempo-comercial"
        | "ritmo-productividad"
        | "ritmo-batch"
        | "herencia-origen"
        | "maquina-m1"
        | "perfil-m1"
        | "candidatas-detallado"
        | "modo-color-detallado";
    };

export interface OpcionPaso {
  /** 'seccion.campo' — la clave del test de paridad. */
  clave: string;
  seccion: SeccionPaso;
  pregunta: string;
  ayuda?: string;
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
  OBLIGATORIO: "Siempre",
  OPCIONAL: "Cuando el comercial lo activa",
  CONDICIONAL: "Según una regla",
  NO_EJECUTAR: "Nunca en esta ruta",
};

function modosActivacionOfrecidos(ctx: ContextoOpcion): string[] {
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

/** ¿El comercial estima el tiempo al cotizar? Suprime las preguntas de
 *  ritmo/tanda/tiempo fijo/calcular-según (corrección del usuario). */
function comercialEstimaTiempo(ctx: ContextoOpcion): boolean {
  return getTiempoManualConfig(ctx.cfg.paramsPasoJson).habilitado === true;
}

function unidadRitmoEfectiva(ctx: ContextoOpcion): string {
  const raw = ctx.paramsPaso.productivityUnit;
  return typeof raw === "string"
    ? raw
    : getDefaultT2ProductivityUnit(ctx.familia?.codigo);
}

function ritmoModoEfectivo(ctx: ContextoOpcion): string {
  const raw = ctx.paramsPaso.timeCalculationMode;
  const valor =
    typeof raw === "string"
      ? raw
      : getDefaultT2TimeCalculationMode(ctx.familia?.codigo);
  return T2_TIME_CALCULATION_MODE_OPTIONS.some((o) => o.value === valor)
    ? valor
    : getDefaultT2TimeCalculationMode(ctx.familia?.codigo);
}

function fuenteRitmoEfectiva(ctx: ContextoOpcion): string {
  const unidad = unidadRitmoEfectiva(ctx);
  const raw = ctx.paramsPaso.productivityQuantitySource;
  const crudo =
    typeof raw === "string"
      ? raw
      : getDefaultT2QuantitySource(ctx.familia?.codigo, unidad);
  const normalizado =
    ctx.familia?.codigo === "montaje_sobre_sustrato" &&
    unidad === "unidades_h" &&
    crudo === "cantidad"
      ? "cantidad_montaje"
      : crudo;
  const opciones = getT2QuantitySourceOptions(unidad, ctx.familia?.codigo);
  return opciones.some((o) => o.value === normalizado)
    ? normalizado
    : getDefaultT2QuantitySource(ctx.familia?.codigo, unidad);
}

function esT2(ctx: ContextoOpcion): boolean {
  return modoTiempoEfectivo(ctx) === "T-2";
}

function mecanismoCantidadEfectivo(ctx: ContextoOpcion): string | null {
  return (
    ctx.cfg.mecanismoCantidad ??
    getDefaultMecanismoCantidad(
      ctx.familia?.codigo,
      ctx.familia?.mecanismosCantidadSoportados ?? [],
    )
  );
}

function labelMecanismoCantidad(
  ctx: ContextoOpcion,
  mecanismo: string,
): string {
  // corte_manual: la herencia se lee como "pliegos impresos" (mismo copy
  // que el detallado congelado).
  if (
    ctx.familia?.codigo === "corte_manual" &&
    mecanismo === "HEREDAR_DEL_OUTPUT_CANONICO"
  ) {
    return "Pliegos impresos del paso anterior";
  }
  return mecanismoCantidadLabels[mecanismo]?.label ?? mecanismo;
}

function maquinaElegida(ctx: ContextoOpcion) {
  return ctx.lookups.maquinas.find((m) => m.id === ctx.cfg.maquinaM1Id);
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

export const ESQUEMA_PASO: OpcionPaso[] = [
  {
    clave: "activacion.nombre",
    seccion: "activacion",
    pregunta: "¿Cómo se llama este paso acá?",
    ayuda:
      "El nombre que ven el cotizador, la OT y el tablero. Vacío = el nombre del paso.",
    visible: () => true,
    resumen: (ctx) =>
      ctx.cfg.nombreVisible?.trim()
        ? `"${ctx.cfg.nombreVisible.trim()}"`
        : `${ctx.familia?.nombre ?? "El nombre del paso"} (heredado)`,
    origenValor: (ctx) =>
      ctx.cfg.nombreVisible?.trim() ? "config" : "default-paso",
    control: {
      tipo: "texto",
      placeholder: (ctx) => ctx.familia?.nombre ?? "Nombre del paso",
      valor: (ctx) => ctx.cfg.nombreVisible ?? "",
      aplicar: (_ctx, v) => ({
        tipo: "config",
        patch: { nombreVisible: v.trim() || null },
      }),
    },
  },
  {
    clave: "activacion.cuando",
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
    control: {
      tipo: "pills",
      opciones: (ctx) =>
        modosActivacionOfrecidos(ctx).map((modo) => ({
          value: modo,
          label: MODO_ACTIVACION_LABELS[modo] ?? modo,
        })),
      valor: (ctx) => ctx.cfg.modoActivacion ?? "OBLIGATORIO",
      aplicar: (_ctx, v) => ({
        tipo: "config",
        patch: { modoActivacion: v },
      }),
    },
  },
  {
    clave: "activacion.regla",
    seccion: "activacion",
    pregunta: "¿Con qué regla se activa?",
    ayuda:
      "La condición del pedido que enciende el paso: medida, opción elegida, tecnología…",
    visible: (ctx) => ctx.cfg.modoActivacion === "CONDICIONAL",
    resumen: (ctx) =>
      ctx.cfg.condicionActivacionJson ? "Regla definida" : "Sin regla todavía",
    origenValor: (ctx) =>
      ctx.cfg.condicionActivacionJson ? "config" : "sin-definir",
    pendiente: "regla_condicional",
    control: { tipo: "componente", id: "regla-condicional" },
  },
  {
    clave: "activacion.coejecucion",
    seccion: "activacion",
    pregunta: "¿Arrastra otros pasos al activarse?",
    ayuda:
      "Al activarse este paso, enciende también los que marques aunque sean opcionales (los ojales arrastran el refuerzo).",
    visible: (ctx) => ctx.otrosPasos.length > 0,
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
        ? `Multiplica por ${activos.join(", ")}`
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
          label: m,
        })),
      activos: (ctx) => ctx.cfg.multiplicadoresActivos ?? [],
      aplicar: (_ctx, valores) => ({
        tipo: "config",
        patch: { multiplicadoresActivos: valores },
      }),
    },
  },

  // ───────────────────────────────────────────────────────────────────
  // Sección TIEMPO Y COSTO (sub-fase B). El tiempo del comercial va
  // PRIMERO y suprime ritmo/tanda/tiempo fijo/calcular-según
  // (corrección del usuario).
  // ───────────────────────────────────────────────────────────────────
  {
    clave: "tiempo.comercial",
    seccion: "tiempo",
    pregunta: "¿El tiempo lo estima el comercial al cotizar?",
    ayuda:
      "Para trabajos donde el tiempo lo sabe el vendedor (diseño, minutos de láser según el RIP). El valor cargado reemplaza el cálculo; setup y limpieza de máquina se suman igual.",
    visible: () => true,
    resumen: (ctx) => {
      if (!comercialEstimaTiempo(ctx)) return "No — se calcula solo";
      const sugerido = numOpcional(
        getTiempoManualConfig(ctx.cfg.paramsPasoJson).defaultMin,
      );
      return sugerido != null
        ? `Sí — lo carga al cotizar (sugerido ${sugerido} min)`
        : "Sí — lo carga al cotizar";
    },
    origenValor: (ctx) =>
      comercialEstimaTiempo(ctx) ? "config" : "default-paso",
    control: { tipo: "componente", id: "tiempo-comercial" },
  },
  {
    clave: "tiempo.modo",
    seccion: "tiempo",
    pregunta: "¿Cómo se mide el tiempo acá?",
    ayuda:
      "La base del cálculo: tiempo fijo, ritmo propio del paso, o la velocidad de la máquina.",
    visible: (ctx) =>
      !comercialEstimaTiempo(ctx) &&
      (ctx.familia?.modosTiempoSoportados?.length ?? 4) > 1,
    resumen: (ctx) => {
      const modo = modoTiempoEfectivo(ctx);
      return modo
        ? (modoTiempoLabels[modo]?.label ?? modo)
        : "Sin definir";
    },
    origenValor: (ctx) => (ctx.cfg.modoTiempo ? "config" : "default-paso"),
    control: {
      tipo: "pills",
      opciones: (ctx) =>
        (ctx.familia?.modosTiempoSoportados ?? ["T-1", "T-2", "T-3", "T-4"]).map(
          (m) => ({
            value: m,
            label: modoTiempoLabels[m]?.label ?? m,
            descripcion: modoTiempoLabels[m]?.descripcion,
          }),
        ),
      valor: (ctx) => modoTiempoEfectivo(ctx) ?? "",
      aplicar: (_ctx, v) => ({
        tipo: "config",
        patch: { modoTiempo: v || null },
      }),
    },
  },
  {
    clave: "tiempo.centro",
    seccion: "tiempo",
    pregunta: "¿En qué centro productivo se realiza este paso?",
    ayuda:
      "El centro define la tarifa horaria del paso. Si el paso usa máquina, el centro lo pone la máquina.",
    visible: (ctx) => !ctx.cfg.maquinaM1Id,
    resumen: (ctx) => {
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
      ctx.cfg.centroCostoId
        ? "config"
        : ctx.familia?.defaults?.centroCostoId
          ? "default-paso"
          : "sin-definir",
    pendiente: "centro",
    control: {
      tipo: "select",
      opciones: (ctx) =>
        ctx.lookups.centrosCosto.map((c) => ({
          value: c.id,
          label: c.nombre,
        })),
      valor: (ctx) => ctx.cfg.centroCostoId ?? "",
      aplicar: (_ctx, v) => ({
        tipo: "config",
        patch: { centroCostoId: v || null },
      }),
    },
  },
  {
    clave: "tiempo.dotacion",
    seccion: "tiempo",
    pregunta: "¿Cuántas personas trabajan?",
    ayuda:
      "Multiplica sólo la mano de obra (2 personas = doble de horas-hombre); la máquina no cambia.",
    visible: () => true,
    resumen: (ctx) => {
      const n = ctx.cfg.dotacionOperarios ?? 1;
      return n === 1 ? "1 persona" : `${n} personas`;
    },
    origenValor: (ctx) =>
      (ctx.cfg.dotacionOperarios ?? 1) !== 1 ? "config" : "default-paso",
    control: {
      tipo: "numero",
      min: 1,
      step: 1,
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
    pregunta: "¿Cómo medís el ritmo?",
    ayuda:
      "Por hora (120 pliegos/h) o por tanda (2 pliegos cada 1 minuto) — lo que sea natural contar en el taller.",
    visible: (ctx) => esT2(ctx) && !comercialEstimaTiempo(ctx),
    resumen: (ctx) => {
      const modo = ritmoModoEfectivo(ctx);
      return (
        T2_TIME_CALCULATION_MODE_OPTIONS.find((o) => o.value === modo)
          ?.label ?? modo
      );
    },
    origenValor: (ctx) =>
      typeof ctx.paramsPaso.timeCalculationMode === "string"
        ? "config"
        : "default-paso",
    control: {
      tipo: "pills",
      opciones: () =>
        T2_TIME_CALCULATION_MODE_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          descripcion: o.description,
        })),
      valor: (ctx) => ritmoModoEfectivo(ctx),
      aplicar: (_ctx, v) => ({
        tipo: "params",
        patch: { timeCalculationMode: v },
      }),
    },
  },
  {
    clave: "tiempo.productividad",
    seccion: "tiempo",
    pregunta: "¿A qué ritmo?",
    ayuda:
      "Cuánto produce una persona por hora en este paso. Si el paso ya declara un ritmo, se usa ese.",
    visible: (ctx) =>
      esT2(ctx) &&
      !comercialEstimaTiempo(ctx) &&
      ritmoModoEfectivo(ctx) !== "batch_time",
    resumen: (ctx) => {
      const valor = numOpcional(ctx.paramsPaso.productivityValue);
      if (valor != null) {
        return `${valor} ${getT2ProductivityUnitSuffix(
          unidadRitmoEfectiva(ctx),
          fuenteRitmoEfectiva(ctx),
        )}`;
      }
      const delPaso = ctx.familia?.defaults?.productividadHora;
      return delPaso != null
        ? `Usando el del paso: ${delPaso}/h`
        : "Sin ritmo cargado";
    },
    origenValor: (ctx) =>
      numOpcional(ctx.paramsPaso.productivityValue) != null
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
    pregunta: "¿Cuánto tarda una tanda y de cuántas?",
    ayuda:
      "Ejemplo: 2 pliegos cada 1 minuto. El motor convierte la tanda a ritmo por hora.",
    visible: (ctx) =>
      esT2(ctx) &&
      !comercialEstimaTiempo(ctx) &&
      ritmoModoEfectivo(ctx) === "batch_time",
    resumen: (ctx) => {
      const tiempo = numOpcional(ctx.paramsPaso.batchTimeMin);
      const tamano = numOpcional(ctx.paramsPaso.batchSize);
      if (tiempo != null && tamano != null) {
        return `${tamano} ${getT2BatchUnitSuffix(
          unidadRitmoEfectiva(ctx),
          fuenteRitmoEfectiva(ctx),
        )} cada ${tiempo} min`;
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
    pregunta: "¿Sobre cuántas piezas trabaja?",
    ayuda:
      "La cantidad que este paso procesa: la del pedido, la que hereda de otro paso, o la que calcula acá (nesting/conversión).",
    visible: (ctx) =>
      requiereMecanismoCantidad(ctx.cfg, ctx.familia) &&
      (ctx.familia?.mecanismosCantidadSoportados?.length ?? 4) > 1,
    resumen: (ctx) => {
      const mecanismo = mecanismoCantidadEfectivo(ctx);
      return mecanismo
        ? labelMecanismoCantidad(ctx, mecanismo)
        : "Sin definir";
    },
    origenValor: (ctx) =>
      ctx.cfg.mecanismoCantidad ? "config" : "default-paso",
    control: {
      tipo: "select",
      opciones: (ctx) =>
        (
          ctx.familia?.mecanismosCantidadSoportados ?? [
            "DIRECT_FROM_JOBCONTEXT",
            "HEREDAR_DEL_OUTPUT_CANONICO",
            "CALCULADO_POR_PASO",
            "CONVERSION",
          ]
        ).map((m) => ({
          value: m,
          label: labelMecanismoCantidad(ctx, m),
          descripcion: mecanismoCantidadLabels[m]?.descripcion,
        })),
      valor: (ctx) => mecanismoCantidadEfectivo(ctx) ?? "",
      aplicar: (_ctx, v) => ({
        tipo: "config",
        patch: { mecanismoCantidad: v || null },
      }),
    },
  },
  {
    clave: "tiempo.herencia",
    seccion: "tiempo",
    pregunta: "¿De qué paso hereda?",
    ayuda:
      "Señalá el paso origen y qué número usa (unidades, pliegos, m²…). Sin origen, hereda del paso anterior que publica cantidad.",
    visible: (ctx) =>
      requiereMecanismoCantidad(ctx.cfg, ctx.familia) &&
      mecanismoCantidadEfectivo(ctx) === "HEREDAR_DEL_OUTPUT_CANONICO",
    resumen: (ctx) => {
      const origen = (ctx.cfg.mecanismoCantidadConfigJson ?? {}) as {
        origen?: { rutaPasoId?: string; capacidad?: string };
      };
      const rutaPasoId = origen.origen?.rutaPasoId;
      if (!rutaPasoId) return "Del paso anterior (automático)";
      const nombre =
        ctx.otrosPasos.find((p) => p.id === rutaPasoId)?.nombre ??
        "un paso de la ruta";
      const capacidad = origen.origen?.capacidad;
      return capacidad
        ? `Hereda de ${nombre} (${capacidad.replaceAll("_", " ")})`
        : `Hereda de ${nombre}`;
    },
    origenValor: (ctx) => {
      const origen = (ctx.cfg.mecanismoCantidadConfigJson ?? {}) as {
        origen?: { rutaPasoId?: string };
      };
      return origen.origen?.rutaPasoId ? "config" : "default-paso";
    },
    pendiente: "herencia_origen",
    control: { tipo: "componente", id: "herencia-origen" },
  },
  {
    clave: "tiempo.calcular_segun",
    seccion: "tiempo",
    pregunta: "¿El ritmo cuenta piezas, m² o metros?",
    ayuda:
      "Qué magnitud cronometra la productividad: cantidad, área, metros lineales o perímetro.",
    visible: (ctx) => esT2(ctx) && !comercialEstimaTiempo(ctx),
    resumen: (ctx) => {
      const fuente = fuenteRitmoEfectiva(ctx);
      return (
        getT2QuantitySourceOptions(
          unidadRitmoEfectiva(ctx),
          ctx.familia?.codigo,
        ).find((o) => o.value === fuente)?.label ?? fuente
      );
    },
    origenValor: (ctx) =>
      typeof ctx.paramsPaso.productivityQuantitySource === "string"
        ? "config"
        : "default-paso",
    control: {
      tipo: "select",
      opciones: (ctx) =>
        getT2QuantitySourceOptions(
          unidadRitmoEfectiva(ctx),
          ctx.familia?.codigo,
        ).map((o) => ({
          value: o.value,
          label: o.label,
          descripcion: o.description,
        })),
      valor: (ctx) => fuenteRitmoEfectiva(ctx),
      aplicar: (_ctx, v) => ({
        tipo: "params",
        patch: { productivityQuantitySource: v },
      }),
    },
  },
  {
    clave: "tiempo.piezas_montar",
    seccion: "tiempo",
    pregunta: "¿Qué monta: piezas del pedido o pliegos impresos?",
    ayuda:
      "Define qué medidas usa el paso para acomodar sobre el material de montaje.",
    visible: (ctx) => ctx.familia?.codigo === "montaje_sobre_sustrato",
    resumen: (ctx) => {
      const valor = String(
        ctx.paramsPaso.fuentePiezasMontaje ?? "piezas_jobcontext",
      );
      return (
        MONTAJE_SOURCE_OPTIONS.find((o) => o.value === valor)?.label ?? valor
      );
    },
    origenValor: (ctx) =>
      typeof ctx.paramsPaso.fuentePiezasMontaje === "string"
        ? "config"
        : "default-paso",
    control: {
      tipo: "pills",
      opciones: () =>
        MONTAJE_SOURCE_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          descripcion: o.description,
        })),
      valor: (ctx) =>
        String(ctx.paramsPaso.fuentePiezasMontaje ?? "piezas_jobcontext"),
      aplicar: (_ctx, v) => ({
        tipo: "params",
        patch: { fuentePiezasMontaje: v || "piezas_jobcontext" },
      }),
    },
  },
  {
    clave: "tiempo.talonario",
    seccion: "tiempo",
    pregunta: "¿Es un talonario? ¿Cómo se apila?",
    ayuda:
      "Agrupa talonarios de a N poses por pliego y define qué hacer con los sueltos: compartir pliego (menos papel) o poses vacías (listo para abrochar).",
    visible: (ctx) => ctx.familia?.codigo === "pre_prensa",
    resumen: (ctx) => {
      const valor = String(ctx.paramsPaso.modoTalonarioIncompleto ?? "off");
      return (
        TALONARIO_MODE_OPTIONS.find((o) => o.value === valor)?.label ?? valor
      );
    },
    origenValor: (ctx) =>
      typeof ctx.paramsPaso.modoTalonarioIncompleto === "string"
        ? "config"
        : "default-paso",
    control: {
      tipo: "pills",
      opciones: () =>
        TALONARIO_MODE_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          descripcion: o.description,
        })),
      valor: (ctx) => String(ctx.paramsPaso.modoTalonarioIncompleto ?? "off"),
      aplicar: (_ctx, v) => ({
        tipo: "params",
        patch: { modoTalonarioIncompleto: v === "off" ? null : v },
      }),
    },
  },
  {
    clave: "tiempo.tiempo_fijo",
    seccion: "tiempo",
    pregunta: "¿Cuántos minutos lleva?",
    ayuda:
      "El tiempo fijo del paso, independiente de la cantidad. Si el paso ya declara uno, se usa ese.",
    visible: (ctx) =>
      modoTiempoEfectivo(ctx) === "T-1" &&
      !ctx.cfg.maquinaM1Id &&
      !comercialEstimaTiempo(ctx),
    resumen: (ctx) => {
      if (ctx.cfg.tiempoFijoOverrideMin != null) {
        return `${ctx.cfg.tiempoFijoOverrideMin} min`;
      }
      const delPaso = ctx.familia?.defaults?.tiempoFijoMin;
      return delPaso != null
        ? `Usando el del paso: ${delPaso} min`
        : "Sin definir";
    },
    origenValor: (ctx) =>
      ctx.cfg.tiempoFijoOverrideMin != null
        ? "config"
        : ctx.familia?.defaults?.tiempoFijoMin != null
          ? "default-paso"
          : "sin-definir",
    pendiente: "tiempo_fijo",
    control: {
      tipo: "numero",
      min: 0,
      step: 0.5,
      sufijo: () => "min",
      placeholder: (ctx) => {
        const delPaso = ctx.familia?.defaults?.tiempoFijoMin;
        return delPaso != null ? `Usando el del paso: ${delPaso}` : "Ej. 15";
      },
      valor: (ctx) => ctx.cfg.tiempoFijoOverrideMin ?? null,
      aplicar: (_ctx, v) => ({
        tipo: "config",
        patch: { tiempoFijoOverrideMin: v },
      }),
    },
  },

  // ───────────────────────────────────────────────────────────────────
  // Sección MÁQUINA Y PERFIL (sub-fase B). Candidatas y modo de color
  // usan LA UI del detallado extraída como componentes (corrección del
  // usuario: las cards v2 de botones se descartan).
  // ───────────────────────────────────────────────────────────────────
  {
    clave: "maquina.maquina",
    seccion: "maquina",
    pregunta: "¿En qué máquina se hace?",
    ayuda:
      "La máquina fija de este paso: pone su centro de costo y, si el tiempo es por máquina, su velocidad.",
    visible: (ctx) =>
      (ctx.familia?.relacionMaquinaSoportada ?? []).includes("M-1"),
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
    seccion: "maquina",
    pregunta: "¿Con qué perfil?",
    ayuda:
      "El perfil operativo define velocidad y modos de color de la máquina para este paso.",
    visible: (ctx) => Boolean(ctx.cfg.maquinaM1Id),
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
    seccion: "maquina",
    pregunta: "¿Entre qué máquinas elige el comercial?",
    ayuda:
      "Las máquinas candidatas del paso: el comercial (o el sistema) elige una al cotizar. Por candidata podés fijar perfil default y modos de color.",
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
    clave: "maquina.modo_color",
    seccion: "maquina",
    pregunta: "¿Se imprime a color o en negro?",
    ayuda:
      "Limita los modos de color que se pueden cotizar en este producto. Con candidatas, los modos se definen por máquina dentro de la pregunta anterior.",
    visible: (ctx) =>
      modoColorAplica(ctx.familia?.codigo, ctx.cfg) &&
      ((ctx.familia?.relacionMaquinaSoportada ?? []).includes("M-2")
        ? (ctx.cfg.maquinasCandidatas?.length ?? 0) === 0
        : true),
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
];

/** Las opciones visibles de una sección, en orden de declaración. */
export function opcionesDeSeccion(
  seccion: SeccionPaso,
  ctx: ContextoOpcion,
): OpcionPaso[] {
  return ESQUEMA_PASO.filter(
    (op) => op.seccion === seccion && op.visible(ctx),
  );
}

/** Secciones ya migradas al esquema (crece por sub-fase). */
export const SECCIONES_MIGRADAS: SeccionPaso[] = [
  "activacion",
  "tiempo",
  "maquina",
];
