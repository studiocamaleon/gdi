import { describe, expect, it } from "vitest";

import {
  cantidadUsosProductoComponente,
  crearIdentidadOcurrenciaComponente,
  type OcurrenciaComponenteReferencia,
} from "./componentes-receta-ocurrencias";

const producto = {
  id: "vinilo",
  codigo: "VINILO-IMPRESO",
  nombre: "Vinilo impreso",
};

describe("ocurrencias de componentes fabricados", () => {
  it("conserva la identidad del producto para su primer uso", () => {
    expect(crearIdentidadOcurrenciaComponente(producto, [])).toEqual({
      codigo: "VINILO-IMPRESO",
      nombre: "Vinilo impreso",
      numeroUso: 1,
    });
  });

  it("crea otra ocurrencia del mismo producto con código y nombre propios", () => {
    const existentes: OcurrenciaComponenteReferencia[] = [
      {
        productoComponenteId: "vinilo",
        codigo: "VINILO-IMPRESO",
        nombre: "Vinilo frente",
      },
    ];

    expect(crearIdentidadOcurrenciaComponente(producto, existentes)).toEqual({
      codigo: "VINILO-IMPRESO-2",
      nombre: "Vinilo impreso · Uso 2",
      numeroUso: 2,
    });
    expect(cantidadUsosProductoComponente("vinilo", existentes)).toBe(1);
  });

  it("evita colisiones globales y respeta el límite del código", () => {
    const largo = { ...producto, codigo: "V".repeat(100) };
    const existentes: OcurrenciaComponenteReferencia[] = [
      {
        productoComponenteId: "otro",
        codigo: "V".repeat(98) + "-2",
        nombre: "Otro componente",
      },
      {
        productoComponenteId: "vinilo",
        codigo: "V".repeat(100),
        nombre: "Vinilo impreso",
      },
    ];

    const identidad = crearIdentidadOcurrenciaComponente(largo, existentes);
    expect(identidad.codigo).toBe(`${"V".repeat(98)}-3`);
    expect(identidad.codigo).toHaveLength(100);
    expect(identidad.numeroUso).toBe(3);
  });
});
