import type { CurrentAuth } from '../auth/auth.types';
import { expandirVistas } from '../auth/vistas';

/** Crear, emitir y consultar una emisión deben exigir el mismo alcance.
 * Facturación opera facturas de OT; Comprobantes opera facturas y ND generales.
 * Las NC siempre conservan el permiso independiente de anular. */
export function puedeOperarComprobante(
  auth: CurrentAuth,
  tipo: string,
  tieneOrdenes = false,
): boolean {
  const permisos = expandirVistas(auth.permisos ?? []);
  if (tipo === 'nota_credito') return permisos.has('administracion.anular');
  if (tipo !== 'factura' && tipo !== 'nota_debito') return false;
  return (
    permisos.has('administracion.comprobantes.gestionar') ||
    (tipo === 'factura' &&
      tieneOrdenes &&
      permisos.has('administracion.facturacion.gestionar'))
  );
}
