import {
  materialPriceInUseUnit,
  materialUnitConversion,
  normalizedMaterialPrice,
  validateMaterialUnits,
  type MaterialUnitContext,
} from '../material-units';

describe('Compra, uso y precio de materiales', () => {
  const polyfan: MaterialUnitContext = {
    unidadCompra: 'UNIDAD',
    unidadStock: 'UNIDAD',
    unidadUso: 'M2',
    unidadPrecio: 'UNIDAD',
    templateId: 'sustrato_rigido_v1',
    atributos: { ancho: 1.2, alto: 0.6 },
  };

  it.each(['unidad', 'pieza'])(
    'convierte un rígido llamado %s según el área de su placa',
    (unidad) => {
      expect(materialUnitConversion(polyfan, unidad, 'm2')).toMatchObject({
        ok: true,
        factor: 0.72,
        origen: 'medidas',
      });
      expect(materialPriceInUseUnit(polyfan, 15000)).toEqual({
        ok: true,
        precio: 15000 / 0.72,
      });
    },
  );

  it('conserva una equivalencia explícita de unidad para el rígido', () => {
    const contexto = {
      ...polyfan,
      equivalencias: [{ origen: 'unidad', destino: 'placa', factor: 2 }],
    };
    expect(validateMaterialUnits(contexto)).toBeNull();
    expect(materialUnitConversion(contexto, 'unidad', 'm2')).toMatchObject({
      ok: true,
      factor: 1.44,
      origen: 'manual',
    });
  });

  it('no interpreta como placa una unidad de otro tipo de material', () => {
    expect(
      materialUnitConversion({ ...polyfan, templateId: null }, 'unidad', 'm2')
        .ok,
    ).toBe(false);
    expect(
      materialUnitConversion({ ...polyfan, atributos: {} }, 'unidad', 'm2').ok,
    ).toBe(false);
  });

  const roll: MaterialUnitContext = {
    unidadCompra: 'ROLLO',
    unidadStock: 'M2',
    unidadPrecio: 'ROLLO',
    templateId: 'sustrato_rollo_flexible_v1',
    atributos: { ancho: 1.37, largo: 50 },
  };

  it('convierte dos rollos a área y conserva el valor de compra', () => {
    const conversion = materialUnitConversion(roll, 'rollo', 'm2');
    const price = materialPriceInUseUnit(roll, 137000);
    expect(conversion).toMatchObject({
      ok: true,
      factor: 68.5,
      origen: 'medidas',
    });
    expect(price).toEqual({ ok: true, precio: 2000 });
    if (conversion.ok && price.ok)
      expect(2 * conversion.factor * price.precio).toBe(274000);
  });

  it.each([100, 250])('usa el contenido propio de una caja de %i', (factor) => {
    const box = {
      unidadCompra: 'caja',
      unidadStock: 'unidad',
      unidadPrecio: 'caja',
      equivalenciaCompra: factor,
    };
    expect(materialPriceInUseUnit(box, 12000)).toEqual({
      ok: true,
      precio: 12000 / factor,
    });
    const reverse = materialUnitConversion(box, 'unidad', 'caja');
    expect(reverse.ok && reverse.factor).toBe(1 / factor);
  });

  it.each(['caja', 'pack', 'kit', 'rollo', 'resma'])(
    'no inventa contenido para %s',
    (unidadCompra) => {
      const c = {
        unidadCompra,
        unidadStock: 'unidad',
        unidadPrecio: unidadCompra,
      };
      expect(materialUnitConversion(c, unidadCompra, 'unidad').ok).toBe(false);
      expect(materialPriceInUseUnit(c, 100).ok).toBe(false);
    },
  );

  it.each(['hoja', 'placa'])(
    'el precio puede venir por m² aunque se compre por %s',
    (unidad) => {
      const pvc = {
        unidadCompra: unidad,
        unidadStock: 'm2',
        unidadPrecio: 'm2',
        templateId: 'sustrato_rigido_v1',
        atributos: { ancho: 1.22, alto: 2.44 },
      };
      const c = materialUnitConversion(pvc, unidad, 'm2');
      expect(c.ok && c.factor).toBeCloseTo(2.9768, 8);
      expect(materialPriceInUseUnit(pvc, 8000)).toEqual({
        ok: true,
        precio: 8000,
      });
      const priceBySheet = materialPriceInUseUnit(
        { ...pvc, unidadPrecio: unidad },
        23814.4,
      );
      expect(priceBySheet.ok && priceBySheet.precio).toBeCloseTo(8000, 8);
    },
  );

  it('hoja y placa son equivalentes sin medidas y no admiten coeficientes contradictorios', () => {
    const context = { unidadCompra: 'hoja', unidadStock: 'placa' };
    expect(materialUnitConversion(context, 'HOJA', 'PLACA')).toMatchObject({
      ok: true,
      factor: 1,
    });
    expect(materialUnitConversion(context, 'placa', 'hoja')).toMatchObject({
      ok: true,
      factor: 1,
    });
    expect(
      validateMaterialUnits({
        ...context,
        equivalencias: [{ origen: 'hoja', destino: 'placa', factor: 2 }],
      }),
    ).not.toBeNull();
  });

  it('encadena kg → placa → m² usando el coeficiente propio del material', () => {
    const context = {
      unidadCompra: 'kg',
      unidadStock: 'placa',
      unidadUso: 'm2',
      unidadPrecio: 'kg',
      templateId: 'sustrato_rigido_v1',
      atributos: { ancho: 1, alto: 2 },
      equivalencias: [{ origen: 'kg', destino: 'placa', factor: 0.55 }],
    };
    expect(materialUnitConversion(context, 'kg', 'm2')).toMatchObject({
      ok: true,
      factor: 1.1,
    });
    const price = materialPriceInUseUnit(context, 110);
    expect(price.ok).toBe(true);
    expect(price.ok && price.precio).toBeCloseTo(100, 8);
  });

  it.each([
    { origen: 'm2', destino: 'kg', expected: 4.576 },
    { origen: 'kg', destino: 'm2', expected: 3.7818181818 },
  ])(
    'conserva el sentido de 1 $origen = 1,1 $destino al costear PAI',
    ({ origen, destino, expected }) => {
      const context = {
        unidadCompra: 'kg',
        unidadStock: 'placa',
        unidadUso: 'm2',
        unidadPrecio: 'kg',
        templateId: 'sustrato_rigido_v1',
        atributos: { ancho: 1, alto: 2 },
        equivalencias: [{ origen, destino, factor: 1.1 }],
      };
      const cost = materialPriceInUseUnit(context, 4.16);
      expect(cost.ok && cost.precio).toBeCloseTo(expected, 8);
      const plateCost = materialPriceInUseUnit(
        { ...context, unidadUso: 'placa' },
        4.16,
      );
      expect(plateCost.ok && plateCost.precio).toBeCloseTo(expected * 2, 8);
    },
  );

  it('respeta milímetros declarados por film, sin inferir escala por tamaño', () => {
    const c = {
      ...roll,
      templateId: 'film_transferencia_v1',
      atributos: { ancho: 600, largo: 100 },
    };
    const area = materialUnitConversion(c, 'rollo', 'm2');
    expect(area.ok && area.factor).toBe(60);
  });

  it('prioriza dimensiones canónicas actualizadas sobre alias antiguos', () => {
    const c = {
      ...roll,
      atributos: { ancho: 1.52, largo: 50, anchoMm: 1370, largoRolloMm: 50000 },
    };
    const area = materialUnitConversion(c, 'rollo', 'm2');
    expect(area.ok && area.factor).toBe(76);
  });

  it('convierte litro/ml y un envase de 500 ml de manera diferente', () => {
    expect(
      materialPriceInUseUnit(
        { unidadCompra: 'litro', unidadStock: 'ml', unidadPrecio: 'litro' },
        20000,
      ),
    ).toEqual({ ok: true, precio: 20 });
    expect(
      materialPriceInUseUnit(
        {
          unidadCompra: 'unidad',
          unidadStock: 'ml',
          unidadPrecio: 'unidad',
          templateId: 'tinta_impresion_v1',
          atributos: { volumenPresentacion: 500 },
        },
        20000,
      ),
    ).toEqual({ ok: true, precio: 40 });
  });

  it.each([500, 1000, 5000])(
    'costea una botella de %s ml por su contenido real',
    (volumen) => {
      const context = {
        unidadCompra: 'botella',
        unidadPrecio: 'botella',
        unidadStock: 'botella',
        unidadUso: 'ml',
        templateId: 'tinta_impresion_v1',
        atributos: { volumenPresentacion: volumen },
      };
      expect(materialUnitConversion(context, 'botella', 'ml')).toMatchObject({
        ok: true,
        factor: volumen,
      });
      expect(materialPriceInUseUnit(context, 20000)).toEqual({
        ok: true,
        precio: 20000 / volumen,
      });
    },
  );

  it('una botella sin contenido conocido necesita coeficiente propio', () => {
    const context = {
      unidadCompra: 'botella',
      unidadPrecio: 'botella',
      unidadStock: 'botella',
      unidadUso: 'ml',
    };
    expect(materialUnitConversion(context, 'botella', 'litro').ok).toBe(false);
    const configured = {
      ...context,
      equivalencias: [{ origen: 'botella', destino: 'ml', factor: 750 }],
    };
    expect(
      materialUnitConversion(configured, 'botella', 'litro'),
    ).toMatchObject({ ok: true, factor: 0.75 });
    expect(materialPriceInUseUnit(configured, 15000)).toEqual({
      ok: true,
      precio: 20,
    });
  });

  it('no aplica densidad universal entre volumen y masa', () => {
    expect(
      materialUnitConversion(
        { unidadCompra: 'litro', unidadStock: 'kg' },
        'litro',
        'kg',
      ).ok,
    ).toBe(false);
  });

  it.each([0, -1, NaN, Infinity])(
    'rechaza el factor %s',
    (equivalenciaCompra) => {
      expect(
        validateMaterialUnits({
          unidadCompra: 'caja',
          unidadStock: 'unidad',
          equivalenciaCompra,
        }),
      ).not.toBeNull();
    },
  );

  it('rechaza una equivalencia manual que contradice dimensiones o física', () => {
    expect(
      validateMaterialUnits({ ...roll, equivalenciaCompra: 50 }),
    ).not.toBeNull();
    expect(
      validateMaterialUnits({
        unidadCompra: 'litro',
        unidadStock: 'ml',
        equivalenciaCompra: 900,
      }),
    ).not.toBeNull();
  });

  it('conserva el importe antiguo sin suponer la unidad de un precio ambiguo', () => {
    const record = {
      precioReferencia: 12000,
      unidadStock: 'UNIDAD',
      unidadCompra: 'CAJA',
      equivalenciaCompra: 100,
    };
    expect(normalizedMaterialPrice(record)).toBeNull();
    expect(record.precioReferencia).toBe(12000);
    expect(normalizedMaterialPrice({ ...record, unidadPrecio: 'CAJA' })).toBe(
      120,
    );
    expect(normalizedMaterialPrice({ ...record, unidadPrecio: 'UNIDAD' })).toBe(
      12000,
    );
  });

  it('respeta unidad y contenido de la variante por encima del material', () => {
    expect(
      normalizedMaterialPrice({
        precioReferencia: 30000,
        unidadStock: 'UNIDAD',
        unidadCompra: 'CAJA',
        unidadPrecio: 'CAJA',
        equivalenciaCompra: 250,
        materiaPrima: { unidadStock: 'M2', unidadCompra: 'ROLLO' },
      }),
    ).toBe(120);
  });
});

describe('Equivalencias encadenadas por variante', () => {
  const context: MaterialUnitContext = {
    unidadCompra: 'pallet',
    unidadStock: 'caja',
    unidadUso: 'unidad',
    unidadPrecio: 'pallet',
    equivalencias: [
      { origen: 'pallet', destino: 'caja', factor: 10 },
      { origen: 'caja', destino: 'unidad', factor: 10 },
    ],
  };
  it('un pallet son diez cajas o cien unidades; conserva el valor en ambos sentidos', () => {
    expect(materialUnitConversion(context, 'pallet', 'unidad')).toMatchObject({
      ok: true,
      factor: 100,
      pasos: context.equivalencias!.map((r) => ({
        ...r,
        origenFactor: 'manual',
      })),
    });
    expect(materialPriceInUseUnit(context, 500)).toEqual({
      ok: true,
      precio: 5,
    });
    expect(materialUnitConversion(context, 'unidad', 'caja')).toMatchObject({
      ok: true,
      factor: 0.1,
    });
  });
  it('el peso del PAI corresponde a la variante y se combina con sus medidas', () => {
    const pai = {
      unidadCompra: 'kg',
      unidadStock: 'hoja',
      unidadUso: 'm2',
      unidadPrecio: 'kg',
      templateId: 'sustrato_rigido_v1',
      atributos: { ancho: 1, alto: 2 },
      equivalencias: [{ origen: 'hoja', destino: 'kg', factor: 2.5 }],
    };
    expect(materialPriceInUseUnit(pai, 4)).toEqual({ ok: true, precio: 5 });
    expect(materialUnitConversion(pai, 'kg', 'hoja')).toMatchObject({
      ok: true,
      factor: 0.4,
    });
    expect(
      materialPriceInUseUnit(
        {
          ...pai,
          equivalencias: [{ origen: 'hoja', destino: 'kg', factor: 5 }],
        },
        4,
      ),
    ).toEqual({ ok: true, precio: 10 });
  });
  it('rechaza ciclos contradictorios y permite relaciones redundantes coherentes', () => {
    expect(
      validateMaterialUnits({
        ...context,
        equivalencias: [
          ...context.equivalencias!,
          { origen: 'unidad', destino: 'pallet', factor: 0.02 },
        ],
      }),
    ).toContain('contradice');
    expect(
      validateMaterialUnits({
        ...context,
        equivalencias: [
          ...context.equivalencias!,
          { origen: 'unidad', destino: 'pallet', factor: 0.01 },
        ],
      }),
    ).toBeNull();
  });
  it('borrar la lista no reactiva el factor legado', () => {
    expect(
      materialUnitConversion(
        { ...context, equivalencias: [], equivalenciaCompra: 10 },
        'pallet',
        'caja',
      ).ok,
    ).toBe(false);
  });
  it('exige una relación para la unidad de consumo aunque compra y stock coincidan', () => {
    expect(
      materialPriceInUseUnit(
        {
          ...context,
          unidadCompra: 'caja',
          unidadPrecio: 'caja',
          equivalencias: [],
        },
        50,
      ).ok,
    ).toBe(false);
  });
});
