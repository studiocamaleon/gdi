/** Contrato de la cantidad propia del paso. Espejo entre web y API. */
export const FUENTE_CANTIDAD_MANUAL = "cantidad_manual";
export interface CantidadManualConfig {
  etiqueta: string;
  unidad: string;
}
export interface CantidadManualRegistrada extends CantidadManualConfig {
  valor: number;
}
export function cantidadManualKey(configPasoId: string) {
  return `cantidadManual_${configPasoId}`;
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function usaCantidadManual(params: unknown): boolean {
  return record(params).productivityQuantitySource === FUENTE_CANTIDAD_MANUAL;
}
export function leerCantidadManual(
  params: unknown,
): CantidadManualConfig | null {
  if (!usaCantidadManual(params)) return null;
  const config = record(record(params).cantidadManual);
  return {
    etiqueta: typeof config.etiqueta === "string" ? config.etiqueta : "",
    unidad: typeof config.unidad === "string" ? config.unidad : "",
  };
}
export function errorConfigCantidadManual(params: unknown): string | null {
  const config = leerCantidadManual(params);
  if (!config) return null;
  if (!config.etiqueta.trim() || config.etiqueta.trim().length > 80)
    return "Ingresá un nombre de hasta 80 caracteres para la cantidad del paso.";
  if (!config.unidad.trim() || config.unidad.trim().length > 24)
    return "Ingresá una unidad de hasta 24 caracteres para la cantidad del paso.";
  return null;
}
export function cantidadManualValida(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
export function errorValorCantidadManual(
  config: CantidadManualConfig,
  value: unknown,
): string | null {
  return cantidadManualValida(value)
    ? null
    : `Ingresá "${config.etiqueta.trim() || "Cantidad del paso"}" (${config.unidad.trim() || "unidades"}) con un valor mayor que cero.`;
}
export function restaurarCantidadesManuales(
  ctx: Record<string, unknown>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(ctx)
      .filter(
        ([key, value]) =>
          key.startsWith("cantidadManual_") && cantidadManualValida(value),
      )
      .map(([key, value]) => [
        key.slice("cantidadManual_".length),
        value as number,
      ]),
  );
}
