import {
  catalogoSalidasPublicasComposicion,
  extraerSalidasPublicasComposicion,
} from '../composicion-outputs';
import { runDerivador } from '../../motor-universal/derivadores';

describe('outputs públicos para composición', () => {
  it('publica outputs controlados y geometría rectangular con etiquetas humanas', () => {
    const catalogo = catalogoSalidasPublicasComposicion([
      {
        familiaCodigo: 'estructura_bastidor',
        nombreVisible: 'Fabricación de estructura',
      },
    ]);

    expect(catalogo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clave: 'ml_estructura',
          pasoNombre: 'Fabricación de estructura',
        }),
        expect.objectContaining({
          clave: 'lonaBrutaMm.anchoMm',
          etiqueta: expect.stringContaining('Lona bruta'),
          unidadVisible: 'cm',
        }),
      ]),
    );
    expect(catalogo).toContainEqual(
      expect.objectContaining({
        clave: 'cenefaTirasMm.0.anchoMm',
        etiqueta: 'Fabricación de estructura · Cenefa superior · desarrollo',
        tipoDato: 'number',
        unidadVisible: 'cm',
      }),
    );
    expect(
      catalogo.filter((item) => item.clave.startsWith('cenefaTirasMm.')),
    ).toHaveLength(8);
  });

  it('extrae únicamente los valores declarados en el contrato público', () => {
    const catalogo = catalogoSalidasPublicasComposicion([
      { familiaCodigo: 'estructura_bastidor' },
    ]);
    const result = extraerSalidasPublicasComposicion(
      {
        ml_estructura: 7.2,
        lonaBrutaMm: { anchoMm: 2080, altoMm: 1080 },
        datoInterno: 'no debe salir',
      },
      catalogo,
    );

    expect(result).toMatchObject({
      ml_estructura: 7.2,
      'lonaBrutaMm.anchoMm': 2080,
      'lonaBrutaMm.altoMm': 1080,
    });
    expect(result).not.toHaveProperty('datoInterno');
  });

  it.each([2, 3])(
    'hereda las cenefas calculadas por el nodo con solapas de %s cm',
    (solapaCenefaCm) => {
      const resultado = runDerivador(
        'bastidor_rectangular',
        {
          cantidad: 2,
          medidaCustomMm: { anchoMm: 2400, altoMm: 1200 },
          profundidadMm: 150,
        },
        { tipoBastidor: 'doble', solapaCenefaCm },
        undefined,
      );
      const catalogo = catalogoSalidasPublicasComposicion([
        { familiaCodigo: 'estructura_bastidor' },
      ]);
      const outputs = extraerSalidasPublicasComposicion(
        { cenefaTirasMm: resultado!.traza!.cenefaTiras },
        catalogo,
      );
      expect(outputs).toMatchObject({
        'cenefaTirasMm.0.largoMm': 2400,
        'cenefaTirasMm.1.largoMm': 2400,
        'cenefaTirasMm.2.largoMm': 1200,
        'cenefaTirasMm.3.largoMm': 1200,
        'cenefaTirasMm.0.anchoMm': 150 + solapaCenefaCm * 20,
        'cenefaTirasMm.2.anchoMm': 150 + solapaCenefaCm * 20,
      });
    },
  );
});
