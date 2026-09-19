/** Las funciones piloto requieren habilitación explícita, incluso en planes
 * con `todo` o cuentas anteriores a las suscripciones. */
export function incluyeImpresionDirecta(
  estado: string | undefined,
  features: unknown,
): boolean {
  return (
    estado === 'activa' &&
    !!features &&
    typeof features === 'object' &&
    !Array.isArray(features) &&
    (features as Record<string, unknown>).impresionDirecta === true
  );
}
