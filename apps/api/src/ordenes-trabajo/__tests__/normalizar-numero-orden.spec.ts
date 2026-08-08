import { normalizarNumeroOrden } from '../entrega.service';

/**
 * El lector 2D emula un teclado US y manda la POSICIÓN de la tecla, no el
 * carácter: con el sistema en español el `-` sale como `'`. Sin normalizar,
 * el número escaneado nunca matchea y la entrega no abre.
 */
describe('normalizarNumeroOrden', () => {
  it('arregla el guión que el layout español convierte en apóstrofe', () => {
    // Lo que efectivamente llegó del lector de Lucas (2026-08-09).
    expect(normalizarNumeroOrden("OT'2026'0009")).toBe('OT-2026-0009');
  });

  it('deja intacto un número ya correcto', () => {
    expect(normalizarNumeroOrden('OT-2026-0009')).toBe('OT-2026-0009');
  });

  it('tolera minúsculas y espacios de sobra', () => {
    expect(normalizarNumeroOrden('  ot-2026-0009 ')).toBe('OT-2026-0009');
  });

  it('cubre otros separadores posibles según el layout', () => {
    for (const raro of ['OT/2026/0009', 'OT?2026?0009', 'OT_2026_0009']) {
      expect(normalizarNumeroOrden(raro)).toBe('OT-2026-0009');
    }
  });

  it('colapsa separadores repetidos y recorta los de los bordes', () => {
    expect(normalizarNumeroOrden("-OT''2026---0009-")).toBe('OT-2026-0009');
  });

  it('no inventa un número con basura', () => {
    expect(normalizarNumeroOrden('   ')).toBe('');
    expect(normalizarNumeroOrden('---')).toBe('');
  });
});
