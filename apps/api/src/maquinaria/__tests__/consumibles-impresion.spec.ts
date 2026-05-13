import {
  getConsumableChannelFromDetail,
  getPerfilConsumableChannels,
  requiredConsumableChannelsFromColorMode,
} from '../consumibles-impresion';

describe('consumibles de impresión', () => {
  it('resuelve canales CMYK completos desde el modo de color del perfil', () => {
    expect(requiredConsumableChannelsFromColorMode('CMYK')).toEqual([
      'cian',
      'magenta',
      'amarillo',
      'negro',
    ]);
  });

  it('resuelve blanco y barniz cuando el perfil los declara', () => {
    expect(
      requiredConsumableChannelsFromColorMode('CMYK+blanco+barniz'),
    ).toEqual(['cian', 'magenta', 'amarillo', 'negro', 'blanco', 'barniz']);
  });

  it('usa negro como único canal para BN', () => {
    expect(getPerfilConsumableChannels({ colores: 'BN' }, null)).toEqual([
      'negro',
    ]);
  });

  it('normaliza aliases de detalle.color/canal', () => {
    expect(getConsumableChannelFromDetail({ color: 'K' })).toBe('negro');
    expect(getConsumableChannelFromDetail({ canal: 'cyan' })).toBe('cian');
  });
});
