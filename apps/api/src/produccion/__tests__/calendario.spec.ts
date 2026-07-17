import { BadRequestException } from '@nestjs/common';
import { parseCalendario } from '../calendario';

describe('parseCalendario', () => {
  const lunesAViernes = {
    dias: {
      lun: { desde: '08:00', hasta: '18:00' },
      mar: { desde: '08:00', hasta: '18:00' },
      mie: { desde: '08:00', hasta: '18:00' },
      jue: { desde: '08:00', hasta: '18:00' },
      vie: { desde: '08:00', hasta: '18:00' },
      sab: null,
      dom: null,
    },
  };

  it('null/undefined → null (sin calendario)', () => {
    expect(parseCalendario(null)).toBeNull();
    expect(parseCalendario(undefined)).toBeNull();
  });

  it('acepta un calendario válido y lo normaliza completo', () => {
    const resultado = parseCalendario(lunesAViernes);
    expect(resultado).toEqual(lunesAViernes);
  });

  it('días ausentes cuentan como inactivos', () => {
    const resultado = parseCalendario({
      dias: { sab: { desde: '09:00', hasta: '13:00' } },
    });
    expect(resultado?.dias.sab).toEqual({ desde: '09:00', hasta: '13:00' });
    expect(resultado?.dias.lun).toBeNull();
    expect(resultado?.dias.dom).toBeNull();
  });

  it('0 días activos equivale a null', () => {
    expect(parseCalendario({ dias: {} })).toBeNull();
    expect(
      parseCalendario({ dias: { lun: null, mar: null, dom: null } }),
    ).toBeNull();
  });

  it('rechaza días desconocidos', () => {
    expect(() =>
      parseCalendario({ dias: { lunes: { desde: '08:00', hasta: '18:00' } } }),
    ).toThrow(BadRequestException);
  });

  it('rechaza formato de hora inválido', () => {
    for (const desde of ['8:00', '08', '24:00', '08:60', '', 8]) {
      expect(() =>
        parseCalendario({ dias: { lun: { desde, hasta: '18:00' } } }),
      ).toThrow(BadRequestException);
    }
  });

  it('rechaza rango invertido o vacío (desde >= hasta)', () => {
    expect(() =>
      parseCalendario({ dias: { lun: { desde: '18:00', hasta: '08:00' } } }),
    ).toThrow(BadRequestException);
    expect(() =>
      parseCalendario({ dias: { lun: { desde: '08:00', hasta: '08:00' } } }),
    ).toThrow(BadRequestException);
  });

  it('rechaza shapes que no son objeto', () => {
    expect(() => parseCalendario('L-V 8 a 18')).toThrow(BadRequestException);
    expect(() => parseCalendario([])).toThrow(BadRequestException);
    expect(() => parseCalendario({})).toThrow(BadRequestException);
    expect(() => parseCalendario({ dias: { lun: [] } })).toThrow(
      BadRequestException,
    );
  });
});
