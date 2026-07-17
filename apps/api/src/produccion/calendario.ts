import { BadRequestException } from '@nestjs/common';

/**
 * Calendario semanal operativo de una estación (D2 de
 * docs/capacidad-estaciones-diseno.md). Una franja desde/hasta por día;
 * null en un día = no se trabaja. El shape viaja como `calendarioJson`.
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

export type CalendarioDia = { desde: string; hasta: string };

export type CalendarioEstacion = {
  dias: Record<DiaSemana, CalendarioDia | null>;
};

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Valida y normaliza el calendario del payload. Devuelve null para
 * "sin calendario" (input null/undefined o con 0 días activos — equivalen).
 * Días ausentes cuentan como inactivos; claves desconocidas son error.
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
    const franja = (dias as Record<string, unknown>)[dia] ?? null;
    if (franja === null) {
      normalizado[dia] = null;
      continue;
    }
    if (typeof franja !== 'object' || Array.isArray(franja)) {
      throw new BadRequestException(
        `Calendario inválido: la franja de ${dia} debe ser { desde, hasta } o null.`,
      );
    }
    const { desde, hasta } = franja as { desde?: unknown; hasta?: unknown };
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
    normalizado[dia] = { desde, hasta };
    activos += 1;
  }

  // 0 días activos equivale a "sin calendario" (caso borde del doc §8).
  if (activos === 0) return null;
  return { dias: normalizado };
}
