import { BadRequestException } from '@nestjs/common';

/** El margen opcional ausente equivale a recuperar costos, sin utilidad. */
export function validarMargenOpcionales(config: unknown): void {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return;
  const detalle = (config as Record<string, unknown>).detalle;
  if (!detalle || typeof detalle !== 'object' || Array.isArray(detalle)) return;
  const margen = (detalle as Record<string, unknown>).margenOpcionalesPct;
  if (margen === undefined) return;
  if (
    typeof margen !== 'number' ||
    !Number.isFinite(margen) ||
    margen < 0 ||
    margen >= 100
  ) {
    throw new BadRequestException(
      'El margen de los opcionales debe ser un número entre 0 y menos de 100%.',
    );
  }
}
