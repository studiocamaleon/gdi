/** Compatibilidad del medio con el destino, compartida por API y formulario. */
export const MEDIOS_BANCARIOS = [
  'transferencia',
  'tarjeta_debito',
  'tarjeta_credito',
  'billetera_qr',
  'debito_automatico',
];
export function medioBancario(tipo: string) {
  return MEDIOS_BANCARIOS.includes(tipo);
}
export function cuentaCompatibleCobro(medio: string, cuenta: string) {
  if (medioBancario(medio)) return cuenta === 'banco' || cuenta === 'billetera';
  if (medio === 'efectivo') return cuenta === 'caja';
  return !['cartera_valores', 'cartera_valores_legacy'].includes(cuenta);
}
