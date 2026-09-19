import { describe, expect, it } from "vitest";
import {
  medidasSeleccionadas,
  paginasCad,
  perfilCadPreferido,
  resumenMedidas,
  sugerirCad,
  cantidadImpresionesCad,
  errorCopiasPorPagina,
  type PerfilCadCopiado,
} from "./centro-copiado-cad";
const perfil = {
  id: "bn",
  color: "BN",
  prioridad: 1,
  rollo: { anchoRolloMm: 914, margenMm: 5 },
} as PerfilCadCopiado;
const medidas = [
  { anchoMm: 594, altoMm: 841 },
  { anchoMm: 841, altoMm: 1189 },
  { anchoMm: 910, altoMm: 1200 },
];
describe("planos del Centro de copiado", () => {
  const desglose = {
    modo: "CAD" as const,
    paginas: 2,
    paginasOriginales: 5,
    rangoPaginas: "2,5",
    copias: 2,
    copiasPorPagina: [
      { pagina: 2, copias: 3 },
      { pagina: 4, copias: 20 },
    ],
  };
  it("suma las copias de páginas originales seleccionadas y usa la cantidad común como respaldo", () => {
    expect(errorCopiasPorPagina(desglose)).toBeNull();
    expect(cantidadImpresionesCad(desglose)).toBe(5);
    expect(cantidadImpresionesCad({ ...desglose, rangoPaginas: "4" })).toBe(20);
    expect(cantidadImpresionesCad({ ...desglose, copiasPorPagina: [] })).toBe(
      4,
    );
    expect(cantidadImpresionesCad({ ...desglose, rangoPaginas: "7" })).toBe(0);
  });
  it("rechaza el desglose en documentos y las cantidades o páginas inválidas", () => {
    expect(
      errorCopiasPorPagina({ ...desglose, modo: "HOJAS", copiasPorPagina: [] }),
    ).toContain("sólo");
    for (const copiasPorPagina of [
      [{ pagina: 0, copias: 1 }],
      [{ pagina: 6, copias: 1 }],
      [{ pagina: 1.5, copias: 1 }],
      [{ pagina: 1, copias: 0 }],
      [{ pagina: 1, copias: 1.5 }],
      [{ pagina: 1, copias: 10001 }],
      [
        { pagina: 2, copias: 2 },
        { pagina: 2, copias: 3 },
      ],
    ])
      expect(
        errorCopiasPorPagina({ ...desglose, copiasPorPagina }),
      ).not.toBeNull();
  });
  it("conserva números del original al seleccionar rangos y valida sólo las páginas elegidas", () => {
    expect(medidasSeleccionadas(medidas, "2,1-2").map((p) => p.pagina)).toEqual(
      [1, 2],
    );
    const paginas = paginasCad(medidas, "1-2", perfil);
    expect(
      paginas.map((p) => [p.plan?.giro, p.plan?.largoSalidaMm, p.plan?.escala]),
    ).toEqual([
      [90, 604, 100],
      [0, 1199, 100],
    ]);
    expect(paginasCad(medidas, "", perfil)[2].error).toContain(
      "No se reducirá",
    );
  });
  it("sugiere CAD por capacidad de formatos y admite formatos rotados", () => {
    const formatos = [
      { anchoMm: 210, altoMm: 297 },
      { anchoMm: 297, altoMm: 420 },
    ];
    expect(sugerirCad([{ anchoMm: 420, altoMm: 297 }], formatos)).toBe(false);
    expect(sugerirCad(medidas, formatos)).toBe(true);
    expect(resumenMedidas(medidas)).toBe("Tamaños mixtos");
    expect(resumenMedidas([medidas[0], { anchoMm: 841, altoMm: 594 }])).toBe(
      "A1",
    );
  });
  it("no elige silenciosamente entre perfiles empatados y respeta B/N o Color", () => {
    expect(perfilCadPreferido([perfil], "COLOR")).toBeUndefined();
    expect(
      perfilCadPreferido([perfil, { ...perfil, id: "otro" }], "BN"),
    ).toBeUndefined();
    expect(
      perfilCadPreferido(
        [perfil, { ...perfil, id: "prioritario", prioridad: 2 }],
        "BN",
      )?.id,
    ).toBe("prioritario");
  });
});
