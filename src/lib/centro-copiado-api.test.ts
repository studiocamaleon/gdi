import { describe, expect, it } from "vitest";
import { cantidadLibrosCentroCopiado } from "./centro-copiado-api";

describe("cantidadLibrosCentroCopiado", () => {
  it("usa copias para un documento suelto anillado, no sus hojas físicas", () => {
    expect(
      cantidadLibrosCentroCopiado({
        cantidad: 56,
        _centroCopiado: {
          version: 1,
          esTomo: false,
          terminaciones: ["Anillado"],
          copias: 1,
          paginas: 112,
          hojas: 56,
        },
      }),
    ).toBe(1);
  });

  it("usa juegos para un tomo anillado", () => {
    expect(
      cantidadLibrosCentroCopiado({
        _centroCopiado: {
          version: 1,
          esTomo: true,
          terminaciones: ["Anillado"],
          juegos: 3,
          hojas: 168,
        },
      }),
    ).toBe(3);
  });

  it("no interviene en impresiones sin anillado", () => {
    expect(
      cantidadLibrosCentroCopiado({
        _centroCopiado: {
          version: 1,
          esTomo: false,
          terminaciones: [],
          copias: 1,
          hojas: 56,
        },
      }),
    ).toBeNull();
  });
});
