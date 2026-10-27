import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { IluminacionTiraResumen } from './iluminacion-tira-resumen';

describe('resumen de tira LED', () => {
  it('muestra los largos en cm y el consumo en metros sin cambiar la escala', () => {
    const html = renderToStaticMarkup(<IluminacionTiraResumen plan={{
      unidades: 1, anchoMm: 2400, altoMm: 1200, profundidadMm: 150,
      orientacion: 'horizontal', filas: 12, largoFilaMm: 2350,
      separacionRealMm: 1150 / 12, retiroMm: 25, metrosPorCartel: 28.2,
      wattsMetro: 8, wattsPorCartel: 225.6, tensionV: 12, margenPct: 30,
      alimentacionesMinimas: null, maxAlimentacionM: null,
      fuentes: { porCartel: 1, capacidadW: 350, consumoMaximoPorFuenteW: 225.6 },
    }} />);
    expect(html).toContain('12 filas de 235 cm');
    expect(html).toContain('28,2 m de tira');
    expect(html).toContain('225,6 W a 12 V');
    expect(html).toContain('9,58 cm');
    expect(html).toContain('1 fuente de 350 W');
    expect(html).toContain('confirmar con el proveedor');
  });
});
