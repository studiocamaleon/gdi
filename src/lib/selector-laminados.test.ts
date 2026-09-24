import { describe, expect, it } from "vitest";
import { acabadoLaminadoVisual, crearGruposLaminados } from "./selector-laminados";
import type { CandidatoMaterialVisual } from "./selectores-materiales";

function material(id = "film", acabados = ["Mate", "Brillante"]): CandidatoMaterialVisual {
  return {
    materiaPrimaId: id, templateId: "laminado_film_v1", label: "Film del tenant",
    defaultVarianteId: `${id}-0`,
    variantes: acabados.map((acabado, i) => ({
      variantId: `${id}-${i}`, sku: `${id}-SKU-${i}`, missingPrice: false,
      atributosVarianteJson: { acabado, ancho: 330, largo: 150, micrones: 25 },
    })),
  };
}

describe("selector de acabados de laminado", () => {
  it("muestra los acabados del catálogo y sólo una vez las medidas comunes", () => {
    const grupo = crearGruposLaminados([material()])![0];
    expect(grupo.detalleComun).toBe("Rollo 330 mm × 150 m · 25 µm");
    expect(grupo.opciones.map((o) => o.titulo)).toEqual(["Brillante", "Mate"]);
    expect(grupo.opciones.every((o) => !o.descripcion)).toBe(true);
    expect(grupo.opciones.find((o) => o.id === "film-0")?.predeterminada).toBe(true);
  });

  it("reutiliza la presentación entre tenants sin inventar valores ni fusionar nombres iguales", () => {
    const primero = material("tenant-a", ["Texturado especial"]);
    const segundo = { ...material("tenant-b", ["Soft touch"]), templateId: "film_laminado" };
    const grupos = crearGruposLaminados([primero, segundo])!;
    expect(grupos).toHaveLength(2);
    expect(grupos[0].opciones[0]).toMatchObject({ id: "tenant-a-0", titulo: "Texturado especial", visual: "otro" });
    expect(grupos[1].opciones[0]).toMatchObject({ id: "tenant-b-0", visual: "soft-touch" });
  });

  it("desambigua ancho, micraje y adhesivo sin perder la identidad de variante", () => {
    const m = material("m", ["Mate", "Mate", "Mate"]);
    m.variantes = m.variantes.map((v, i) => ({ ...v, atributosVarianteJson: {
      ...v.atributosVarianteJson, ancho: i === 1 ? 480 : 330,
      micrones: i === 2 ? 32 : 25, adhesivoTipo: i === 2 ? "Térmico" : "Acrílico",
    } }));
    const grupo = crearGruposLaminados([m])![0];
    expect(grupo.opciones).toHaveLength(3);
    expect(grupo.opciones.find((o) => o.id === "m-1")?.descripcion).toContain("480 mm");
    expect(grupo.opciones.find((o) => o.id === "m-2")?.descripcion).toContain("32 µm · Adhesivo: Térmico");
    expect(grupo.opciones.every((o) => !o.referencia)).toBe(true);
  });

  it("dos variantes idénticas muestran sus referencias y nunca se sustituyen por el acabado", () => {
    const grupo = crearGruposLaminados([material("m", ["Mate", "Mate"])])![0];
    expect(grupo.opciones.map((o) => o.referencia)).toEqual(["m-SKU-0", "m-SKU-1"]);
    expect(grupo.opciones.map((o) => o.id)).toEqual(["m-0", "m-1"]);
  });

  it("respeta aliases de medida con unidad explícita y no interpreta espesor antiguo por magnitud", () => {
    const m = material("m", ["Mate"]);
    m.variantes = [{ ...m.variantes[0], atributosVarianteJson: { acabado: "Mate", anchoMm: 330, largoRolloMm: 150000, espesor: 75 } }];
    const grupo = crearGruposLaminados([m])![0];
    expect(grupo.detalleComun).toContain("330 mm × 150 m");
    expect(grupo.detalleComun).toContain("Espesor registrado: 75 (unidad por confirmar)");
    expect(grupo.detalleComun).not.toContain("75 mm");
    expect(grupo.detalleComun).not.toContain("75 µm");
    expect(grupo.opciones[0].aviso).toContain("confirmación");
  });

  it("expone medidas incompletas y micrajes contradictorios sin inventar ceros", () => {
    const m = material("m", ["Mate"]);
    m.variantes = [{ ...m.variantes[0], atributosVarianteJson: { acabado: "Mate", ancho: null, largo: "", micrones: 25, espesorMm: 0.032 } }];
    const grupo = crearGruposLaminados([m])![0];
    expect(grupo.detalleComun).toContain("Ancho sin informar · Largo sin informar");
    expect(grupo.detalleComun).toContain("25 / 32 µm");
    expect(grupo.opciones[0].aviso).toContain("micraje distintos");
  });

  it("mantiene acabados desconocidos, faltantes y sin precio como variantes elegibles", () => {
    const m = material("m", ["Antihuellas del proveedor", ""]);
    m.defaultVarianteId = "eliminada";
    m.variantes = m.variantes.map((v) => ({ ...v, missingPrice: true }));
    const opciones = crearGruposLaminados([m])![0].opciones;
    expect(opciones.every((o) => !o.predeterminada && o.sinPrecio)).toBe(true);
    expect(opciones.find((o) => o.id === "m-1")).toMatchObject({ titulo: "Acabado sin informar", referencia: "m-SKU-1" });
    expect(opciones.find((o) => o.id === "m-0")?.titulo).toBe("Antihuellas del proveedor");
  });

  it("reserva este selector a film; no clasifica vinilos, papel ni pouch por su nombre", () => {
    expect(crearGruposLaminados([])).toBeNull();
    for (const templateId of ["laminado_pouch_v1", "sustrato_hoja_v1", "vinilo_esmerilado_v1", "desconocido"]) {
      expect(crearGruposLaminados([{ ...material(), label: "Laminado Mate", templateId }])).toBeNull();
      expect(crearGruposLaminados([material(), { ...material("otro"), templateId }])).toBeNull();
    }
  });

  it("los aliases visuales no alteran los nombres guardados ni fusionan Brillo/Brillante", () => {
    expect(acabadoLaminadoVisual("BRILLO")).toBe("brillante");
    expect(acabadoLaminadoVisual("soft_touch")).toBe("soft-touch");
    const opciones = crearGruposLaminados([material("m", ["Brillo", "Brillante"])])![0].opciones;
    expect(opciones).toHaveLength(2);
    expect(opciones.map((o) => o.titulo)).toEqual(["Brillante", "Brillo"]);
    expect(opciones.every((o) => o.visual === "brillante")).toBe(true);
  });
});
