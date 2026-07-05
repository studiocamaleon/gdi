// Config de "herramientas" opcionales por producto, guardada dentro de
// `atributosComercialesJson.herramientas`. Pensado para ser extensible: hoy
// sólo `medidasDesdeArchivo`, pero el shape permite sumar más herramientas sin
// migraciones de base de datos.

export type HerramientaMedidasArchivo = {
  enabled: boolean;
  unaFilaPorPagina: boolean;
};

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getHerramientaMedidasArchivo(
  atributos: Record<string, unknown> | null | undefined,
): HerramientaMedidasArchivo {
  const config = getRecord(getRecord(atributos).herramientas).medidasDesdeArchivo;
  const record = getRecord(config);
  return {
    enabled: record.enabled === true,
    unaFilaPorPagina: record.unaFilaPorPagina !== false,
  };
}

export function setHerramientaMedidasArchivo(
  atributos: Record<string, unknown> | null | undefined,
  enabled: boolean,
): Record<string, unknown> {
  const base = { ...getRecord(atributos) };
  const herramientas = { ...getRecord(base.herramientas) };
  herramientas.medidasDesdeArchivo = { enabled, unaFilaPorPagina: true };
  base.herramientas = herramientas;
  return base;
}
