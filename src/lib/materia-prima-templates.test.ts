import { describe, expect, it } from "vitest";
import { getMateriaPrimaTemplate, materiaPrimaTemplatesV1 } from "@/lib/materia-prima-templates";
import { familiaMateriaPrimaItems, subfamiliaMateriaPrimaItems } from "@/lib/materias-primas";

describe("clasificación y datos textiles", () => {
  it("las familias de todas las plantillas se pueden mostrar y seleccionar en la ficha", () => {
    for (const template of materiaPrimaTemplatesV1) {
      expect(familiaMateriaPrimaItems.some((o) => o.value === template.familia), template.id).toBe(true);
      expect(subfamiliaMateriaPrimaItems.some((o) => o.value === template.subfamilia), template.id).toBe(true);
    }
  });

  it("indumentaria es un producto base por unidad y separa título de hilado y gramaje", () => {
    const template = getMateriaPrimaTemplate("textil_indumentaria_v1")!;
    expect(template).toMatchObject({ familia: "sustrato", subfamilia: "textil_indumentaria", unidadStock: "unidad", unidadCompra: "unidad", defaults: { esProductoBase: true } });
    const titulo = template.camposTecnicos.find((f) => f.key === "tituloHilado")!;
    expect(titulo.type).toBe("text");
    expect(titulo.unit).toBeUndefined();
    expect(template.dimensionesVariante).toContain("tituloHilado");
    expect(template.requiredAtributos).not.toContain("tituloHilado");
    expect(template.atributosIniciales).not.toHaveProperty("tituloHilado");
    expect(template.camposTecnicos.find((f) => f.key === "gramaje")).toMatchObject({ label: "Gramaje de la tela", type: "number", unit: "g_m2", optional: true });
  });
});

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
