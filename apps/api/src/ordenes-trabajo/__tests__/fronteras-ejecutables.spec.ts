import { fronterasEjecutablesDAG } from '../fronteras-ejecutables';

describe('fronteras ejecutables con rutas DAG', () => {
  const paso = (
    id: string,
    estado: string,
    predecesorPasoIds: string[] = [],
  ) => ({
    id,
    indice: 0,
    nodoClave: id,
    estado,
    dependenciasEntrantes: predecesorPasoIds.map((predecesorPasoId) => ({
      predecesorPasoId,
    })),
  });

  it('devuelve dos ramas listas y bloquea la convergencia', () => {
    const diseno = paso('diseno', 'hecho');
    const uv = paso('uv', 'pendiente', ['diseno']);
    const laser = paso('laser', 'pendiente', ['diseno']);
    const armado = paso('armado', 'pendiente', ['uv', 'laser']);

    expect(
      fronterasEjecutablesDAG(
        [diseno, uv, laser, armado],
        [uv, laser, armado],
      ).map((nodo) => nodo.id),
    ).toEqual(['uv', 'laser']);
  });

  it('respeta una convergencia que llega desde un componente hijo', () => {
    const componente = paso('componente-terminal', 'pendiente');
    const armado = paso('armado', 'pendiente', ['componente-terminal']);
    expect(fronterasEjecutablesDAG([componente, armado], [armado])).toEqual([]);
    componente.estado = 'hecho';
    expect(
      fronterasEjecutablesDAG([componente, armado], [armado]).map(
        (nodo) => nodo.id,
      ),
    ).toEqual(['armado']);
  });
});
