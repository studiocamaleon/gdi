const {
  materialPresets,
} = require('../../../prisma/seed-modulos/material-presets');

describe('Biblioteca de materiales — tornillos autoperforantes T1', () => {
  it('ofrece las cuatro medidas habituales con consumo unitario y compra por caja', () => {
    const preset = materialPresets.find(
      (item: { key: string }) => item.key === 'TORNILLO_AUTOPERFORANTE_T1',
    );

    expect(preset).toMatchObject({
      familia: 'MAGNETICO_FIJACION',
      subfamilia: 'FIJACION_AUXILIAR',
      templateId: 'fijacion_auxiliar_v1',
      tipoTecnico: 'tornillo_autoperforante',
    });
    expect(
      preset.variantes.map(
        (variante: {
          formato: string;
          recomendada: boolean;
          unidadStock: string;
          unidadCompra: string;
          atributosVarianteJson: { unidadesPorCaja: number };
        }) => ({
          medida: variante.formato,
          unidadesPorCaja: variante.atributosVarianteJson.unidadesPorCaja,
          unidadStock: variante.unidadStock,
          unidadCompra: variante.unidadCompra,
          recomendada: variante.recomendada,
        }),
      ),
    ).toEqual([
      {
        medida: '#8 × 1/2"',
        unidadesPorCaja: 10000,
        unidadStock: 'UNIDAD',
        unidadCompra: 'CAJA',
        recomendada: true,
      },
      {
        medida: '#8 × 3/4"',
        unidadesPorCaja: 5000,
        unidadStock: 'UNIDAD',
        unidadCompra: 'CAJA',
        recomendada: true,
      },
      {
        medida: '#10 × 1"',
        unidadesPorCaja: 2500,
        unidadStock: 'UNIDAD',
        unidadCompra: 'CAJA',
        recomendada: true,
      },
      {
        medida: '#10 × 1 1/2"',
        unidadesPorCaja: 2000,
        unidadStock: 'UNIDAD',
        unidadCompra: 'CAJA',
        recomendada: true,
      },
    ]);
  });
});
