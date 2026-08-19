import { evaluateRollLayoutForConfiguredAlgorithm } from '../../motor-universal/nesting-dispatcher';
import {
  acomodarTanda,
  claveCompatibilidadVariante,
} from '../produccion.service';

describe('compatibilidad física de variantes', () => {
  it('ignora el ancho pero conserva color, gramaje y demás atributos', () => {
    expect(
      claveCompatibilidadVariante({
        anchoMm: 600,
        color: 'blanco',
        gramaje: 90,
      }),
    ).toBe(
      claveCompatibilidadVariante({
        gramaje: 90,
        color: 'blanco',
        anchoMm: 1200,
      }),
    );
    expect(
      claveCompatibilidadVariante({
        anchoMm: 600,
        color: 'negro',
        gramaje: 90,
      }),
    ).not.toBe(
      claveCompatibilidadVariante({
        anchoMm: 600,
        color: 'blanco',
        gramaje: 90,
      }),
    );
  });
});

/**
 * El simulador GRAN FORMATO re-acomoda la tanda con el motor real. Este test
 * fija que los parámetros que arma `simuladorNesting` a partir del snapshot
 * reproducen EXACTAMENTE lo que el motor cotizó, que es la condición para que
 * el "ahorro vs. cotizado" compare dos acomodos equivalentes.
 *
 * Caso real: OT-2026-0005 y OT-2026-0016, remeras DTF de 28×28 cm en rollo de
 * 600 mm. El snapshot de cada una guarda consumedLengthMm 14450 y
 * aprovechamiento 90,43% con `maxrects-rollo`.
 */
describe('simuladorNesting — paridad con el nesting cotizado', () => {
  // visualConfig del snapshot: márgenes 15/15/100/100, separación 5,
  // pieceBleedMm 2,5, rotación on.
  const ROLLO_MM = 600;
  const DEMASIA = 2.5;
  // El borde efectivo es margen de máquina MÁS demasía: el snapshot guarda
  // usableArea 565 contra printableArea 570. Omitir la demasía daba 14445 en
  // vez de los 14450 cotizados — 5 mm por pasada, y más en anchos justos.
  const BORDE_LATERAL = 15 + DEMASIA;
  const BORDE_LONGITUDINAL = 100 + DEMASIA;

  function acomodar(cantidad: number, anchoRolloMm = ROLLO_MM) {
    return evaluateRollLayoutForConfiguredAlgorithm(
      {
        printableWidthMm: anchoRolloMm - BORDE_LATERAL * 2,
        marginLeftMm: BORDE_LATERAL,
        marginStartMm: BORDE_LONGITUDINAL,
        marginEndMm: BORDE_LONGITUDINAL,
        separacionHorizontalMm: 5,
        separacionVerticalMm: 5,
        permitirRotacion: true,
        medidas: [{ anchoMm: 280, altoMm: 280, cantidad }],
      },
      'maxrects-rollo',
    );
  }

  it('reproduce el consumo cotizado de un item (14450 mm, 90,43%)', () => {
    const candidato = acomodar(100);
    expect(candidato).not.toBeNull();

    const { result } = candidato!;
    expect(result.consumedLengthMm).toBe(14450);
    expect(result.placements).toHaveLength(100);
    expect(result.piecesPerRow).toBe(2);
    // Mismas coordenadas que guardó el snapshot de la cotización.
    const xs = [
      ...new Set(result.placements.map((p) => p.centerXMm - p.widthMm / 2)),
    ].sort((a, b) => a - b);
    expect(xs).toEqual([17.5, 302.5]);

    const areaTotalMm2 = ROLLO_MM * result.consumedLengthMm;
    const aprovechamiento =
      Math.round(((result.usefulAreaM2 * 1_000_000) / areaTotalMm2) * 10000) /
      100;
    expect(aprovechamiento).toBe(90.43);
  });

  it('consolidar las dos OT ahorra una cabecera y un pie, no 30 metros', () => {
    const juntas = acomodar(200)!;
    const porSeparado = 14450 * 2;

    expect(juntas.result.consumedLengthMm).toBe(28700);
    // El ahorro real de juntar trabajos idénticos: los márgenes de una pasada.
    expect(porSeparado - juntas.result.consumedLengthMm).toBe(200);
  });

  /**
   * Regresión del packer propio que tenía el simulador: con márgenes de 30 mm
   * por lado y 15 mm de separación, 280+15+280 = 575 > 540 y caía a una pieza
   * por fila — 58,99 m contra 28,90 m cotizados, o sea un ahorro de −30,1 ml.
   */
  it('no cae a fila india con el ancho útil correcto', () => {
    const conMotor = acomodar(200)!;
    expect(conMotor.result.piecesPerRow).toBe(2);
    expect(conMotor.result.consumedLengthMm).toBeLessThan(30000);
  });

  it('devuelve el mapeo de cada pieza a su medida de origen', () => {
    const { result } = acomodar(4)!;
    for (const placement of result.placements) {
      expect(placement.sourcePieceId).toMatch(/^piece-0-\d+$/);
    }
  });
});

/**
 * Pegamento entre el snapshot de la cotización y el motor: de acá salen las
 * piezas, la config de acomodo y a qué trabajo pertenece cada pieza colocada.
 */
describe('acomodarTanda — desde el snapshot', () => {
  /** Snapshot recortado, con la forma real de OT-2026-0005/0016. */
  function paso(id: string, rutaPasoId: string, cantidad: number) {
    return {
      id,
      rutaPasoId,
      item: {
        cotizacionItem: {
          jobContextJson: { piezas: [{ anchoMm: 280, altoMm: 280, cantidad }] },
          trazabilidadJson: {
            pasos: [
              {
                rutaPasoId,
                nestingResult: {
                  algorithm: 'maxrects-rollo',
                  consumedLengthMm: 14450,
                  placements: Array.from({ length: cantidad }, () => ({
                    widthMm: 280,
                    heightMm: 280,
                  })),
                  visualConfig: {
                    margins: {
                      topMm: 100,
                      leftMm: 15,
                      rightMm: 15,
                      bottomMm: 100,
                    },
                    spacing: { horizontalMm: 5, verticalMm: 5 },
                    allowRotation: true,
                    pieceBleedMm: 2.5,
                  },
                },
              },
            ],
          },
        },
      },
    };
  }

  const RUTA = 'ruta-paso-dtf';

  it('consolida dos pasos y reproduce el acomodo del motor', () => {
    const { anchos } = acomodarTanda(
      [paso('paso-a', RUTA, 100), paso('paso-b', RUTA, 100)],
      [600],
    );

    expect(anchos).toHaveLength(1);
    expect(anchos[0].consumedLengthMm).toBe(28700);
    expect(anchos[0].piezasAcomodadas).toBe(200);
    expect(anchos[0].incompatibles).toEqual([]);
  });

  it('asigna cada pieza acomodada a su paso', () => {
    const { anchos } = acomodarTanda(
      [paso('paso-a', RUTA, 3), paso('paso-b', RUTA, 5)],
      [600],
    );

    const porPaso = new Map<string | null, number>();
    for (const p of anchos[0].placements) {
      const pasoId = (p as { pasoId: string | null }).pasoId;
      porPaso.set(pasoId, (porPaso.get(pasoId) ?? 0) + 1);
    }
    expect(porPaso.get('paso-a')).toBe(3);
    expect(porPaso.get('paso-b')).toBe(5);
  });

  it('compara varios anchos en una sola pasada', () => {
    const { anchos } = acomodarTanda([paso('paso-a', RUTA, 100)], [600, 1600]);

    expect(anchos.map((a) => a.anchoMm)).toEqual([600, 1600]);
    // Un rollo más ancho mete más piezas por fila: consume menos largo.
    expect(anchos[1].consumedLengthMm!).toBeLessThan(
      anchos[0].consumedLengthMm!,
    );
  });

  it('marca el paso cuya pieza no entra en el ancho', () => {
    const { anchos } = acomodarTanda([paso('gigante', RUTA, 2)], [200]);
    expect(anchos[0].incompatibles).toEqual(['gigante']);
    expect(anchos[0].consumedLengthMm).toBeNull();
  });

  it('reporta los pasos sin medidas en vez de acomodarlos', () => {
    const sinPiezas = {
      id: 'manual',
      rutaPasoId: RUTA,
      item: {
        cotizacionItem: { jobContextJson: {}, trazabilidadJson: { pasos: [] } },
      },
    };
    const { sinMedidas, anchos } = acomodarTanda(
      [sinPiezas, paso('paso-a', RUTA, 4)],
      [600],
    );

    expect(sinMedidas).toEqual(['manual']);
    expect(anchos[0].piezasAcomodadas).toBe(4);
  });
});
