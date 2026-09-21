/** Las funciones piloto requieren habilitación explícita, incluso en planes
 * con `todo` o cuentas anteriores a las suscripciones. */
export type ClaveFuncionPlan =
  | 'afip'
  | 'whatsapp'
  | 'centroCopiado'
  | 'impresionDirecta';

/** Contrato único de inclusión, compartido por los gates y su diagnóstico. */
export function funcionIncluidaEnPlan(
  clave: ClaveFuncionPlan,
  plan: { featuresJson: unknown } | null,
): boolean {
  if (clave === 'impresionDirecta')
    return incluyeImpresionDirecta('activa', plan?.featuresJson);
  if (!plan) return true;
  const features =
    plan.featuresJson &&
    typeof plan.featuresJson === 'object' &&
    !Array.isArray(plan.featuresJson)
      ? (plan.featuresJson as Record<string, unknown>)
      : {};
  return features.todo === true || features[clave] === true;
}

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
