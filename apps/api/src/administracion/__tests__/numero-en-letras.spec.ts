import { enteroEnLetras, importeEnLetras } from '../numero-en-letras';

/**
 * El monto en letras es lo que hace que un recibo sea un recibo: en letras no
 * se puede alterar un dígito. Un error acá no rompe nada visible en pantalla,
 * sale impreso en un documento que el cliente firma — por eso están fijadas
 * todas las trampas del castellano, no sólo el camino feliz.
 */
describe('enteroEnLetras', () => {
  it('los casos base', () => {
    expect(enteroEnLetras(0)).toBe('cero');
    expect(enteroEnLetras(1)).toBe('uno');
    expect(enteroEnLetras(15)).toBe('quince');
    expect(enteroEnLetras(21)).toBe('veintiuno');
    expect(enteroEnLetras(31)).toBe('treinta y uno');
    expect(enteroEnLetras(99)).toBe('noventa y nueve');
  });

  it('distingue "cien" de "ciento"', () => {
    expect(enteroEnLetras(100)).toBe('cien');
    expect(enteroEnLetras(101)).toBe('ciento uno');
    expect(enteroEnLetras(115)).toBe('ciento quince');
    expect(enteroEnLetras(200)).toBe('doscientos');
    expect(enteroEnLetras(500)).toBe('quinientos');
    expect(enteroEnLetras(999)).toBe('novecientos noventa y nueve');
  });

  it('apocopa el "uno" delante de mil', () => {
    expect(enteroEnLetras(1000)).toBe('mil');
    expect(enteroEnLetras(21_000)).toBe('veintiún mil');
    expect(enteroEnLetras(31_000)).toBe('treinta y un mil');
    expect(enteroEnLetras(101_000)).toBe('ciento un mil');
  });

  it('mil va solo, el millón lleva "un"', () => {
    expect(enteroEnLetras(1000)).toBe('mil');
    expect(enteroEnLetras(1_000_000)).toBe('un millón');
    expect(enteroEnLetras(2_000_000)).toBe('dos millones');
    expect(enteroEnLetras(21_000_000)).toBe('veintiún millones');
  });

  it('los importes que se ven todos los días', () => {
    expect(enteroEnLetras(124_059)).toBe(
      'ciento veinticuatro mil cincuenta y nueve',
    );
    expect(enteroEnLetras(248_118)).toBe(
      'doscientos cuarenta y ocho mil ciento dieciocho',
    );
    expect(enteroEnLetras(1_500_000)).toBe('un millón quinientos mil');
    expect(enteroEnLetras(999_999_999)).toBe(
      'novecientos noventa y nueve millones novecientos noventa y nueve mil novecientos noventa y nueve',
    );
  });
});

describe('importeEnLetras', () => {
  it('arma la frase del recibo', () => {
    expect(importeEnLetras(124_059)).toBe(
      'Ciento veinticuatro mil cincuenta y nueve pesos con 00/100.',
    );
    expect(importeEnLetras(1)).toBe('Un peso con 00/100.');
    expect(importeEnLetras(0)).toBe('Cero pesos con 00/100.');
  });

  it('los centavos van en cifras, con dos dígitos', () => {
    expect(importeEnLetras(1250.5)).toBe(
      'Mil doscientos cincuenta pesos con 50/100.',
    );
    expect(importeEnLetras(1250.05)).toBe(
      'Mil doscientos cincuenta pesos con 05/100.',
    );
  });

  it('redondea antes de partir: nunca 100/100', () => {
    // 12,999 redondea a 13,00 — si partiera primero saldría "doce con 100/100".
    expect(importeEnLetras(12.999)).toBe('Trece pesos con 00/100.');
    expect(importeEnLetras(0.999)).toBe('Un peso con 00/100.');
  });

  it('el importe en letras coincide con el número impreso arriba', () => {
    // El PDF muestra $X con toLocaleString (2 decimales, redondeo bancario del
    // navegador) y abajo las letras: si difirieran en un centavo, el recibo no
    // sirve. Se prueba contra el mismo redondeo.
    for (const monto of [0.005, 1.005, 99.994, 99.996, 124_059.499]) {
      const impreso = monto.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const centavosImpresos = impreso.slice(-2);
      expect(importeEnLetras(monto)).toContain(`con ${centavosImpresos}/100.`);
    }
  });
});
