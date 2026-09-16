import { createHash } from 'node:crypto';

const dimensiones = new Set([
  'ancho',
  'anchoMm',
  'largo',
  'largoMm',
  'largoRolloMm',
  'longitudRolloMm',
]);

/** El ancho cambia; acabado, espesor y demás características siguen siendo el mismo material. */
export function identidadMaterialRollo(atributos: unknown) {
  const objeto =
    atributos && typeof atributos === 'object' && !Array.isArray(atributos)
      ? atributos
      : {};
  return JSON.stringify(
    Object.entries(objeto)
      .filter(([k]) => !dimensiones.has(k))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/** Clave pública de compatibilidad; evita enviar los atributos técnicos completos a Colas. */
export function claveMaterialNesting(
  materiaPrimaId: string,
  atributos: unknown,
) {
  return `${materiaPrimaId}:${createHash('sha256').update(identidadMaterialRollo(atributos)).digest('hex')}`;
}
