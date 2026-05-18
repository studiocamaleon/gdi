import { getVarianteOptionChips } from "@/lib/materias-primas-variantes-display";

type MateriaPrimaDisplay = {
  codigo: string;
  nombre: string;
  templateId: string;
};

type VarianteDisplay = {
  sku: string;
  nombreVariante: string | null;
  precioReferencia: string | null;
  atributosVarianteJson?: Record<string, unknown> | null;
};

export function getSlotMaterialVariantDisplay(
  materiaPrima: MateriaPrimaDisplay,
  variante: VarianteDisplay,
) {
  const details = getVarianteOptionChips(
    {
      id: "",
      codigo: materiaPrima.codigo,
      nombre: materiaPrima.nombre,
      descripcion: "",
      familia: "sustrato",
      subfamilia: "sustrato_hoja",
      tipoTecnico: "",
      templateId: materiaPrima.templateId,
      unidadStock: "unidad",
      unidadCompra: "unidad",
      esConsumible: false,
      esRepuesto: false,
      activo: true,
      atributosTecnicos: {},
      variantes: [],
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "",
      sku: variante.sku,
      nombreVariante: variante.nombreVariante ?? "",
      activo: true,
      atributosVariante: variante.atributosVarianteJson ?? {},
      unidadStock: null,
      unidadCompra: null,
      precioReferencia: variante.precioReferencia
        ? Number(variante.precioReferencia)
        : null,
      moneda: "ARS",
      proveedorReferenciaId: null,
      proveedorReferenciaNombre: "",
    },
    { maxDimensiones: 6 },
  ).map((detail) => ({ label: detail.label, value: detail.value }));

  const label =
    details.length > 0
      ? details.map((detail) => `${detail.label}: ${detail.value}`).join(" · ")
      : variante.nombreVariante?.trim() || "Variante sin descripcion";

  const price = variante.precioReferencia
    ? Number(variante.precioReferencia).toLocaleString("es-AR")
    : null;

  return {
    label,
    description: price
      ? `${materiaPrima.nombre} · Referencia: $${price}`
      : materiaPrima.nombre,
    details,
    fallbackCode: variante.sku,
  };
}

export function getSlotMaterialVariantSortValue(variante: VarianteDisplay) {
  const attrs = variante.atributosVarianteJson ?? {};
  const raw =
    attrs.espesor ??
    attrs.espesorMm ??
    attrs.espesor_mm ??
    attrs.espesorMicrones;
  const value = typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function sortSlotMaterialVariantsByThickness<T extends { sortEspesor: number | null }>(
  variantes: T[],
) {
  return [...variantes].sort((left, right) => {
    const leftHasThickness = left.sortEspesor !== null;
    const rightHasThickness = right.sortEspesor !== null;
    if (leftHasThickness && rightHasThickness) {
      return (left.sortEspesor ?? 0) - (right.sortEspesor ?? 0);
    }
    if (leftHasThickness) return -1;
    if (rightHasThickness) return 1;
    return 0;
  });
}
