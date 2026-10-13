import type { Prisma } from '@prisma/client';
import {
  materialPriceContext,
  materialPriceInStockUnit,
} from './material-units';
import { planPapelDerivado } from './papel-derivado';

/** El sobrante conserva su costo promedio histórico en stock; su referencia
 * comercial sigue el precio vigente del pliego de origen, en la misma moneda. */
export async function precioPapelCortado(
  db: Pick<Prisma.TransactionClient, 'materiaPrimaVariante'>,
  tenantId: string,
  atributos: Record<string, unknown> | null,
) {
  const meta = atributos?._papelDerivado as
    | { origenVarianteId?: string; rendimiento?: number }
    | undefined;
  if (!meta) return undefined;
  if (typeof meta.origenVarianteId !== 'string') return null;
  const origen = await db.materiaPrimaVariante.findFirst({
    where: {
      tenantId,
      id: meta.origenVarianteId,
      activo: true,
      materiaPrima: { activo: true },
    },
    include: { materiaPrima: true },
  });
  if (!origen) return null;
  // El selector de copiado sólo reutiliza hojas cortadas del mismo tamaño;
  // no genera cadenas de cortes ni presupone que se pueden volver a unir.
  const attrs = origen.atributosVarianteJson as Record<string, unknown>;
  if (attrs._papelDerivado) return null;
  const plan = planPapelDerivado(
    1,
    attrs,
    Number(atributos?.anchoMm),
    Number(atributos?.altoMm),
  );
  if (!plan || plan.rendimiento !== meta.rendimiento) return null;
  const precio = materialPriceInStockUnit(
    materialPriceContext(origen),
    Number(origen.precioReferencia),
  );
  return precio.ok && precio.precio > 0
    ? { precio: precio.precio / plan.rendimiento, moneda: origen.moneda }
    : null;
}
