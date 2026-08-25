import { indicePerfilUnicoPorOperacion } from '../seleccion-perfil-operacion';

const perfil = (tipoOperacion?: string) => ({
  detalleJson: tipoOperacion ? { tipoOperacion } : {},
});

const perfilMaterial = (
  material: string | string[],
  espesorMinMm: number,
  espesorMaxMm: number,
) => ({
  detalleJson: {
    tipoOperacion: 'CORTE',
    material,
    espesorMinMm,
    espesorMaxMm,
  },
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

  it('elige por materia prima y espesor entre varios perfiles de corte', () => {
    const perfiles = [
      perfilMaterial('acrilico-id', 2, 3),
      perfilMaterial('acrilico-id', 4, 6),
      perfilMaterial('mdf-id', 3, 6),
    ];
    expect(
      indicePerfilUnicoPorOperacion('corte_laser', perfiles, {
        materiaPrimaId: 'acrilico-id',
        espesorMm: 5,
      }),
    ).toBe(1);
  });

  it('mantiene compatibilidad con códigos canónicos de material legados', () => {
    const perfiles = [
      perfilMaterial('MDF', 3, 6),
      perfilMaterial('ACRILICO', 3, 5),
    ];
    expect(
      indicePerfilUnicoPorOperacion('corte_laser', perfiles, {
        canonicalMaterialKey: 'acrilico',
        espesorMm: 3,
      }),
    ).toBe(1);
  });

  it('devuelve null cuando dos rangos igualmente específicos se superponen', () => {
    const perfiles = [
      perfilMaterial('acrilico-id', 3, 5),
      perfilMaterial('acrilico-id', 3, 5),
    ];
    expect(
      indicePerfilUnicoPorOperacion('corte_laser', perfiles, {
        materiaPrimaId: 'acrilico-id',
        espesorMm: 4,
      }),
    ).toBeNull();
  });

  it('no adivina un rango de corte cuando el sustrato no informa espesor', () => {
    const perfiles = [
      perfilMaterial('acrilico-id', 2, 3),
      perfilMaterial('acrilico-id', 4, 6),
    ];
    expect(
      indicePerfilUnicoPorOperacion('corte_laser', perfiles, {
        materiaPrimaId: 'acrilico-id',
      }),
    ).toBeNull();
  });
});
