import { createHash } from 'node:crypto';
import type { LoteNestingCompuestoSnapshot } from '../motor-universal/tipos';

/** Mismo contrato de lectura que una cotización raíz, sin reevaluar maestros. */
export function trazabilidadDeComponente(snapshot: Record<string, unknown>) {
  const { componentes, ...propios } = snapshot;
  return {
    ...propios,
    componentesFabricados: Array.isArray(componentes) ? componentes : [],
  };
}

export function idLoteEnItem(itemId: string, loteId: string) {
  return `lote-ot-${createHash('sha256')
    .update(JSON.stringify([itemId, loteId]))
    .digest('hex')
    .slice(0, 40)}`;
}

/** Un mismo producto/revisión puede aparecer varias veces en una OT. La
 * identidad operativa pertenece al padre ejecutable, no a la firma técnica. */
export function loteEnItem(lote: LoteNestingCompuestoSnapshot, itemId: string) {
  return {
    ...lote,
    id: idLoteEnItem(itemId, lote.id),
    loteCotizadoId: lote.id,
    ambitoItemId: itemId,
    ...(lote.layoutOrigenLoteId
      ? { layoutOrigenLoteId: idLoteEnItem(itemId, lote.layoutOrigenLoteId) }
      : {}),
    nestingResult: {
      ...lote.nestingResult,
      ...(lote.nestingResult?.layoutRegistradoLoteId
        ? {
            layoutRegistradoLoteId: idLoteEnItem(
              itemId,
              lote.nestingResult.layoutRegistradoLoteId,
            ),
          }
        : {}),
    },
  };
}
