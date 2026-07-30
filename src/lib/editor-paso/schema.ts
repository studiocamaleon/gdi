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
import type { UpsertConfigPasoPayload } from "../productos-servicios-api";
import type { FamiliaListItem } from "../productos-servicios";
import type { PendientePasoTipo } from "../pendientes-paso";

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
      /** Control rico registrado en el renderer (RuleBuilder, buscador de
       *  material, candidatas del detallado, panel tercerizado…). */
      tipo: "componente";
      id: "regla-condicional" | "co-ejecucion";
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
export const SECCIONES_MIGRADAS: SeccionPaso[] = ["activacion"];
