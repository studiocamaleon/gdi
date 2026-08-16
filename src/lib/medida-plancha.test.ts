import { describe, expect, it } from "vitest";
import { resolverPlanchaUtil } from "./medida-plancha";

// Paridad conceptual con el motor (nesting-config.ts `baseMargins` + extras):
// mismos casos que resolvería resolveNestingConfig para impresion_por_hoja.
describe("resolverPlanchaUtil", () => {
  it("resta los márgenes de la máquina (claves izq/der/sup/inf)", () => {
    const plancha = resolverPlanchaUtil({
      pliegoAnchoMm: 325,
      pliegoAltoMm: 500,
      maquinaParametrosTecnicos: {
        margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 10, inf: 10 },
      },
    });
    expect(plancha).toMatchObject({ anchoMm: 315, altoMm: 480 });
  });

  it("sin máquina cae al default de familia (5 mm por lado)", () => {
    const plancha = resolverPlanchaUtil({ pliegoAnchoMm: 325, pliegoAltoMm: 500 });
    expect(plancha).toMatchObject({ anchoMm: 315, altoMm: 490 });
  });

  it("el override del paso (nestingConfig.margins) le gana a la máquina", () => {
    const plancha = resolverPlanchaUtil({
      pliegoAnchoMm: 300,
      pliegoAltoMm: 400,
      maquinaParametrosTecnicos: {
        margenesNoImprimiblesMm: { izq: 20, der: 20, sup: 20, inf: 20 },
      },
      pasoParams: {
        nestingConfig: { margins: { leftMm: 2, rightMm: 2, topMm: 3, bottomMm: 3 } },
      },
    });
    expect(plancha).toMatchObject({ anchoMm: 296, altoMm: 394 });
  });

  it("un 0 declarado GANA (no cae al siguiente): margen cero es legítimo", () => {
    const plancha = resolverPlanchaUtil({
      pliegoAnchoMm: 100,
      pliegoAltoMm: 100,
      maquinaParametrosTecnicos: {
        margenesNoImprimiblesMm: { izq: 0, der: 0, sup: 0, inf: 0 },
      },
    });
    expect(plancha).toMatchObject({ anchoMm: 100, altoMm: 100 });
  });

  it("extraMargins y pieceBleed se SUMAN al margen base", () => {
    const plancha = resolverPlanchaUtil({
      pliegoAnchoMm: 325,
      pliegoAltoMm: 500,
      maquinaParametrosTecnicos: {
        margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 },
      },
      pasoParams: {
        nestingConfig: {
          extraMargins: { leftMm: 10, rightMm: 0, topMm: 0, bottomMm: 0 },
          pieceBleedMm: 1,
        },
      },
    });
    // izq 5+10+1=16, der 5+0+1=6, sup/inf 5+0+1=6
    expect(plancha).toMatchObject({ anchoMm: 325 - 16 - 6, altoMm: 500 - 6 - 6 });
  });

  it("margen uniforme legacy de la máquina (margenNoImprimibleMm)", () => {
    const plancha = resolverPlanchaUtil({
      pliegoAnchoMm: 210,
      pliegoAltoMm: 297,
      maquinaParametrosTecnicos: { margenNoImprimibleMm: 4 },
    });
    expect(plancha).toMatchObject({ anchoMm: 202, altoMm: 289 });
  });

  it("devuelve null si los márgenes se comen el pliego o faltan dims", () => {
    expect(
      resolverPlanchaUtil({
        pliegoAnchoMm: 8,
        pliegoAltoMm: 100,
        maquinaParametrosTecnicos: {
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 0, inf: 0 },
        },
      }),
    ).toBeNull();
    expect(resolverPlanchaUtil({ pliegoAnchoMm: 0, pliegoAltoMm: 100 })).toBeNull();
  });
});
