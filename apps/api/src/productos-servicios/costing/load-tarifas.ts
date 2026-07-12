/**
 * Helper para cargar tarifas horarias de centros de costo desde DB.
 *
 * Reemplaza el patrón duplicado en 4 motores:
 *   const tarifas = await prisma.centroCostoTarifaPeriodo.findMany({
 *     where: { tenantId, periodo, estado: 'PUBLICADA', centroCostoId: { in: centroIds } },
 *     select: { centroCostoId: true, tarifaCalculada: true },
 *   });
 *   const tarifaByCentro = new Map(tarifas.map(t => [t.centroCostoId, t.tarifaCalculada]));
 *
 * Si `centroCostoIds` está vacío, no consulta y devuelve un Map vacío.
 * Si se omite (undefined), trae TODAS las tarifas del tenant para el período
 * (necesario para el caso de gran formato preview, línea ~15573 del service).
 *
 * Devuelve Decimal de Prisma (no number) para que el caller decida cuándo
 * castear y mantener bit-exactitud con el código legacy.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { EstadoTarifaCentroCostoPeriodo } from '@prisma/client';

/**
 * Tarifa de un centro de costo desdoblada: la tarifa total (mezclada) y la
 * componente de mano de obra (SUELDOS + CARGAS). El motor usa `manoObra` para
 * cobrar la hora hombre sólo sobre setup/cleanup y no sobre el runtime de la
 * máquina. Ver docs/hora-hombre-setup-cleanup-diseno.md
 */
export interface TarifaCentro {
  tarifa: Prisma.Decimal;
  manoObra: Prisma.Decimal;
}

export type TarifaByCentroId = Map<string, TarifaCentro>;

export interface LoadTarifasInput {
  tenantId: string;
  periodo: string;
  /**
   * Si se proveen, filtra a esos centros de costo (patrón típico de motores).
   * Si se omite, trae todas las tarifas publicadas del tenant en el período.
   * Si es array vacío, devuelve Map vacío sin consultar DB.
   */
  centroCostoIds?: string[];
}

export async function loadTarifasHorarias(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: LoadTarifasInput,
): Promise<TarifaByCentroId> {
  // Array vacío explícito → no consultar (preserva el guard del caller en línea 4159)
  if (input.centroCostoIds && input.centroCostoIds.length === 0) {
    return new Map();
  }

  const where: Prisma.CentroCostoTarifaPeriodoWhereInput = {
    tenantId: input.tenantId,
    periodo: input.periodo,
    estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
  };
  if (input.centroCostoIds) {
    where.centroCostoId = { in: input.centroCostoIds };
  }

  const tarifas = await prisma.centroCostoTarifaPeriodo.findMany({
    where,
    select: {
      centroCostoId: true,
      tarifaCalculada: true,
      tarifaManoObra: true,
    },
  });

  return new Map(
    tarifas.map((t) => [
      t.centroCostoId,
      { tarifa: t.tarifaCalculada, manoObra: t.tarifaManoObra },
    ]),
  );
}
