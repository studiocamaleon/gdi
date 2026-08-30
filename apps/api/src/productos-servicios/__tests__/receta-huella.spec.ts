import { huellaDe } from '../recetas-producto.service';

describe('huella canónica de receta', () => {
  it('no cambia por el orden de las claves de un objeto', () => {
    expect(
      huellaDe({
        producto: { nombre: 'Exhibidor', codigo: 'EXH' },
        version: 1,
      }),
    ).toBe(
      huellaDe({
        version: 1,
        producto: { codigo: 'EXH', nombre: 'Exhibidor' },
      }),
    );
  });

  it('detecta cambios productivos reales', () => {
    expect(huellaDe({ material: 'PVC', merma: 5 })).not.toBe(
      huellaDe({ material: 'PVC', merma: 8 }),
    );
  });

  it('conserva el orden significativo de las listas', () => {
    expect(huellaDe({ pasos: ['imprimir', 'cortar'] })).not.toBe(
      huellaDe({ pasos: ['cortar', 'imprimir'] }),
    );
  });
});
