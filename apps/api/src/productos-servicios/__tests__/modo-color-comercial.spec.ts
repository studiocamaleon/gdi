import {
  buildModoColorOptionsFromProfiles,
  getModoColorsFromPerfil,
  modoColorMatchesPerfil,
  normalizeModoColor,
} from '../modo-color-comercial';

describe('modo color comercial', () => {
  const perfiles = [
    {
      id: 'perfil-bn',
      activo: true,
      tipoPerfil: 'IMPRESION',
      detalleJson: { colores: 'BN' },
    },
    {
      id: 'perfil-cmyk',
      activo: true,
      tipoPerfil: 'IMPRESION',
      detalleJson: { colores: 'CMYK' },
    },
    {
      id: 'perfil-laser-multimodo',
      activo: true,
      tipoPerfil: 'IMPRESION',
      detalleJson: { colores: ['K', 'CMYK'] },
    },
    {
      id: 'perfil-cmyk-blanco',
      activo: true,
      tipoPerfil: 'IMPRESION',
      detalleJson: { colores: 'CMYK+blanco' },
    },
    {
      id: 'perfil-cmyk-barniz',
      activo: true,
      tipoPerfil: 'IMPRESION',
      detalleJson: { colores: 'CMYK+barniz' },
    },
    {
      id: 'perfil-inactivo',
      activo: false,
      tipoPerfil: 'IMPRESION',
      detalleJson: { colores: 'CMYK+blanco+barniz' },
    },
  ];

  it('normaliza los nombres canónicos y aliases de modo de color', () => {
    expect(normalizeModoColor('K')).toBe('BN');
    expect(normalizeModoColor('cmyk')).toBe('CMYK');
    expect(normalizeModoColor('CMYK + white')).toBe('CMYK+blanco');
    expect(normalizeModoColor('CMYK + varnish')).toBe('CMYK+barniz');
    expect(normalizeModoColor('CMYK + blanco + varnish')).toBe(
      'CMYK+blanco+barniz',
    );
  });

  it('deriva opciones comerciales desde perfiles activos', () => {
    expect(buildModoColorOptionsFromProfiles(perfiles)).toEqual([
      {
        value: 'BN',
        label: 'Blanco y negro',
        perfilIds: ['perfil-bn', 'perfil-laser-multimodo'],
      },
      {
        value: 'CMYK',
        label: 'CMYK',
        perfilIds: ['perfil-cmyk', 'perfil-laser-multimodo'],
      },
      {
        value: 'CMYK+blanco',
        label: 'CMYK + Blanco',
        perfilIds: ['perfil-cmyk-blanco'],
      },
      {
        value: 'CMYK+barniz',
        label: 'CMYK + Barniz',
        perfilIds: ['perfil-cmyk-barniz'],
      },
    ]);
  });

  it('respeta allowedModes cuando el paso restringe opciones comerciales', () => {
    expect(buildModoColorOptionsFromProfiles(perfiles, ['CMYK'])).toEqual([
      {
        value: 'CMYK',
        label: 'CMYK',
        perfilIds: ['perfil-cmyk', 'perfil-laser-multimodo'],
      },
    ]);
  });

  it('matchea un perfil compatible contra el modo elegido', () => {
    expect(modoColorMatchesPerfil(perfiles[0], 'BN')).toBe(true);
    expect(modoColorMatchesPerfil(perfiles[0], 'CMYK')).toBe(false);
    expect(modoColorMatchesPerfil(perfiles[3], 'CMYK+white')).toBe(true);
  });

  it('permite perfiles láser con múltiples modos comerciales', () => {
    expect(getModoColorsFromPerfil(perfiles[2])).toEqual(['BN', 'CMYK']);
    expect(modoColorMatchesPerfil(perfiles[2], 'K')).toBe(true);
    expect(modoColorMatchesPerfil(perfiles[2], 'CMYK')).toBe(true);
  });
});
