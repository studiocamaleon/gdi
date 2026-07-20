import { filtrarSpecsPublicas } from '../tracking-publico-specs';

describe('filtrarSpecsPublicas', () => {
  const specs = [
    { etiqueta: 'Medidas', valor: '150 × 100 cm' },
    { etiqueta: 'Medida de corte', valor: '158 × 108 cm' },
    { etiqueta: 'Material', valor: 'Lona frontlit 13oz' },
  ];

  it('saca la medida de corte y deja el resto', () => {
    expect(filtrarSpecsPublicas(specs)).toEqual([
      { etiqueta: 'Medidas', valor: '150 × 100 cm' },
      { etiqueta: 'Material', valor: 'Lona frontlit 13oz' },
    ]);
  });

  it('no depende de mayúsculas ni espacios de más', () => {
    expect(
      filtrarSpecsPublicas([
        { etiqueta: '  MEDIDA DE CORTE ', valor: '158 × 108 cm' },
      ]),
    ).toEqual([]);
  });

  it('deja pasar la medida que pidió el cliente', () => {
    expect(
      filtrarSpecsPublicas([{ etiqueta: 'Medidas', valor: '150 × 100 cm' }]),
    ).toHaveLength(1);
  });

  it('sin specs devuelve lista vacía', () => {
    expect(filtrarSpecsPublicas([])).toEqual([]);
  });
});
