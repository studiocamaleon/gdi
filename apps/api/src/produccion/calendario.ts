import { BadRequestException } from '@nestjs/common';

/**
 * Calendario semanal operativo de una estación (D2 de
 * docs/capacidad-estaciones-diseno.md). Cada día lleva una LISTA de franjas
 * desde/hasta (jornada cortada: 09–12 y 15–19); null = no se trabaja. El
 * shape viaja como `calendarioJson`.
 *
 * Retrocompatibilidad: las filas guardadas antes de las franjas múltiples
 * tienen `{ desde, hasta }` a secas por día; se aceptan como lista de una
 * franja tanto al validar el payload como al leer lo almacenado.
 */

export const DIAS_SEMANA = [
  'lun',
  'mar',
  'mie',
  'jue',
  'vie',
  'sab',
  'dom',
] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number];

export type CalendarioFranja = { desde: string; hasta: string };

/** Franjas del día, ordenadas por `desde` y sin solaparse. */
export type CalendarioDia = CalendarioFranja[];

export type CalendarioEstacion = {
  dias: Record<DiaSemana, CalendarioDia | null>;
};

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function esFranjaCruda(valor: unknown): valor is { desde?: unknown; hasta?: unknown } {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function validarFranja(dia: string, franja: unknown): CalendarioFranja {
  if (!esFranjaCruda(franja)) {
    throw new BadRequestException(
      `Calendario inválido: cada franja de ${dia} debe ser { desde, hasta }.`,
    );
  }
  const { desde, hasta } = franja;
  if (
    typeof desde !== 'string' ||
    typeof hasta !== 'string' ||
    !HORA_RE.test(desde) ||
    !HORA_RE.test(hasta)
  ) {
    throw new BadRequestException(
      `Calendario inválido: horario de ${dia} con formato incorrecto (se espera HH:MM).`,
    );
  }
  if (desde >= hasta) {
    throw new BadRequestException(
      `Calendario inválido: en ${dia}, "desde" (${desde}) debe ser anterior a "hasta" (${hasta}).`,
    );
  }
  return { desde, hasta };
}

/**
 * Valida y normaliza el calendario del payload. Devuelve null para
 * "sin calendario" (input null/undefined o con 0 días activos — equivalen).
 * Días ausentes cuentan como inactivos; claves desconocidas son error.
 * Cada día acepta null, una franja suelta (shape legado) o una lista de
 * franjas; se normaliza a lista ordenada y se rechazan los solapes.
 */
export function parseCalendario(input: unknown): CalendarioEstacion | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Calendario inválido: se espera un objeto.');
  }
  const dias = (input as { dias?: unknown }).dias;
  if (typeof dias !== 'object' || dias === null || Array.isArray(dias)) {
    throw new BadRequestException(
      'Calendario inválido: falta el objeto `dias`.',
    );
  }

  const desconocidas = Object.keys(dias).filter(
    (clave) => !DIAS_SEMANA.includes(clave as DiaSemana),
  );
  if (desconocidas.length > 0) {
    throw new BadRequestException(
      `Calendario inválido: días desconocidos (${desconocidas.join(', ')}).`,
    );
  }

  const normalizado = {} as Record<DiaSemana, CalendarioDia | null>;
  let activos = 0;
  for (const dia of DIAS_SEMANA) {
    const crudo = (dias as Record<string, unknown>)[dia] ?? null;
    if (crudo === null) {
      normalizado[dia] = null;
      continue;
    }
    const lista = Array.isArray(crudo) ? crudo : [crudo];
    if (lista.length === 0) {
      normalizado[dia] = null;
      continue;
    }
    const franjas = lista
      .map((franja) => validarFranja(dia, franja))
      .sort((a, b) => (a.desde < b.desde ? -1 : 1));
    for (let i = 1; i < franjas.length; i += 1) {
      if (franjas[i].desde < franjas[i - 1].hasta) {
        throw new BadRequestException(
          `Calendario inválido: en ${dia}, las franjas ${franjas[i - 1].desde}–${franjas[i - 1].hasta} y ${franjas[i].desde}–${franjas[i].hasta} se solapan.`,
        );
      }
    }
    normalizado[dia] = franjas;
    activos += 1;
  }

  // 0 días activos equivale a "sin calendario" (caso borde del doc §8).
  if (activos === 0) return null;
  return { dias: normalizado };
}

/**
 * Normaliza un calendario YA ALMACENADO (columna Json) al shape de franjas
 * múltiples, sin validar: lo guardado pasó por parseCalendario en su momento.
 * Tolera el shape legado ({ desde, hasta } por día) y devuelve null ante
 * cualquier cosa irreconocible en vez de romper la lectura.
 */
export function normalizarCalendarioAlmacenado(
  crudo: unknown,
): CalendarioEstacion | null {
  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) {
    return null;
  }
  const dias = (crudo as { dias?: unknown }).dias;
  if (typeof dias !== 'object' || dias === null || Array.isArray(dias)) {
    return null;
  }
  const normalizado = {} as Record<DiaSemana, CalendarioDia | null>;
  for (const dia of DIAS_SEMANA) {
    const valor = (dias as Record<string, unknown>)[dia] ?? null;
    if (valor === null) {
      normalizado[dia] = null;
    } else if (Array.isArray(valor)) {
      normalizado[dia] = valor.length > 0 ? (valor as CalendarioDia) : null;
    } else {
      normalizado[dia] = [valor as CalendarioFranja];
    }
  }
  return { dias: normalizado };
}
