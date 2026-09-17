import type { NestingIrregularOpenNestData } from '../colas';
import { resolverNestingBaseSeguro } from './nesting-base-seguro';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';

function entrada(
  patch?: Partial<NestingIrregularOpenNestData>,
): NestingIrregularOpenNestData {
  return {
    schemaVersion: 1,
    tenantId: 'tenant-test',
    correlationId: 'base-test',
    solicitadoEl: new Date(0).toISOString(),
    motor: 'collision',
    placa: { anchoMm: 1_000, altoMm: 700, margenMm: 10, maxPlacas: 20 },
    separacionMm: 5,
    timeoutMs: 30_000,
    semilla: 30,
    piezas: [
      {
        id: 'pieza-a',
        cantidad: 12,
        rotaciones: 4,
        contorno: [
          { x: 0, y: 0 },
          { x: 240, y: 0 },
          { x: 240, y: 160 },
          { x: 0, y: 160 },
        ],
      },
    ],
    ...patch,
  };
}

describe('solución base segura de GrafoNest', () => {
  it('produce todas las copias, dentro de placa y respetando separación', () => {
    const input = entrada();
    const result = resolverNestingBaseSeguro(input);

    expect(() => validarResultadoNestingOpenNest(input, result)).not.toThrow();
    expect(result.algoritmo).toBe('grafonest-baseline-v1');
    expect(result.calidadSolucion).toBe('BASE_SEGURA');
    expect(result.placements).toHaveLength(12);
  });

  it('rota una pieza cuando su orientación original no entra', () => {
    const input = entrada({
      placa: { anchoMm: 300, altoMm: 500, margenMm: 10, maxPlacas: 2 },
      piezas: [
        {
          id: 'pieza-rotada',
          cantidad: 1,
          rotaciones: 4,
          contorno: [
            { x: 0, y: 0 },
            { x: 450, y: 0 },
            { x: 450, y: 200 },
            { x: 0, y: 200 },
          ],
        },
      ],
    });

    const result = resolverNestingBaseSeguro(input);
    expect(result.placements[0].rotacionGrados).toBe(90);
    expect(() => validarResultadoNestingOpenNest(input, result)).not.toThrow();
  });
});
