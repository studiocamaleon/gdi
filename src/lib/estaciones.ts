/**
 * Estaciones de producción — contrato de datos.
 *
 * La estación agrupa FAMILIAS de pasos (ruteo del tablero: una familia vive
 * en una sola estación), máquinas (una máquina vive en una sola estación) y
 * empleados habilitados (N:M), con capacidad de trabajo concurrente.
 * Ver docs/estaciones-diseno.md
 */

export type EstacionEmpleadoRef = {
  id: string;
  nombreCompleto: string;
  sector: string;
};

export type EstacionMaquinaRef = {
  id: string;
  codigo: string;
  nombre: string;
};

export type Estacion = {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
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
  icono?: string;
  capacidadConcurrente?: number;
  horario?: string;
  /** Reemplazo completo de las tres listas. */
  familias: string[];
  empleadoIds: string[];
  maquinaIds: string[];
};

/** Fila del catálogo de familias con su dueña actual (para el picker). */
export type FamiliaPasoCatalogo = {
  codigo: string;
  nombre: string;
  categoria: string;
  visibleEnSelector: boolean;
  estacionId: string | null;
  estacionNombre: string | null;
};

export function createEmptyEstacion(): EstacionPayload {
  return {
    nombre: "",
    descripcion: "",
    activo: true,
    icono: "Tool",
    capacidadConcurrente: 1,
    horario: "",
    familias: [],
    empleadoIds: [],
    maquinaIds: [],
  };
}

/**
 * Categoría visible de la estación, DERIVADA de sus familias (la
 * mayoritaria). Sin familias → null ("Sin configurar").
 */
export function categoriaDeEstacion(
  estacion: Pick<Estacion, "familias">,
  catalogo: FamiliaPasoCatalogo[],
): string | null {
  if (estacion.familias.length === 0) return null;
  const porCategoria = new Map<string, number>();
  for (const codigo of estacion.familias) {
    const familia = catalogo.find((entry) => entry.codigo === codigo);
    if (!familia) continue;
    porCategoria.set(familia.categoria, (porCategoria.get(familia.categoria) ?? 0) + 1);
  }
  let mejor: string | null = null;
  let mejorCount = 0;
  for (const [categoria, count] of porCategoria) {
    if (count > mejorCount) {
      mejor = categoria;
      mejorCount = count;
    }
  }
  return mejor;
}
