import { RecorridosVectorialesService } from './recorridos-vectoriales.service';

describe('RecorridosVectorialesService', () => {
  const totalLengthMm = 700;
  const service = new (class extends RecorridosVectorialesService {
    protected loadLinker() {
      return Promise.resolve({
        generateHotwireJob: (input: {
          profile?: { feedRateMmPerMin?: number };
        }) => {
          const feed = input.profile?.feedRateMmPerMin ?? 350;
          return {
            originSvg: { x: 0, y: 0 },
            routeSvg: [
              { x: 0, y: 0, via: 'origin' as const },
              { x: 700, y: 0, via: 'contour' as const },
            ],
            routeMachine: [
              { x: 0, y: 0, via: 'origin' as const },
              { x: 700, y: 0, via: 'contour' as const },
            ],
            metrics: {
              contourLengthMm: 650,
              bridgeOneWayLengthMm: 25,
              bridgeTravelLengthMm: 50,
              totalLengthMm,
              estimatedSeconds: (totalLengthMm / feed) * 60,
              contourCount: 1,
              pieceCount: 1,
              bridgeCount: 1,
            },
            bridges: [{ id: 'origin-1' }],
            linkedSvg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
            tap: `G17 G90 G21\r\nG1 F${feed} \r\nX0.000000 Y0.000000\r\n`,
            report: {},
          };
        },
      });
    }
  })();

  it('genera un recorrido CORTE y aplica la velocidad al TAP y al tiempo', async () => {
    const result = await service.generar({
      modo: 'CORTE',
      svg: '<svg/>',
      nombreFuente: 'puma.svg',
      perfil: {
        id: 'test-hotwire',
        nombre: 'Hilo caliente de prueba',
        postprocesador: 'HOTWIRE_TAP_V1',
        anchoUtilMm: 1250,
        altoUtilMm: 600,
        velocidadMmMin: 420,
      },
    });

    expect(result.modo).toBe('CORTE');
    expect(result.tap).toContain('G1 F420 ');
    expect(result.recorridoMaquina.length).toBeGreaterThan(1);
    expect(result.metricas.longitudTotalMm).toBeGreaterThan(0);
    expect(result.metricas.tiempoEstimadoSeg).toBeCloseTo(
      (result.metricas.longitudTotalMm / 420) * 60,
      5,
    );
  });
});
