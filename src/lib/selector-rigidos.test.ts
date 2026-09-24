import { describe, expect, it } from "vitest";
import { crearGruposRigidos, type CandidatoRigido } from "./selector-rigidos";

function material(id: string, espesores: number[], extra: Partial<CandidatoRigido> = {}): CandidatoRigido {
  return {
    materiaPrimaId: id,
    templateId: "sustrato_rigido_v1",
    label: "Material del tenant",
    variantes: espesores.map((espesor) => ({
      variantId: `${id}-${espesor}`,
      sku: `SKU-${id}-${espesor}`,
      missingPrice: false,
      atributosVarianteJson: { espesor, ancho: 1.22, alto: 2.44, colorBase: "Blanco" },
    })),
    ...extra,
  };
}

describe("selector de rígidos", () => {
  it("usa la plantilla y el catálogo de cada tenant, ordenando por espesor sin inventar variantes", () => {
    const a = crearGruposRigidos([material("tenant-a", [10, 3, 5])])!;
    const b = crearGruposRigidos([material("tenant-b", [6, 2], { label: "Nombre personalizado", templateId: "rigido_placa" })])!;
    expect(a[0].opciones.map((v) => v.id)).toEqual(["tenant-a-3", "tenant-a-5", "tenant-a-10"]);
    expect(b[0].opciones.map((v) => v.id)).toEqual(["tenant-b-2", "tenant-b-6"]);
    expect(b[0].material).toBe("Nombre personalizado");
    expect(a[0].formatoComun).toBe("122 × 244 cm");
  });

  it("no clasifica materiales por nombre ni cambia los selectores de otras plantillas", () => {
    expect(crearGruposRigidos([])).toBeNull();
    expect(crearGruposRigidos([material("pvc", [3], { label: "PVC rígido", templateId: "otra" })])).toBeNull();
    expect(crearGruposRigidos([material("ok", [3]), material("otro", [5], { templateId: "otra" })])).toBeNull();
  });

  it("conserva materiales diferentes aunque compartan nombre, color y espesor", () => {
    const grupos = crearGruposRigidos([material("a", [3]), material("b", [3])])!;
    expect(grupos).toHaveLength(2);
    expect(grupos[0].id).not.toBe(grupos[1].id);
    expect(grupos.flatMap((g) => g.opciones.map((o) => o.id))).toEqual(["a-3", "b-3"]);
  });

  it("desambigua formatos y referencias sin fusionar IDs ni opciones sin costo", () => {
    const c = material("a", [3]);
    c.variantes = [
      c.variantes[0],
      { ...c.variantes[0], variantId: "otra-placa", sku: "OTRA", atributosVarianteJson: { espesor: 3, ancho: 2, alto: 3, colorBase: "Blanco" } },
      { ...c.variantes[0], variantId: "otro-proveedor", sku: "PROVEEDOR", missingPrice: true },
    ];
    c.defaultVarianteId = "otra-placa";
    const grupo = crearGruposRigidos([c])![0];
    expect(grupo.formatoComun).toBeNull();
    expect(grupo.opciones).toHaveLength(3);
    expect(grupo.opciones.find((v) => v.id === "otra-placa")).toMatchObject({ formato: "200 × 300 cm", predeterminada: true, referencia: "" });
    expect(grupo.opciones.find((v) => v.id === "otro-proveedor")).toMatchObject({ referencia: "PROVEEDOR", sinPrecio: true });
    expect(grupo.opciones.find((v) => v.id === "a-3")?.referencia).toBe("SKU-a-3");
  });

  it("convierte sólo por unidades explícitas y no convierte datos faltantes en cero", () => {
    const c = material("a", []);
    c.variantes = [
      { variantId: "sin", sku: "SIN", missingPrice: false, atributosVarianteJson: { espesor: null, ancho: "", alto: null } },
      { variantId: "legacy", sku: "LEG", missingPrice: false, atributosVarianteJson: { espesorMicrones: "3000", anchoMm: 1220, alto_mm: 2440 } },
      { variantId: "decimal", sku: "DEC", missingPrice: false, atributosVarianteJson: { espesor: "1,5", ancho: "0,5", alto: 2 } },
      { variantId: "invalido", sku: "INV", missingPrice: false, atributosVarianteJson: { espesor: -3, espesorMm: 5, ancho: 0, alto: true } },
    ];
    const opciones = crearGruposRigidos([c])![0].opciones;
    expect(opciones.find((v) => v.id === "sin")).toMatchObject({ espesorMm: null, titulo: "Espesor sin informar", formato: "Formato sin informar" });
    expect(opciones.find((v) => v.id === "legacy")).toMatchObject({ espesorMm: 3, formato: "122 × 244 cm" });
    expect(opciones.find((v) => v.id === "decimal")).toMatchObject({ espesorMm: 1.5, formato: "50 × 200 cm" });
    expect(opciones.find((v) => v.id === "invalido")).toMatchObject({ espesorMm: null, formato: "Formato sin informar" });
  });

  it("no designa un predeterminado que ya no está entre las variantes permitidas", () => {
    const opciones = crearGruposRigidos([material("a", [3, 5], { defaultVarianteId: "obsoleto" })])![0].opciones;
    expect(opciones.every((o) => !o.predeterminada)).toBe(true);
  });
});
