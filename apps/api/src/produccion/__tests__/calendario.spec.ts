import { BadRequestException } from '@nestjs/common';
import { normalizarCalendarioAlmacenado, parseCalendario } from '../calendario';

describe('parseCalendario', () => {
  const franjaOficina = [{ desde: '08:00', hasta: '18:00' }];
  const lunesAViernes = {
    dias: {
      lun: franjaOficina,
      mar: franjaOficina,
      mie: franjaOficina,
      jue: franjaOficina,
      vie: franjaOficina,
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

  it('acepta el shape legado (una franja suelta) y lo lista', () => {
    const resultado = parseCalendario({
      dias: { lun: { desde: '08:00', hasta: '18:00' } },
    });
    expect(resultado?.dias.lun).toEqual([{ desde: '08:00', hasta: '18:00' }]);
  });

  it('acepta varias franjas por día (jornada cortada) y las ordena', () => {
    const resultado = parseCalendario({
      dias: {
        lun: [
          { desde: '15:00', hasta: '19:00' },
          { desde: '09:00', hasta: '12:00' },
        ],
      },
    });
    expect(resultado?.dias.lun).toEqual([
      { desde: '09:00', hasta: '12:00' },
      { desde: '15:00', hasta: '19:00' },
    ]);
  });

  it('acepta franjas contiguas (12:00–12:00 de borde compartido)', () => {
    const resultado = parseCalendario({
      dias: {
        lun: [
          { desde: '09:00', hasta: '12:00' },
          { desde: '12:00', hasta: '18:00' },
        ],
      },
    });
    expect(resultado?.dias.lun).toHaveLength(2);
  });

  it('rechaza franjas solapadas en el mismo día', () => {
    expect(() =>
      parseCalendario({
        dias: {
          lun: [
            { desde: '09:00', hasta: '13:00' },
            { desde: '12:00', hasta: '18:00' },
          ],
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('días ausentes cuentan como inactivos', () => {
    const resultado = parseCalendario({
      dias: { sab: [{ desde: '09:00', hasta: '13:00' }] },
    });
    expect(resultado?.dias.sab).toEqual([{ desde: '09:00', hasta: '13:00' }]);
    expect(resultado?.dias.lun).toBeNull();
    expect(resultado?.dias.dom).toBeNull();
  });

  it('0 días activos equivale a null; lista vacía = día inactivo', () => {
    expect(parseCalendario({ dias: {} })).toBeNull();
    expect(
      parseCalendario({ dias: { lun: null, mar: null, dom: null } }),
    ).toBeNull();
    expect(parseCalendario({ dias: { lun: [] } })).toBeNull();
    const resultado = parseCalendario({
      dias: { lun: [], mar: [{ desde: '08:00', hasta: '12:00' }] },
    });
    expect(resultado?.dias.lun).toBeNull();
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
      expect(() =>
        parseCalendario({ dias: { lun: [{ desde, hasta: '18:00' }] } }),
      ).toThrow(BadRequestException);
    }
  });

  it('rechaza rango invertido o vacío (desde >= hasta)', () => {
    expect(() =>
      parseCalendario({ dias: { lun: { desde: '18:00', hasta: '08:00' } } }),
    ).toThrow(BadRequestException);
    expect(() =>
      parseCalendario({ dias: { lun: [{ desde: '08:00', hasta: '08:00' }] } }),
    ).toThrow(BadRequestException);
  });

  it('rechaza shapes que no son objeto', () => {
    expect(() => parseCalendario('L-V 8 a 18')).toThrow(BadRequestException);
    expect(() => parseCalendario([])).toThrow(BadRequestException);
    expect(() => parseCalendario({})).toThrow(BadRequestException);
    expect(() => parseCalendario({ dias: { lun: 'todo el día' } })).toThrow(
      BadRequestException,
    );
  });
});

describe('normalizarCalendarioAlmacenado', () => {
  it('convierte el shape legado a listas sin validar', () => {
    const resultado = normalizarCalendarioAlmacenado({
      dias: { lun: { desde: '08:00', hasta: '18:00' }, mar: null },
    });
    expect(resultado?.dias.lun).toEqual([{ desde: '08:00', hasta: '18:00' }]);
    expect(resultado?.dias.mar).toBeNull();
    expect(resultado?.dias.dom).toBeNull();
  });

  it('deja pasar el shape nuevo tal cual', () => {
    const dia = [
      { desde: '09:00', hasta: '12:00' },
      { desde: '15:00', hasta: '19:00' },
    ];
    const resultado = normalizarCalendarioAlmacenado({ dias: { jue: dia } });
    expect(resultado?.dias.jue).toEqual(dia);
  });

  it('devuelve null ante datos irreconocibles', () => {
    expect(normalizarCalendarioAlmacenado(null)).toBeNull();
    expect(normalizarCalendarioAlmacenado('x')).toBeNull();
    expect(normalizarCalendarioAlmacenado({})).toBeNull();
  });
});
