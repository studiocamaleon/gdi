import { describe, expect, it } from "vitest";
import { capacidadPantalla, paginarEntregas } from "./pantalla-produccion";

describe("páginas para televisores", () => {
  it("muestra cada entrega una vez por vuelta incluso con muchas atrasadas", () => {
    const entregas = Array.from({ length: 53 }, (_, n) => n);
    for (const medida of [
      [990, 1450],
      [1830, 650],
      [370, 250],
    ]) {
      const c = capacidadPantalla(...(medida as [number, number]));
      const paginas = paginarEntregas(entregas, c.filas * c.columnas);
      expect(paginas.flat()).toEqual(entregas);
      expect(paginas.every((p) => p.length <= c.filas * c.columnas)).toBe(true);
    }
  });
  it("deja una página vacía y mantiene al menos una fila con poco espacio", () => {
    expect(paginarEntregas([], 3)).toEqual([[]]);
    expect(capacidadPantalla(300, 10)).toEqual({ columnas: 1, filas: 1 });
  });
});
