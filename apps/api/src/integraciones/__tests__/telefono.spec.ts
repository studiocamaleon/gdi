import { aE164, contarInvalidos } from '../telefono';

/**
 * Los casos vienen de cómo se cargan los teléfonos de verdad en la ficha de
 * cliente: a mano, durante años, sin formato obligatorio. El objetivo del
 * test no es cubrir la librería —eso ya está cubierto río arriba— sino la
 * composición de las TRES columnas y los prefijos argentinos, que es donde
 * está nuestra lógica.
 */
describe('teléfono a E.164', () => {
  const ar = (codigo: string, numero: string) =>
    aE164({ telefonoCodigo: codigo, telefonoNumero: numero, paisCodigo: 'AR' });

  describe('Argentina — celulares', () => {
    // Todos estos son el MISMO teléfono escrito de siete maneras.
    const ESPERADO = '5493415551840';

    it.each([
      ['341', '5551840', 'código de área y número, limpio'],
      ['0341', '5551840', 'con el 0 de larga distancia'],
      ['341', '15 555 1840', 'con el 15 de celular y espacios'],
      ['0341', '15-555-1840', 'con 0, 15 y guiones'],
      ['+54 9 341', '555 1840', 'ya internacional'],
      ['54', '9 341 555 1840', 'código de país en la primera columna'],
      ['', '0341 15 555 1840', 'todo junto en la segunda columna'],
    ])('%s / %s — %s', (codigo, numero) => {
      expect(ar(codigo, numero)).toEqual({ ok: true, e164: ESPERADO });
    });

    it('fuerza la forma móvil aunque el número venga sin el 15', () => {
      // Decisión explícita, no accidente: sin el 15 la librería lo lee como
      // fijo. Ver forzarMovilAr — agregar el 9 sólo puede fallar donde ya
      // iba a fallar; no agregarlo falla donde podía funcionar.
      expect(ar('341', '5551840')).toEqual({ ok: true, e164: '5493415551840' });
    });

    it('inserta el 9 que WhatsApp necesita para móviles', () => {
      // Es el error clásico de hacerlo a mano: sin el 9, Meta acepta el
      // número y el mensaje no llega nunca.
      const r = ar('341', '5551840');
      expect(r.ok && r.e164.startsWith('549')).toBe(true);
    });
  });

  describe('Argentina — otras áreas', () => {
    it('Buenos Aires (área de 2 dígitos)', () => {
      expect(ar('011', '15 4567 8901')).toEqual({
        ok: true,
        e164: '5491145678901',
      });
    });

    it('área de 4 dígitos', () => {
      expect(ar('02346', '15 123456')).toEqual({
        ok: true,
        e164: '5492346123456',
      });
    });
  });

  describe('otros países', () => {
    it('respeta un número ya internacional', () => {
      expect(
        aE164({
          telefonoCodigo: '+1',
          telefonoNumero: '415 555 2671',
          paisCodigo: 'US',
        }),
      ).toEqual({ ok: true, e164: '14155552671' });
    });

    it('usa el paisCodigo de la fila', () => {
      const r = aE164({
        telefonoCodigo: '',
        telefonoNumero: '91234567',
        paisCodigo: 'UY',
      });
      expect(r).toEqual({ ok: true, e164: '59891234567' });
    });
  });

  describe('lo que no sirve', () => {
    it('sin teléfono', () => {
      const r = aE164({ telefonoCodigo: '', telefonoNumero: '' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toContain('no tiene teléfono');
    });

    it('texto sin dígitos', () => {
      expect(aE164({ telefonoNumero: 'no tiene' }).ok).toBe(false);
    });

    it('demasiado corto para ser un teléfono', () => {
      expect(ar('341', '123').ok).toBe(false);
    });

    it('demasiado largo', () => {
      expect(ar('341', '5551840999999').ok).toBe(false);
    });

    it('el motivo dice qué número falló, para poder corregirlo', () => {
      const r = ar('341', '123');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toContain('123');
    });
  });

  describe('null y undefined', () => {
    it('no explota con campos nulos', () => {
      expect(
        aE164({ telefonoCodigo: null, telefonoNumero: null, paisCodigo: null })
          .ok,
      ).toBe(false);
    });

    it('sin paisCodigo asume Argentina', () => {
      expect(
        aE164({ telefonoCodigo: '341', telefonoNumero: '5551840' }),
      ).toEqual({ ok: true, e164: '5493415551840' });
    });

    it('tolera un paisCodigo basura cayendo a Argentina', () => {
      expect(
        aE164({
          telefonoCodigo: '341',
          telefonoNumero: '5551840',
          paisCodigo: 'argentina',
        }),
      ).toEqual({ ok: true, e164: '5493415551840' });
    });
  });

  describe('contarInvalidos', () => {
    it('cuenta los que no sirven para WhatsApp', () => {
      const clientes = [
        { telefonoCodigo: '341', telefonoNumero: '5551840', paisCodigo: 'AR' },
        { telefonoCodigo: '', telefonoNumero: '', paisCodigo: 'AR' },
        { telefonoCodigo: '341', telefonoNumero: '123', paisCodigo: 'AR' },
      ];
      expect(contarInvalidos(clientes)).toBe(2);
    });
  });
});
