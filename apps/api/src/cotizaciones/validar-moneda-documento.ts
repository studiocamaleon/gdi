import { BadRequestException } from '@nestjs/common';
import type { TipoCambioSnapshot } from './tipo-cambio.types';

export function cambioDelSnapshot(
  snapshot: unknown,
): TipoCambioSnapshot | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  return (snapshot as { tipoCambio?: TipoCambioSnapshot }).tipoCambio ?? null;
}

/** Los históricos sin cambio siguen legibles; una actualización explícita es completa. */
export function validarMonedaDocumento(
  items: Array<{ snapshotJson?: unknown }>,
  esperado?: string,
) {
  const cambios = items.map((item) => cambioDelSnapshot(item.snapshotJson));
  const ids = new Set(cambios.flatMap((c) => (c ? [c.id] : [])));
  if (ids.size > 1 || (esperado && cambios.some((c) => c?.id !== esperado))) {
    throw new BadRequestException(
      'Los productos tienen distintos tipos de cambio. Actualizá el cambio y recotizá todo el documento antes de guardar.',
    );
  }
}
