import { describe, expect, it } from "vitest";

import { monedaDe } from "@/lib/moneda";
import { formatMaterialUnitPrice } from "@/lib/propuestas";

const ARS = monedaDe("ARS");
const CLP = monedaDe("CLP");

describe("formatMaterialUnitPrice", () => {
  it("muestra al menos dos decimales en costos unitarios", () => {
    expect(formatMaterialUnitPrice(11.570248, ARS)).toBe("$ 11,57");
    expect(formatMaterialUnitPrice(0.267, ARS)).toBe("$ 0,27");
    expect(formatMaterialUnitPrice(0, ARS)).toBe("$ 0,00");
  });

  it("aumenta la precisión para que un costo real menor a un centavo no parezca cero", () => {
    expect(formatMaterialUnitPrice(0.004, ARS)).toBe("$ 0,0040");
    expect(formatMaterialUnitPrice(0.000267, ARS)).toBe("$ 0,00027");
  });

  it("preserva decimales teóricos incluso en monedas sin centavos", () => {
    expect(formatMaterialUnitPrice(0.267, CLP)).toBe("$ 0,27");
  });
});
