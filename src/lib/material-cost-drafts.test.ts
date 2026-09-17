import { describe, expect, it } from "vitest";
import {
  buildMaterialCostChanges,
  changeMaterialCostUnit,
  changeMaterialVariantCost,
} from "./material-cost-drafts";
import type { MateriaPrima, MateriaPrimaVariante } from "./materias-primas";

const variant = (id: string): MateriaPrimaVariante => ({
  id,
  sku: id,
  nombreVariante: "",
  activo: true,
  atributosVariante: { ancho: 1, alto: 2 },
  unidadCompra: null,
  unidadStock: null,
  unidadUso: null,
  unidadPrecio: "placa",
  equivalenciaCompra: null,
  equivalencias: [],
  precioReferencia: 100,
  moneda: "ARS",
  proveedorReferenciaId: null,
  proveedorReferenciaNombre: "",
});
const material: MateriaPrima = {
  id: "pai",
  codigo: "PAI",
  nombre: "Alto Impacto",
  descripcion: "",
  familia: "sustrato",
  subfamilia: "sustrato_rigido",
  tipoTecnico: "",
  templateId: "sustrato_rigido_v1",
  unidadCompra: "placa",
  unidadStock: "placa",
  unidadUso: "m2",
  esConsumible: false,
  esRepuesto: false,
  activo: true,
  atributosTecnicos: {},
  variantes: [variant("v1"), variant("v2")],
  createdAt: "",
  updatedAt: "",
};

describe("Edición aislada de costos de materiales", () => {
  it("abrir o filtrar la tabla no genera cambios ni exige sembrar precios", () => {
    expect(buildMaterialCostChanges([material], {}, "ARS")).toEqual({
      variantes: [],
      materiales: [],
    });
  });

  it("conserva las referencias de las variantes no editadas", () => {
    const first = changeMaterialVariantCost({}, "v1", { precio: "150" });
    const second = changeMaterialVariantCost(first, "v2", { moneda: "USD" });
    expect(second.variantes?.v1).toBe(first.variantes?.v1);
    expect(first.variantes?.v2).toBeUndefined();
    const third = changeMaterialVariantCost(second, "v1", { precio: "175" });
    expect(third.variantes?.v2).toBe(second.variantes?.v2);
    expect(second.variantes?.v1.precio).toBe("150");
  });

  it("guarda el último importe, moneda y coeficiente juntos sin perder cambios anteriores", () => {
    const relations = [{ origen: "m2", destino: "kg", factor: 1.1 }];
    let draft = changeMaterialCostUnit(material, {}, "unidadCompra", "kg");
    draft = changeMaterialVariantCost(draft, "v1", {
      precio: "4,16",
      moneda: "USD",
    });
    draft = changeMaterialVariantCost(draft, "v1", {
      conversion: { equivalencias: relations },
    });
    const payload = buildMaterialCostChanges([material], { pai: draft }, "ARS");
    expect(payload.materiales).toEqual([{ id: "pai", unidadCompra: "kg" }]);
    expect(payload.variantes?.find((v) => v.id === "v1")).toEqual({
      id: "v1",
      precioReferencia: 4.16,
      moneda: "USD",
      unidadPrecio: "kg",
      equivalencias: relations,
      equivalenciaCompra: null,
    });
    expect(payload.variantes?.find((v) => v.id === "v2")?.unidadPrecio).toBe(
      "kg",
    );
  });

  it("volver al valor original descuenta los cambios", () => {
    let draft = changeMaterialVariantCost({}, "v1", { precio: "120" });
    draft = changeMaterialVariantCost(draft, "v1", { precio: "100" });
    draft = changeMaterialCostUnit(material, draft, "unidadCompra", "m2");
    draft = changeMaterialCostUnit(material, draft, "unidadCompra", "placa");
    expect(buildMaterialCostChanges([material], { pai: draft }, "ARS")).toEqual(
      { variantes: [], materiales: [] },
    );
  });

  it("el cambio general conserva importes, monedas y coeficientes ya editados", () => {
    const relations = [{ origen: "m2", destino: "kg", factor: 1.1 }];
    const before = changeMaterialVariantCost({}, "v1", {
      precio: "4.16",
      moneda: "USD",
      conversion: { equivalencias: relations },
    });
    const after = changeMaterialCostUnit(
      material,
      before,
      "unidadCompra",
      "kg",
    );
    expect(after.variantes?.v1).toMatchObject({
      precio: "4.16",
      moneda: "USD",
      conversion: { equivalencias: relations, unidadPrecio: "kg" },
    });
    expect(before.variantes?.v1.conversion?.unidadPrecio).toBeUndefined();
  });

  it("mantiene los borradores de otros materiales en el guardado conjunto", () => {
    const other = { ...material, id: "otro", variantes: [variant("v3")] };
    const drafts = {
      pai: changeMaterialVariantCost({}, "v1", { precio: "111" }),
      otro: changeMaterialVariantCost({}, "v3", { precio: "222" }),
    };
    expect(
      buildMaterialCostChanges([material, other], drafts, "ARS").variantes,
    ).toEqual([
      { id: "v1", precioReferencia: 111 },
      { id: "v3", precioReferencia: 222 },
    ]);
  });

  it("stock y consumo no modifican el precio ni su unidad", () => {
    const draft = changeMaterialCostUnit(material, {}, "unidadUso", "placa");
    expect(buildMaterialCostChanges([material], { pai: draft }, "ARS")).toEqual(
      {
        materiales: [{ id: "pai", unidadUso: "placa" }],
        variantes: [],
      },
    );
  });

  it("no transforma un precio vacío en cero y permite un cero explícito", () => {
    const empty = changeMaterialVariantCost({}, "v1", { precio: "" });
    expect(
      buildMaterialCostChanges([material], { pai: empty }, "ARS").variantes,
    ).toEqual([]);
    const zero = changeMaterialVariantCost(empty, "v1", { precio: "0" });
    expect(
      buildMaterialCostChanges([material], { pai: zero }, "ARS").variantes,
    ).toEqual([{ id: "v1", precioReferencia: 0 }]);
  });
});
