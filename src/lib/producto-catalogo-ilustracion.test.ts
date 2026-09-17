import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { ILUSTRACIONES_SUBCATEGORIA, resolverIlustracionCatalogo } from "./producto-catalogo-ilustracion";

const require = createRequire(import.meta.url);
const { SUBCATEGORIAS_COMERCIALES } = require("../../apps/api/prisma/seed-modulos/catalogo-comercial.js") as {
  SUBCATEGORIAS_COMERCIALES: { codigo: string; categoriaCodigo: string }[];
};

describe("ilustración automática del catálogo", () => {
  it("cubre todas las subcategorías del catálogo, aunque aún no tengan productos", () => {
    // Compara con la clasificación que se siembra en API, no con otra copia
    // del mapa visual: una familia nueva debe elegir ilustración explícitamente.
    const pendientes = SUBCATEGORIAS_COMERCIALES
      .filter(({ codigo }) => codigo !== "producto_a_medida")
      .filter(({ codigo }) => !Object.hasOwn(ILUSTRACIONES_SUBCATEGORIA, codigo))
      .map(({ codigo }) => codigo);
    expect(pendientes).toEqual([]);
  });

  it("conserva la identidad de la familia aunque sea compuesto o se cobre por superficie", () => {
    expect(resolverIlustracionCatalogo({ subcategoriaCodigo: "remeras_indumentaria", categoriaCodigo: "textil_personalizacion", compuesto: true, cobro: "Por m²" })).toBe("remera");
    expect(resolverIlustracionCatalogo({ subcategoriaCodigo: "sellos_manuales", categoriaCodigo: "sellos", cobro: "Por unidad" })).toBe("sello_manual");
  });

  it("hereda la categoría cuando aparece una subcategoría nueva", () => {
    expect(resolverIlustracionCatalogo({ subcategoriaCodigo: "sellos_personalizados_nuevos", categoriaCodigo: "sellos", cobro: "Por unidad" })).toBe("sello");
  });

  it.each([
    { compuesto: true, cobro: "Por m²", esperado: "compuesto" },
    { compuesto: false, cobro: "Por metro lineal", esperado: "rollo" },
    { compuesto: false, cobro: "Por m²", esperado: "superficie" },
    { compuesto: false, cobro: "Por unidad", esperado: "piezas" },
    { compuesto: false, cobro: "Por hora", esperado: "piezas" },
  ])("mantiene una imagen para familias nuevas: $esperado / $cobro", ({ esperado, ...datos }) => {
    expect(resolverIlustracionCatalogo({ ...datos, subcategoriaCodigo: "nueva", categoriaCodigo: "nueva" })).toBe(esperado);
    // La categoría Servicios no debe convertir todo producto custom en diseño.
    expect(resolverIlustracionCatalogo({ ...datos, subcategoriaCodigo: "producto_a_medida", categoriaCodigo: "servicios_logistica" })).toBe(esperado);
  });
});
