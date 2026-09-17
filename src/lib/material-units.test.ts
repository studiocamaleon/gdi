import { describe, expect, it } from "vitest";
import { getMateriaPrimaTemplate } from "./materia-prima-templates";
import { materialUnitConversion } from "./material-units";

describe("Equivalencias y unidades declaradas en las plantillas", () => {
  it.each([
    "sustrato_hoja_v1", "componente_editorial_hoja_v1", "sustrato_rigido_v1",
    "sustrato_rollo_flexible_v1", "vinilo_esmerilado_rollo_v1", "vinilo_de_corte_rollo_v1",
    "film_transferencia_v1", "papel_transferencia_v1", "laminado_film_v1", "laminado_pouch_v1", "iman_flexible_rollo_v1",
  ])("%s usa la misma escala en la ficha y en el cálculo", (templateId) => {
    const template = getMateriaPrimaTemplate(templateId)!;
    expect(template).toBeDefined();
    const fields = template.camposTecnicos;
    const width = fields.find(field => field.key === "ancho")!;
    const length = fields.find(field => field.key === "largo") ?? fields.find(field => field.key === "alto")!;
    const scale: Record<string, number> = { m: 1, cm: 0.01, mm: 0.001 };
    const conversion = materialUnitConversion({ unidadStock: "m2", unidadCompra: length.key === "largo" ? "rollo" : "hoja", templateId, atributos: { ancho: 2, [length.key]: 3 } }, length.key === "largo" ? "rollo" : "hoja", "m2");
    expect(conversion.ok && conversion.factor).toBeCloseTo(2 * scale[width.unit!] * 3 * scale[length.unit!], 10);
  });
});
