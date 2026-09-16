import { BadRequestException } from '@nestjs/common';

export const ORDEN_CANALES_VENTA = [
  'whatsapp',
  'mostrador',
  'email',
  'web',
  'app_movil',
] as const;

const HISTORICOS = ['vendedor_externo', 'telefono'];
export const MENSAJE_CANAL_REQUERIDO = 'Elegí un canal de venta para guardar.';

/** Conserva canales históricos existentes, pero no permite asignarlos de nuevo. */
export function exigirCanalVenta(canal: unknown, guardado?: string | null): void {
  if (typeof canal === 'string' && (
    ORDEN_CANALES_VENTA.some((value) => value === canal) ||
    (canal === guardado && HISTORICOS.includes(canal))
  )) return;
  throw new BadRequestException(MENSAJE_CANAL_REQUERIDO);
}
