import { describe, expect, it } from "vitest";
import { CANALES_VENTA, canalVentaValido, nombreCanalVenta } from "./canales-venta";

describe("canal elegido por el vendedor", () => {
  it.each(["", " ", "telefono", "vendedor_externo", "fax"])("no permite %j en una orden nueva", (value) => {
    expect(canalVentaValido(value)).toBe(false);
  });
  it.each(CANALES_VENTA)("acepta la elección explícita de $label", ({ value }) => {
    expect(canalVentaValido(value)).toBe(true);
  });
  it("conserva un canal retirado únicamente en la orden que ya lo tenía", () => {
    expect(canalVentaValido("telefono", "telefono")).toBe(true);
    expect(canalVentaValido("telefono", "vendedor_externo")).toBe(false);
    expect(canalVentaValido("", null)).toBe(false);
    expect(nombreCanalVenta("mostrador")).toBe("Presencial");
    expect(nombreCanalVenta("telefono")).toBe("Teléfono");
    expect(nombreCanalVenta(null)).toBe("Sin indicar");
  });
});
