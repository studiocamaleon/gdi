import { calculateSustratoToPliegoConversion } from './sustrato-to-pliego';

describe('calculateSustratoToPliegoConversion', () => {
  it('devuelve cero cuando el pliego no entra en la hoja comprada', () => {
    expect(
      calculateSustratoToPliegoConversion({
        sustrato: { anchoMm: 210, altoMm: 297 },
        pliegoImpresion: { anchoMm: 325, altoMm: 475 },
      }).pliegosPorSustrato,
    ).toBe(0);
  });

  it('mantiene la conversión normal o rotada cuando sí entra', () => {
    expect(
      calculateSustratoToPliegoConversion({
        sustrato: { anchoMm: 320, altoMm: 450 },
        pliegoImpresion: { anchoMm: 210, altoMm: 297 },
      }),
    ).toMatchObject({ esDerivado: true, pliegosPorSustrato: 2 });
  });
});
