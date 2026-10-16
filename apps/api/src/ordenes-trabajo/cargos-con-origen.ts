type Numero = number | { toString(): string };

export type OrdenConCargos = {
  cargosDirectos?: Numero | null;
  cargosDirectosJson?: unknown;
  tratamientoFiscal?: string | null;
  cotizacion?: { cargosDirectosCotizacionJson: unknown } | null;
};

/** Algunas conversiones conservaron el importe, pero no el detalle del cargo.
 * Recuperar sólo el snapshot enlazado cuyo importe coincide con el guardado.
 * No completar diferencias ni reconstruir impuestos desde el catálogo actual.
 */
export function cargosConOrigen(orden: OrdenConCargos): unknown[] {
  const propios = orden.cargosDirectosJson;
  if (Array.isArray(propios) && propios.length) return propios;
  if (propios != null && !Array.isArray(propios)) return [];

  const monto = Number(orden.cargosDirectos ?? 0);
  const origen = orden.cotizacion?.cargosDirectosCotizacionJson;
  if (!Number.isFinite(monto) || monto <= 0 || !Array.isArray(origen))
    return [];
  const campo =
    orden.tratamientoFiscal === 'SIN_COMPROBANTE' ? 'montoNeto' : 'total';
  let suma = 0;
  for (const cargo of origen) {
    if (!cargo || typeof cargo !== 'object' || Array.isArray(cargo)) return [];
    const valor = (cargo as Record<string, unknown>)[campo];
    if (
      (typeof valor !== 'number' && typeof valor !== 'string') ||
      (typeof valor === 'string' && !valor.trim()) ||
      !Number.isFinite(Number(valor)) ||
      Number(valor) < 0
    )
      return [];
    suma += Number(valor);
  }
  return Math.round(suma * 100) === Math.round(monto * 100) ? origen : [];
}
