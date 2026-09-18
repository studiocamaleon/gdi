import { errorPaginasDocumento, resolverRangoPaginas } from './rangos-paginas';
import { calcularHojas } from '../centro-copiado/adaptador';

describe('selección de páginas de un archivo', () => {
  it('cotiza las 13 páginas elegidas, con cada copia a doble faz empezando en frente', () => {
    const seleccion = resolverRangoPaginas('1-7,9,12-16', 20);
    expect(seleccion).toEqual({
      paginas: 13,
      rango: '1-7,9,12-16',
      intervalos: [
        [1, 7],
        [9, 9],
        [12, 16],
      ],
      error: null,
    });
    expect(calcularHojas(seleccion.paginas, 2, 2)).toEqual({
      carillas: 26,
      hojas: 14,
    });
    expect(calcularHojas(seleccion.paginas, 2, 1)).toEqual({
      carillas: 26,
      hojas: 26,
    });
  });
  it('conserva el orden del original y elimina páginas repetidas y solapadas', () => {
    expect(
      resolverRangoPaginas(' 12-16, 9, 1 - 5, 3-7, 9, 6 ', 20),
    ).toMatchObject({ paginas: 13, rango: '1-7,9,12-16', error: null });
    expect(resolverRangoPaginas('3,1,2', 3).rango).toBe('1-3');
  });
  it('vacío significa todo el documento y mantiene compatibilidad con trabajos anteriores', () => {
    expect(resolverRangoPaginas('  ', 20)).toMatchObject({
      paginas: 20,
      rango: '',
      error: null,
    });
    expect(errorPaginasDocumento({ paginas: 20 })).toBeNull();
  });
  it.each([
    '0',
    '5-2',
    '1-21',
    '21',
    '1,',
    ',1',
    '1,,2',
    '1.5',
    '1e1',
    '-1',
    'a',
    '1;2',
    '1-2-3',
  ])('rechaza %s sin producir una selección parcial', (rango) => {
    expect(resolverRangoPaginas(rango, 20)).toMatchObject({
      paginas: 0,
      intervalos: [],
      error: expect.any(String),
    });
  });
  it('no permite una cantidad que contradiga el rango ni rangos sin archivo original', () => {
    const doc = {
      paginas: 13,
      paginasOriginales: 20,
      rangoPaginas: '1-7,9,12-16',
      archivoNombre: 'original.pdf',
    };
    expect(errorPaginasDocumento(doc)).toBeNull();
    expect(errorPaginasDocumento({ ...doc, paginas: 20 })).toMatch(
      /no coincide/,
    );
    expect(errorPaginasDocumento({ ...doc, archivoNombre: undefined })).toMatch(
      /archivo asociado/,
    );
    expect(
      errorPaginasDocumento({ ...doc, paginasOriginales: undefined }),
    ).toMatch(/cantidad original/);
    expect(errorPaginasDocumento({ ...doc, rangoPaginas: '' })).toMatch(
      /no coincide/,
    );
  });
});
