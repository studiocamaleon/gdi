import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  cantidadManualValida,
  restaurarCantidadesManuales,
} from "./cantidad-manual-paso";
import {
  getRitmoMagnitudOptions,
  getT2QuantitySourceOptions,
} from "./editor-paso/catalogo-tiempo";

it("ofrece la entrada una sola vez y no la pierde al guardar bajo ninguna unidad", () => {
  expect(
    getRitmoMagnitudOptions().filter((o) => o.fuente === "cantidad_manual"),
  ).toHaveLength(1);
  for (const unidad of ["unidades_h", "m2_h", "ml_h"])
    expect(
      getT2QuantitySourceOptions(unidad).some(
        (o) => o.value === "cantidad_manual",
      ),
    ).toBe(true);
});
it("reabre cantidades propias sin convertirlas en cantidades de producto", () => {
  expect(
    restaurarCantidadesManuales({
      cantidad: 12,
      cantidadManual_desploteo: 5,
      cantidadManual_otro: 2.5,
    }),
  ).toEqual({ desploteo: 5, otro: 2.5 });
  for (const value of [null, "5", 0, -1, Infinity, NaN, {}, true])
    expect(cantidadManualValida(value)).toBe(false);
});
it("mantiene el mismo contrato entre servidor y navegador", () => {
  const web = readFileSync("src/lib/cantidad-manual-paso.ts", "utf8");
  const api = readFileSync(
    "apps/api/src/motor-universal/cantidad-manual-paso.ts",
    "utf8",
  );
  expect(web).toBe(api);
});
