import { describe, it, expect } from 'vitest';
import { alternarSeleccionCola, alternarGrupoCola, seleccionColaVigente, motivoNestingSeleccionCola, SELECCION_COLA_VACIA } from './seleccion-cola';
import type { TrabajoCola } from './colas-produccion';

const trabajo = (id: string, estadoCola = 'listos', configuracion = {}) => ({ id, estadoCola, configuracion }) as TrabajoCola;
describe('selección libre para completar trabajos', () => {
  it('admite distintos materiales, formatos y colores, incluso sin configuración', () => {
    const items = [trabajo('a', 'listos', { materialId: 'vinilo', modoColor: 'CMYK' }), trabajo('b', 'en_curso', { materialId: 'lona', modoColor: 'CMYK+W' }), trabajo('c')];
    const seleccion = items.reduce(alternarSeleccionCola, SELECCION_COLA_VACIA);
    expect(seleccion.ids).toEqual(['a', 'b', 'c']);
    expect(alternarSeleccionCola(seleccion, items[1]).ids).toEqual(['a', 'c']);
  });
  it('la selección no impone validación por estado ni prepara una tanda', () => {
    const items = ['listos', 'en_curso', 'pausados', 'en_espera'].map((estado, i) => trabajo(String(i), estado));
    expect(alternarGrupoCola(SELECCION_COLA_VACIA, items).ids).toHaveLength(4);
  });
  it('selecciona y quita una página completa sin duplicar trabajos', () => {
    const items = [trabajo('a'), trabajo('b')];
    const parcial = alternarSeleccionCola(SELECCION_COLA_VACIA, items[0]);
    const todos = alternarGrupoCola(parcial, items);
    expect(todos.ids).toEqual(['a', 'b']);
    expect(alternarGrupoCola(todos, items)).toEqual(SELECCION_COLA_VACIA);
  });
  it('limita a 50 y permite quitar aunque se haya llegado al límite', () => {
    const items = Array.from({ length: 51 }, (_, i) => trabajo(String(i)));
    const llena = alternarGrupoCola(SELECCION_COLA_VACIA, items);
    expect(llena.ids).toHaveLength(50);
    expect(alternarSeleccionCola(llena, items[50])).toBe(llena);
    expect(alternarSeleccionCola(llena, items[0]).ids).toHaveLength(49);
  });
  it('detecta desapariciones sin invalidar cambios de configuración o estado', () => {
    const seleccion = { ids: ['a', 'b'] };
    expect(seleccionColaVigente(seleccion, [trabajo('a'), trabajo('b', 'pausados', { modoColor: 'otro' })])).toBe(true);
    expect(seleccionColaVigente(seleccion, [trabajo('a')])).toBe(false);
  });
});

describe('material de la selección para nesting', () => {
  const seleccion = { ids: ['a', 'b'] };
  it('admite diferentes anchos, colores y estados cuando el material coincide', () => {
    const items = [
      trabajo('a', 'listos', { materialId: 'vinilo-1370', modoColor: 'CMYK', materialNestingClave: 'vinilo:brillante' }),
      trabajo('b', 'en_espera', { materialId: 'vinilo-1520', modoColor: 'CMYK+W', materialNestingClave: 'vinilo:brillante' }),
    ];
    expect(motivoNestingSeleccionCola(seleccion, items)).toBeNull();
  });
  it('bloquea nesting con materiales diferentes, pero conserva la selección libre para completar', () => {
    const items = [trabajo('a', 'listos', { materialNestingClave: 'vinilo:brillante' }), trabajo('b', 'listos', { materialNestingClave: 'lona:brillante' })];
    const mixta = alternarGrupoCola(SELECCION_COLA_VACIA, items);
    expect(mixta).toEqual(seleccion);
    expect(seleccionColaVigente(mixta, items)).toBe(true);
    expect(motivoNestingSeleccionCola(mixta, items)).toContain('seleccioná un solo material');
  });
  it('requiere identificar ambos materiales y detecta selecciones desactualizadas', () => {
    expect(motivoNestingSeleccionCola(seleccion, [trabajo('a'), trabajo('b')])).toContain('Falta identificar');
    expect(motivoNestingSeleccionCola(seleccion, [trabajo('a')])).toContain('La cola cambió');
    expect(motivoNestingSeleccionCola(SELECCION_COLA_VACIA, [])).toContain('Seleccioná trabajos');
  });
  it('bloquea compuestos, layouts conservados y placas sin impedir seleccionarlos para completar', () => {
    for (const configuracion of [
      { productoCompuesto: true }, { layoutConservado: true }, { formatos: [{ tipo: 'sheet' }] },
    ]) {
      const items = [trabajo('a', 'listos', { materialNestingClave: 'vinilo', ...configuracion })];
      const seleccion = alternarGrupoCola(SELECCION_COLA_VACIA, items);
      expect(seleccion.ids).toEqual(['a']);
      expect(motivoNestingSeleccionCola(seleccion, items)).toMatch(/compuesto|bloqueado|placas/);
    }
  });
});
