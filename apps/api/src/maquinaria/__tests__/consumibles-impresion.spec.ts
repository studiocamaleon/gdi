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

  it('combina canales cuando el perfil láser admite K y CMYK', () => {
    expect(getPerfilConsumableChannels({ colores: ['K', 'CMYK'] }, null)).toEqual([
      'negro',
      'cian',
      'magenta',
      'amarillo',
    ]);
  });

  it('prioriza el modo comercial elegido para costear sólo sus canales', () => {
    expect(
      getPerfilConsumableChannels({ colores: ['K', 'CMYK'] }, null, 'K'),
    ).toEqual(['negro']);
    expect(
      getPerfilConsumableChannels({ colores: ['K', 'CMYK'] }, null, 'CMYK'),
    ).toEqual(['cian', 'magenta', 'amarillo', 'negro']);
  });

  it('normaliza aliases de detalle.color/canal', () => {
    expect(getConsumableChannelFromDetail({ color: 'K' })).toBe('negro');
    expect(getConsumableChannelFromDetail({ canal: 'cyan' })).toBe('cian');
  });
});
