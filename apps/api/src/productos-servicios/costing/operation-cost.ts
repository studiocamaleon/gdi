/**
 * Cálculo del costo de una operación (paso productivo).
 *
 * Fórmula universal:
 *   costo = (totalMin / 60) × tarifaHora
 *
 * Reemplaza el patrón duplicado en 5 lugares del service con 2 variantes:
 *   - Variante A (number):  (totalMin / 60) * tarifaHora
 *   - Variante B (Decimal): tarifa.mul(totalMin / 60)
 *
 * El helper acepta ambas formas de tarifa (number o Prisma.Decimal) y
 * devuelve siempre `number`. La operación interna se hace en number para
 * preservar el comportamiento exacto de los call-sites legacy que ya
 * castean a Number en algún punto.
 *
 * Por defecto NO redondea el resultado: dejá al caller decidir cuándo
 * llamar a su `roundProductNumber` (algunos call-sites redondean al
 * final del proceso, otros redondean por paso).
 */

import type { Prisma } from '@prisma/client';

export type TarifaHora = number | Prisma.Decimal;

/**
 * Costo crudo (sin redondear): (totalMin / 60) × tarifa.
 *
 * Si `tarifa` es null/undefined, devuelve 0 — preserva el patrón legacy
 * `Number(tarifa?.tarifaCalculada ?? 0)`.
 */
export function calculateOperationCost(
  totalMin: number,
  tarifaHora: TarifaHora | null | undefined,
): number {
  if (tarifaHora == null) return 0;
  const tarifaNumber = typeof tarifaHora === 'number' ? tarifaHora : Number(tarifaHora);
  return (totalMin / 60) * tarifaNumber;
}
