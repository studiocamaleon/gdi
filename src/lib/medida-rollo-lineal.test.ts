import { describe, expect, it } from "vitest";

import {
  prioridadIdsVarianteRollo,
  resolverAnchoRolloLineal,
} from "./medida-rollo-lineal";

describe("resolverAnchoRolloLineal", () => {
  it("prioriza el rollo real del Plano CAD sobre el ancho de la máquina", () => {
    expect(
      resolverAnchoRolloLineal({
        materialWidthMm: 914,
        machineWidthMm: 920,
        machineParams: {
          margenesNoImprimiblesMm: { izq: 5, der: 5 },
        },
      }),
    ).toEqual({
      materialWidthMm: 914,
      usableWidthMm: 904,
      margins: { leftMm: 5, rightMm: 5 },
    });
  });

  it("mantiene el comportamiento DTF/UV con el ancho de su material", () => {
    expect(
      resolverAnchoRolloLineal({
        materialWidthMm: 300,
        machineWidthMm: 600,
        machineParams: {
          margenesNoImprimiblesMm: { izquierdo: 15, derecho: 15 },
        },
      })?.usableWidthMm,
    ).toBe(270);
  });

  it("usa la máquina sólo cuando el material no declara ancho", () => {
    expect(
      resolverAnchoRolloLineal({
        machineWidthMm: 920,
        machineParams: {
          margenesNoImprimiblesMm: { leftMm: 5, rightMm: 5 },
        },
      })?.usableWidthMm,
    ).toBe(910);
  });

  it("en un slot HARDCODED ignora primero los candidatos residuales", () => {
    expect(
      prioridadIdsVarianteRollo({
        selectionMode: "HARDCODED",
        hardcodedId: "film-dtf-600",
        candidateDefaultIds: ["vinilo-1060"],
      }),
    ).toEqual(["film-dtf-600", "vinilo-1060"]);
  });
});
