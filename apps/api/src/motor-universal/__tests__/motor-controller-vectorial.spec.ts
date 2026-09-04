import { MotorUniversalController } from '../motor.controller';

describe('medición vectorial comercial', () => {
  it('mide los contornos reales aunque el viewBox tenga margen interno', () => {
    const controller = new MotorUniversalController({} as never, {} as never);
    const result = controller.medirSvg(
      {
        nombreArchivo: 'cartel.svg',
        svg: '<svg viewBox="0 0 100 50"><rect x="10" y="10" width="80" height="30"/></svg>',
      },
      { auth: { tenantId: 'tenant', userId: 'usuario' } } as never,
    );

    expect(result.relacionAltoAncho).toBeCloseTo(0.375, 6);
  });
});
