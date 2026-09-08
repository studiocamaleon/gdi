import {
  catalogoSalidasPublicasComposicion,
  extraerSalidasPublicasComposicion,
} from '../composicion-outputs';

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
    expect(catalogo.some((item) => item.clave.includes('cenefaTirasMm'))).toBe(
      false,
    );
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
});
