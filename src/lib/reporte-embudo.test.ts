import { describe, expect, it } from "vitest";
import type { EmbudoEtapaPanel } from "./panel-api";
import { etapasDelEmbudo } from "./reporte-embudo";

const etapas: EmbudoEtapaPanel[] = [
  {
    clave: "emitidas",
    label: "Emitidas",
    cantidad: 6,
    monto: 100,
    sharePct: 100,
    conversionPct: null,
  },
  {
    clave: "aprobadas",
    label: "Aprobadas",
    cantidad: 3,
    monto: 60,
    sharePct: 50,
    conversionPct: 50,
  },
  {
    clave: "produccion",
    label: "Producción",
    cantidad: 2,
    monto: 150,
    sharePct: 33.33,
    conversionPct: 66.67,
  },
  {
    clave: "entregadas",
    label: "Entregadas",
    cantidad: 1,
    monto: 120,
    sharePct: 16.67,
    conversionPct: 50,
  },
];
describe("Presentación del embudo", () => {
  it("distingue participación de conversión y no modifica los datos recibidos", () => {
    const copia = structuredClone(etapas);
    const filas = etapasDelEmbudo(etapas, "cantidad");
    expect(filas[2].share).toBeCloseTo(33.3333);
    expect(filas[2].conversion).toBeCloseTo(66.6667);
    expect(filas[0].conversion).toBeNull();
    expect(etapas).toEqual(copia);
  });
  it("mantiene importes y ratios superiores al presupuesto sin desbordar las barras", () => {
    const filas = etapasDelEmbudo(etapas, "monto");
    expect(filas[2].share).toBe(150);
    expect(filas[2].conversion).toBe(250);
    expect(filas[3].conversion).toBe(80);
    expect(filas[2].anchoPct).toBe(100);
    expect(filas[0].anchoPct).toBeCloseTo(66.6667);
  });
  it("no inventa una tasa cuando no hay base y conserva etapas con importe cero", () => {
    const filas = etapasDelEmbudo(
      etapas.map((e) => ({ ...e, monto: 0 })),
      "monto",
    );
    expect(filas).toHaveLength(4);
    expect(
      filas.every(
        (e) => e.share === null && e.conversion === null && e.anchoPct === 0,
      ),
    ).toBe(true);
    expect(etapasDelEmbudo([], "cantidad")).toEqual([]);
  });
  it("conserva importes negativos sin producir anchuras negativas", () => {
    const filas = etapasDelEmbudo(
      etapas.map((e) => ({
        ...e,
        monto: e.clave === "entregadas" ? -5 : e.monto,
      })),
      "monto",
    );
    expect(filas[3].monto).toBe(-5);
    expect(filas[3].share).toBe(-5);
    expect(filas[3].anchoPct).toBe(0);
  });
});
