import type { Prisma } from '@prisma/client';
import type { SuscripcionExterna } from './suscripcion-sync.service';

/** Resuelve TODOS los ítems; el orden de Paddle no decide qué plan se concede.
 * Una oferta retirada conserva sus precios para suscripciones anteriores. */
export async function resolverContratoOferta(
  tx: Prisma.TransactionClient,
  externa: SuscripcionExterna,
) {
  const entorno =
    process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox';
  const vinculos = await tx.planOfertaPrecio.findMany({
    where: { entorno, priceId: { in: externa.precios } },
    include: { oferta: { include: { version: { select: { codigo: true } } } } },
  });
  if (!vinculos.length) return { tipo: 'legacy' as const };
  const items = externa.items;
  if (
    !items ||
    items.length !== vinculos.length ||
    new Set(items.map((i) => i.priceId)).size !== items.length ||
    items.length !== externa.precios.length
  )
    return {
      tipo: 'invalido' as const,
      motivo:
        'La suscripción contiene ítems desconocidos, repetidos o cantidades sin confirmar.',
    };
  const bases = vinculos.filter((v) => v.tipo === 'base');
  if (bases.length !== 1)
    return {
      tipo: 'invalido' as const,
      motivo: 'La suscripción debe contener exactamente un plan base.',
    };
  const base = bases[0];
  let adicionales = 0;
  for (const v of vinculos) {
    const cantidad = items.find((i) => i.priceId === v.priceId)?.quantity;
    if (
      v.ofertaId !== base.ofertaId ||
      v.ciclo !== base.ciclo ||
      !cantidad ||
      !Number.isInteger(cantidad) ||
      cantidad < 1 ||
      cantidad > v.cantidadMaxima ||
      (v.tipo === 'base' && cantidad !== 1)
    )
      return {
        tipo: 'invalido' as const,
        motivo:
          'El plan y los adicionales deben corresponder a la misma versión y ciclo, con cantidades válidas.',
      };
    if (v.tipo === 'usuario') adicionales += cantidad;
  }
  return {
    tipo: 'version' as const,
    plan: { id: base.oferta.planId, codigo: base.oferta.version.codigo },
    planVersionId: base.oferta.versionId,
    ofertaId: base.ofertaId,
    cicloFacturacion: base.ciclo,
    usuariosAdicionales: adicionales,
  };
}
