import { describe, expect, it } from "vitest";
import { normalizarBusqueda } from "./busqueda-texto";
import { compararProductosPorUso } from "./productos-por-uso";
describe("búsqueda comercial", () => {
  it.each(["María Núñez", "MARÍA NÚÑEZ", "maria nunez"])(
    "normaliza %s sin acentos",
    (v) => expect(normalizarBusqueda(v)).toBe("maria nunez"),
  );
  it("prioriza frecuencia sobre nombre y desempata alfabéticamente sin perder productos nuevos", () => {
    const productos = [
      { id: "a", nombre: "Vinilo azul", usosEnOrdenes: 1 },
      { id: "b", nombre: "Vinilo blanco", usosEnOrdenes: 8 },
      { id: "c", nombre: "Vinilo amarillo", usosEnOrdenes: 1 },
      { id: "d", nombre: "Vinilo nuevo" },
    ];
    expect(
      [...productos].sort(compararProductosPorUso).map((p) => p.id),
    ).toEqual(["b", "c", "a", "d"]);
  });
});
