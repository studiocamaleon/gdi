import 'reflect-metadata';

import { componenteDesgasteSinCosto } from '../maquinaria.service';

describe('borradores de maquinaria', () => {
  it('identifica un componente pendiente de precio o repuesto', () => {
    expect(componenteDesgasteSinCosto({})).toBe(true);
  });

  it('acepta como costeable un componente con precio o repuesto', () => {
    expect(componenteDesgasteSinCosto({ precioUnitario: 150_000 })).toBe(false);
    expect(
      componenteDesgasteSinCosto({
        materiaPrimaVarianteId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toBe(false);
  });
});
