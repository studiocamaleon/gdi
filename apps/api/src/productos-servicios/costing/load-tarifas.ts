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

  // Carry-forward: si el período pedido no tiene tarifa PUBLICADA, se usa la más
  // reciente de un período ANTERIOR (los `periodo` son "YYYY-MM", ordenables como
  // string). Así una imprenta no tiene que re-cargar las tarifas cada mes: valen
  // las del último mes publicado hasta que las cambie. Cuando el período pedido SÍ
  // tiene tarifa, gana ella (es la mayor ≤ período). Ver
  // docs/centros-de-costo-carry-forward-diseno.md
  const where: Prisma.CentroCostoTarifaPeriodoWhereInput = {
    tenantId: input.tenantId,
    periodo: { lte: input.periodo },
    estado: {
      in: [
        EstadoTarifaCentroCostoPeriodo.PUBLICADA,
        EstadoTarifaCentroCostoPeriodo.BORRADOR,
      ],
    },
    // Un centro inactivo no puede seguir costando por arrastre de una tarifa
    // histórica. Reactivarlo vuelve a habilitarlo y el guardado del período
    // vuelve a publicar el conjunto completo.
    centroCosto: { activo: true },
  };
  if (input.centroCostoIds) {
    where.centroCostoId = { in: input.centroCostoIds };
  }

  const tarifas = await prisma.centroCostoTarifaPeriodo.findMany({
    where,
    select: {
      centroCostoId: true,
      periodo: true,
      tarifaCalculada: true,
      tarifaManoObra: true,
      estado: true,
    },
    // Mayor período primero: el primero que vemos por centro es el vigente
    // (el del período pedido si existe, si no el último anterior).
    orderBy: { periodo: 'desc' },
  });

  const map: TarifaByCentroId = new Map();
  const resueltos = new Set<string>();
  const porCentroPeriodo = new Map<string, typeof tarifas>();
  for (const tarifa of tarifas) {
    const key = `${tarifa.centroCostoId}:${tarifa.periodo}`;
    const grupo = porCentroPeriodo.get(key) ?? [];
    grupo.push(tarifa);
    porCentroPeriodo.set(key, grupo);
  }
  for (const grupo of porCentroPeriodo.values()) {
    const centroId = grupo[0].centroCostoId;
    if (resueltos.has(centroId)) continue;
    resueltos.add(centroId);
    const publicada = grupo.find(
      (tarifa) => tarifa.estado === EstadoTarifaCentroCostoPeriodo.PUBLICADA,
    );
    // Si el período más reciente sólo tiene borrador, fue guardado pero quedó
    // inválido. No se cae silenciosamente a una publicación anterior.
    if (!publicada) continue;
    map.set(centroId, {
      tarifa: publicada.tarifaCalculada,
      manoObra: publicada.tarifaManoObra,
    });
  }
  return map;
}
