import { describe, expect, it } from "vitest";

import {
  type MutacionAplicadaView,
  demasiaPorLado,
  describirLados,
  describirModificaciones,
  describirOjales,
  medidaAntesDespues,
  medidasDeCorte,
  porcentajeMaterialExtra,
  resumenModificacion,
  resumenOjales,
  tieneDemasia,
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
  it("nombra la modificación con el nombre del PASO", () => {
    // [F4 efectos] La frase la encabeza el paso que pidió el material extra,
    // que es como se llama en el taller. El preset bolsillo/refuerzo murió.
    expect(
      resumenModificacion({
        ...BOLSILLO,
        subTipo: undefined,
        nombrePaso: "Tensado de lona",
        lados: ["superior", "inferior", "izquierdo", "derecho"],
      }),
    ).toBe("Tensado de lona en los 4 lados · +100 mm por lado");
  });

  it("sin nombre ni preset, no inventa: dice qué es", () => {
    expect(resumenModificacion({ ...BOLSILLO, subTipo: undefined })).toBe(
      "Material extra en arriba y abajo · +100 mm por lado",
    );
  });

  it("compat: una cotización vieja sigue leyéndose por su preset", () => {
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

describe("resumenOjales / describirOjales", () => {
  const CONFIG = {
    separacionMaxMm: 500,
    lados: ["superior", "inferior", "izquierdo", "derecho"],
    esquinasSiempre: true,
  };
  const posiciones = (n: number) => Array.from({ length: n }, () => ({}));

  it("una sola pieza: el total es el de la pieza", () => {
    const r = resumenOjales([
      {
        ojalesLayout: [{ cantidad: 1, posiciones: posiciones(10) }],
        ojalesConfig: CONFIG,
      },
    ])!;
    expect(r).toMatchObject({ total: 10, porPieza: 10, piezas: 1 });
    expect(describirOjales(r)).toBe(
      "10 ojales · cada 50 cm · los 4 lados",
    );
  });

  /** Lo que pidió el usuario: cuántos ojales lleva el trabajo, no la pieza. */
  it("varias piezas: manda el total y aclara el por pieza", () => {
    const r = resumenOjales([
      {
        ojalesLayout: [{ cantidad: 3, posiciones: posiciones(10) }],
        ojalesConfig: CONFIG,
      },
    ])!;
    expect(r).toMatchObject({ total: 30, porPieza: 10, piezas: 3 });
    expect(describirOjales(r)).toBe(
      "30 ojales (10 por pieza) · cada 50 cm · los 4 lados",
    );
  });

  it("suma piezas de medidas distintas", () => {
    const r = resumenOjales([
      {
        ojalesLayout: [
          { cantidad: 1, posiciones: posiciones(10) },
          { cantidad: 2, posiciones: posiciones(8) },
        ],
        ojalesConfig: CONFIG,
      },
    ])!;
    expect(r.total).toBe(26);
    expect(r.piezas).toBe(3);
  });

  it("sin ojales no hay resumen", () => {
    expect(resumenOjales([{}, { ojalesLayout: null }])).toBeNull();
  });

  it("sin config igual informa la cantidad", () => {
    const r = resumenOjales([
      { ojalesLayout: [{ cantidad: 1, posiciones: posiciones(6) }] },
    ])!;
    expect(describirOjales(r)).toBe("6 ojales");
  });
});

describe("describirModificaciones", () => {
  it("una línea por paso PRE", () => {
    expect(
      describirModificaciones([
        { mutacionAplicada: BOLSILLO },
        {},
        {
          mutacionAplicada: {
            ...BOLSILLO,
            subTipo: "refuerzo",
            lados: ["izquierdo", "derecho"],
            demasiaMm: 40,
          },
        },
      ]),
    ).toEqual([
      "Bolsillo en arriba y abajo · +100 mm por lado",
      "Refuerzo en los laterales · +40 mm por lado",
    ]);
  });

  it("sin pasos PRE devuelve vacío", () => {
    expect(describirModificaciones([{}])).toEqual([]);
  });
});

describe("demasiaPorLado", () => {
  it("sin pasos PRE no hay demasía", () => {
    const d = demasiaPorLado([{ mutacionAplicada: null }, {}]);
    expect(d).toEqual({ superior: 0, inferior: 0, izquierdo: 0, derecho: 0 });
    expect(tieneDemasia(d)).toBe(false);
  });

  it("caso A: el bolsillo sólo carga los lados horizontales", () => {
    const d = demasiaPorLado([{ mutacionAplicada: BOLSILLO }]);
    expect(d).toEqual({
      superior: 100,
      inferior: 100,
      izquierdo: 0,
      derecho: 0,
    });
    expect(tieneDemasia(d)).toBe(true);
  });

  /** Es lo que distingue un bolsillo arriba+abajo de uno sólo arriba. */
  it("acumula pasos encadenados en los ejes que corresponden", () => {
    const refuerzoLateral: MutacionAplicadaView = {
      ...BOLSILLO,
      subTipo: "refuerzo",
      lados: ["izquierdo", "derecho"],
      demasiaMm: 40,
    };
    expect(
      demasiaPorLado([
        { mutacionAplicada: BOLSILLO },
        {},
        { mutacionAplicada: refuerzoLateral },
      ]),
    ).toEqual({ superior: 100, inferior: 100, izquierdo: 40, derecho: 40 });
  });

  it("dos pasos sobre el mismo lado se suman", () => {
    expect(
      demasiaPorLado([
        { mutacionAplicada: { ...BOLSILLO, lados: ["superior"] } },
        { mutacionAplicada: { ...BOLSILLO, lados: ["superior"], demasiaMm: 30 } },
      ]).superior,
    ).toBe(130);
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
