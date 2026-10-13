import { objeto } from '../centro-copiado/pedidos/snapshot-pedido';
import { BadRequestException, ConflictException } from '@nestjs/common';

/** La decisión pertenece a la OT; nunca modifica el snapshot ni sus precios. */
export function validarCopiadoListo(
  item: {
    listoEnMostrador?: boolean;
    planEntrega?: unknown;
    asignacionesPersonal?: unknown[];
  },
  producto: Record<string, unknown>,
  jobContext?: unknown,
) {
  if (!item.listoEnMostrador) return;
  if (
    producto.codigo !== 'SYS-IMPRESION-DOC' &&
    !Object.keys(objeto(objeto(jobContext)._centroCopiado)).length
  )
    throw new BadRequestException(
      'Sólo los ítems de Centro de copiado pueden marcarse con producción finalizada.',
    );
  if (item.planEntrega || item.asignacionesPersonal?.length)
    throw new BadRequestException(
      'Un ítem con producción finalizada no necesita distribución de entregas ni operadores de producción.',
    );
}

export function exigirMarcaAntesDeEmision(
  estado: string,
  items: Array<{
    id?: string;
    cotizacionItemId?: string | null;
    listoEnMostrador?: boolean;
  }>,
  anteriores: Array<{
    id: string;
    cotizacionItemId: string | null;
    listoEnMostrador: boolean;
  }>,
) {
  if (estado === 'borrador') return;
  for (const item of items) {
    const anterior = anteriores.find((i) => i.id === item.id);
    if (
      item.listoEnMostrador !== undefined &&
      item.listoEnMostrador !== (anterior?.listoEnMostrador ?? false)
    )
      throw new ConflictException(
        'La marca «Producción finalizada» se elige antes de emitir la OT.',
      );
    if (
      anterior?.listoEnMostrador &&
      item.cotizacionItemId !== anterior.cotizacionItemId
    )
      throw new ConflictException(
        'El ítem ya se registró con producción finalizada y no puede recotizarse.',
      );
  }
  if (
    anteriores.some(
      (i) => i.listoEnMostrador && !items.some((nuevo) => nuevo.id === i.id),
    )
  )
    throw new ConflictException(
      'No se puede quitar un ítem con producción finalizada.',
    );
}
