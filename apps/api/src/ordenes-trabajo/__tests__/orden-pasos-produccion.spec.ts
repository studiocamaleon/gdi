import { ordenarPasosProduccion } from '../orden-pasos-produccion';
const ordenar = (
  pasos: Array<{ id: string; indice: number; previos?: string[] }>,
) => ordenarPasosProduccion(pasos, (p) => p.previos ?? []).map((p) => p.id);
it('respeta precedencias aunque preprensa haya sido agregada al final de la traza', () => {
  expect(
    ordenar([
      { id: 'impresion', indice: 0, previos: ['preprensa'] },
      { id: 'refilado', indice: 1, previos: ['impresion'] },
      { id: 'preprensa', indice: 2 },
    ]),
  ).toEqual(['preprensa', 'impresion', 'refilado']);
});
it('conserva ramas paralelas y ubica la convergencia después de ambas', () => {
  expect(
    ordenar([
      { id: 'armado', indice: 0, previos: ['corte', 'impresion'] },
      { id: 'corte', indice: 1 },
      { id: 'impresion', indice: 2 },
    ]),
  ).toEqual(['corte', 'impresion', 'armado']);
});
it('las dependencias de otros ítems no eliminan ni bloquean la presentación', () => {
  expect(
    ordenar([
      { id: 'instalar', indice: 0, previos: ['preparar', 'externo'] },
      { id: 'preparar', indice: 1, previos: ['externo'] },
    ]),
  ).toEqual(['preparar', 'instalar']);
});
it('mantiene la secuencia histórica por índice cuando no hay dependencias', () => {
  expect(
    ordenar([
      { id: 'c', indice: 9 },
      { id: 'a', indice: 0 },
      { id: 'b', indice: 4 },
    ]),
  ).toEqual(['a', 'b', 'c']);
});
it('deduplica aristas y no oculta pasos ni se cuelga ante ciclos inválidos', () => {
  expect(
    ordenar([
      { id: 'b', indice: 0, previos: ['a', 'a'] },
      { id: 'a', indice: 1 },
    ]),
  ).toEqual(['a', 'b']);
  expect(
    ordenar([
      { id: 'b', indice: 0, previos: ['a'] },
      { id: 'a', indice: 1, previos: ['b'] },
    ]),
  ).toEqual(['b', 'a']);
});
