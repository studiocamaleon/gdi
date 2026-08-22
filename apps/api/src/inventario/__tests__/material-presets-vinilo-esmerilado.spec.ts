const {
  materialPresets,
} = require('../../../prisma/seed-modulos/material-presets');

describe('Biblioteca de materiales — vinilo esmerilado', () => {
  it('ofrece blanco y gris en rollos de 61 y 122 cm por 50 m', () => {
    const preset = materialPresets.find(
      (item: { key: string }) => item.key === 'VINILO_ESMERILADO',
    );

    expect(preset).toMatchObject({
      subfamilia: 'SUSTRATO_ROLLO_FLEXIBLE',
      templateId: 'vinilo_esmerilado_rollo_v1',
      tipoTecnico: 'vinilo_esmerilado',
    });
    expect(preset.variantes).toHaveLength(4);
    expect(
      preset.variantes.map(
        (variante: {
          color: string;
          atributosVarianteJson: {
            acabado: string;
            anchoMm: number;
            largoMm: number;
          };
        }) => ({
          color: variante.color,
          acabado: variante.atributosVarianteJson.acabado,
          anchoMm: variante.atributosVarianteJson.anchoMm,
          largoMm: variante.atributosVarianteJson.largoMm,
        }),
      ),
    ).toEqual([
      { color: 'Blanco', acabado: 'Blanco', anchoMm: 610, largoMm: 50_000 },
      { color: 'Blanco', acabado: 'Blanco', anchoMm: 1220, largoMm: 50_000 },
      { color: 'Gris', acabado: 'Gris', anchoMm: 610, largoMm: 50_000 },
      { color: 'Gris', acabado: 'Gris', anchoMm: 1220, largoMm: 50_000 },
    ]);
  });
});
