import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DibujoSimulacionRollo } from './simular-nesting-cola';
import { simularNestingCola, type SimulacionNestingCola } from '@/lib/colas-produccion';
import { apiRequest } from '@/lib/api';
import { dibujoNestingCola } from '@/lib/nesting-cola-vista';

vi.mock('@/lib/api', () => ({ apiRequest: vi.fn().mockResolvedValue({}) }));

describe('simulación manual de rollo', () => {
  it('envía sólo IDs y permite cancelar la consulta; no completa ni inicia trabajos', async () => {
    const signal = new AbortController().signal;
    await simularNestingCola('maquina', ['p1', 'p2'], signal);
    expect(apiRequest).toHaveBeenCalledWith('/produccion/colas/maquina/simular-nesting', { method: 'POST', body: JSON.stringify({ pasoIds: ['p1', 'p2'] }), signal });
  });
  it('dibuja proporciones reales, referencia OT/panel y medidas; escapa los nombres', () => {
    const datos: SimulacionNestingCola = { materialNombre: '<Vinilo>', maquina: { id: 'm', nombre: 'UV', anchoMaximoMm: 1600 }, trabajos: [{ pasoId: 'p', itemId: 'i', referencia: 'OT-0050 · Vinilo', piezas: 1 }],
      piezas: [{ id: 'p1', trabajo: 0, etiqueta: 'OT-0050 <script> · panel 1/2', anchoMm: 1170, altoMm: 1600, permiteRotar: true, panel: 1, paneles: 2, solapeInicioMm: 0, solapeFinMm: 20 }],
      alternativas: [], descartados: [], separacionMm: 0, separacionVerticalMm: 0, margenes: { izquierda: 10, derecha: 10, inicio: 100, fin: 100 } };
    const html = renderToStaticMarkup(<DibujoSimulacionRollo datos={datos} alternativa={{ anchoMm: 1370, largoMm: 1800, superficieM2: 2.466, aprovechamientoPct: 75,
      ubicaciones: [{ piezaId: 'p1', xMm: 10, yMm: 100, anchoMm: 1170, altoMm: 1600, rotada: false }] }} />);
    // El dibujo comparte ahora orientación y escala con el visor de la OT.
    const pieza = html.match(/data-piece-id="p1"[^>]*>[\s\S]*?<rect[^>]*width="([\d.]+)" height="([\d.]+)"/);
    expect(pieza).not.toBeNull();
    expect(Number(pieza![1]) / Number(pieza![2])).toBeCloseTo(1170 / 1600, 8);
    const adaptado = dibujoNestingCola(datos, { anchoMm: 1370, largoMm: 1800, superficieM2: 2.466, aprovechamientoPct: 75,
      ubicaciones: [{ piezaId: 'p1', xMm: 10, yMm: 100, anchoMm: 1170, altoMm: 1600, rotada: false }] });
    expect(adaptado.placements[0]).toMatchObject({ xMm: 10, yMm: 100, widthMm: 1170, heightMm: 1600, panelIndex: 1, panelCount: 2 });
    expect(adaptado.visualConfig?.usableArea).toEqual({ xMm: 10, yMm: 100, widthMm: 1350, heightMm: 1600 });
    expect(html).toContain('OT-0050 · P1/2');
    expect(html).toContain('117×160 cm');
    expect(html).not.toContain('<script>');
    expect(html).toContain('role="img"');
  });
});
