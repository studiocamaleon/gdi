import { describe, expect, it } from "vitest";
import {
  materialCoefficientFields,
  updateMaterialCoefficient,
} from "./material-coefficients";
import {
  materialPriceInUseUnit,
  materialUnitConversion,
  validateMaterialUnits,
  type MaterialUnitContext,
} from "./material-units";

const pai: MaterialUnitContext = {
  unidadCompra: "kg",
  unidadStock: "placa",
  unidadUso: "m2",
  unidadPrecio: "kg",
  templateId: "sustrato_rigido_v1",
  atributos: { ancho: 1, alto: 2 },
};
const pallet: MaterialUnitContext = {
  unidadCompra: "pallet",
  unidadStock: "caja",
  unidadUso: "unidad",
  unidadPrecio: "pallet",
};

describe("Coeficientes determinados por las unidades del material", () => {
  it("pide solamente kg/m² para PAI y resuelve las placas por sus medidas", () => {
    expect(materialCoefficientFields(pai)).toEqual([
      {
        key: "m2:kg",
        label: "Coeficiente de consumo",
        origen: "m2",
        destino: "kg",
        factor: undefined,
      },
    ]);
    const configured = {
      ...pai,
      equivalencias: updateMaterialCoefficient(pai, {
        key: "m2:kg",
        factor: 1.1,
      }),
    };
    const cost = materialPriceInUseUnit(configured, 4.16);
    expect(cost.ok && cost.precio).toBeCloseTo(4.576, 8);
    const weight = materialUnitConversion(configured, "placa", "kg");
    expect(weight.ok && weight.factor).toBeCloseTo(2.2, 8);
  });

  it.each([
    { ...pai, unidadCompra: "placa", unidadPrecio: "placa" },
    {
      unidadCompra: "kg",
      unidadStock: "gramo",
      unidadUso: "kg",
      unidadPrecio: "kg",
    },
    { unidadCompra: "pieza", unidadStock: "unidad", unidadUso: "unidad" },
    { unidadCompra: "hoja", unidadStock: "placa", unidadUso: "hoja" },
    {
      unidadCompra: "rollo",
      unidadStock: "metro_lineal",
      unidadUso: "m2",
      templateId: "sustrato_rollo_flexible_v1",
      atributos: { ancho: 1.52, largo: 50 },
    },
  ])(
    "no pide factores para unidades o medidas automáticas: $unidadCompra/$unidadStock/$unidadUso",
    (context) => {
      expect(materialCoefficientFields(context)).toEqual([]);
    },
  );

  it("pide la superficie de cada placa sólo cuando faltan sus medidas", () => {
    const fields = materialCoefficientFields({ ...pai, atributos: {} });
    expect(fields.map(({ origen, destino }) => ({ origen, destino }))).toEqual([
      { origen: "placa", destino: "kg" },
      { origen: "placa", destino: "m2" },
    ]);
  });

  it("pide las dos relaciones independientes de pallet → caja → unidad", () => {
    const fields = materialCoefficientFields(pallet);
    expect(fields.map(({ origen, destino }) => ({ origen, destino }))).toEqual([
      { origen: "pallet", destino: "caja" },
      { origen: "caja", destino: "unidad" },
    ]);
    let configured = {
      ...pallet,
      equivalencias: updateMaterialCoefficient(pallet, {
        key: "pallet:caja",
        factor: 10,
      }),
    };
    configured = {
      ...configured,
      equivalencias: updateMaterialCoefficient(configured, {
        key: "caja:unidad",
        factor: 10,
      }),
    };
    expect(materialPriceInUseUnit(configured, 500)).toEqual({
      ok: true,
      precio: 5,
    });
  });

  it("usa un solo factor cuando compra y consumo coinciden, pero el stock es diferente", () => {
    expect(
      materialCoefficientFields({
        ...pallet,
        unidadCompra: "unidad",
        unidadPrecio: "unidad",
      }),
    ).toHaveLength(1);
  });

  it("conserva la posibilidad de precio por kg con compra en placas", () => {
    const fields = materialCoefficientFields({ ...pai, unidadCompra: "placa" });
    expect(fields).toEqual([
      {
        key: "m2:kg",
        label: "Coeficiente del precio",
        origen: "m2",
        destino: "kg",
        factor: undefined,
      },
    ]);
  });

  it("reexpresa relaciones inversas anteriores sin reinterpretar el valor ni modificar el contexto", () => {
    const context = {
      ...pai,
      equivalencias: [{ origen: "kg", destino: "m2", factor: 1.1 }],
    };
    const before = structuredClone(context);
    expect(materialCoefficientFields(context)[0].factor).toBeCloseTo(
      1 / 1.1,
      12,
    );
    expect(context).toEqual(before);
    const cost = materialPriceInUseUnit(context, 4.16);
    expect(cost.ok && cost.precio).toBeCloseTo(3.7818181818, 8);
  });

  it("deriva kg/m² desde el coeficiente anterior por placa y reemplaza la relación al editar", () => {
    const context = {
      ...pai,
      equivalencias: [{ origen: "placa", destino: "kg", factor: 2.2 }],
    };
    expect(materialCoefficientFields(context)[0].factor).toBeCloseTo(1.1, 12);
    const edited = {
      ...context,
      equivalencias: updateMaterialCoefficient(context, {
        key: "m2:kg",
        factor: 1.2,
      }),
    };
    expect(validateMaterialUnits(edited)).toBeNull();
    const weight = materialUnitConversion(edited, "placa", "kg");
    expect(weight.ok && weight.factor).toBeCloseTo(2.4, 8);
  });

  it("conserva el factor legado al abrir y lo reemplaza al editar", () => {
    const context = { ...pai, equivalenciaCompra: 0.5 };
    expect(materialCoefficientFields(context)[0].factor).toBe(1);
    const edited = {
      ...context,
      equivalencias: updateMaterialCoefficient(context, {
        key: "m2:kg",
        factor: 1.1,
      }),
    };
    expect(materialCoefficientFields(edited)[0].factor).toBe(1.1);
    expect(validateMaterialUnits(edited)).toBeNull();
  });

  it("permite completar una fila mientras la otra se encuentra vacía", () => {
    const context = {
      ...pallet,
      equivalencias: [
        { origen: "pallet", destino: "caja", factor: 0 },
        { origen: "caja", destino: "unidad", factor: 10 },
      ],
    };
    expect(
      materialCoefficientFields(context).map((field) => field.factor),
    ).toEqual([0, 10]);
    const edited = {
      ...context,
      equivalencias: updateMaterialCoefficient(context, {
        key: "pallet:caja",
        factor: 12,
      }),
    };
    expect(materialPriceInUseUnit(edited, 600)).toEqual({
      ok: true,
      precio: 5,
    });
  });

  it("elimina relaciones redundantes para que no contradigan una edición", () => {
    const context = {
      ...pallet,
      equivalencias: [
        { origen: "pallet", destino: "caja", factor: 10 },
        { origen: "caja", destino: "unidad", factor: 10 },
        { origen: "pallet", destino: "unidad", factor: 100 },
      ],
    };
    const edited = {
      ...context,
      equivalencias: updateMaterialCoefficient(context, {
        key: "pallet:caja",
        factor: 12,
      }),
    };
    expect(validateMaterialUnits(edited)).toBeNull();
    expect(materialPriceInUseUnit(edited, 600)).toEqual({
      ok: true,
      precio: 5,
    });
  });

  it("conserva las presentaciones adicionales al editar la cadena principal", () => {
    const context = {
      ...pallet,
      equivalencias: [
        { origen: "pallet", destino: "caja", factor: 10 },
        { origen: "caja", destino: "unidad", factor: 10 },
        { origen: "pack", destino: "unidad", factor: 5 },
      ],
    };
    const edited = {
      ...context,
      equivalencias: updateMaterialCoefficient(context, {
        key: "pallet:caja",
        factor: 12,
      }),
    };
    expect(validateMaterialUnits(edited)).toBeNull();
    const pack = materialUnitConversion(edited, "pack", "unidad");
    expect(pack.ok && pack.factor).toBe(5);
  });

  it("puede restablecer medidas automáticas que tenían un coeficiente contradictorio", () => {
    const context = {
      ...pai,
      unidadCompra: "placa",
      unidadPrecio: "placa",
      equivalencias: [{ origen: "placa", destino: "m2", factor: 3 }],
    };
    expect(materialCoefficientFields(context)).toEqual([]);
    const edited = {
      ...context,
      equivalencias: updateMaterialCoefficient(context),
    };
    expect(validateMaterialUnits(edited)).toBeNull();
    expect(materialPriceInUseUnit(edited, 10)).toEqual({ ok: true, precio: 5 });
  });
});
