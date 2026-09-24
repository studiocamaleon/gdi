import { describe, expect, it } from "vitest";
import { crearGruposPapeles, varianteInicialPapel } from "./selector-papeles";
import { seleccionVarianteVisualResuelta, type CandidatoMaterialVisual } from "./selectores-materiales";

function papel(id: string, gramajes = [250, 150], extra: Partial<CandidatoMaterialVisual> = {}): CandidatoMaterialVisual {
  return { materiaPrimaId: id, templateId: "sustrato_hoja_v1", label: "Papel del tenant", variantes: gramajes.map((gramaje) => ({ variantId: `${id}-${gramaje}`, sku: `${id}-${gramaje}`, missingPrice: false, atributosVarianteJson: { gramaje, ancho: 32.5, alto: 47.5, formatoComercial: "SRA3", material: "Ilustración", color: "Blanco", acabado: "Brillo" } })), ...extra };
}

describe("papeles y gramajes reales", () => {
  it("usa plantilla y alias, ordena gramajes y respeta cada catálogo sin mezclar IDs", () => {
    const grupos = crearGruposPapeles([papel("a"), papel("b", [180, 210], { templateId: "papel_hoja" })])!;
    expect(grupos).toHaveLength(2);
    expect(grupos[0].opciones.map((o) => o.id)).toEqual(["a-150", "a-250"]);
    expect(grupos[1].opciones.map((o) => o.id)).toEqual(["b-180", "b-210"]);
    expect(grupos[0].detalleComun).toBe("SRA3 · 32,5 × 47,5 cm · Material: Ilustración · Acabado: Brillo · Color: Blanco");
    expect(crearGruposPapeles([papel("a"), papel("otro", [], { templateId: "sustrato_rigido_v1" })])).toBeNull();
    expect(crearGruposPapeles([])).toBeNull();
  });

  it("distingue pliego, acabado, color y referencia aunque compartan gramaje", () => {
    const c = papel("a", [150]);
    const original = c.variantes[0];
    c.variantes = [original,
      { ...original, variantId: "pliego", atributosVarianteJson: { ...original.atributosVarianteJson, ancho: 65, alto: 95, formatoComercial: "Plana" } },
      { ...original, variantId: "mate", atributosVarianteJson: { ...original.atributosVarianteJson, acabado: "Mate", color: "Crema" } },
      { ...original, variantId: "otra-ref", sku: "OTRA", missingPrice: true },
    ];
    const grupo = crearGruposPapeles([c])![0];
    expect(grupo.opciones).toHaveLength(4);
    expect(grupo.opciones.find((o) => o.id === "pliego")?.descripcion).toContain("65 × 95 cm");
    expect(grupo.opciones.find((o) => o.id === "mate")?.descripcion).toContain("Acabado: Mate · Color: Crema");
    expect(grupo.opciones.find((o) => o.id === "otra-ref")).toMatchObject({ referencia: "OTRA", sinPrecio: true });
    expect(varianteInicialPapel(grupo)).toBe("");
  });

  it("datos faltantes no son gramaje cero ni medidas inferidas por magnitud", () => {
    const c = papel("a");
    c.variantes = [
      { variantId: "sin", sku: "SIN", missingPrice: false, atributosVarianteJson: { gramaje: null, ancho: "", alto: false } },
      { variantId: "mm", sku: "MM", missingPrice: false, atributosVarianteJson: { gramaje: "120,5", anchoMm: 210, altoMm: 297 } },
      { variantId: "invalid", sku: "INV", missingPrice: false, atributosVarianteJson: { gramaje: -5, ancho: -1, anchoMm: 210, alto: 29.7 } },
    ];
    const ops = crearGruposPapeles([c])![0].opciones;
    expect(ops.find((o) => o.id === "sin")).toMatchObject({ gramaje: null, titulo: "Gramaje sin informar" });
    expect(ops.find((o) => o.id === "mm")?.detalles[0].valor).toBe("21 × 29,7 cm");
    expect(ops.find((o) => o.id === "invalid")?.detalles[0].valor).toContain("Ancho sin informar");
  });

  it("no recupera el default anterior al cambiar papel ni elige el primer gramaje", () => {
    const materiales = [papel("a", [150, 250], { defaultVarianteId: "a-150" }), papel("b", [180, 210])];
    expect(seleccionVarianteVisualResuelta(materiales, undefined)).toBe("a-150");
    expect(seleccionVarianteVisualResuelta(materiales, "")).toBe("");
    expect(seleccionVarianteVisualResuelta(materiales, "b-150")).toBe("");
    expect(seleccionVarianteVisualResuelta(materiales, "b-210")).toBe("b-210");
    expect(varianteInicialPapel(crearGruposPapeles(materiales)![1])).toBe("");
  });

  it("sólo resuelve automáticamente variante única o default permitido, nunca uno obsoleto", () => {
    const unico = papel("a", [180]);
    expect(varianteInicialPapel(crearGruposPapeles([unico])![0])).toBe("a-180");
    expect(seleccionVarianteVisualResuelta([unico], undefined)).toBe("a-180");
    const multiples = papel("b", [150, 250], { defaultVarianteId: "b-250" });
    expect(varianteInicialPapel(crearGruposPapeles([multiples])![0])).toBe("b-250");
    multiples.defaultVarianteId = "obsoleto";
    expect(varianteInicialPapel(crearGruposPapeles([multiples])![0])).toBe("");
    expect(seleccionVarianteVisualResuelta([multiples], undefined)).toBe("");
  });
});
