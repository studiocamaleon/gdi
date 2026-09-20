import { createHash } from 'node:crypto';
import {
  proyectarMaterialesOrden,
  type ItemMaterialesSnapshot,
  type MaterialesOrden,
} from './materiales-orden.proyeccion';
export * from './materiales-orden.proyeccion';
/** La proyección es compartida con el cotizador; la revisión para escribir
 * reservas se firma únicamente en el servidor. */
export function calcularMaterialesOrden(
  ordenId: string,
  items: ItemMaterialesSnapshot[],
): MaterialesOrden {
  const resultado = proyectarMaterialesOrden(ordenId, items);
  return {
    ...resultado,
    revision: createHash('sha256')
      .update(JSON.stringify(resultado))
      .digest('hex'),
  };
}
