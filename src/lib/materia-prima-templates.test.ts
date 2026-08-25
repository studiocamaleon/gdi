import { describe, expect, it } from "vitest";
import { getMateriaPrimaTemplate } from "@/lib/materia-prima-templates";

describe("plantilla de vinilo esmerilado", () => {
  it("limita el selector de acabado a Blanco y Gris", () => {
    const template = getMateriaPrimaTemplate("vinilo_esmerilado_rollo_v1");
    const acabado = template?.camposTecnicos.find(
      (field) => field.key === "acabado",
    );

    expect(template).toMatchObject({
      subfamilia: "sustrato_rollo_flexible",
      tipoTecnico: "vinilo_esmerilado",
    });
    expect(acabado?.options).toEqual(["Blanco", "Gris"]);
  });
});

describe("plantilla de pegatina raspadita", () => {
  it("la costea por unidad y define ancho antes que alto", () => {
    const template = getMateriaPrimaTemplate("pegatina_raspadita_v1");

    expect(template).toMatchObject({
      familia: "terminacion_editorial",
      subfamilia: "pegatina_raspadita",
      unidadStock: "unidad",
      dimensionesVariante: ["ancho", "alto", "forma", "color"],
      requiredAtributos: ["ancho", "alto"],
    });
    expect(template?.defaults?.esConsumible).toBe(true);
  });
});
