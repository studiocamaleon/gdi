import { isUUID } from 'class-validator';

export const esRegistro = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

export function procedenciaGeometriaValida(v: unknown): boolean {
  return (
    esRegistro(v) &&
    v.version === 1 &&
    typeof v.geometriaId === 'string' &&
    isUUID(v.geometriaId) &&
    typeof v.archivoId === 'string' &&
    isUUID(v.archivoId) &&
    typeof v.hash === 'string' &&
    /^[a-f0-9]{64}$/.test(v.hash)
  );
}

/** Referencia de transporte, sin campos que puedan sustituir geometría guardada. */
export function referenciaGeometriaValida(v: unknown): boolean {
  return (
    esRegistro(v) &&
    v.tipo === 'REFERENCIA_GEOMETRIA' &&
    v.schemaVersion === 1 &&
    procedenciaGeometriaValida(v.procedencia) &&
    Object.keys(v).every((k) =>
      ['tipo', 'schemaVersion', 'procedencia'].includes(k),
    ) &&
    Object.keys(v.procedencia as object).every((k) =>
      ['version', 'geometriaId', 'archivoId', 'hash'].includes(k),
    )
  );
}

export function esFuenteGuardadaOReferencia(
  v: unknown,
): v is Record<string, unknown> {
  return (
    esRegistro(v) &&
    (v.tipo === 'REFERENCIA_GEOMETRIA' ||
      (v.schemaVersion === 2 &&
        typeof v.svg === 'string' &&
        v.procedencia != null))
  );
}
