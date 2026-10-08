import { normalizarTelefonoCliente } from './telefono-cliente';

describe('teléfonos de clientes: contrato compartido entre API y formulario', () => {
  it.each([
    '+54 9 341 555-1840',
    '5493415551840',
    '9 341 555 1840',
    '0341 15 555 1840',
  ])('normaliza %s sin duplicar el país', (numero) => {
    expect(normalizarTelefonoCliente('54', numero, 'AR')).toMatchObject({
      ok: true,
      telefonoCodigo: '54',
      telefonoNumero: '93415551840',
    });
  });
  it('respeta un internacional de otro país aunque el cliente sea argentino', () => {
    expect(
      normalizarTelefonoCliente('54', '+1 (415) 555-2671', 'AR'),
    ).toMatchObject({
      ok: true,
      telefonoCodigo: '1',
      telefonoNumero: '4155552671',
      pais: 'US',
    });
  });
  it('usa el país del tenant como valor inicial sin exigir un teléfono', () => {
    expect(normalizarTelefonoCliente('', '', 'UY')).toMatchObject({
      ok: true,
      telefonoCodigo: '598',
      telefonoNumero: '',
    });
  });
  it('acepta el formato dominicano anterior y conserva el prefijo de área', () => {
    expect(normalizarTelefonoCliente('1809', '2345678', 'DO')).toMatchObject({
      ok: true,
      telefonoCodigo: '1',
      telefonoNumero: '8092345678',
    });
  });
  it.each([
    '123',
    '+54 +54 93415551840',
    '5495493415551840',
    'llamar al 3415551840',
    '3415551840 ext 12',
  ])('rechaza entradas ambiguas o inválidas: %s', (numero) => {
    expect(normalizarTelefonoCliente('54', numero, 'AR').ok).toBe(false);
  });
  it('no confunde dígitos 15 del número con un prefijo móvil', () => {
    expect(normalizarTelefonoCliente('341', '5551840', 'AR')).toMatchObject({
      ok: true,
      telefonoNumero: '3415551840',
    });
  });
  it('no interpreta un código de área anterior como un prefijo internacional distinto', () => {
    expect(normalizarTelefonoCliente('341', '55551840', 'AR').ok).toBe(false);
  });
});
