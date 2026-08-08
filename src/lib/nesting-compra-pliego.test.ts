import { describe, expect, it } from "vitest";

import { layoutPliegosEnHoja } from "@/lib/nesting-compra-pliego";

describe("layoutPliegosEnHoja", () => {
  it("SRA3 (320×450) con pliego A4 (210×297): gana rotada, 2 pliegos", () => {
    // normal: floor(320/210)=1 × floor(450/297)=1 = 1
    // rotada: floor(320/297)=1 × floor(450/210)=2 = 2  → gana
    const r = layoutPliegosEnHoja(
      { anchoMm: 320, altoMm: 450 },
      { anchoMm: 210, altoMm: 297 },
    );
    expect(r).not.toBeNull();
    expect(r!.esDerivado).toBe(true);
    expect(r!.orientacion).toBe("rotada");
    expect(r!.cols).toBe(1);
    expect(r!.rows).toBe(2);
    expect(r!.pliegosPorHoja).toBe(2);
    // Pliego dibujado rotado: 297 de ancho × 210 de alto.
    expect(r!.pliegoDibujoAnchoMm).toBe(297);
    expect(r!.pliegoDibujoAltoMm).toBe(210);
  });

  it("grilla pareja 640×900 con 320×450: 2×2 = 4, sin sobrante", () => {
    const r = layoutPliegosEnHoja(
      { anchoMm: 640, altoMm: 900 },
      { anchoMm: 320, altoMm: 450 },
    );
    expect(r!.orientacion).toBe("normal");
    expect(r!.cols).toBe(2);
    expect(r!.rows).toBe(2);
    expect(r!.pliegosPorHoja).toBe(4);
    expect(r!.sobranteAnchoMm).toBe(0);
    expect(r!.sobranteAltoMm).toBe(0);
    expect(r!.aprovechamientoPct).toBe(100);
  });

  it("hoja == pliego (con rotación): no derivado, no se dibuja", () => {
    expect(
      layoutPliegosEnHoja(
        { anchoMm: 320, altoMm: 450 },
        { anchoMm: 320, altoMm: 450 },
      )!.esDerivado,
    ).toBe(false);
    expect(
      layoutPliegosEnHoja(
        { anchoMm: 450, altoMm: 320 },
        { anchoMm: 320, altoMm: 450 },
      )!.esDerivado,
    ).toBe(false);
  });

  it("deja sobrante cuando la grilla no llena la hoja", () => {
    // 700×500 con 320×450 → normal: floor(700/320)=2 × floor(500/450)=1 = 2
    // (rotada: floor(700/450)=1 × floor(500/320)=1 = 1). Gana normal 2×1.
    const r = layoutPliegosEnHoja(
      { anchoMm: 700, altoMm: 500 },
      { anchoMm: 320, altoMm: 450 },
    );
    expect(r!.orientacion).toBe("normal");
    expect(r!.cols).toBe(2);
    expect(r!.rows).toBe(1);
    expect(r!.pliegosPorHoja).toBe(2);
    expect(r!.sobranteAnchoMm).toBeCloseTo(60); // 700 - 2×320
    expect(r!.sobranteAltoMm).toBeCloseTo(50); // 500 - 1×450
    expect(r!.aprovechamientoPct).toBeCloseTo((2 * 320 * 450) / (700 * 500) * 100);
  });

  it("dimensiones inválidas → null", () => {
    expect(
      layoutPliegosEnHoja({ anchoMm: 0, altoMm: 450 }, { anchoMm: 210, altoMm: 297 }),
    ).toBeNull();
  });
});
