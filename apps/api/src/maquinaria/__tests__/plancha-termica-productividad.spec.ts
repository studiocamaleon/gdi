import { deriveProductividadPlanchaTermica } from '../plancha-termica';

describe('plancha térmica — derivación de productividad por ciclo', () => {
  it('deriva piezas/hora de solo el planchado', () => {
    // ciclo = 18 s → 3600/18 = 200 piezas/h
    const out = deriveProductividadPlanchaTermica({ tiempoPrensadoSeg: 18 });
    expect(out).not.toBeNull();
    expect(out!.productivityUnit).toBe('piezas_h');
    expect(out!.productivityValue).toBeCloseTo(200, 5);
  });

  it('suma pre-planchado + planchado + post-planchado', () => {
    // 8 + 16 + 8 = 32 s → 112.5 piezas/h
    const out = deriveProductividadPlanchaTermica({
      tiempoPreplanchadoSeg: 8,
      tiempoPrensadoSeg: 16,
      tiempoPostplanchadoSeg: 8,
    });
    expect(out!.productivityValue).toBeCloseTo(112.5, 5);
  });

  it('pre y post son opcionales (default 0)', () => {
    // solo planchado 20 + post 10 = 30 s → 120 piezas/h
    const out = deriveProductividadPlanchaTermica({
      tiempoPrensadoSeg: 20,
      tiempoPostplanchadoSeg: 10,
    });
    expect(out!.productivityValue).toBeCloseTo(120, 5);
  });

  it('acepta strings numéricos (payload sin castear)', () => {
    const out = deriveProductividadPlanchaTermica({
      tiempoPreplanchadoSeg: '8',
      tiempoPrensadoSeg: '16',
      tiempoPostplanchadoSeg: '8',
    });
    expect(out!.productivityValue).toBeCloseTo(112.5, 5);
  });

  it('devuelve null si falta el planchado', () => {
    expect(deriveProductividadPlanchaTermica({})).toBeNull();
    expect(
      deriveProductividadPlanchaTermica({ tiempoPreplanchadoSeg: 8 }),
    ).toBeNull();
    expect(deriveProductividadPlanchaTermica(null)).toBeNull();
  });
});
