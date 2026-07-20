import { describe, expect, it } from "vitest";

import {
  type MutacionAplicadaView,
  describirLados,
  medidaAntesDespues,
  medidasDeCorte,
  porcentajeMaterialExtra,
  resumenModificacion,
} from "@/lib/modificaciones-fisicas";

/** Caso A del diseño: bolsillo sup+inf de 100mm sobre 1500×1000. */
const BOLSILLO: MutacionAplicadaView = {
  subTipo: "bolsillo",
  lados: ["superior", "inferior"],
  demasiaMm: 100,
  deltaAnchoMm: 0,
  deltaAltoMm: 200,
  metrosLinealesUnion: 3,
  piezas: [
    {
      antes: { anchoMm: 1500, altoMm: 1000 },
      despues: { anchoMm: 1500, altoMm: 1200 },
    },
  ],
};

describe("describirLados", () => {
  it("usa los atajos que dice la gente del taller", () => {
    expect(
      describirLados(["superior", "inferior", "izquierdo", "derecho"]),
    ).toBe("los 4 lados");
    expect(describirLados(["superior", "inferior"])).toBe("arriba y abajo");
    expect(describirLados(["izquierdo", "derecho"])).toBe("los laterales");
  });

  it("enumera cuando no hay atajo", () => {
    expect(describirLados(["superior", "izquierdo"])).toBe("arriba y izquierda");
    expect(describirLados(["superior", "inferior", "derecho"])).toBe(
      "arriba, abajo y derecha",
    );
  });

  it("no depende del orden en que vengan los lados", () => {
    expect(describirLados(["inferior", "superior"])).toBe("arriba y abajo");
  });

  it("un solo lado", () => {
    expect(describirLados(["superior"])).toBe("arriba");
  });

  it("sin lados", () => {
    expect(describirLados([])).toBe("sin lados");
  });
});

describe("resumenModificacion", () => {
  it("arma la frase del caso A", () => {
    expect(resumenModificacion(BOLSILLO)).toBe(
      "Bolsillo en arriba y abajo · +100 mm por lado",
    );
  });

  it("arma la frase del caso B", () => {
    expect(
      resumenModificacion({
        ...BOLSILLO,
        subTipo: "refuerzo",
        lados: ["superior", "inferior", "izquierdo", "derecho"],
        demasiaMm: 40,
      }),
    ).toBe("Refuerzo en los 4 lados · +40 mm por lado");
  });
});

describe("porcentajeMaterialExtra", () => {
  it("caso A: el bolsillo cuesta 20% más de material", () => {
    expect(porcentajeMaterialExtra(BOLSILLO)).toBeCloseTo(20, 6);
  });

  it("caso B: el refuerzo de 40mm en los 4 lados cuesta ~13.8%", () => {
    expect(
      porcentajeMaterialExtra({
        ...BOLSILLO,
        piezas: [
          {
            antes: { anchoMm: 1500, altoMm: 1000 },
            despues: { anchoMm: 1580, altoMm: 1080 },
          },
        ],
      }),
      // 1.7064 / 1.5 − 1 = 13.76%
    ).toBeCloseTo(13.76, 2);
  });

  it("suma todas las piezas", () => {
    expect(
      porcentajeMaterialExtra({
        ...BOLSILLO,
        piezas: [
          {
            antes: { anchoMm: 1000, altoMm: 1000 },
            despues: { anchoMm: 1000, altoMm: 2000 },
          },
          {
            antes: { anchoMm: 1000, altoMm: 1000 },
            despues: { anchoMm: 1000, altoMm: 1000 },
          },
        ],
      }),
    ).toBeCloseTo(50, 6);
  });

  it("devuelve null sin piezas", () => {
    expect(porcentajeMaterialExtra({ ...BOLSILLO, piezas: [] })).toBeNull();
  });
});

describe("medidasDeCorte", () => {
  it("sin pasos PRE no hay medida de corte", () => {
    expect(medidasDeCorte([{ mutacionAplicada: null }, {}])).toEqual([]);
  });

  it("con un solo paso devuelve su antes y después", () => {
    expect(medidasDeCorte([{ mutacionAplicada: BOLSILLO }])).toEqual([
      {
        antes: { anchoMm: 1500, altoMm: 1000 },
        despues: { anchoMm: 1500, altoMm: 1200 },
      },
    ]);
  });

  /**
   * El caso que importa: con refuerzo + bolsillo encadenados, la medida
   * intermedia no le sirve a nadie. El operario necesita la que pidió el
   * cliente y la que tiene que cortar.
   */
  it("atraviesa varios pasos: primer antes contra último después", () => {
    const refuerzo: MutacionAplicadaView = {
      ...BOLSILLO,
      subTipo: "refuerzo",
      lados: ["izquierdo", "derecho"],
      demasiaMm: 40,
      piezas: [
        {
          antes: { anchoMm: 1500, altoMm: 1200 },
          despues: { anchoMm: 1580, altoMm: 1200 },
        },
      ],
    };

    expect(
      medidasDeCorte([
        { mutacionAplicada: BOLSILLO },
        {},
        { mutacionAplicada: refuerzo },
      ]),
    ).toEqual([
      {
        antes: { anchoMm: 1500, altoMm: 1000 },
        despues: { anchoMm: 1580, altoMm: 1200 },
      },
    ]);
  });

  it("alinea las piezas por índice", () => {
    const dosPiezas: MutacionAplicadaView = {
      ...BOLSILLO,
      piezas: [
        {
          antes: { anchoMm: 1500, altoMm: 1000 },
          despues: { anchoMm: 1500, altoMm: 1200 },
        },
        {
          antes: { anchoMm: 800, altoMm: 600 },
          despues: { anchoMm: 800, altoMm: 800 },
        },
      ],
    };

    expect(medidasDeCorte([{ mutacionAplicada: dosPiezas }])).toHaveLength(2);
    expect(medidasDeCorte([{ mutacionAplicada: dosPiezas }])[1]).toEqual({
      antes: { anchoMm: 800, altoMm: 600 },
      despues: { anchoMm: 800, altoMm: 800 },
    });
  });

  it("descarta piezas que terminaron igual que empezaron", () => {
    const soloUna: MutacionAplicadaView = {
      ...BOLSILLO,
      piezas: [
        {
          antes: { anchoMm: 1500, altoMm: 1000 },
          despues: { anchoMm: 1500, altoMm: 1200 },
        },
        {
          antes: { anchoMm: 800, altoMm: 600 },
          despues: { anchoMm: 800, altoMm: 600 },
        },
      ],
    };

    expect(medidasDeCorte([{ mutacionAplicada: soloUna }])).toHaveLength(1);
  });
});

describe("medidaAntesDespues", () => {
  it("devuelve la medida de la primera pieza", () => {
    expect(medidaAntesDespues(BOLSILLO)).toEqual({
      antes: { anchoMm: 1500, altoMm: 1000 },
      despues: { anchoMm: 1500, altoMm: 1200 },
    });
  });

  it("devuelve null sin piezas", () => {
    expect(medidaAntesDespues({ ...BOLSILLO, piezas: [] })).toBeNull();
  });
});
