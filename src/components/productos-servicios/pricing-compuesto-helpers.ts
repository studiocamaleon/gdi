import type {
  ConfiguracionComponenteFabricado,
  ModoPricingComponente,
  PoliticaPricingComponente,
  ProductoReceta,
  ProductoRecetaComponenteInput,
  ProductoRecetaRevision,
} from "@/lib/productos-servicios-api";
import type { TabPrecioConfig } from "./tab-precio-editor";

export type ComponentesPricingPorRuta = Record<
  string,
  ProductoRecetaComponenteInput[]
>;

const METODOS_PRECIO = new Set<TabPrecioConfig["metodoCalculo"]>([
  "por_margen",
  "precio_fijo",
  "precio_fijo_para_margen_minimo",
  "margen_variable",
  "fijado_por_cantidad",
  "fijo_con_margen_variable",
  "variable_por_cantidad",
]);

export const PRECIO_OVERRIDE_INICIAL: TabPrecioConfig = {
  metodoCalculo: "por_margen",
  detalle: { marginPct: 40, minimumMarginPct: 25 },
};

function esRegistro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function esTabPrecioConfig(value: unknown): value is TabPrecioConfig {
  if (!esRegistro(value) || !esRegistro(value.detalle)) return false;
  return METODOS_PRECIO.has(
    value.metodoCalculo as TabPrecioConfig["metodoCalculo"],
  );
}

function cleanForCompare(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanForCompare);
  if (!esRegistro(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, cleanForCompare(entry)]),
  );
}

export function revisionPricingReceta(
  receta: ProductoReceta,
): ProductoRecetaRevision | null {
  return (
    receta.revisiones.find((revision) => revision.estado === "BORRADOR") ??
    receta.revisionPublicada ??
    null
  );
}

export function componenteRevisionAInput(
  item: ProductoRecetaRevision["componentes"][number],
): ProductoRecetaComponenteInput {
  return {
    productoComponenteId: item.productoComponenteId,
    codigo: item.codigo,
    nombre: item.nombre,
    politicaEjecucion: item.politicaEjecucion,
    formula: item.formula,
    cantidad: Number(item.cantidad),
    unidad: item.unidad,
    requerido: item.requerido,
    configuracionJson: item.configuracionJson,
    nodoIncorporacionClave: item.nodoIncorporacionClave,
    nodosPredecesoresClaves: item.nodosPredecesoresClaves ?? [],
    orden: item.orden,
  };
}

export function crearComponentesPricingPorRuta(
  recetas: ProductoReceta[],
): ComponentesPricingPorRuta {
  return Object.fromEntries(
    recetas.map((receta) => {
      const revision = revisionPricingReceta(receta);
      return [
        receta.rutaAlternativa.id,
        revision?.componentes.map(componenteRevisionAInput) ?? [],
      ];
    }),
  );
}

export function componentesPricingKey(value: ComponentesPricingPorRuta) {
  return JSON.stringify(cleanForCompare(value));
}

export function leerPoliticaPricingComponente(
  configuracionJson: ConfiguracionComponenteFabricado | null | undefined,
): PoliticaPricingComponente & {
  precioConfigOverride?: TabPrecioConfig;
  precioConfigSnapshot?: TabPrecioConfig;
} {
  const raw = configuracionJson?.pricing;
  const modo = raw?.modo;
  if (
    raw?.version !== 1 ||
    ![
      "HEREDAR_PADRE",
      "USAR_PRODUCTO_HIJO",
      "OVERRIDE",
    ].includes(String(modo))
  ) {
    return { version: 1, modo: "HEREDAR_PADRE" };
  }
  return {
    version: 1,
    modo: modo as ModoPricingComponente,
    ...(esTabPrecioConfig(raw.precioConfigOverride)
      ? { precioConfigOverride: raw.precioConfigOverride }
      : {}),
    ...(esTabPrecioConfig(raw.precioConfigSnapshot)
      ? { precioConfigSnapshot: raw.precioConfigSnapshot }
      : {}),
  };
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

export function actualizarPoliticaPricingComponente(
  componente: ProductoRecetaComponenteInput,
  modo: ModoPricingComponente,
  precioConfigOverride?: TabPrecioConfig,
): ProductoRecetaComponenteInput {
  const actual = leerPoliticaPricingComponente(componente.configuracionJson);
  const override =
    precioConfigOverride ??
    actual.precioConfigOverride ??
    PRECIO_OVERRIDE_INICIAL;
  const pricing: PoliticaPricingComponente = {
    version: 1,
    modo,
    ...(modo === "OVERRIDE" ? { precioConfigOverride: override } : {}),
  };

  return {
    ...componente,
    configuracionJson: {
      ...configuracionOperativa(componente),
      pricing,
    },
  };
}
