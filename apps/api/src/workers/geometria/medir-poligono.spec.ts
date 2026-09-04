import { medirPoligono } from './medir-poligono';

describe('medirPoligono', () => {
  it('calcula área, perímetro y límites sin depender del sentido', () => {
    const base = {
      schemaVersion: 1 as const,
      tenantId: 'tenant-a',
      correlationId: 'corr-a',
      solicitadoEl: '2026-09-04T00:00:00.000Z',
    };
    const horario = medirPoligono({
      ...base,
      puntos: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 100 },
        { x: 0, y: 100 },
      ],
    });
    const antihorario = medirPoligono({
      ...base,
      puntos: [
        { x: 0, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 0 },
        { x: 0, y: 0 },
      ],
    });

    expect(horario).toEqual(antihorario);
    expect(horario).toMatchObject({
      areaMm2: 20_000,
      perimetroMm: 600,
      cantidadVertices: 4,
      limites: { anchoMm: 200, altoMm: 100 },
    });
  });

  it('acepta un último punto que repite el cierre', () => {
    const result = medirPoligono({
      schemaVersion: 1,
      tenantId: 'tenant-a',
      correlationId: 'corr-a',
      solicitadoEl: '2026-09-04T00:00:00.000Z',
      puntos: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ],
    });

    expect(result.cantidadVertices).toBe(3);
    expect(result.areaMm2).toBe(50);
  });

  it('rechaza geometría degenerada', () => {
    expect(() =>
      medirPoligono({
        schemaVersion: 1,
        tenantId: 'tenant-a',
        correlationId: 'corr-a',
        solicitadoEl: '2026-09-04T00:00:00.000Z',
        puntos: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ],
      }),
    ).toThrow('área positiva');
  });
});
