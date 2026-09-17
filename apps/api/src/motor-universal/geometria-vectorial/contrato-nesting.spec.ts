import {
  crearDemandasDesdeGeometriaVectorial,
  crearProblemaNestingIrregular,
  resolverProblemaNestingIrregular,
  type DemandaNesting,
} from './contrato-nesting';
import { nestearGeometriaIrregular } from './nesting-irregular';
import type { GeometriaVectorialCanonica } from './tipos';

const triangulo: GeometriaVectorialCanonica = {
  schemaVersion: 1,
  anchoMm: 60,
  altoMm: 60,
  piezas: [
    {
      id: 'triangulo',
      anchoMm: 60,
      altoMm: 60,
      areaMm2: 1_800,
      perimetroMm: 204.85,
      contornos: [
        {
          esHueco: false,
          puntos: [
            { x: 0, y: 60 },
            { x: 30, y: 0 },
            { x: 60, y: 60 },
          ],
        },
      ],
    },
  ],
  areaTotalMm2: 1_800,
  perimetroTotalMm: 204.85,
  hashFuente: 'triangulo',
};

describe('contrato universal de nesting irregular', () => {
  it('mantiene paridad con el adaptador vectorial anterior', () => {
    const anterior = nestearGeometriaIrregular({
      geometria: triangulo,
      cantidad: 2,
      anchoPlacaMm: 120,
      altoPlacaMm: 120,
      margenMm: 5,
      separacionMm: 2,
      permitirRotacion: true,
      permitirSegmentacion: false,
    });
    const problema = crearProblemaNestingIrregular({
      demandas: crearDemandasDesdeGeometriaVectorial({
        geometria: triangulo,
        cantidad: 2,
      }),
      anchoPlacaMm: 120,
      altoPlacaMm: 120,
      margenMm: 5,
      separacionMm: 2,
      permitirRotacion: true,
      permitirSegmentacion: false,
    });
    const nueva = resolverProblemaNestingIrregular(problema);

    expect(nueva.resultado).toEqual(anterior);
    expect(nueva.problemaHash).toMatch(/^[a-f0-9]{64}$/);
    expect(nueva.versionAlgoritmo).toBe(1);
  });

  it('resuelve rectángulos y polígonos con cantidades independientes', () => {
    const demandas: DemandaNesting[] = [
      ...crearDemandasDesdeGeometriaVectorial({
        geometria: triangulo,
        cantidad: 2,
        propietario: { componenteCodigo: 'VECTOR-A', ocurrenciaId: 'frente' },
      }),
      {
        schemaVersion: 1,
        id: 'rectangulo-b',
        cantidad: 1,
        propietario: { componenteCodigo: 'VECTOR-B', ocurrenciaId: 'dorso' },
        geometria: { tipo: 'RECTANGULO', anchoMm: 40, altoMm: 20 },
      },
    ];
    const solucion = resolverProblemaNestingIrregular(
      crearProblemaNestingIrregular({
        demandas,
        anchoPlacaMm: 160,
        altoPlacaMm: 120,
        permitirSegmentacion: false,
      }),
    );

    expect(solucion.resultado.piezasOriginales).toBe(3);
    expect(solucion.resultado.placements).toHaveLength(3);
    expect(
      solucion.resultado.placements.filter(
        (placement) => placement.pieceId === 'triangulo',
      ),
    ).toHaveLength(2);
    expect(
      solucion.resultado.placements.filter(
        (placement) => placement.pieceId === 'rectangulo-b',
      ),
    ).toHaveLength(1);
    expect(solucion.resultado.areaPiezasMm2).toBe(4_400);
  });

  it('rechaza identidades duplicadas para no mezclar propietarios', () => {
    const demanda = crearDemandasDesdeGeometriaVectorial({
      geometria: triangulo,
      cantidad: 1,
    })[0];
    const problema = crearProblemaNestingIrregular({
      demandas: [demanda, demanda],
      anchoPlacaMm: 120,
      altoPlacaMm: 120,
    });

    expect(() => resolverProblemaNestingIrregular(problema)).toThrow(
      /duplicada/i,
    );
  });
});
