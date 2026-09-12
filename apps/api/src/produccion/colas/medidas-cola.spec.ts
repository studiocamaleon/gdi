import { medidasPiezasCola, medidasPanelesCola } from './medidas-cola';

it('lee las piezas físicas y no interpreta cantidad como superficie', () => {
  expect(
    medidasPiezasCola({
      cantidad: 1,
      piezas: [{ cantidad: 1, anchoMm: 1700, altoMm: 1200 }],
    }),
  ).toEqual([{ cantidad: 1, anchoMm: 1700, altoMm: 1200 }]);
});

describe('medidas calculadas de paneles', () => {
  it('mantiene cada panel, sus solapes y cantidades; deshace la rotación del acomodo', () => {
    const paneles = [1, 2].flatMap((panelIndex) =>
      [false, true].map((rotated) => ({
        panelIndex,
        panelCount: 2,
        rotated,
        widthMm: rotated ? 1600 : 1170,
        heightMm: rotated ? 1170 : 1600,
        usefulWidthMm: 1150,
        overlapEndMm: 20,
      })),
    );
    expect(medidasPanelesCola(paneles)).toEqual(
      [1, 2].map((panel) => ({
        panel,
        paneles: 2,
        anchoMm: 1170,
        altoMm: 1600,
        cantidad: 2,
      })),
    );
  });
  it('conserva paneles desiguales y piezas sin panelizar del mismo trabajo', () => {
    expect(
      medidasPanelesCola([
        { widthMm: 1100, heightMm: 1600, panelIndex: 1, panelCount: 2 },
        { widthMm: 1240, heightMm: 1600, panelIndex: 2, panelCount: 2 },
        { widthMm: 500, heightMm: 300 },
      ]),
    ).toEqual([
      { anchoMm: 500, altoMm: 300, panel: null, paneles: null, cantidad: 1 },
      { anchoMm: 1100, altoMm: 1600, panel: 1, paneles: 2, cantidad: 1 },
      { anchoMm: 1240, altoMm: 1600, panel: 2, paneles: 2, cantidad: 1 },
    ]);
  });
  it.each([
    null,
    [],
    [{ widthMm: 0, heightMm: 1600 }],
    [{ widthMm: 1170, heightMm: 1600, panelCount: 2 }],
    [{ widthMm: 1170, heightMm: 1600, panelCount: 2, panelIndex: 3 }],
    [{ widthMm: 1170, heightMm: 1600 }, { widthMm: 1170 }],
  ])(
    'no inventa medidas o índices faltantes ni devuelve un desglose incompleto (%j)',
    (entrada) => {
      expect(medidasPanelesCola(entrada)).toEqual([]);
    },
  );
});
it('usa las medidas para producir aunque también existan medidas finales', () => {
  const job = {
    cantidad: 2,
    medidaCustomMm: { anchoMm: 1700, altoMm: 1200 },
    medidaVisibleMm: { anchoMm: 1500, altoMm: 1000 },
  };
  expect(medidasPiezasCola(job)).toEqual([
    { cantidad: 2, anchoMm: 1700, altoMm: 1200 },
  ]);
});
it('conserva todas las medidas y cantidades de un conjunto, agrupando repeticiones', () => {
  expect(
    medidasPiezasCola({
      cantidad: 50,
      piezas: [
        { cantidad: 50, anchoMm: 300, altoMm: 400 },
        { cantidad: 200, anchoMm: 100, altoMm: 200 },
        { cantidad: 50, anchoMm: 300, altoMm: 400 },
      ],
    }),
  ).toEqual([
    { cantidad: 100, anchoMm: 300, altoMm: 400 },
    { cantidad: 200, anchoMm: 100, altoMm: 200 },
  ]);
});
it('no inventa medidas ni devuelve sólo una parte de las piezas', () => {
  expect(medidasPiezasCola({ cantidad: 1 })).toEqual([]);
  expect(
    medidasPiezasCola({
      cantidad: 1,
      medidaCustomMm: { anchoMm: 1500, altoMm: 1000 },
      piezas: [{ cantidad: 1, anchoMm: 500 }],
    }),
  ).toEqual([]);
  expect(
    medidasPiezasCola({
      cantidad: 1,
      medidaVisibleMm: { anchoMm: 300, altoMm: 400 },
    }),
  ).toEqual([]);
});
