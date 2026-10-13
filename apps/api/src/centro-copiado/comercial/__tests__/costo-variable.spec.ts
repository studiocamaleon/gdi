import { separarCostoContribucion } from '../costo-variable';

describe('costo variable de Centro de copiado', () => {
  it('conserva insumos, proveedores y cargos; excluye únicamente el tiempo interno', () => {
    const r = separarCostoContribucion({
      costos: { total: 170, tiempoTotal: 40, tiempoExtraTotal: 10 },
    });
    expect(r.variable.toNumber()).toBe(120);
    expect(r.estructura.toNumber()).toBe(50);
  });
  it('recorre componentes sin duplicar tiempos ni quitar costos de proveedores', () => {
    const r = separarCostoContribucion({
      costos: { total: 200, tiempoTotal: 20 },
      componentesFabricados: [
        {
          pasos: [
            {
              activado: true,
              tiempo: { costo: 15, tiemposExtra: [{ costo: 5 }] },
            },
            { activado: true, tercerizado: true, tiempo: { costo: 50 } },
            { activado: false, tiempo: { costo: 50 } },
          ],
          componentes: [{ pasos: [{ activado: true, tiempo: { costo: 10 } }] }],
        },
      ],
    });
    expect(r.variable.toNumber()).toBe(150);
    expect(r.estructura.toNumber()).toBe(50);
  });
  it('no inventa ahorros en costos sin detalle y rechaza un desglose inconsistente', () => {
    expect(
      separarCostoContribucion({ costos: { total: 100 } }).variable.toNumber(),
    ).toBe(100);
    expect(() =>
      separarCostoContribucion({ costos: { total: 100, tiempoTotal: 101 } }),
    ).toThrow('supera');
  });
});
