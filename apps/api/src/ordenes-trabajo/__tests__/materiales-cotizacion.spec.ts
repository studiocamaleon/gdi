import { materialesDeCotizaciones } from '../materiales-cotizacion.proyeccion';
const material = (extra: Record<string, unknown> = {}) => ({
  materialVarianteId: 'papel',
  materialDisplayName: 'Papel',
  tipoLineaCosto: 'MATERIAL',
  cantidad: 5,
  unidad: 'hoja',
  contextoUnidadesSnapshot: { unidadStock: 'HOJA', unidadCompra: 'HOJA' },
  ...extra,
});
const paso = (extra: Record<string, unknown> = {}) => ({
  rutaPasoId: 'imp',
  materiales: [material(extra)],
});
const run = (cotizacion: unknown) =>
  materialesDeCotizaciones([{ id: 'i', nombre: 'Producto', cotizacion }]);
describe('Materiales antes de persistir la cotización', () => {
  it('incluye componentes independientes e INLINE anidados una sola vez', () => {
    const q = {
      pasos: [paso()],
      componentesFabricados: [
        {
          codigo: 'frente',
          politicaEjecucion: 'INDEPENDIENTE',
          pasos: [paso()],
          componentes: [
            { codigo: 'dorso', politicaEjecucion: 'INLINE', pasos: [paso()] },
          ],
        },
      ],
    };
    expect(run(q).necesidades[0].cantidad).toBe(15);
    expect(run(q).pendientes).toHaveLength(0);
  });
  it('no duplica soportes compartidos entre componentes ni mezcla dos productos', () => {
    const q = {
      pasos: [],
      componentesFabricados: ['a', 'b'].map((codigo) => ({
        codigo,
        pasos: [
          paso({ cantidad: 0.5, asignacionNestingCompuesto: { loteId: 'l' } }),
        ],
      })),
      analisisNestingCompuesto: {
        grupos: [
          {
            aplicacion: { aplicado: true },
            lote: {
              id: 'l',
              materialVarianteId: 'papel',
              nestingResult: {
                substrates: [
                  { kind: 'sheet', count: 1, widthMm: 1000, heightMm: 2000 },
                ],
              },
              participantes: ['a', 'b'].map((componenteCodigo, i) => ({
                componenteCodigo,
                rutaPasoId: 'imp',
                esPasoOperativo: i === 0,
              })),
            },
          },
        ],
      },
    };
    expect(run(q).necesidades[0].cantidad).toBe(1);
    expect(
      materialesDeCotizaciones(
        ['1', '2'].map((id) => ({ id, nombre: id, cotizacion: q })),
      ).necesidades[0].cantidad,
    ).toBe(2);
  });
  it('sin el lote operativo no adivina el consumo a partir del reparto del costo', () => {
    expect(
      run({
        pasos: [
          paso({
            cantidad: 0.5,
            asignacionNestingCompuesto: { loteId: 'ausente' },
          }),
        ],
      }).necesidades[0],
    ).toMatchObject({ cantidad: null, estado: 'revisar' });
  });
  it('traza ausente advierte que falta información', () => {
    expect(run(null).pendientes.length).toBeGreaterThan(0);
  });
});
