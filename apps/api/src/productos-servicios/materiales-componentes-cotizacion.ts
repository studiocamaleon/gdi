import { productoParaCotizacion } from './producto-cotizacion-publico';

function registro(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function bindingsMateriales(configuracion: unknown) {
  const bindings = registro(configuracion).bindings;
  return Array.isArray(bindings)
    ? bindings
        .map(registro)
        .filter(
          (binding) =>
            binding.origen === 'COTIZACION' &&
            (binding.tipoDato === 'material' ||
              String(binding.clave).startsWith('slotMateriales.')),
        )
    : [];
}

export function idsMaterialesComponentes(configuraciones: unknown[]): string[] {
  return [
    ...new Set(
      configuraciones.flatMap((configuracion) =>
        bindingsMateriales(configuracion).flatMap((binding) =>
          Array.isArray(binding.opciones)
            ? binding.opciones.flatMap((opcion) => {
                const valor = registro(opcion).valor;
                return typeof valor === 'string' && valor ? [valor] : [];
              })
            : [],
        ),
      ),
    ),
  ];
}

export type VarianteMaterialComponente = {
  id: string;
  sku: string;
  nombreVariante: string | null;
  atributosVarianteJson: unknown;
  precioReferencia: unknown;
  materiaPrima: { id: string; nombre: string; templateId: string };
};

/** Enriquece sólo las opciones ya declaradas; no cambia ni publica la receta. */
export function conMaterialesComponentes(
  configuracion: unknown,
  variantes: ReadonlyMap<string, VarianteMaterialComponente>,
): unknown {
  const materiales = new Set(bindingsMateriales(configuracion));
  const config = registro(configuracion);
  if (!materiales.size || !Array.isArray(config.bindings)) return configuracion;
  return {
    ...config,
    bindings: config.bindings.map((binding: Record<string, unknown>) => {
      if (!materiales.has(binding)) return binding;
      const grupos = new Map<
        string,
        {
          materiaPrimaId: string;
          templateId: string;
          label: string;
          variantes: Array<{
            variantId: string;
            sku: string;
            nombreVariante: string | null;
            atributosVarianteJson: unknown;
            missingPrice: boolean;
          }>;
        }
      >();
      for (const id of idsMaterialesComponentes([{ bindings: [binding] }])) {
        const variante = variantes.get(id);
        if (!variante) continue;
        const material = variante.materiaPrima;
        if (!grupos.has(material.id))
          grupos.set(material.id, {
            materiaPrimaId: material.id,
            templateId: material.templateId,
            label: material.nombre,
            variantes: [],
          });
        const publico = productoParaCotizacion({
          atributosVarianteJson: variante.atributosVarianteJson,
        }) as Record<string, unknown>;
        grupos.get(material.id)!.variantes.push({
          variantId: variante.id,
          sku: variante.sku,
          nombreVariante: variante.nombreVariante,
          atributosVarianteJson: publico.atributosVarianteJson,
          missingPrice: !(Number(variante.precioReferencia) > 0),
        });
      }
      return { ...binding, materiales: [...grupos.values()] };
    }),
  };
}
