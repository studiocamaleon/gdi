import type { PublicPlan } from "./public-plans";

export type ComparisonRow = {
  key: string;
  name: string;
  group: string;
  values: (string | boolean | null)[];
};

const number = new Intl.NumberFormat("es-AR");

/** Sólo comparamos capacidades presentes en las ofertas públicas, sin herencia implícita. */
export function comparisonRows(plans: PublicPlan[]): ComparisonRow[] {
  const resources: ComparisonRow[] = [
    {
      key: "usuariosMax",
      name: "Usuarios incluidos",
      group: "Equipo y capacidad",
      values: plans.map(({ features }) =>
        typeof features.usuariosMax === "number"
          ? features.usuariosMax > 0
            ? number.format(features.usuariosMax)
            : "Sin límite"
          : null,
      ),
    },
    {
      key: "storageGb",
      name: "Almacenamiento",
      group: "Equipo y capacidad",
      values: plans.map(({ features }) =>
        typeof features.storageGb === "number"
          ? `${number.format(features.storageGb)} GB`
          : null,
      ),
    },
  ];
  const capabilities = new Map<
    string,
    NonNullable<PublicPlan["prestaciones"]>[number]
  >();
  const included = plans.map((plan) => {
    for (const capability of plan.prestaciones ?? []) {
      // Retirada de la oferta comercial el 22/09/2026. No anunciarla aunque
      // una versión de plan anterior todavía la incluya en su contrato.
      if (capability.clave === "whatsapp_web") continue;
      if (!capabilities.has(capability.clave))
        capabilities.set(capability.clave, capability);
    }
    return new Set((plan.prestaciones ?? []).map((p) => p.clave));
  });
  return [
    ...resources.filter((row) => row.values.some((value) => value !== null)),
    ...Array.from(capabilities.values(), (capability) => ({
      key: capability.clave,
      name: capability.nombre,
      group: capability.grupo,
      values: included.map((keys) => keys.has(capability.clave)),
    })),
  ];
}

export function hasDifferences(row: ComparisonRow) {
  return new Set(row.values).size > 1;
}
