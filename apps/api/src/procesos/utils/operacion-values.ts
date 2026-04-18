/**
 * Helper para resolver los valores "efectivos" de un ProcesoOperacion (o
 * ProcesoOperacionPlantilla) considerando niveles (variantes) almacenados en
 * `detalleJson.niveles`.
 *
 * IMPORTANTE: Este archivo tiene un mirror en
 *   src/lib/proceso-operacion-values.ts
 * Cualquier cambio aquí debe replicarse allí.
 *
 * Uso típico en los motores de cotización:
 *   1. Leer `op` con Prisma (include: { maquina, perfilOperativo, centroCosto })
 *   2. Llamar `resolveOperacionForNivel(op, nivelSeleccionado)` para obtener
 *      los valores a usar (maquinaId, productividadBase, setupMin, etc.).
 *   3. Si hay niveles y no se pasó nivel → el resolver devuelve null, y el
 *      motor debe fallar con un mensaje claro ("Paso X tiene variantes, elegí una").
 *
 * Ver `apps/api/src/procesos/procesos.service.ts` `getOperacionNiveles`
 * para la forma canónica de parsear niveles (este helper la duplica para
 * evitar dependencias circulares).
 */

import type { Prisma } from '@prisma/client';
import { ModoProductividadProceso, UnidadProceso } from '@prisma/client';

export type ModoProductividadNivel =
  | 'fija'
  | 'variable_manual'
  | 'variable_perfil';

export type ParsedNivel = {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  modoProductividadNivel: ModoProductividadNivel;
  tiempoFijoMin: number | null;
  productividadBase: number | null;
  unidadSalida: string | null;
  unidadTiempo: string | null;
  maquinaId: string | null;
  maquinaNombre: string;
  perfilOperativoId: string | null;
  perfilOperativoNombre: string;
  setupMin: number | null;
  cleanupMin: number | null;
};

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function trimmedOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function trimmedOrEmpty(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

/**
 * Parsea los niveles persistidos en `detalleJson.niveles`. Devuelve arreglo
 * vacío si no hay niveles o la forma es inválida.
 */
export function parseNivelesFromDetalleJson(
  detalleJson: Prisma.JsonValue | null | undefined,
): ParsedNivel[] {
  if (
    !detalleJson ||
    typeof detalleJson !== 'object' ||
    Array.isArray(detalleJson)
  ) {
    return [];
  }
  const raw = (detalleJson as Record<string, unknown>).niveles;
  if (!Array.isArray(raw)) return [];

  const parsed: ParsedNivel[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const nivel = item as Record<string, unknown>;
    const nombre = trimmedOrEmpty(nivel.nombre);
    if (!nombre) return;
    const modoRaw = nivel.modoProductividadNivel;
    const modoProductividadNivel: ModoProductividadNivel =
      modoRaw === 'variable_manual' || modoRaw === 'variable_perfil'
        ? modoRaw
        : 'fija';
    parsed.push({
      id: typeof nivel.id === 'string' && nivel.id ? nivel.id : `nivel-${index}`,
      nombre,
      orden: toNumberOrNull(nivel.orden) ?? index + 1,
      activo: nivel.activo !== false,
      modoProductividadNivel,
      tiempoFijoMin: toNumberOrNull(nivel.tiempoFijoMin),
      productividadBase: toNumberOrNull(nivel.productividadBase),
      unidadSalida: trimmedOrNull(nivel.unidadSalida),
      unidadTiempo: trimmedOrNull(nivel.unidadTiempo),
      maquinaId: trimmedOrNull(nivel.maquinaId),
      maquinaNombre: trimmedOrEmpty(nivel.maquinaNombre),
      perfilOperativoId: trimmedOrNull(nivel.perfilOperativoId),
      perfilOperativoNombre: trimmedOrEmpty(nivel.perfilOperativoNombre),
      setupMin: toNumberOrNull(nivel.setupMin),
      cleanupMin: toNumberOrNull(nivel.cleanupMin),
    });
  });
  return parsed.sort((a, b) => a.orden - b.orden);
}

/**
 * Solo los niveles activos, ordenados.
 */
export function getNivelesActivos(
  detalleJson: Prisma.JsonValue | null | undefined,
): ParsedNivel[] {
  return parseNivelesFromDetalleJson(detalleJson).filter((n) => n.activo);
}

/**
 * true si el paso tiene al menos un nivel activo.
 */
export function operacionTieneNiveles(op: {
  detalleJson: Prisma.JsonValue | null;
}): boolean {
  return getNivelesActivos(op.detalleJson).length > 0;
}

// ---------------------------------------------------------------------------
// Resolución para cotización
// ---------------------------------------------------------------------------

/**
 * Shape mínima del paso necesaria para resolver valores. Permite pasarle
 * tanto un `ProcesoOperacion` completo (de Prisma) como un objeto parcial.
 */
export type OperacionLike = {
  id: string;
  codigo?: string | null;
  nombre?: string | null;
  detalleJson: Prisma.JsonValue | null;
  maquinaId: string | null;
  perfilOperativoId: string | null;
  modoProductividad: ModoProductividadProceso;
  productividadBase: Prisma.Decimal | number | null;
  tiempoFijoMin: Prisma.Decimal | number | null;
  setupMin: Prisma.Decimal | number | null;
  cleanupMin: Prisma.Decimal | number | null;
  runMin: Prisma.Decimal | number | null;
  unidadSalida: UnidadProceso;
  unidadTiempo: UnidadProceso;
};

export type ResolvedOperacionValues = {
  maquinaId: string | null;
  perfilOperativoId: string | null;
  modoProductividad: ModoProductividadProceso;
  productividadBase: number | null;
  tiempoFijoMin: number | null;
  setupMin: number | null;
  cleanupMin: number | null;
  runMin: number | null;
  unidadSalida: UnidadProceso;
  unidadTiempo: UnidadProceso;
  /** ID del nivel usado (null si resolvió del campo general). */
  nivelId: string | null;
  /** Nombre del nivel usado (null si resolvió del campo general). */
  nivelNombre: string | null;
};

function decimalOrNull(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  // Prisma.Decimal → Number
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unidadFromString(
  value: string | null | undefined,
  fallback: UnidadProceso,
): UnidadProceso {
  if (!value) return fallback;
  const upper = value.toUpperCase();
  if ((UnidadProceso as Record<string, unknown>)[upper] !== undefined) {
    return (UnidadProceso as Record<string, UnidadProceso>)[upper];
  }
  // Formatos ya en UPPER_CASE directos
  if ((Object.values(UnidadProceso) as string[]).includes(upper as string)) {
    return upper as UnidadProceso;
  }
  return fallback;
}

function modoProductividadFromNivel(
  modo: ModoProductividadNivel,
): ModoProductividadProceso {
  return modo === 'fija'
    ? ModoProductividadProceso.FIJA
    : ModoProductividadProceso.FORMULA;
}

/**
 * Resuelve los valores de ejecución para un paso:
 *   - Sin niveles → devuelve los campos generales.
 *   - Con niveles + `nivelId` válido → devuelve los valores del nivel
 *     (con fallback a campos generales para aquellos que el nivel no define,
 *     como runMin o unidades si están vacías).
 *   - Con niveles sin `nivelId` → devuelve null, el caller debe fallar con
 *     un mensaje claro indicando que falta seleccionar un nivel.
 */
export function resolveOperacionForNivel(
  op: OperacionLike,
  nivelId?: string | null,
): ResolvedOperacionValues | null {
  const niveles = getNivelesActivos(op.detalleJson);
  const tieneNiveles = niveles.length > 0;

  if (!tieneNiveles) {
    return {
      maquinaId: op.maquinaId || null,
      perfilOperativoId: op.perfilOperativoId || null,
      modoProductividad: op.modoProductividad,
      productividadBase: decimalOrNull(op.productividadBase),
      tiempoFijoMin: decimalOrNull(op.tiempoFijoMin),
      setupMin: decimalOrNull(op.setupMin),
      cleanupMin: decimalOrNull(op.cleanupMin),
      runMin: decimalOrNull(op.runMin),
      unidadSalida: op.unidadSalida,
      unidadTiempo: op.unidadTiempo,
      nivelId: null,
      nivelNombre: null,
    };
  }

  if (!nivelId) return null;
  const nivel = niveles.find((n) => n.id === nivelId);
  if (!nivel) return null;

  return {
    maquinaId: nivel.maquinaId,
    perfilOperativoId: nivel.perfilOperativoId,
    modoProductividad: modoProductividadFromNivel(nivel.modoProductividadNivel),
    productividadBase:
      nivel.productividadBase !== null
        ? nivel.productividadBase
        : decimalOrNull(op.productividadBase),
    tiempoFijoMin:
      nivel.tiempoFijoMin !== null
        ? nivel.tiempoFijoMin
        : decimalOrNull(op.tiempoFijoMin),
    setupMin:
      nivel.setupMin !== null ? nivel.setupMin : decimalOrNull(op.setupMin),
    cleanupMin:
      nivel.cleanupMin !== null
        ? nivel.cleanupMin
        : decimalOrNull(op.cleanupMin),
    // Los niveles no tienen runMin propio → fallback siempre al general
    runMin: decimalOrNull(op.runMin),
    unidadSalida: unidadFromString(nivel.unidadSalida, op.unidadSalida),
    unidadTiempo: unidadFromString(nivel.unidadTiempo, op.unidadTiempo),
    nivelId: nivel.id,
    nivelNombre: nivel.nombre,
  };
}

// ---------------------------------------------------------------------------
// Helpers para validar completitud de niveles
// ---------------------------------------------------------------------------

/**
 * true si todos los niveles tienen los campos mínimos de costeo:
 *  - modo FIJA → tiempoFijoMin > 0
 *  - modo FORMULA → productividadBase > 0
 */
export function todosLosNivelesCompletos(
  detalleJson: Prisma.JsonValue | null | undefined,
): boolean {
  const niveles = getNivelesActivos(detalleJson);
  if (niveles.length === 0) return true;
  return niveles.every((nivel) => {
    if (nivel.modoProductividadNivel === 'fija') {
      return (nivel.tiempoFijoMin ?? 0) > 0;
    }
    return (nivel.productividadBase ?? 0) > 0;
  });
}

/**
 * IDs de máquinas referenciadas por los niveles activos (para resolver
 * centros de costo u otras validaciones que dependen de máquinas).
 */
export function getMaquinaIdsDeNiveles(
  detalleJson: Prisma.JsonValue | null | undefined,
): string[] {
  const niveles = getNivelesActivos(detalleJson);
  const out = new Set<string>();
  for (const n of niveles) {
    if (n.maquinaId) out.add(n.maquinaId);
  }
  return Array.from(out);
}
