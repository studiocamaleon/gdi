/** Datos del catálogo de cada tenant; la presentación nunca crea variantes. */
export type CandidatoMaterialVisual = {
  materiaPrimaId: string;
  templateId: string;
  label: string;
  defaultVarianteId?: string | null;
  variantes: readonly {
    variantId: string;
    nombreVariante?: string | null;
    sku: string;
    missingPrice: boolean;
    atributosVarianteJson?: Record<string, unknown> | null;
  }[];
};

export function numeroPositivoMaterial(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+(?:[.,]\d+)?$/.test(value.trim())) return null;
  const parsed = typeof value === "number" ? value : Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function textoMaterial(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Cada clave declara su unidad; nunca se deduce por la magnitud del número. */
export function medidaMaterial(
  attrs: Record<string, unknown>,
  campos: readonly (readonly [string, number])[],
): number | null {
  for (const [key, factor] of campos) {
    // Un valor canónico inválido no se reemplaza por un alias posiblemente viejo.
    if (attrs[key] !== undefined && attrs[key] !== null && attrs[key] !== "") {
      const value = numeroPositivoMaterial(attrs[key]);
      return value === null ? null : value * factor;
    }
  }
  return null;
}

export function normalizarBusquedaMaterial(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

/** Vacío explícito significa elección pendiente, no volver al default anterior. */
export function seleccionVarianteVisualResuelta(candidatos: readonly CandidatoMaterialVisual[], seleccion: string | undefined): string {
  const predeterminada = candidatos.find((c) => c.defaultVarianteId)?.defaultVarianteId;
  const unica = candidatos.length === 1 && candidatos[0].variantes.length === 1 ? candidatos[0].variantes[0].variantId : "";
  const id = seleccion ?? predeterminada ?? unica;
  return candidatos.some((c) => c.variantes.some((v) => v.variantId === id)) ? id : "";
}
