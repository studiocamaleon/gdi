const {
  materialPresets,
} = require('../../../prisma/seed-modulos/material-presets');

describe('Biblioteca de materiales — ojales niquelados', () => {
  it('ofrece diámetros internos de 8, 10 y 13 mm compatibles con colocación de ojales', () => {
    const preset = materialPresets.find(
      (item: { key: string }) => item.key === 'OJAL_NIQUELADO',
    );

    expect(preset).toMatchObject({
      familia: 'HERRAJE_ACCESORIO',
      subfamilia: 'OJAL_OJALILLO_REMACHE',
      templateId: 'ojal_ojalillo_remache_v1',
      tipoTecnico: 'ojal',
      procesosCompatibles: ['colocacion_ojales'],
    });
    expect(
      preset.variantes.map(
        (variante: {
          recomendada: boolean;
          atributosVarianteJson: {
            diametroInterno: number;
            terminacion: string;
          };
        }) => ({
          diametroInterno: variante.atributosVarianteJson.diametroInterno,
          terminacion: variante.atributosVarianteJson.terminacion,
          recomendada: variante.recomendada,
        }),
      ),
    ).toEqual([
      { diametroInterno: 8, terminacion: 'Niquelado', recomendada: false },
      { diametroInterno: 10, terminacion: 'Niquelado', recomendada: true },
      { diametroInterno: 13, terminacion: 'Niquelado', recomendada: false },
    ]);
  });
});
