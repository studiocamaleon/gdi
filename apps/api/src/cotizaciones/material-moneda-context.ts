import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';
import {
  normalizedMaterialPrice,
  materialPriceContext,
  materialEquivalences,
  materialUnitConversion,
} from '../inventario/material-units';
import { factorCambioMaterial } from './tipo-cambio.service';
import type {
  CostoMaterialMoneda,
  TipoCambioSnapshot,
} from './tipo-cambio.types';

export const monedaCotizacionContext = new AsyncLocalStorage<{
  tenantId: string;
  cambio: TipoCambioSnapshot;
  materiales: Map<string, CostoMaterialMoneda>;
}>();

/** Siempre recibe un registro ORIGINAL de inventario, nunca un precio ya convertido. */
export function precioMaterialEnMonedaCotizacion(
  record: Parameters<typeof normalizedMaterialPrice>[0] & {
    id?: string;
    sku?: string;
    moneda?: string | null;
  },
): number | null {
  const precio = normalizedMaterialPrice(record);
  const contexto = monedaCotizacionContext.getStore();
  if (precio === null || !contexto) return precio;
  const factor = factorCambioMaterial(record.moneda, contexto.cambio);
  const convertido = new Prisma.Decimal(precio).mul(factor).toNumber();
  const unidades = materialPriceContext(record);
  if (record.id)
    contexto.materiales.set(record.id, {
      varianteId: record.id,
      sku: record.sku ?? '',
      monedaOrigen: record.moneda || contexto.cambio.monedaDestino,
      monedaDestino: contexto.cambio.monedaDestino,
      precioOriginal: Number(record.precioReferencia),
      unidadPrecio: unidades.unidadPrecio || unidades.unidadCompra,
      unidadUso: unidades.unidadUso ?? unidades.unidadStock,
      unidadStock: unidades.unidadStock,
      unidadCompra: unidades.unidadCompra,
      conversionStock: materialUnitConversion(
        unidades,
        unidades.unidadUso ?? unidades.unidadStock,
        unidades.unidadStock,
      ),
      equivalencias: materialEquivalences(unidades),
      conversionPrecio: materialUnitConversion(
        unidades,
        unidades.unidadPrecio || unidades.unidadCompra,
        unidades.unidadUso ?? unidades.unidadStock,
      ),
      precioPorUnidadUsoOrigen: precio,
      costoUnitarioDestino: convertido,
      factorCambio: factor,
    });
  return convertido;
}
