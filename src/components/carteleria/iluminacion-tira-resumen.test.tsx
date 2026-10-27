import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { IluminacionTiraResumen } from './iluminacion-tira-resumen';

describe('resumen de tira LED', () => {
  it.each([
    { fuentes: { porCartel: 1, capacidadW: 300, corrienteA: 25, consumoMaximoPorFuenteW: 225.6 }, texto: '1 fuente de 25 A a 12 V (300 W)' },
    { fuentes: { porCartel: 1, capacidadW: 350, consumoMaximoPorFuenteW: 225.6 }, texto: '1 fuente de 29,17 A a 12 V (350 W)' },
  ])('muestra medidas, consumo y amperios de fuentes nuevas y cotizaciones anteriores', ({ fuentes, texto }) => {
    const html = renderToStaticMarkup(<IluminacionTiraResumen plan={{
      unidades: 1, anchoMm: 2400, altoMm: 1200, profundidadMm: 150,
      orientacion: 'horizontal', filas: 12, largoFilaMm: 2350,
      separacionRealMm: 1150 / 12, retiroMm: 25, metrosPorCartel: 28.2,
      wattsMetro: 8, wattsPorCartel: 225.6, tensionV: 12, margenPct: 30,
      alimentacionesMinimas: null, maxAlimentacionM: null,
      fuentes,
    }} />);
    expect(html).toContain('12 filas de 235 cm');
    expect(html).toContain('28,2 m de tira');
    expect(html).toContain('225,6 W a 12 V');
    expect(html).toContain('9,58 cm');
    expect(html).toContain('Consumo: 18,8 A');
    expect(html).toContain('capacidad mínima total: 24,44 A por cartel');
    expect(html).toContain(texto);
    expect(html).toContain('confirmar con el proveedor');
  });
});
