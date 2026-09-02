import { describe, expect, it } from "vitest";

import { resolverCantidadTrabajo } from "./cantidad-trabajo";

describe("resolverCantidadTrabajo", () => {
  it("usa la cantidad general cuando hay una medida predefinida", () => {
    expect(
      resolverCantidadTrabajo({
        cantidadItem: 200,
        cotizaLinealDirecto: false,
        usaMedidaPersonalizada: false,
        piezas: [],
      }),
    ).toBe(200);
  });

  it("suma las cantidades de cada fila cuando se eligió A medida", () => {
    expect(
      resolverCantidadTrabajo({
        cantidadItem: 200,
        cotizaLinealDirecto: false,
        usaMedidaPersonalizada: true,
        piezas: [{ cantidad: 25 }, { cantidad: 75 }],
      }),
    ).toBe(100);
  });

  it("mantiene una unidad técnica al cotizar metros lineales directos", () => {
    expect(
      resolverCantidadTrabajo({
        cantidadItem: 12.5,
        cotizaLinealDirecto: true,
        usaMedidaPersonalizada: false,
        piezas: [],
      }),
    ).toBe(1);
  });
});
