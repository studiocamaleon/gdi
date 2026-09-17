import { describe, expect, it } from "vitest";
import { changedMaterialUnits, resolveMaterialVariantUnits } from "./material-unit-drafts";

const material = {
  unidadCompra: "placa",
  unidadStock: "placa",
  unidadUso: "m2",
  variantes: [
    { unidadCompra: null, unidadStock: null, unidadUso: null },
    { unidadCompra: "kg", unidadStock: "m2", unidadUso: "placa" },
  ],
} as const;
const fixture = { ...material, variantes: [...material.variantes] };

describe("Unidades del editor de costos", () => {
  it("al abrir conserva las excepciones y no genera cambios", () => {
    expect(changedMaterialUnits(fixture)).toEqual({});
    expect(resolveMaterialVariantUnits(fixture, fixture.variantes[1])).toEqual({
      unidadCompra: "kg", unidadStock: "m2", unidadUso: "placa",
    });
  });

  it("muestra las unidades heredadas en las variantes sin excepción", () => {
    expect(resolveMaterialVariantUnits(fixture, fixture.variantes[0])).toEqual({
      unidadCompra: "placa", unidadStock: "placa", unidadUso: "m2",
    });
  });

  it("aplica la compra seleccionada a todas las variantes sin cambiar stock o consumo", () => {
    const draft = { unidadCompra: "m2" } as const;
    expect(changedMaterialUnits(fixture, draft)).toEqual(draft);
    expect(fixture.variantes.map(variant => resolveMaterialVariantUnits(fixture, variant, draft).unidadCompra))
      .toEqual(["m2", "m2"]);
    expect(resolveMaterialVariantUnits(fixture, fixture.variantes[1], draft)).toEqual({
      unidadCompra: "m2", unidadStock: "m2", unidadUso: "placa",
    });
  });

  it("al volver a la compra original mantiene la selección y envía la limpieza de excepciones", () => {
    const draft = { unidadCompra: "placa" } as const;
    expect(changedMaterialUnits(fixture, draft)).toEqual(draft);
    expect(resolveMaterialVariantUnits(fixture, fixture.variantes[1], draft).unidadCompra).toBe("placa");
  });

  it("volver a la unidad original sin excepciones no genera un cambio", () => {
    expect(changedMaterialUnits({ ...fixture, variantes: [fixture.variantes[0]] }, { unidadCompra: "placa" }))
      .toEqual({});
  });

  it("el fallback de consumo sigue al material, aunque la variante tenga otro stock", () => {
    expect(resolveMaterialVariantUnits({ ...fixture, unidadUso: null }, {
      unidadCompra: null, unidadStock: "kg", unidadUso: null,
    }).unidadUso).toBe("placa");
  });
});
