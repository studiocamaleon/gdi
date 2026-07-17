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
  /** Pasos que pueden ejecutarse en paralelo (carga real del tablero). */
  capacidadConcurrente: number;
  /** Horario operativo, texto libre informativo. */
  horario: string | null;
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
  horario?: string;
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
    horario: "",
    familias: [],
    empleadoIds: [],
    maquinaIds: [],
  };
}

