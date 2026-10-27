import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IluminacionTubosResumen } from './iluminacion-tubos-resumen';

describe('Resumen de tubos', () => {
  it('dibuja tubos enteros y muestra consumo por cartel sin fuente', () => {
    const html = renderToStaticMarkup(<IluminacionTubosResumen plan={{
      unidades: 2, anchoMm: 2360, altoMm: 1160, orientacion: 'horizontal',
      filas: 4, tubosPorFila: 3, tubosPorCartel: 12, largoTuboMm: 600,
      retiroMm: 20, separacionFilasMm: 280, separacionExtremosMm: 520 / 3,
      wattsPorCartel: 108, tensionV: 220,
    }} />);
    expect(html.match(/<line /g)).toHaveLength(12);
    expect(html).toContain('12 tubos LED de 60 cm');
    expect(html).toContain('sin fuente externa');
    expect(html).toContain('108');
  });
});
