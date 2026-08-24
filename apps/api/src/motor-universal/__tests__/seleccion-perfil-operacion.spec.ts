import { indicePerfilUnicoPorOperacion } from '../seleccion-perfil-operacion';

const perfil = (tipoOperacion?: string) => ({
  detalleJson: tipoOperacion ? { tipoOperacion } : {},
});

describe('indicePerfilUnicoPorOperacion — auto-selección láser/CNC', () => {
  it('corte_laser toma el único perfil de CORTE entre corte y grabado', () => {
    const perfiles = [perfil('GRABADO'), perfil('CORTE')];
    expect(indicePerfilUnicoPorOperacion('corte_laser', perfiles)).toBe(1);
  });

  it('grabado_laser toma el de GRABADO', () => {
    const perfiles = [perfil('CORTE'), perfil('GRABADO')];
    expect(indicePerfilUnicoPorOperacion('grabado_laser', perfiles)).toBe(1);
  });

  it('corte_laser ya no considera SEMICORTE una operación válida', () => {
    const perfiles = [perfil('GRABADO'), perfil('SEMICORTE')];
    expect(indicePerfilUnicoPorOperacion('corte_laser', perfiles)).toBeNull();
  });

  it('null si hay varios perfiles de la misma operación (desambigua el comercial)', () => {
    const perfiles = [perfil('CORTE'), perfil('CORTE'), perfil('GRABADO')];
    expect(indicePerfilUnicoPorOperacion('corte_laser', perfiles)).toBeNull();
  });

  it('null si ningún perfil matchea la operación', () => {
    const perfiles = [perfil('GRABADO'), perfil('GRABADO')];
    expect(indicePerfilUnicoPorOperacion('corte_laser', perfiles)).toBeNull();
  });

  it('null para familias que no mapean a operación (cnc, impresión)', () => {
    const perfiles = [perfil('CORTE'), perfil('GRABADO')];
    expect(indicePerfilUnicoPorOperacion('cnc', perfiles)).toBeNull();
    expect(
      indicePerfilUnicoPorOperacion('impresion_por_hoja', perfiles),
    ).toBeNull();
  });

  it('ignora perfiles sin tipoOperacion', () => {
    const perfiles = [perfil(), perfil('CORTE')];
    expect(indicePerfilUnicoPorOperacion('corte_laser', perfiles)).toBe(1);
  });
});
