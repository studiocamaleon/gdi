import type {
  ConfiguracionComponenteFabricado,
  PoliticaNestingCompuesto,
  ProductoRecetaComponenteInput,
} from "@/lib/productos-servicios-api";

const MOTIVO_EXCLUSION_MANUAL = "Excluido manualmente en la receta";

function esRegistro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function leerPoliticaNestingCompuesto(
  atributosComercialesJson: unknown,
): PoliticaNestingCompuesto {
  if (!esRegistro(atributosComercialesJson)) return "INDEPENDIENTE";
  const configuracion = atributosComercialesJson.nestingCompuesto;
  if (!esRegistro(configuracion) || configuracion.version !== 1) {
    return "INDEPENDIENTE";
  }
  return configuracion.politica === "CONSOLIDAR_COMPATIBLES"
    ? "CONSOLIDAR_COMPATIBLES"
    : "INDEPENDIENTE";
}

export function actualizarPoliticaNestingCompuesto(
  atributosComercialesJson: unknown,
  politica: PoliticaNestingCompuesto,
): Record<string, unknown> {
  const atributos = esRegistro(atributosComercialesJson)
    ? { ...atributosComercialesJson }
    : {};
  return {
    ...atributos,
    nestingCompuesto: {
      version: 1,
      politica,
    },
  };
}

export function estaExcluidoDelNestingCompuesto(
  configuracionJson: ConfiguracionComponenteFabricado | null | undefined,
) {
  return (
    configuracionJson?.nestingCompuesto?.version === 1 &&
    configuracionJson.nestingCompuesto.excluido === true
  );
}

function configuracionOperativa(
  componente: ProductoRecetaComponenteInput,
): ConfiguracionComponenteFabricado {
  const actual = componente.configuracionJson;
  if (
    actual &&
    [1, 2].includes(actual.version) &&
    Array.isArray(actual.bindings) &&
    actual.bindings.some((binding) => binding.clave === "cantidad")
  ) {
    return { ...actual };
  }

  const factor = Number.isFinite(Number(componente.cantidad))
    ? Number(componente.cantidad)
    : 1;
  return {
    version: 2,
    bindings: [
      {
        clave: "cantidad",
        etiqueta: "Cantidad",
        tipoDato: "number",
        unidad: componente.unidad ?? "unidad",
        requerido: true,
        origen: "FORMULA",
        regla: {
          campoPadre: "cantidad",
          operador: "MULTIPLICAR",
          valor: factor,
          fuente: { tipo: "PADRE", campo: "cantidad" },
        },
      },
    ],
  };
}

export function actualizarExclusionNestingComponente(
  componente: ProductoRecetaComponenteInput,
  excluido: boolean,
): ProductoRecetaComponenteInput {
  if (!excluido && !componente.configuracionJson?.nestingCompuesto) {
    return componente;
  }
  const configuracion = configuracionOperativa(componente);
  const resto = { ...configuracion };
  delete resto.nestingCompuesto;
  return {
    ...componente,
    configuracionJson: excluido
      ? {
          ...resto,
          nestingCompuesto: {
            version: 1,
            excluido: true,
            motivo: MOTIVO_EXCLUSION_MANUAL,
          },
        }
      : resto,
  };
}
