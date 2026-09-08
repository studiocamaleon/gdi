import {
  compilarRutaLineal,
  nodoEjecutable,
  nodoReabrible,
  reducirGrafoAClaves,
  validarYOrdenarGrafo,
} from '../grafo-produccion';

const nodos = [
  { clave: 'diseno', indice: 0 },
  { clave: 'uv', indice: 1 },
  { clave: 'carton', indice: 2 },
  { clave: 'acrilico', indice: 3 },
  { clave: 'armado', indice: 4 },
  { clave: 'qc', indice: 5 },
];

describe('grafo de producción', () => {
  it('compila una ruta histórica al DAG lineal equivalente', () => {
    const grafo = compilarRutaLineal(nodos.slice(0, 3));

    expect(grafo.topologia).toBe('LINEAL');
    expect(grafo.aristas).toEqual([
      { desdeClave: 'diseno', haciaClave: 'uv' },
      { desdeClave: 'uv', haciaClave: 'carton' },
    ]);
    expect(grafo.raices).toEqual(['diseno']);
    expect(grafo.terminales).toEqual(['carton']);
  });

  it('conserva y normaliza los gates declarados por nodo', () => {
    const grafo = compilarRutaLineal([
      { clave: 'impresion', indice: 0, gates: ['MATERIAL', 'MATERIAL'] },
      { clave: 'packing', indice: 1, gates: ['CALIDAD'] },
    ]);

    expect(grafo.nodos).toEqual([
      { clave: 'impresion', indice: 0, gates: ['MATERIAL'] },
      { clave: 'packing', indice: 1, gates: ['CALIDAD'] },
    ]);
  });

  it('habilita ramas paralelas y bloquea la convergencia incompleta', () => {
    const aristas = [
      { desdeClave: 'diseno', haciaClave: 'uv' },
      { desdeClave: 'diseno', haciaClave: 'carton' },
      { desdeClave: 'diseno', haciaClave: 'acrilico' },
      { desdeClave: 'uv', haciaClave: 'armado' },
      { desdeClave: 'carton', haciaClave: 'armado' },
      { desdeClave: 'acrilico', haciaClave: 'armado' },
      { desdeClave: 'armado', haciaClave: 'qc' },
    ];
    const grafo = validarYOrdenarGrafo(nodos, aristas);
    const estados = nodos.map((nodo) => ({
      clave: nodo.clave,
      estado: nodo.clave === 'diseno' ? 'hecho' : 'pendiente',
    }));

    expect(grafo.topologia).toBe('DAG');
    expect(nodoEjecutable('uv', estados, aristas)).toBe(true);
    expect(nodoEjecutable('carton', estados, aristas)).toBe(true);
    expect(nodoEjecutable('acrilico', estados, aristas)).toBe(true);
    expect(nodoEjecutable('armado', estados, aristas)).toBe(false);

    const ramasTerminadas = estados.map((nodo) =>
      ['uv', 'carton', 'acrilico'].includes(nodo.clave)
        ? { ...nodo, estado: 'hecho' }
        : nodo,
    );
    expect(nodoEjecutable('armado', ramasTerminadas, aristas)).toBe(true);
  });

  it('rechaza ciclos, autorreferencias, duplicados y aristas huérfanas', () => {
    expect(() =>
      validarYOrdenarGrafo(nodos.slice(0, 2), [
        { desdeClave: 'diseno', haciaClave: 'uv' },
        { desdeClave: 'uv', haciaClave: 'diseno' },
      ]),
    ).toThrow('ciclo');
    expect(() =>
      validarYOrdenarGrafo(nodos.slice(0, 1), [
        { desdeClave: 'diseno', haciaClave: 'diseno' },
      ]),
    ).toThrow('depender de sí mismo');
    expect(() =>
      validarYOrdenarGrafo(
        [
          { clave: 'diseno', indice: 0 },
          { clave: 'diseno', indice: 1 },
        ],
        [],
      ),
    ).toThrow('duplicada');
    expect(() =>
      validarYOrdenarGrafo(nodos.slice(0, 1), [
        { desdeClave: 'fantasma', haciaClave: 'diseno' },
      ]),
    ).toThrow('inexistente');
  });

  it('sólo reabre cuando todos los descendientes siguen pendientes', () => {
    const aristas = [
      { desdeClave: 'diseno', haciaClave: 'uv' },
      { desdeClave: 'uv', haciaClave: 'armado' },
      { desdeClave: 'armado', haciaClave: 'qc' },
    ];
    const pendientes = nodos.map((nodo) => ({
      clave: nodo.clave,
      estado: nodo.clave === 'diseno' ? 'hecho' : 'pendiente',
    }));
    expect(nodoReabrible('diseno', pendientes, aristas)).toBe(true);
    expect(
      nodoReabrible(
        'diseno',
        pendientes.map((nodo) =>
          nodo.clave === 'qc' ? { ...nodo, estado: 'en_curso' } : nodo,
        ),
        aristas,
      ),
    ).toBe(false);
  });

  it('saltea un opcional inactivo sin cortar sus dependencias', () => {
    const completo = compilarRutaLineal(nodos.slice(0, 4));
    const reducido = reducirGrafoAClaves(
      completo,
      new Set(['diseno', 'carton', 'acrilico']),
    );
    expect(reducido.aristas).toEqual([
      { desdeClave: 'diseno', haciaClave: 'carton' },
      { desdeClave: 'carton', haciaClave: 'acrilico' },
    ]);
    expect(reducido.terminales).toEqual(['acrilico']);
  });
});
