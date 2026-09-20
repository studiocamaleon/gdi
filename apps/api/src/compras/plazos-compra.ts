import { BadRequestException } from '@nestjs/common';
/** Fechas civiles: no dependen de la zona horaria del proceso. Hábiles = lunes a viernes. */
export function fechaCivil(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('Usá una fecha válida (AAAA-MM-DD).');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('La fecha no es válida.');
  return date;
}
export function estimarReposicion(
  fecha: Date,
  dias: number | null,
  tipo: string | null,
): Date | null {
  if (dias == null) return null;
  const date = new Date(fecha);
  for (let pendientes = dias; pendientes > 0; ) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (tipo !== 'HABILES' || ![0, 6].includes(date.getUTCDay())) pendientes--;
  }
  return date;
}
