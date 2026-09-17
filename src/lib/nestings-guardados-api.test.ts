import { describe, expect, it } from 'vitest';
import { leerCantidadesNesting } from './nestings-guardados-api';

describe('cantidades para preparar nesting', () => {
  it('admite separadores, elimina duplicados y ordena cantidades', () => {
    expect(leerCantidadesNesting('50, 10; 25\n50')).toEqual([10, 25, 50]);
  });
  it.each(['', '0', '-1', '2.5', '10001', '50abc', Array(21).fill('1').join(',')])('rechaza %s', value => {
    expect(() => leerCantidadesNesting(value)).toThrow();
  });
});
