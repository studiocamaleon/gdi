/**
 * Seguimiento público de OT (cliente) — contrato + copy amigable.
 *
 * Espejo de la proyección de `GET /ordenes-trabajo/track/:token`
 * (apps/api/src/ordenes-trabajo/ordenes-trabajo.service.ts → trackingPublico).
 * Ver docs/tracking-publico-diseno.md
 */

import { apiRequest } from "@/lib/api";

export type TrackingPasoEstado =
  | "pendiente"
  | "en_curso"
  | "pausado"
  | "hecho"
  | "bloqueado";

export type TrackingPaso = {
  indice: number;
  /** Nombre técnico del paso (línea "tec" del diseño). */
  nombre: string;
  familiaCodigo: string;
  estado: TrackingPasoEstado;
  completadoEl: string | null;
  duracionEstimadaMin: number | null;
};

export type TrackingItem = {
  id: string;
  nombre: string;
  specs: Array<{ etiqueta: string; valor: string }>;
  progresoPct: number;
  pasoActual: string | null;
  estacionActual: string | null;
  pasos: TrackingPaso[];
};

export type TrackingPublico = {
  numero: string;
  estado: string;
  creadaEl: string;
  fechaEntrega: string | null;
  progresoPct: number;
  imprenta: { nombre: string; iniciales: string };
  cliente: { primerNombre: string; iniciales: string };
  vendedor: { nombre: string; iniciales: string; telefono: string | null } | null;
  items: TrackingItem[];
  actividad: Array<{ fecha: string; texto: string }>;
};

export async function getTrackingPublico(token: string): Promise<TrackingPublico> {
  // Ruta pública: sin sesión (auth: false → no adjunta token de staff).
  return apiRequest<TrackingPublico>(
    `/ordenes-trabajo/track/${encodeURIComponent(token)}`,
    undefined,
    { auth: false },
  );
}

// ── Copy amigable por familia de paso ────────────────────────────────────
// El paso real sólo trae el nombre técnico; acá derivamos un título claro y
// una descripción cliente-facing a partir de la familia del paso.

type CopyPaso = { simple: string; desc: string };

const COPY_FAMILIA: Record<string, CopyPaso> = {
  diseno_grafico: {
    simple: "Diseñamos tu pieza",
    desc: "Nuestro equipo prepara el arte de tu pedido.",
  },
  pre_prensa: {
    simple: "Preparamos los archivos",
    desc: "Revisamos y acomodamos tu archivo para que entre a producción sin sorpresas.",
  },
  proof: {
    simple: "Prueba de color",
    desc: "Imprimimos una prueba para verificar que los colores coincidan con tu archivo.",
  },
  impresion_por_hoja: {
    simple: "Imprimiendo tu pedido",
    desc: "Estamos imprimiendo tu trabajo.",
  },
  impresion_por_area: {
    simple: "Imprimiendo tu pedido",
    desc: "Estamos imprimiendo en gran formato.",
  },
  impresion_por_pieza: {
    simple: "Imprimiendo tu pedido",
    desc: "Estamos imprimiendo pieza por pieza.",
  },
  aplicacion_transfer: {
    simple: "Estampado / transfer",
    desc: "Aplicamos el diseño sobre el material.",
  },
  grabado_laser: { simple: "Grabado láser", desc: "Grabamos tu diseño con láser." },
  corte_guillotina: {
    simple: "Cortamos a medida",
    desc: "Refilamos tu pedido a la medida final.",
  },
  plotter_corte: {
    simple: "Corte de vinilo",
    desc: "Cortamos el vinilo con el plotter de corte.",
  },
  corte_laser: { simple: "Corte láser", desc: "Cortamos las piezas con láser." },
  troquelado_digital: {
    simple: "Troquelado",
    desc: "Damos la forma final a cada pieza.",
  },
  cnc: { simple: "Corte CNC", desc: "Cortamos el material en la router CNC." },
  plegado: { simple: "Plegado", desc: "Plegamos tu trabajo en línea." },
  laminado: {
    simple: "Aplicamos el laminado",
    desc: "Pasamos tu pedido por la laminadora para la terminación.",
  },
  barniz: { simple: "Barnizado", desc: "Aplicamos el barniz de terminación." },
  encuadernado_anillado: {
    simple: "Encuadernado",
    desc: "Anillamos / encuadernamos tu trabajo.",
  },
  armado_cajas: { simple: "Armado", desc: "Armamos las piezas de tu pedido." },
  soldadura: { simple: "Armado estructural", desc: "Soldamos la estructura." },
  montaje_sobre_sustrato: {
    simple: "Montaje",
    desc: "Montamos el material sobre su sustrato.",
  },
  embalaje: {
    simple: "Control final y empaque",
    desc: "Verificamos todo y embalamos tu pedido.",
  },
  control_calidad: {
    simple: "Control de calidad",
    desc: "Revisamos color, corte y cantidad antes de entregar.",
  },
  envio: { simple: "Preparando el envío", desc: "Coordinamos la entrega de tu pedido." },
  instalacion_in_situ: {
    simple: "Instalación",
    desc: "Instalamos tu trabajo en el lugar.",
  },
  toma_medidas: { simple: "Toma de medidas", desc: "Relevamos las medidas del trabajo." },
  trabajo_manual: {
    simple: "Trabajo manual",
    desc: "Realizamos tareas manuales sobre tu pedido.",
  },
};

const COPY_DEFAULT: CopyPaso = {
  simple: "Paso de producción",
  desc: "Avanzamos en la producción de tu pedido.",
};

export function copyDePaso(familiaCodigo: string): CopyPaso {
  return COPY_FAMILIA[familiaCodigo] ?? COPY_DEFAULT;
}

// ── Derivados de presentación ────────────────────────────────────────────

/** "en producción" / "listo para retirar" / etc. para el saludo del hero. */
export function estadoNarrativo(estado: string): string {
  switch (estado) {
    case "pendiente":
      return "en camino a producción";
    case "produccion":
      return "en producción";
    case "finalizada":
      return "listo para retirar";
    case "entregada":
      return "entregado";
    default:
      return "en curso";
  }
}

export function estadoPill(estado: string): { label: string; tone: "ok" | "warm" } {
  if (estado === "finalizada" || estado === "entregada") {
    return { label: estado === "entregada" ? "Entregado" : "Listo", tone: "ok" };
  }
  return { label: "En producción", tone: "warm" };
}

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function fechaLocal(iso: string): Date | null {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** "Mié 21 May" a partir de una fecha ISO (date-only). */
export function fechaLarga(iso: string | null): { dia: string; num: string; mes: string } | null {
  if (!iso) return null;
  const f = fechaLocal(iso);
  if (!f) return null;
  return {
    dia: `${DIAS[f.getDay()]} ${f.getDate()} ${MESES[f.getMonth()]}`,
    num: String(f.getDate()),
    mes: MESES[f.getMonth()],
  };
}

/** "hace 3 h" / "hace 2 d" / "recién" a partir de un ISO datetime. */
export function haceCuanto(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} d`;
}

/** "45 min" / "2 h 30 m" / "12 h" a partir de minutos estimados. */
export function duracionTexto(min: number | null): string | null {
  if (min == null || min <= 0) return null;
  if (min < 60) return `${Math.round(min)} min`;
  const horas = Math.floor(min / 60);
  const resto = Math.round(min % 60);
  return resto > 0 ? `${horas} h ${resto} m` : `${horas} h`;
}
