import { describe, expect, it } from "vitest";
import { crearGruposColores, muestraColorMaterial, varianteInicialColor } from "./selector-colores";
import { type CandidatoMaterialVisual, seleccionVarianteVisualResuelta } from "./selectores-materiales";

function material(extra: Partial<CandidatoMaterialVisual> = {}): CandidatoMaterialVisual {
  return {
    materiaPrimaId: "vinilo", templateId: "vinilo_de_corte_rollo_v1", label: "Vinilo del tenant",
    defaultVarianteId: "blanco-61",
    variantes: [
      { variantId: "blanco-61", sku: "B61", missingPrice: false, atributosVarianteJson: { color: "Blanco", ancho: 0.61, largo: 50, acabado: "Mate" } },
      { variantId: "negro-61", sku: "N61", missingPrice: false, atributosVarianteJson: { color: "Negro", ancho: 0.61, largo: 50, acabado: "Mate" } },
      { variantId: "negro-122", sku: "N122", missingPrice: true, atributosVarianteJson: { color: "Negro", ancho: 1.22, largo: 50, acabado: "Brillo" } },
    ], ...extra,
  };
}

describe("selector semántico de colores", () => {
  it("agrupa por material y color conservando variantes, anchos, acabados y precio faltante", () => {
    const grupos = crearGruposColores([material()])!;
    expect(grupos).toHaveLength(2);
    expect(varianteInicialColor(grupos[0])).toBe("blanco-61");
    expect(varianteInicialColor(grupos[1])).toBe("");
    expect(grupos[1].opciones.find((o) => o.id === "negro-122")).toMatchObject({ titulo: "Ancho de rollo: 122 cm", descripcion: "Acabado: Brillo", sinPrecio: true });
    expect(grupos[1].detalleComun).toBe("Largo de rollo: 50 m");
    expect(seleccionVarianteVisualResuelta([material()], "")).toBe("");
  });

  it("respeta el catálogo de cada tenant aunque sus materiales tengan el mismo nombre y color", () => {
    const otro = material({ materiaPrimaId: "otro-tenant", variantes: material().variantes.map((v) => ({ ...v, variantId: `otro-${v.variantId}` })) });
    const grupos = crearGruposColores([material(), otro])!;
    expect(new Set(grupos.map((g) => g.id)).size).toBe(4);
    expect(grupos.flatMap((g) => g.opciones)).toHaveLength(6);
    expect(grupos.find((g) => g.materialId === "otro-tenant")?.opciones.some((o) => o.predeterminada)).toBe(false);
  });

  it("no elige el color por nombre de producto ni aplica colores a un acabado de laminado", () => {
    expect(crearGruposColores([material({ label: "Vinilo rojo", templateId: "desconocida" })])).toBeNull();
    expect(crearGruposColores([material(), material({ templateId: "laminado_film_v1" })])).toBeNull();
    const esmerilado = material({ templateId: "vinilo_esmerilado_rollo_v1", variantes: [{ variantId: "gris", sku: "G", missingPrice: false, atributosVarianteJson: { ancho: 0.61, largo: 50, acabado: "Gris" } }] });
    expect(crearGruposColores([esmerilado])![0]).toMatchObject({ color: "Gris", etiqueta: "Color del vinilo" });
  });

  it("distingue color del material, tinta y temperatura de luz por su contrato", () => {
    for (const [templateId, key, etiqueta, color] of [
      ["sello_automatico_v1", "colorCarcasa", "Color de la carcasa", "Negro"],
      ["tinta_sello_v1", "colorTinta", "Color de tinta", "Azul"],
      ["neon_flex_led_v1", "colorLuz", "Color de luz", "6500K"],
      ["modulo_led_carteleria_v1", "temperaturaColor", "Temperatura de luz", "Cálido"],
    ]) {
      const g = crearGruposColores([material({ templateId, variantes: [{ variantId: key, sku: key, missingPrice: false, atributosVarianteJson: { [key]: color, color: "No usar" } }] })])![0];
      expect(g).toMatchObject({ etiqueta, color });
    }
  });

  it("mantiene talles y referencias que distinguen variantes del mismo color", () => {
    const c = material({ templateId: "textil_indumentaria_v1", variantes: ["M", "XL", "XL"].map((talle, i) => ({ variantId: `prenda-${i}`, sku: `REF-${i}`, missingPrice: false, atributosVarianteJson: { color: "Negro", talle, tipoPrenda: "Remera", material: "Algodón", categoria: "Indumentaria" } })) });
    const g = crearGruposColores([c])![0];
    expect(g.opciones.map((o) => o.titulo)).toEqual(["Talle: M", "Talle: XL", "Talle: XL"]);
    expect(g.opciones[1].referencia).toBe("REF-1");
    expect(g.opciones[2].referencia).toBe("REF-2");
    c.variantes = ["L", "S", "XXL", "M", "XL"].map((talle) => ({ variantId: talle, sku: talle, missingPrice: false, atributosVarianteJson: { color: "Negro", talle } }));
    expect(crearGruposColores([c])![0].opciones.map((o) => o.id)).toEqual(["S", "M", "L", "XL", "XXL"]);
  });

  it("respeta aliases de rígidos y unidades explícitas; nunca usa un tamaño como color", () => {
    const g = crearGruposColores([material({ templateId: "rigido_placa", variantes: [{ variantId: "cristal", sku: "CR", missingPrice: false, atributosVarianteJson: { colorBase: "Cristal", anchoMm: 1220, alto_mm: 2440, espesorMicrones: 3000 } }] })])![0];
    expect(g.color).toBe("Cristal");
    expect(g.detalleComun).toContain("Ancho: 1,22 m");
    expect(g.detalleComun).toContain("Espesor: 3 mm");
    const sin = crearGruposColores([material({ variantes: [{ variantId: "sin", sku: "SIN", missingPrice: false }] })])![0];
    expect(sin.color).toBe("Color sin informar");
    expect(sin.detalleComun).toContain("sin informar");
  });

  it("conserva los títulos textiles como texto y los distingue del gramaje real", () => {
    const c = material({ templateId: "textil_indumentaria_v1", variantes: ["16/1", "20/1", "24/1"].map((tituloHilado) => ({
      variantId: tituloHilado, sku: tituloHilado, missingPrice: false,
      atributosVarianteJson: { color: "Blanco", talle: "M", tipoPrenda: "Remera", material: "Algodón", categoria: "Remeras", tituloHilado, gramaje: 150 },
    })) });
    const grupo = crearGruposColores([c])![0];
    expect(grupo.opciones.map((o) => o.titulo)).toEqual(["Título del hilado: 16/1", "Título del hilado: 20/1", "Título del hilado: 24/1"]);
    expect(grupo.detalleComun).toContain("Gramaje de la tela: 150 g/m²");
    expect(grupo.opciones.map((o) => o.id)).toEqual(["16/1", "20/1", "24/1"]);
    expect(varianteInicialColor(grupo)).toBe("");
  });

  it("sólo representa tonos conocidos o HEX válido; Color y Pantone no se vuelven un tono inventado", () => {
    expect(muestraColorMaterial(" BLANCO ")).toEqual({ tipo: "solido", hex: "#ffffff" });
    expect(muestraColorMaterial("#AbC123")).toEqual({ tipo: "solido", hex: "#abc123" });
    expect(muestraColorMaterial("Color")).toEqual({ tipo: "multicolor" });
    expect(muestraColorMaterial("Cristal")).toEqual({ tipo: "transparente" });
    expect(muestraColorMaterial("Plateado").tipo).toBe("metalizado");
    for (const nombre of ["Pantone 186 C", "Rojo 032", "Blanco cálido del proveedor", "url(https://x)", "Color sin informar"]) expect(muestraColorMaterial(nombre)).toEqual({ tipo: "desconocido" });
  });
});
