import {
  calcularMaterialesOrden,
  type ItemMaterialesSnapshot,
} from '../materiales-orden';

const contexto = { unidadStock: 'HOJA', unidadCompra: 'HOJA' };
const material = (override: Record<string, unknown> = {}) => ({
  materialVarianteId: 'papel',
  materialDisplayName: 'Obra A4',
  slotCodigo: 'sustrato_principal',
  tipoLineaCosto: 'MATERIAL',
  cantidad: 5,
  unidad: 'hoja',
  contextoUnidadesSnapshot: contexto,
  ...override,
});
const item = (
  materials: unknown[],
  override: Partial<ItemMaterialesSnapshot> = {},
): ItemMaterialesSnapshot => ({
  id: 'item-1',
  nombre: 'Documento',
  parentItemId: null,
  contieneLotesEntrega: false,
  cotizacionItem: null,
  trazabilidadSnapshotJson: {
    pasos: [{ rutaPasoId: 'ruta-1', activado: true, materiales: materials }],
  },
  pasos: [
    {
      id: 'paso-1',
      nombre: 'Impresión',
      rutaPasoId: 'ruta-1',
      nestingLoteId: null,
      nestingLoteRol: null,
      nestingLoteSnapshotJson: null,
    },
  ],
  ...override,
});
const run = (...items: ItemMaterialesSnapshot[]) =>
  calcularMaterialesOrden('ot', items);
const nesting = {
  substrates: [{ kind: 'sheet', count: 1, widthMm: 1000, heightMm: 2000 }],
};

describe('Necesidades de materiales de la OT (C0)', () => {
  it('incluye componentes INLINE y sus subcomponentes sin multiplicar de nuevo la cantidad comercial', () => {
    const padre = item([]);
    padre.trazabilidadSnapshotJson = {
      pasos: [],
      componentesFabricados: [
        {
          codigo: 'FRENTE',
          nombre: 'Frente',
          politicaEjecucion: 'INLINE',
          cantidad: 10,
          pasos: [
            { rutaPasoId: 'frente', materiales: [material({ cantidad: 2 })] },
          ],
          componentes: [
            {
              codigo: 'DORSO',
              nombre: 'Dorso',
              politicaEjecucion: 'INLINE',
              cantidad: 5,
              pasos: [
                {
                  rutaPasoId: 'dorso',
                  materiales: [material({ cantidad: 3 })],
                },
              ],
            },
          ],
        },
      ],
    };
    padre.pasos = [];
    const result = run(padre);
    expect(result.necesidades[0].cantidad).toBe(5);
    expect(
      result.necesidades[0].origenes.every((o) => o.itemId === padre.id),
    ).toBe(true);
    expect(result.pendientes).toEqual([]);
  });

  it('un componente independiente faltante se advierte y uno materializado no se duplica', () => {
    const padre = item([], { pasos: [] });
    padre.trazabilidadSnapshotJson = {
      pasos: [],
      componentesFabricados: [
        {
          codigo: 'FRENTE',
          nombre: 'Frente',
          politicaEjecucion: 'INDEPENDIENTE',
          pasos: [{ rutaPasoId: 'ruta-1', materiales: [material()] }],
        },
      ],
    };
    expect(run(padre).pendientes).toHaveLength(1);
    const hijo = item([material()], {
      id: 'hijo',
      parentItemId: padre.id,
      componenteCodigo: 'FRENTE',
    });
    const result = run(padre, hijo);
    expect(result.necesidades[0].cantidad).toBe(5);
    expect(result.pendientes).toEqual([]);
  });
  it('redondea a soportes completos la merma física sin volver a aplicar su porcentaje', () => {
    const result = run(
      item([material({ cantidad: 131.25, mermaAdicional: { porcentaje: 5 } })]),
    );
    expect(result.necesidades[0]).toMatchObject({
      cantidad: 132,
      unidad: 'hoja',
    });
    expect(result.necesidades[0].origenes[0].cantidadCalculada).toBe(131.25);
  });

  it('usa los pliegos comprados, no los pliegos menores que pasan por la máquina', () => {
    const snapshot = item([]);
    snapshot.trazabilidadSnapshotJson = {
      pasos: [
        {
          rutaPasoId: 'ruta-1',
          materiales: [
            material({
              cantidad: 0.2,
              detalleCosteoNesting: { strategy: 'm2-exact' },
            }),
          ],
          nestingResult: {
            substrates: [
              { kind: 'sheet', count: 4, widthMm: 500, heightMm: 500 },
            ],
            pliegoImpresionSeleccionado: {
              pliegosImpresion: 4,
              pliegosComprados: 1,
            },
          },
        },
      ],
    };
    expect(run(snapshot).necesidades[0].cantidad).toBe(1);
  });

  it('un material de un paso tercerizado requiere confirmar quién lo aporta', () => {
    const snapshot = item([]);
    snapshot.trazabilidadSnapshotJson = {
      pasos: [
        { rutaPasoId: 'ruta-1', tercerizado: true, materiales: [material()] },
      ],
    };
    expect(run(snapshot).necesidades[0]).toMatchObject({
      cantidad: null,
      estado: 'revisar',
    });
  });

  it('las líneas incompletas no desaparecen como si el paso no consumiera material', () => {
    expect(run(item([null])).resumen.porRevisar).toBe(1);
  });
  it.each([
    ['simple', 10],
    ['doble', 6],
    ['rangos 1-7,9,12-16', 14],
  ])(
    '%s: respeta las hojas calculadas, sin volver a multiplicar copias ni caras',
    (_, hojas) => {
      const snapshot = item([
        material({ cantidad: hojas, mermaAdicional: { porcentaje: 10 } }),
      ]);
      const result = run(snapshot);
      expect(result.necesidades[0]).toMatchObject({
        cantidad: hojas,
        unidad: 'hoja',
        estado: 'calculada',
      });
      expect(result.pendientes).toEqual([]);
    },
  );

  it('conserva la necesidad nativa pero no inventa la unidad de stock histórica', () => {
    const result = run(
      item([material({ contextoUnidadesSnapshot: undefined })]),
    );
    expect(result.necesidades[0]).toMatchObject({
      cantidad: null,
      unidad: null,
      estado: 'revisar',
      origenes: [{ cantidadCalculada: 5, unidadCalculada: 'hoja' }],
    });
  });

  it('calcula la placa física completa aunque el costo sea por área parcial y aplica la merma una sola vez', () => {
    const snapshot = item([]);
    snapshot.trazabilidadSnapshotJson = {
      pasos: [
        {
          rutaPasoId: 'ruta-1',
          materiales: [
            material({
              cantidad: 0.55,
              unidad: 'm2',
              detalleCosteoNesting: { strategy: 'm2-exact' },
              mermaAdicional: { porcentaje: 10 },
              contextoUnidadesSnapshot: {
                unidadStock: 'PLACA',
                unidadCompra: 'PLACA',
              },
            }),
          ],
          nestingResult: nesting,
        },
      ],
    };
    expect(run(snapshot).necesidades[0]).toMatchObject({
      cantidad: 2,
      unidad: 'placa',
    });
  });

  it('no deduce soportes físicos de un importe si falta el acomodo', () => {
    const result = run(
      item([material({ detalleCosteoNesting: { strategy: 'm2-exact' } })]),
    );
    expect(result.necesidades[0]).toMatchObject({
      cantidad: null,
      estado: 'revisar',
    });
  });

  it('CAD: conserva metros lineales y tinta sin confundirlos con desgaste', () => {
    const result = run(
      item([
        material({
          materialVarianteId: 'rollo',
          cantidad: 2.5,
          unidad: 'm_lineales',
          contextoUnidadesSnapshot: {
            unidadStock: 'METRO_LINEAL',
            unidadCompra: 'ROLLO',
          },
        }),
        material({
          materialVarianteId: 'tinta',
          tipoLineaCosto: 'CONSUMIBLE_MAQUINA',
          cantidad: 8,
          unidad: 'ml',
          contextoUnidadesSnapshot: {
            unidadStock: 'ML',
            unidadCompra: 'BOTELLA',
          },
        }),
        material({ tipoLineaCosto: 'DESGASTE_MAQUINA', cantidad: 800 }),
      ]),
    );
    expect(
      result.necesidades.map((m) => [m.varianteId, m.cantidad, m.unidad]),
    ).toEqual([
      ['rollo', 2.5, 'metro_lineal'],
      ['tinta', 8, 'ml'],
    ]);
    expect(result.resumen.desgastesExcluidos).toBe(1);
  });

  it('usa el coeficiente congelado para convertir kg a m²', () => {
    const result = run(
      item([
        material({
          cantidad: 11,
          unidad: 'kg',
          contextoUnidadesSnapshot: {
            unidadStock: 'M2',
            unidadCompra: 'KG',
            equivalencias: [{ origen: 'm2', destino: 'kg', factor: 1.1 }],
          },
        }),
      ]),
    );
    expect(result.necesidades[0]).toMatchObject({ cantidad: 10, unidad: 'm2' });
  });

  it('no presenta una suma parcial como total si alguna línea carece de conversión', () => {
    const result = run(item([material(), material({ unidad: 'kg' })]));
    expect(result.necesidades[0]).toMatchObject({
      cantidad: null,
      estado: 'revisar',
    });
    expect(result.necesidades[0].origenes[0].cantidadStock).toBe(5);
  });

  it('no suma unidades de stock distintas para una misma variante', () => {
    const result = run(
      item([
        material(),
        material({
          unidad: 'm2',
          contextoUnidadesSnapshot: { unidadStock: 'M2', unidadCompra: 'M2' },
        }),
      ]),
    );
    expect(result.necesidades[0]).toMatchObject({
      cantidad: null,
      unidad: null,
      estado: 'revisar',
    });
  });

  it('ignora agregadores comerciales y lee el snapshot propio del componente', () => {
    const result = run(
      item([material({ cantidad: 99 })], { contieneLotesEntrega: true }),
      item([material({ cantidad: 3 })], {
        id: 'hijo',
        parentItemId: 'item-1',
        cotizacionItem: {
          trazabilidadJson: {
            pasos: [
              {
                rutaPasoId: 'ruta-1',
                materiales: [material({ cantidad: 100 })],
              },
            ],
          },
        },
      }),
    );
    expect(result.necesidades[0].cantidad).toBe(3);
  });

  it('etapas compuestas: no cuenta dos veces la lista agregada ni operaciones desactivadas', () => {
    const snapshot = item([]);
    snapshot.trazabilidadSnapshotJson = {
      pasos: [
        {
          rutaPasoId: 'ruta-1',
          materiales: [material({ cantidad: 999 })],
          operacionesInternas: [
            { nombre: 'Imprimir', activada: true, materiales: [material()] },
            {
              nombre: 'Cortar material heredado',
              activada: true,
              materiales: [],
            },
            {
              nombre: 'Opcional',
              activada: false,
              materiales: [material({ cantidad: 100 })],
            },
          ],
        },
      ],
    };
    expect(run(snapshot).necesidades[0].cantidad).toBe(5);
  });

  function compartidos(parentId = 'padre', prefix = '') {
    return ['OPERATIVO', 'PARTICIPANTE'].map((rol, i) =>
      item(
        [
          material({
            cantidad: 0.5,
            asignacionNestingCompuesto: { loteId: 'lote' },
          }),
          material({
            materialVarianteId: 'tinta',
            tipoLineaCosto: 'CONSUMIBLE_MAQUINA',
            cantidad: 2,
            unidad: 'ml',
            contextoUnidadesSnapshot: { unidadStock: 'ML', unidadCompra: 'ML' },
          }),
        ],
        {
          id: `${prefix}hijo-${i}`,
          parentItemId: parentId,
          pasos: [
            {
              id: `${prefix}paso-${i}`,
              nombre: 'Imprimir juntos',
              rutaPasoId: 'ruta-1',
              nestingLoteId: 'lote',
              nestingLoteRol: rol,
              nestingLoteSnapshotJson:
                rol === 'OPERATIVO'
                  ? {
                      id: 'lote',
                      materialVarianteId: 'papel',
                      nestingResult: nesting,
                    }
                  : null,
            },
          ],
        },
      ),
    );
  }

  it('consolida el soporte compartido una vez, conservando los consumibles de todos los participantes', () => {
    const result = run(...compartidos());
    expect(
      result.necesidades.find((m) => m.varianteId === 'papel')?.cantidad,
    ).toBe(1);
    expect(
      result.necesidades.find((m) => m.varianteId === 'tinta')?.cantidad,
    ).toBe(4);
  });

  it('no mezcla lotes con igual código en dos componentes anidados distintos', () => {
    const result = run(
      ...compartidos('padre-a'),
      ...compartidos('padre-b', 'b-'),
    );
    expect(
      result.necesidades.find((m) => m.varianteId === 'papel')?.cantidad,
    ).toBe(2);
  });

  it('requiere revisión si no existe la operación del lote; no usa la parte económica como consumo', () => {
    const result = run(compartidos()[1]);
    expect(
      result.necesidades.find((m) => m.varianteId === 'papel'),
    ).toMatchObject({ cantidad: null, estado: 'revisar' });
  });

  it('no demanda una segunda placa cuando el corte reutiliza el lote de impresión', () => {
    const items = compartidos();
    const corte = item(
      [material({ asignacionNestingCompuesto: { loteId: 'corte' } })],
      { id: 'corte', parentItemId: 'padre' },
    );
    corte.pasos[0] = {
      ...corte.pasos[0],
      nestingLoteId: 'corte',
      nestingLoteRol: 'OPERATIVO',
      nestingLoteSnapshotJson: {
        id: 'corte',
        materialVarianteId: 'papel',
        layoutOrigenLoteId: 'lote',
        nestingResult: nesting,
      },
    };
    expect(
      run(...items, corte).necesidades.find((m) => m.varianteId === 'papel')
        ?.cantidad,
    ).toBe(1);
  });

  it('una OT manual o snapshot incompleto no equivale a consumo cero', () => {
    expect(
      run(item([], { trazabilidadSnapshotJson: null })).resumen.porRevisar,
    ).toBe(1);
    expect(
      run(
        item([], {
          trazabilidadSnapshotJson: { pasos: [{ rutaPasoId: 'ruta-1' }] },
        }),
      ).resumen.porRevisar,
    ).toBe(1);
  });

  it('acepta un paso sin consumos explícito, conserva determinismo y no modifica snapshots', () => {
    const snapshot = item([]);
    const before = JSON.stringify(snapshot);
    expect(run(snapshot).resumen).toMatchObject({
      variantes: 0,
      porRevisar: 0,
    });
    expect(run(snapshot).revision).toBe(run(snapshot).revision);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('nunca expone precios o costos en la proyección', () => {
    const result = run(
      item([material({ precioUnitario: 12345, costoTotal: 61725 })]),
    );
    expect(JSON.stringify(result)).not.toMatch(/precio|costo|12345|61725/);
  });
});
