/**
 * E.3.1 — El motor de preguntas pendientes del Wizard de Ruta
 * (docs/wizard-ruta-diseno.md §4).
 *
 * Dado un paso de una ruta (su familia + defaults declarados + lo que el
 * producto ya configuró), computa QUÉ FALTA para que ese paso cotice
 * bien — y nada más. Es la misma información que las validaciones del
 * editor, pero usada ANTES como guion de preguntas en vez de DESPUÉS
 * como protesta. El corolario de todo el proyecto: un paso bien
 * declarado devuelve lista vacía.
 *
 * Función PURA: la consumen el banner humano del editor (E.3.1), las
 * question-cards del modo guiado (E.3.2) y la FASE A (E.3.4).
 */
import type { UpsertConfigPasoPayload } from "./productos-servicios-api";
import type { DefaultsFamiliaPaso } from "./productos-servicios";

export type PendientePasoTipo =
  | "maquina"
  | "perfil"
  | "candidatas"
  | "material_slot"
  | "grilla_tercerizado"
  | "proveedor"
  | "herencia_origen"
  | "ritmo"
  | "tiempo_fijo"
  | "centro"
  | "regla_condicional";

export interface PendientePaso {
  tipo: PendientePasoTipo;
  /** Etiqueta corta para el banner: "máquina", "papel del slot". */
  etiqueta: string;
  /** Por qué se pregunta (card/tooltip), en idioma de taller. */
  motivo: string;
  /** true = sin esto la cotización sale mal o directamente no sale.
   *  false = hay un fallback razonable, pero conviene decidirlo. */
  bloqueante: boolean;
  /** Para material_slot: qué slot es. */
  slotCodigo?: string;
}

/** La cara de la familia que el motor necesita (subset estructural de
 *  FamiliaListItem — así el wizard y el editor pasan lo que ya tienen). */
export interface FamiliaParaPendientes {
  codigo: string;
  relacionMaquinaSoportada: string[];
  slotsRequeridos: Array<{
    codigo: string;
    nombre: string;
    requerido: boolean;
    tipo?: string;
  }>;
  defaults?: DefaultsFamiliaPaso | null;
}

function esConsumibleMaquina(slot: { tipo?: string }): boolean {
  return slot.tipo === "CONSUMIBLE_MAQUINA";
}

function num(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asRecord(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

export function pendientesDePaso(
  cfg: UpsertConfigPasoPayload,
  familia: FamiliaParaPendientes | undefined,
): PendientePaso[] {
  const pendientes: PendientePaso[] = [];
  if (!familia) return pendientes;

  // "No ejecutar" apaga el paso para esta ruta: no hay nada que preguntar.
  if (cfg.modoActivacion === "NO_EJECUTAR") return pendientes;

  // ── Regla condicional: aplica igual para interno y tercerizado ──────
  if (cfg.modoActivacion === "CONDICIONAL" && !cfg.condicionActivacionJson) {
    pendientes.push({
      tipo: "regla_condicional",
      etiqueta: "la regla de activación",
      motivo:
        "El paso es condicional pero no dice cuándo se activa: definí la regla (medida, opción del pedido…).",
      bloqueante: true,
    });
  }

  // ── Rama TERCERIZADO: sólo importan proveedor y precios ─────────────
  if (cfg.tercerizado) {
    if (!cfg.proveedorId) {
      pendientes.push({
        tipo: "proveedor",
        etiqueta: "el proveedor",
        motivo:
          "El paso se compra hecho pero no dice a quién: la OT de compra necesita un proveedor.",
        bloqueante: true,
      });
    }
    const fuente = cfg.fuenteCostoTercerizado ?? "matriz";
    const configTerc = asRecord(cfg.tercerizadoConfigJson);
    const sinGrilla =
      fuente === "matriz"
        ? (cfg.tercerizadoEntradas?.length ?? 0) === 0
        : fuente === "tarifa_magnitud"
          ? num(configTerc.tarifa) === null
          : num(configTerc.costoFijo ?? configTerc.monto) === null;
    if (sinGrilla) {
      pendientes.push({
        tipo: "grilla_tercerizado",
        etiqueta: "los precios del proveedor",
        motivo:
          fuente === "matriz"
            ? "La grilla de precios está vacía: sin filas, el paso cotiza $0."
            : fuente === "tarifa_magnitud"
              ? "Falta la tarifa por cantidad o medida: sin ella, el paso cotiza $0."
              : "Falta el precio fijo del trabajo: sin él, el paso cotiza $0.",
        bloqueante: true,
      });
    }
    return pendientes;
  }

  // ── Rama INTERNA ────────────────────────────────────────────────────
  const soportaManual = familia.relacionMaquinaSoportada.includes("M-0");
  const soportaMaquina = familia.relacionMaquinaSoportada.includes("M-1");
  const soportaEleccion = familia.relacionMaquinaSoportada.includes("M-2");
  const defaults = familia.defaults ?? null;
  const params = asRecord(cfg.paramsPasoJson);

  // Máquina: obligatoria si el tiempo sale del perfil (T-3) o si la
  // familia no sabe trabajar a mano.
  const requiereMaquina =
    cfg.modoTiempo === "T-3" || (soportaMaquina && !soportaManual);
  const tieneCandidatas = (cfg.maquinasCandidatas?.length ?? 0) > 0;
  if (requiereMaquina && !cfg.maquinaM1Id && !tieneCandidatas) {
    pendientes.push(
      soportaEleccion
        ? {
            tipo: "candidatas",
            etiqueta: "las máquinas candidatas",
            motivo:
              "El comercial elige la máquina al cotizar, pero falta declarar entre cuáles.",
            bloqueante: true,
          }
        : {
            tipo: "maquina",
            etiqueta: "la máquina",
            motivo:
              "Este paso se hace a máquina y todavía no dice en cuál: la tarifa y el tiempo salen de ella.",
            bloqueante: true,
          },
    );
  }
  if (cfg.maquinaM1Id && !cfg.perfilM1Id) {
    pendientes.push({
      tipo: "perfil",
      etiqueta: "el perfil de la máquina",
      motivo:
        "La máquina está elegida pero sin perfil: setup, velocidad y modos de color salen de ahí.",
      bloqueante: false,
    });
  }

  // Materiales: cada slot requerido (no consumible de máquina) necesita
  // saber de dónde sale su material.
  const configurados = new Set(
    (cfg.slotsMateriales ?? []).map((s) => s.slotCodigo),
  );
  for (const slot of familia.slotsRequeridos) {
    if (esConsumibleMaquina(slot)) continue;
    if (slot.requerido && !configurados.has(slot.codigo)) {
      pendientes.push({
        tipo: "material_slot",
        etiqueta: slot.nombre.toLowerCase(),
        motivo: `El paso necesita ${slot.nombre.toLowerCase()} y todavía no dice cuál se usa ni de dónde sale.`,
        bloqueante: true,
        slotCodigo: slot.codigo,
      });
    }
  }
  for (const slot of cfg.slotsMateriales ?? []) {
    const decl = familia.slotsRequeridos.find(
      (d) => d.codigo === slot.slotCodigo,
    );
    if (decl && esConsumibleMaquina(decl)) continue;
    const sinVariante =
      slot.modoSeleccion === "HARDCODED" && !slot.materialVarianteId;
    const sinCandidatos =
      (slot.modoSeleccion === "COMERCIAL_ELIGE" ||
        slot.modoSeleccion === "MOTOR_ELIGE_AUTO") &&
      (slot.candidatos?.length ?? 0) === 0;
    if (sinVariante || sinCandidatos) {
      pendientes.push({
        tipo: "material_slot",
        etiqueta: (decl?.nombre ?? slot.slotCodigo).toLowerCase(),
        motivo: sinVariante
          ? "El slot está en material fijo pero sin variante elegida."
          : "El slot deja elegir, pero no hay candidatos entre los que elegir.",
        bloqueante: true,
        slotCodigo: slot.slotCodigo,
      });
    }
  }

  // Tiempo: T-2 necesita un ritmo de ALGÚN lado (config → default).
  if (cfg.modoTiempo === "T-2") {
    const modoCalculo =
      typeof params.timeCalculationMode === "string"
        ? params.timeCalculationMode
        : "productivity";
    const tiempoManual = asRecord(params.tiempoManual).habilitado === true;
    const cubierto =
      tiempoManual ||
      num(params.horasEstimadas) !== null ||
      (typeof params.campoHorasJobContext === "string" &&
        params.campoHorasJobContext.trim() !== "") ||
      (modoCalculo === "batch_time"
        ? num(params.batchTimeMin) !== null && num(params.batchSize) !== null
        : num(params.productivityValue) !== null) ||
      (defaults?.productividadHora ?? 0) > 0;
    if (!cubierto) {
      pendientes.push({
        tipo: "ritmo",
        etiqueta: "el ritmo de trabajo",
        motivo:
          "Sin ritmo (ni acá ni declarado en el paso), el tiempo da 0 y el paso cotiza $0.",
        bloqueante: true,
      });
    }
  }

  // T-1 sin máquina: la duración fija tiene que venir de algún lado.
  if (cfg.modoTiempo === "T-1" && !cfg.maquinaM1Id) {
    const cubierto =
      num(cfg.tiempoFijoOverrideMin) !== null ||
      (defaults?.tiempoFijoMin ?? 0) > 0;
    if (!cubierto) {
      pendientes.push({
        tipo: "tiempo_fijo",
        etiqueta: "la duración del paso",
        motivo:
          "El paso es de tiempo fijo pero no dice cuántos minutos lleva (ni acá ni declarado en el paso).",
        bloqueante: true,
      });
    }
  }

  // Centro: sin máquina, la tarifa horaria sale del centro (config → default).
  if (
    !cfg.maquinaM1Id &&
    !tieneCandidatas &&
    cfg.modoTiempo &&
    cfg.modoTiempo !== "T-4" &&
    !cfg.centroCostoId &&
    !defaults?.centroCostoId
  ) {
    pendientes.push({
      tipo: "centro",
      etiqueta: "quién lo cobra",
      motivo:
        "Sin centro de costo (ni acá ni declarado en el paso), no hay tarifa horaria y el tiempo cotiza $0.",
      bloqueante: true,
    });
  }

  // Herencia: elegida pero sin señalar el paso origen. Hay fallback
  // (la regla histórica), así que no bloquea — pero decidirlo evita
  // sorpresas (el bug del bordado que hereda pliegos).
  if (cfg.mecanismoCantidad === "HEREDAR_DEL_OUTPUT_CANONICO") {
    const origen = asRecord(cfg.mecanismoCantidadConfigJson).origen;
    if (!origen || typeof (origen as { rutaPasoId?: unknown }).rutaPasoId !== "string") {
      pendientes.push({
        tipo: "herencia_origen",
        etiqueta: "de qué paso hereda",
        motivo:
          "Hereda la cantidad 'del paso anterior' por regla automática: señalá el paso origen para que no haya ambigüedad.",
        bloqueante: false,
      });
    }
  }

  return pendientes;
}

/** "Faltan: la máquina y el papel" / "Falta: el ritmo" — para el banner. */
export function resumenPendientes(pendientes: PendientePaso[]): string | null {
  const bloqueantes = pendientes.filter((p) => p.bloqueante);
  const lista = bloqueantes.length > 0 ? bloqueantes : pendientes;
  if (lista.length === 0) return null;
  const etiquetas = [...new Set(lista.map((p) => p.etiqueta))];
  const cuerpo =
    etiquetas.length === 1
      ? etiquetas[0]
      : `${etiquetas.slice(0, -1).join(", ")} y ${etiquetas[etiquetas.length - 1]}`;
  return `${lista.length === 1 ? "Falta" : "Faltan"}: ${cuerpo}`;
}
