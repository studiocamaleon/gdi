import { evaluateRollLayoutForConfiguredAlgorithm } from '../nesting-dispatcher';

describe('nesting de rollo — paridad con el nesting cotizado', () => {
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
   * Regresión de bordes y separación del acomodo: con márgenes de 30 mm
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

