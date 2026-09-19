import {
  resolverPerfil,
  revisionPerfil,
  type ConfiguracionDocumento,
} from './perfiles-impresion.domain';
import { perfilPrueba } from './perfiles-impresion.fixture';
const doc: ConfiguracionDocumento = {
  papelMateriaPrimaId: 'papel',
  papelNombre: 'Obra',
  gramaje: 75,
  tamano: 'A4',
  color: 'BN',
  faz: 2,
};
describe('selección de perfiles de impresión', () => {
  it('resuelve un plano cotizado sin QZ contra un destino actual y exige coincidencia completa', () => {
    const cad = { rutaAlternativaId: 'ruta', materialVarianteId: 'rollo' };
    const configuracion: ConfiguracionDocumento = {
      ...doc,
      tamano: 'CAD',
      faz: 1,
      cad: {
        ...cad,
        origen: 'COTIZACION',
        maquinaId: 'maquina',
        anchoRolloMm: 914,
      },
    };
    const perfil = {
      ...perfilPrueba,
      tamano: 'CAD',
      faz: 1,
      cad,
      bandeja: {
        ...perfilPrueba.bandeja,
        destino: {
          ...perfilPrueba.bandeja.destino,
          cad: {
            anchoRolloMm: 914,
            margenMm: 5,
            origenPapel: '',
            usarOrigenPredeterminado: true,
          },
        },
      },
    };
    expect(resolverPerfil(configuracion, []).perfil).toBeNull();
    expect(resolverPerfil(configuracion, [perfil], ['maquina']).estado).toBe(
      'LISTO',
    );
    expect(
      resolverPerfil(configuracion, [{ ...perfil, version: 99 }]).estado,
    ).toBe('LISTO');
    expect(
      resolverPerfil({ ...configuracion, gramaje: null }, [perfil]).estado,
    ).toBe('LISTO');
    expect(
      resolverPerfil({ ...configuracion, gramaje: 150 }, [perfil]).perfil,
    ).toBeNull();
    expect(resolverPerfil(configuracion, [perfil], ['otra']).perfil).toBeNull();
    for (const cambio of [
      { materialVarianteId: 'otro' },
      { rutaAlternativaId: 'otra' },
      { maquinaId: 'otra' },
      { anchoRolloMm: 610 },
    ])
      expect(
        resolverPerfil(
          { ...configuracion, cad: { ...configuracion.cad!, ...cambio } },
          [perfil],
        ).perfil,
      ).toBeNull();
    expect(
      resolverPerfil(configuracion, [{ ...perfil, probado: false }]).estado,
    ).toBe('REVISAR');
    expect(
      resolverPerfil(configuracion, [perfil, { ...perfil, id: 'otro' }]).perfil,
    ).toBeNull();
  });
  it('separa B/N de Color aun con mayor prioridad y permite ambos perfiles en una impresora color', () => {
    const color = {
      ...perfilPrueba,
      id: 'color',
      color: 'COLOR',
      prioridad: 99,
    };
    expect(resolverPerfil(doc, [color, perfilPrueba]).perfil?.id).toBe(
      perfilPrueba.id,
    );
    expect(
      resolverPerfil({ ...doc, color: 'COLOR' }, [perfilPrueba, color]),
    ).toMatchObject({ estado: 'LISTO', perfil: { id: 'color' } });
    expect(
      resolverPerfil({ ...doc, color: 'COLOR' }, [perfilPrueba]).perfil,
    ).toBeNull();
    expect(
      resolverPerfil({ ...doc, color: 'COLOR' }, [{ ...color, probado: false }])
        .estado,
    ).toBe('REVISAR');
  });
  it('exige papel, gramaje, formato, color, faz y máquina exactos', () => {
    expect(resolverPerfil(doc, [perfilPrueba], ['maquina']).estado).toBe(
      'LISTO',
    );
    for (const cambio of [
      { papelMateriaPrimaId: 'otro' },
      { gramaje: 150 },
      { tamano: 'A3' },
      { color: 'COLOR' },
      { faz: 1 },
    ])
      expect(resolverPerfil({ ...doc, ...cambio }, [perfilPrueba]).estado).toBe(
        'REVISAR',
      );
    expect(resolverPerfil(doc, [perfilPrueba], ['otra']).perfil).toBeNull();
  });
  it('exige prueba física y preparación actual', () => {
    expect(
      resolverPerfil(doc, [{ ...perfilPrueba, probado: false }]).estado,
    ).toBe('REVISAR');
    expect(
      resolverPerfil(doc, [{ ...perfilPrueba, modo: 'PREPARACION' }]).estado,
    ).toBe('PREPARACION');
    expect(
      resolverPerfil(doc, [
        {
          ...perfilPrueba,
          bandeja: { ...perfilPrueba.bandeja, papelPreparadoId: null },
        },
      ]).estado,
    ).toBe('PREPARACION');
  });
  it('elige la prioridad mayor y bloquea empates, sin sustituir un perfil sin preparar', () => {
    const otro = {
      ...perfilPrueba,
      id: 'otro',
      prioridad: 2,
      modo: 'PREPARACION',
    };
    expect(resolverPerfil(doc, [perfilPrueba, otro])).toMatchObject({
      estado: 'PREPARACION',
      perfil: { id: 'otro' },
    });
    expect(
      resolverPerfil(doc, [perfilPrueba, { ...otro, prioridad: 1 }]).perfil,
    ).toBeNull();
    expect(
      resolverPerfil(doc, [{ ...perfilPrueba, activo: false }]).perfil,
    ).toBeNull();
  });
  it('incluye en la revisión los cambios de perfil, bandeja e impresora', () => {
    expect(revisionPerfil(perfilPrueba)).toBe('1:1:1');
    expect(
      revisionPerfil({
        ...perfilPrueba,
        version: 2,
        bandeja: {
          ...perfilPrueba.bandeja,
          version: 3,
          destino: { ...perfilPrueba.bandeja.destino, version: 4 },
        },
      }),
    ).toBe('2:3:4');
  });
});
