import { evaluateGranFormatoSequentialRollLayout } from './secuencial-rollo';

const baseInput = {
  printableWidthMm: 905,
  marginLeftMm: 7.5,
  marginStartMm: 12.5,
  marginEndMm: 12.5,
  separacionHorizontalMm: 5,
  separacionVerticalMm: 5,
  permitirRotacion: true,
};

describe('evaluateGranFormatoSequentialRollLayout', () => {
  it('coloca cada pieza en su propia fila aunque entren juntas en el ancho', () => {
    const result = evaluateGranFormatoSequentialRollLayout({
      ...baseInput,
      medidas: [
        { anchoMm: 400, altoMm: 300, cantidad: 1 },
        { anchoMm: 400, altoMm: 300, cantidad: 1 },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.rows).toBe(2);
    expect(result!.piecesPerRow).toBe(1);
    // 12.5 + 300 + 5 + 300 + 12.5 = 630
    expect(result!.consumedLengthMm).toBe(630);
    // Sin solapamiento vertical: la segunda arranca después de la primera.
    const [a, b] = result!.placements;
    expect(b!.centerYMm - b!.heightMm / 2).toBeGreaterThanOrEqual(
      a!.centerYMm + a!.heightMm / 2,
    );
  });

  it('expande cantidad > 1 en filas individuales', () => {
    const result = evaluateGranFormatoSequentialRollLayout({
      ...baseInput,
      medidas: [{ anchoMm: 400, altoMm: 300, cantidad: 3 }],
    });
    expect(result).not.toBeNull();
    expect(result!.rows).toBe(3);
    expect(result!.placements).toHaveLength(3);
  });

  it('rota una pieza que solo entra rotada al ancho', () => {
    const result = evaluateGranFormatoSequentialRollLayout({
      ...baseInput,
      medidas: [{ anchoMm: 1460, altoMm: 900, cantidad: 1 }],
    });
    expect(result).not.toBeNull();
    expect(result!.placements[0]!.rotated).toBe(true);
    expect(result!.placements[0]!.widthMm).toBe(900);
    expect(result!.consumedLengthMm).toBe(1485);
  });

  it('rota cuando reduce el largo consumido aunque entre sin rotar', () => {
    const result = evaluateGranFormatoSequentialRollLayout({
      ...baseInput,
      medidas: [{ anchoMm: 300, altoMm: 500, cantidad: 1 }],
    });
    expect(result).not.toBeNull();
    expect(result!.placements[0]!.rotated).toBe(true);
    expect(result!.placements[0]!.heightMm).toBe(300);
  });

  it('no rota si la orientación normal consume menos largo', () => {
    const result = evaluateGranFormatoSequentialRollLayout({
      ...baseInput,
      medidas: [{ anchoMm: 500, altoMm: 300, cantidad: 1 }],
    });
    expect(result).not.toBeNull();
    expect(result!.placements[0]!.rotated).toBe(false);
  });

  it('respeta permitirRotacion = false', () => {
    const result = evaluateGranFormatoSequentialRollLayout({
      ...baseInput,
      permitirRotacion: false,
      medidas: [{ anchoMm: 1460, altoMm: 900, cantidad: 1 }],
    });
    expect(result).toBeNull();
  });

  it('devuelve null si una pieza no entra en ninguna orientación', () => {
    const result = evaluateGranFormatoSequentialRollLayout({
      ...baseInput,
      medidas: [{ anchoMm: 1000, altoMm: 950, cantidad: 1 }],
    });
    expect(result).toBeNull();
  });
});
