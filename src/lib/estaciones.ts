/**
 * Estaciones de producción — contrato de datos.
 *
 * La estación agrupa FAMILIAS de pasos (ruteo del tablero: una familia vive
 * en una sola estación), máquinas (una máquina vive en una sola estación) y
 * empleados habilitados (N:M), con capacidad de trabajo concurrente.
 * Ver docs/estaciones-diseno.md
 */

/**
 * Etapas productivas FIJAS del taller: se elige una por estación y ordenan
 * las vistas operativas (panel y tablero). Espejo del backend
 * (ETAPAS_ESTACION en upsert-estacion.dto.ts).
 */
export const ETAPAS_ESTACION: Array<{
  key: string;
  nm: string;
  desc: string;
  order: number;
  color: string;
}> = [
  { key: "preprensa", nm: "Pre-prensa", desc: "Diseño, verificación de archivos, CTP y planchas", order: 1, color: "#1d4ed8" },
  { key: "impresion", nm: "Impresión", desc: "Offset, digital, ploteo y gran formato", order: 2, color: "#14141a" },
  { key: "postprensa", nm: "Post-prensa", desc: "Secado, estabilización, refilado preliminar", order: 3, color: "#92929b" },
  { key: "terminaciones", nm: "Terminaciones", desc: "Laminado, troquel, corte, plegado, encuadernación, armado", order: 4, color: "#c08025" },
  { key: "instalacion", nm: "Instalación", desc: "Instalación en obra, montaje en sitio", order: 5, color: "#16794a" },
  { key: "qa-despacho", nm: "QA & Despacho", desc: "Control de calidad, empaque, retiro y flete", order: 6, color: "#c2410c" },
];

export function etapaDeEstacion(key: string) {
  return ETAPAS_ESTACION.find((entry) => entry.key === key) ?? ETAPAS_ESTACION[0];
}

// ── Calendario semanal operativo ─────────────────────────────────────────
// Espejo del backend (apps/api/src/produccion/calendario.ts). Una franja
// desde/hasta ("HH:MM") por día; null = no se trabaja ese día.
// Ver docs/capacidad-estaciones-diseno.md D2.

export const DIAS_SEMANA = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number];

export type CalendarioDia = { desde: string; hasta: string };

export type CalendarioEstacion = {
  dias: Record<DiaSemana, CalendarioDia | null>;
};

export const DIAS_SEMANA_LABEL: Record<DiaSemana, string> = {
  lun: "L",
  mar: "Ma",
  mie: "Mi",
  jue: "J",
  vie: "V",
  sab: "S",
  dom: "D",
};

/** Default del form de creación: L–V 9:00–18:00 (el caso común en dos clicks). */
export function calendarioDefault(): CalendarioEstacion {
  const franja = { desde: "09:00", hasta: "18:00" };
  return {
    dias: { lun: { ...franja }, mar: { ...franja }, mie: { ...franja }, jue: { ...franja }, vie: { ...franja }, sab: null, dom: null },
  };
}

/** "08:00" → "8:00" (sin cero inicial, para labels compactos). */
function horaCorta(hora: string) {
  return hora.startsWith("0") ? hora.slice(1) : hora;
}

/**
 * Label compacto del calendario: agrupa días consecutivos con la misma
 * franja — "L–V 8:00–18:00 · S 9:00–13:00". null si no hay calendario.
 */
export function etiquetaCalendario(calendario: CalendarioEstacion | null | undefined): string | null {
  if (!calendario) return null;
  const grupos: Array<{ desdeDia: DiaSemana; hastaDia: DiaSemana; franja: CalendarioDia }> = [];
  for (const dia of DIAS_SEMANA) {
    const franja = calendario.dias[dia];
    if (!franja) continue;
    const previo = grupos[grupos.length - 1];
    const contiguo =
      previo &&
      DIAS_SEMANA.indexOf(dia) === DIAS_SEMANA.indexOf(previo.hastaDia) + 1 &&
      previo.franja.desde === franja.desde &&
      previo.franja.hasta === franja.hasta;
    if (contiguo) previo.hastaDia = dia;
    else grupos.push({ desdeDia: dia, hastaDia: dia, franja });
  }
  if (grupos.length === 0) return null;
  return grupos
    .map((grupo) => {
      const dias =
        grupo.desdeDia === grupo.hastaDia
          ? DIAS_SEMANA_LABEL[grupo.desdeDia]
          : `${DIAS_SEMANA_LABEL[grupo.desdeDia]}–${DIAS_SEMANA_LABEL[grupo.hastaDia]}`;
      return `${dias} ${horaCorta(grupo.franja.desde)}–${horaCorta(grupo.franja.hasta)}`;
    })
    .join(" · ");
}

/** Índice Date.getDay() (0 = domingo) → clave del calendario. */
const JS_DIA: DiaSemana[] = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

/** "HH:MM" → minutos desde medianoche. */
function minutosDesdeMedianoche(hora: string) {
  const [hh, mm] = hora.split(":").map(Number);
  return hh * 60 + mm;
}

/** Duración de una franja en minutos. */
function minutosDeFranja(franja: CalendarioDia) {
  return minutosDesdeMedianoche(franja.hasta) - minutosDesdeMedianoche(franja.desde);
}

/**
 * Capacidad del día más largo del calendario, en minutos-persona (franja ×
 * puestos). Escala la LoadBar del tablero: "un día lleno" = barra llena.
 */
export function capacidadDiariaMaxMin(
  calendario: CalendarioEstacion | null | undefined,
  puestos: number,
): number | null {
  if (!calendario) return null;
  let max = 0;
  for (const dia of DIAS_SEMANA) {
    const franja = calendario.dias[dia];
    if (franja) max = Math.max(max, minutosDeFranja(franja));
  }
  return max > 0 ? max * Math.max(1, puestos) : null;
}

/** "YYYY-MM-DD" local (clave de los días no laborables). */
export function claveFechaLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * Proyección de la cola en JORNADAS operativas, caminando el calendario
 * desde `desde` (D7 de capacidad-estaciones-diseno.md): hoy aporta sólo lo
 * que queda de su franja, los días inactivos y los NO LABORABLES (feriados,
 * cierres — D8) no aportan, y cada día suma su fracción consumida contra la
 * capacidad completa de ese día. Los puestos multiplican. null = sin
 * calendario o cola que no se vacía en el horizonte.
 */
export function proyectarColaDias(
  calendario: CalendarioEstacion | null | undefined,
  colaMin: number,
  puestos: number,
  desde: Date = new Date(),
  noLaborables: Set<string> = new Set(),
): number | null {
  if (!calendario) return null;
  if (colaMin <= 0) return 0;
  const puestosEfectivos = Math.max(1, puestos);
  let restante = colaMin;
  let dias = 0;
  for (let i = 0; i < 365; i += 1) {
    const fecha = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i);
    if (noLaborables.has(claveFechaLocal(fecha))) continue;
    const franja = calendario.dias[JS_DIA[fecha.getDay()]];
    if (!franja) continue;
    const capacidadDia = minutosDeFranja(franja) * puestosEfectivos;
    let disponibles = capacidadDia;
    if (i === 0) {
      const ahora = desde.getHours() * 60 + desde.getMinutes();
      const arranque = Math.max(ahora, minutosDesdeMedianoche(franja.desde));
      disponibles = Math.max(0, minutosDesdeMedianoche(franja.hasta) - arranque) * puestosEfectivos;
    }
    if (disponibles <= 0) continue;
    const consumo = Math.min(restante, disponibles);
    dias += consumo / capacidadDia;
    restante -= consumo;
    if (restante <= 0) return dias;
  }
  return null;
}

/** "1,8 d" (coma decimal; sin decimales desde 10 jornadas). */
export function etiquetaDias(dias: number): string {
  const valor = dias >= 10 ? `${Math.round(dias)}` : `${Math.round(dias * 10) / 10}`.replace(".", ",");
  return `${valor} d`;
}

export type EstacionEmpleadoRef = {
  id: string;
  nombreCompleto: string;
  sector: string;
};

export type EstacionMaquinaRef = {
  id: string;
  codigo: string;
  nombre: string;
  /**
   * Centro de costo principal de la máquina: el vínculo real paso→máquina
   * (la trazabilidad del paso guarda centroCostoId, no maquinaId).
   */
  centroCostoId: string | null;
};

export type Estacion = {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  /** Etapa productiva fija (clave de ETAPAS_ESTACION). */
  etapa: string;
  /** Clave del set de iconos del tablero (Printer, Cut, Shield, …). */
  icono: string | null;
  /** PUESTOS de trabajo simultáneos: multiplican las horas del calendario. */
  capacidadConcurrente: number;
  /**
   * Minutos para traer el material hasta acá y dejarlo listo. Ocupa un PUESTO
   * (lo hace el operario) pero no la máquina. null = default del tenant.
   */
  tiempoPreparacionMin: number | null;
  /** Calendario semanal operativo; null = sin proyección de cola en días. */
  calendario: CalendarioEstacion | null;
  /** Códigos de familias de pasos asignadas. */
  familias: string[];
  empleados: EstacionEmpleadoRef[];
  maquinas: EstacionMaquinaRef[];
  createdAt: string;
  updatedAt: string;
};

export type EstacionPayload = {
  nombre: string;
  descripcion?: string;
  activo: boolean;
  etapa: string;
  icono?: string;
  capacidadConcurrente?: number;
  calendario?: CalendarioEstacion | null;
  /** Reemplazo completo de las tres listas. */
  familias: string[];
  empleadoIds: string[];
  maquinaIds: string[];
};

/**
 * Fila del catálogo de familias con sus dueñas actuales (para el picker).
 * Una familia puede estar en varias estaciones si tienen máquinas (filtran);
 * a lo sumo una estación general (sin máquinas) por familia.
 */
export type FamiliaPasoCatalogo = {
  codigo: string;
  nombre: string;
  categoria: string;
  visibleEnSelector: boolean;
  estaciones: Array<{ id: string; nombre: string; conMaquinas: boolean }>;
};

export function createEmptyEstacion(): EstacionPayload {
  return {
    nombre: "",
    descripcion: "",
    activo: true,
    etapa: "preprensa",
    icono: "Tool",
    capacidadConcurrente: 1,
    calendario: calendarioDefault(),
    familias: [],
    empleadoIds: [],
    maquinaIds: [],
  };
}

