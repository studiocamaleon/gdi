/**
 * ¿Un paso de la ruta PUEDE ejecutarse en esta ruta?
 *
 * Gate ESTRUCTURAL único: el rutaPaso está activo Y su modo de activación no es
 * "no se usa acá" (`NO_EJECUTAR`). Un paso NO_EJECUTAR (o de un rutaPaso
 * inactivo) está muerto en esta ruta: no cotiza y no se le puede configurar
 * NADA en el sheet del comercial.
 *
 * Es la ÚNICA definición de "ejecutable". Todas las derivaciones de controles
 * del comercial (materiales, params, modo de color, tecnología, caras, tiempo
 * manual) la comparten para no divergir.
 *
 * [Antes vivía sólo dentro de `agregar-producto-sheet.tsx` como
 * `isExecutableConfigPaso`, y `getParamsComercialDeRuta` —escrita en otro
 * archivo— NO la aplicaba: los params de un paso NO_EJECUTAR (p.ej. Iluminación
 * LED en un frontlight) se colaban en la planilla aunque el motor los ignore.]
 */
export const MODO_ACTIVACION_NO_EJECUTAR = "NO_EJECUTAR";

export function esConfigPasoEjecutable(config: {
  modoActivacion: string | null;
  rutaPaso: { activo?: boolean };
}): boolean {
  // `activo !== false`: en datos reales `activo` siempre es booleano; el
  // `undefined` (fixtures/parciales) se considera activo por defecto.
  return (
    config.rutaPaso.activo !== false &&
    config.modoActivacion !== MODO_ACTIVACION_NO_EJECUTAR
  );
}
