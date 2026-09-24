import { expect, it } from "vitest";
import { crearGruposRollos } from "./selector-rollos";
import type { CandidatoMaterialVisual } from "./selectores-materiales";

const candidato = (templateId: string, attrs: Record<string, unknown>[]): CandidatoMaterialVisual => ({
  materiaPrimaId: "vinilo", label: "Vinilo Ritrama", templateId,
  variantes: attrs.map((atributosVarianteJson, i) => ({ variantId: `v${i}`, sku: `SKU${i}`, missingPrice: false, atributosVarianteJson })),
});

it("ordena anchos y comparte largo/acabado sin repetirlos en cada tarjeta", () => {
  const [g] = crearGruposRollos([candidato("sustrato_rollo_flexible_v1", [1.52, 1.06, 1.37].map((ancho) => ({ ancho, largo: 50, acabado: "Brillante" })) )])!;
  expect(g.opciones.map((o) => o.titulo)).toEqual(["1,06 m", "1,37 m", "1,52 m"]);
  expect(g.opciones.map((o) => o.id)).toEqual(["v1", "v2", "v0"]);
  expect(g.detalleComun).toBe("Largo de rollo: 50 m · Acabado: Brillante");
  expect(g.opciones.every((o) => !o.descripcion)).toBe(true);
});

it("lee metros y milímetros según la plantilla y admite aliases con unidad explícita", () => {
  expect(crearGruposRollos([candidato("vinilo_de_corte_rollo_v1", [{ ancho: .61 }])])![0].opciones[0].titulo).toBe("0,61 m");
  expect(crearGruposRollos([candidato("iman_flexible_rollo_v1", [{ ancho: 610 }])])![0].opciones[0].titulo).toBe("0,61 m");
  const [g] = crearGruposRollos([candidato("sustrato_rollo_flexible_v1", [{ anchoRolloMm: 1370, largoRolloMm: 50000 }])])!;
  expect(g.opciones[0].titulo).toBe("1,37 m");
  expect(g.detalleComun).toContain("50 m");
});

it("conserva las diferencias entre largos, acabados y variantes duplicadas", () => {
  const [g] = crearGruposRollos([candidato("sustrato_rollo_flexible_v1", [
    { ancho: 1.06, largo: 25, acabado: "Mate" },
    { ancho: 1.06, largo: 50, acabado: "Brillante" },
    { ancho: 1.06, largo: 50, acabado: "Brillante" },
  ])])!;
  expect(g.detalleComun).toBe("");
  expect(g.opciones[0].descripcion).toContain("25 m");
  expect(g.opciones[1].descripcion).toContain("SKU1");
  expect(g.opciones[2].descripcion).toContain("SKU2");
});

it("no inventa medidas ni usa este selector para placas o plantillas desconocidas", () => {
  expect(crearGruposRollos([candidato("sustrato_rigido_v1", [{ ancho: 1.22 }])])).toBeNull();
  expect(crearGruposRollos([candidato("desconocida", [{ ancho: 1.22 }])])).toBeNull();
  const [g] = crearGruposRollos([candidato("sustrato_rollo_flexible_v1", [{ ancho: -1, anchoMm: 1060 }])])!;
  expect(g.opciones[0].titulo).toBe("Ancho sin informar");
});
