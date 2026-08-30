import { describe, expect, it } from "vitest";
import {
  unidadVisibleParametro,
  valorInternoAVisible,
  valorReglaInternoAVisible,
  valorReglaVisibleAInterno,
  valorVisibleAInterno,
} from "./componentes-configuracion-unidades";

describe("unidades visibles de componentes fabricados", () => {
  it("presenta las medidas técnicas en centímetros como el sheet", () => {
    expect(unidadVisibleParametro("medidaCustomMm.anchoMm", "mm")).toBe("cm");
    expect(valorInternoAVisible("medidaCustomMm.anchoMm", 1250)).toBe(125);
    expect(valorVisibleAInterno("medidaCustomMm.altoMm", 80)).toBe(800);
  });

  it("convierte suma y resta, pero conserva multiplicadores sin unidad", () => {
    expect(
      valorReglaVisibleAInterno("medidaCustomMm.anchoMm", "SUMAR", 1.5),
    ).toBe(15);
    expect(
      valorReglaInternoAVisible("medidaCustomMm.anchoMm", "RESTAR", 20),
    ).toBe(2);
    expect(
      valorReglaVisibleAInterno("medidaCustomMm.anchoMm", "MULTIPLICAR", 1.5),
    ).toBe(1.5);
  });
});
