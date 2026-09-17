/**
 * Productos por unidad "sin medida" (merchandising comprado: taza, remera):
 * modoMedidas FIJA + medidas vacías es válido cuando unidadComercial='unidad'
 * (se cotiza por unidad; la estampa la maneja la personalización). Para m²/ml
 * sigue exigiendo al menos una medida.
 * Ver docs/productos-comprados-merchandising-diseno.md
 *
 * Unitario sin DB: invoca el método privado sobre el prototype.
 */
import { ProductosService } from '../productos.service';

type ConPrivados = {
  normalizarMedidasPredefinidas: (input: {
    modoMedidas: string;
    medidas?: unknown;
    anchoDefault?: number | null;
    altoDefault?: number | null;
    profundidadDefault?: number | null;
    dimensionesRequeridas?: string[];
    unidadComercial?: string | null;
  }) => Array<{
    nombre: string;
    anchoMm: number;
    altoMm: number;
    profundidadMm?: number;
    esDefault: boolean;
  }>;
};

function svc(): ConPrivados {
  return Object.create(ProductosService.prototype) as unknown as ConPrivados;
}

describe('ProductosService — normalizarMedidasPredefinidas (sin medida)', () => {
  it('FIJA sin medidas + unidad → [] (producto por unidad, sin medida)', () => {
    const r = svc().normalizarMedidasPredefinidas({
      modoMedidas: 'FIJA',
      medidas: [],
      unidadComercial: 'unidad',
    });
    expect(r).toEqual([]);
  });

  it('FIJA sin medidas + m2 → sigue exigiendo una medida (throw)', () => {
    expect(() =>
      svc().normalizarMedidasPredefinidas({
        modoMedidas: 'FIJA',
        medidas: [],
        unidadComercial: 'm2',
      }),
    ).toThrow(/al menos una medida/i);
  });

  it('FIJA con una medida + unidad → la normaliza y marca default', () => {
    const r = svc().normalizarMedidasPredefinidas({
      modoMedidas: 'FIJA',
      medidas: [{ id: 'm1', nombre: '', anchoMm: 90, altoMm: 50, esDefault: true }],
      unidadComercial: 'unidad',
    });
    expect(r).toHaveLength(1);
    expect(r[0].esDefault).toBe(true);
  });

  it('3D exige profundidad en cada medida', () => {
    expect(() =>
      svc().normalizarMedidasPredefinidas({
        modoMedidas: 'FIJA',
        dimensionesRequeridas: ['ANCHO', 'ALTO', 'PROFUNDIDAD'],
        medidas: [
          {
            id: 'm1',
            anchoMm: 1500,
            altoMm: 1000,
            esDefault: true,
          },
        ],
        unidadComercial: 'unidad',
      }),
    ).toThrow(/profundidad/i);
  });

  it('3D conserva profundidad y la incorpora al nombre humano', () => {
    const r = svc().normalizarMedidasPredefinidas({
      modoMedidas: 'FIJA',
      dimensionesRequeridas: ['ANCHO', 'ALTO', 'PROFUNDIDAD'],
      medidas: [
        {
          id: 'm1',
          nombre: '',
          anchoMm: 1500,
          altoMm: 1000,
          profundidadMm: 180,
          esDefault: true,
        },
      ],
      unidadComercial: 'unidad',
    });
    expect(r[0]).toMatchObject({
      anchoMm: 1500,
      altoMm: 1000,
      profundidadMm: 180,
      nombre: '1500 x 1000 x 180 mm',
    });
  });
});
