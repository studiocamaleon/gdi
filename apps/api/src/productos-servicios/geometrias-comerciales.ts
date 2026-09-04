import { BadRequestException } from '@nestjs/common';

export const MODOS_GEOMETRIA_COMERCIAL = [
  'RECTANGULAR',
  'VECTORIAL',
  'AMBAS',
] as const;

export type ModoGeometriaComercial = (typeof MODOS_GEOMETRIA_COMERCIAL)[number];

export type FuenteGeometriaComercial = {
  id: string;
  nombre: string;
  requerida: boolean;
};

export type ConfiguracionGeometriasComerciales = {
  version: 1;
  modo: ModoGeometriaComercial;
  fuentes: FuenteGeometriaComercial[];
};

function esRegistro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Lee el contrato comercial sin convertir datos legacy en una obligación.
 * Ausente significa RECTANGULAR, por lo que todos los productos publicados
 * antes de esta mejora conservan exactamente su comportamiento.
 */
export function leerGeometriasComerciales(
  atributos: unknown,
): ConfiguracionGeometriasComerciales {
  const raw = esRegistro(atributos)
    ? atributos.geometriasComerciales
    : undefined;
  if (!esRegistro(raw)) {
    return { version: 1, modo: 'RECTANGULAR', fuentes: [] };
  }
  const modo = MODOS_GEOMETRIA_COMERCIAL.includes(
    raw.modo as ModoGeometriaComercial,
  )
    ? (raw.modo as ModoGeometriaComercial)
    : 'RECTANGULAR';
  const fuentes = Array.isArray(raw.fuentes)
    ? raw.fuentes.flatMap((item) => {
        if (!esRegistro(item)) return [];
        const id = typeof item.id === 'string' ? item.id.trim() : '';
        const nombre =
          typeof item.nombre === 'string' ? item.nombre.trim() : '';
        return /^[a-z0-9][a-z0-9_-]{0,59}$/.test(id) && nombre
          ? [{ id, nombre, requerida: item.requerida !== false }]
          : [];
      })
    : [];
  return { version: 1, modo, fuentes };
}

export function validarGeometriasComerciales(atributos: unknown): void {
  if (!esRegistro(atributos) || atributos.geometriasComerciales == null) {
    return;
  }
  const raw = atributos.geometriasComerciales;
  if (
    !esRegistro(raw) ||
    Number(raw.version) !== 1 ||
    !MODOS_GEOMETRIA_COMERCIAL.includes(raw.modo as ModoGeometriaComercial) ||
    !Array.isArray(raw.fuentes) ||
    raw.fuentes.length > 30
  ) {
    throw new BadRequestException(
      'La configuración de geometrías comerciales no es válida.',
    );
  }
  const ids = new Set<string>();
  for (const item of raw.fuentes) {
    if (!esRegistro(item)) {
      throw new BadRequestException(
        'Cada fuente geométrica debe tener identificador y nombre.',
      );
    }
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const nombre = typeof item.nombre === 'string' ? item.nombre.trim() : '';
    if (
      !/^[a-z0-9][a-z0-9_-]{0,59}$/.test(id) ||
      ids.has(id) ||
      !nombre ||
      nombre.length > 120 ||
      typeof item.requerida !== 'boolean'
    ) {
      throw new BadRequestException(
        'Las fuentes geométricas deben tener identificadores únicos y nombres válidos.',
      );
    }
    ids.add(id);
  }
  if (raw.modo === 'RECTANGULAR' && raw.fuentes.length > 0) {
    throw new BadRequestException(
      'Un producto exclusivamente rectangular no debe declarar fuentes vectoriales.',
    );
  }
  if (raw.modo === 'VECTORIAL' && raw.fuentes.length === 0) {
    throw new BadRequestException(
      'Un producto vectorial debe declarar al menos una fuente geométrica.',
    );
  }
}
