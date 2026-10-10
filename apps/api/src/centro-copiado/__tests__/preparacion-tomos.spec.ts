import { CentroCopiadoService } from '../centro-copiado.service';
import { preparacionesPorDocumento, type DocumentoInput } from '../adaptador';

const ctx = {
  productoId: 'producto',
  rutaAlternativaId: 'ruta',
  configPasoId: 'impresion',
  maquinaBnId: 'bn',
  maquinaColorId: 'color',
  cobraSetup: true,
  papeles: [],
};
const doc = (
  id: string,
  cambios: Partial<DocumentoInput> = {},
): DocumentoInput => ({
  id,
  nombre: `${id}.pdf`,
  paginas: 3,
  copias: 1,
  tamano: 'A4',
  tamanoAnchoMm: 210,
  tamanoAltoMm: 297,
  papelMateriaPrimaId: 'papel',
  gramaje: 80,
  color: 'BN',
  faz: 2,
  grupoId: 'T',
  ...cambios,
});

it('cobra una preparación por tirada consecutiva y por tomo, independiente de las copias y cobertura', () => {
  const docs = [
    doc('a'),
    doc('b', { copias: 30, cobertura: 'borrador' }),
    doc('c', { color: 'COLOR' }),
    doc('d'),
    doc('e', { grupoId: 'otro' }),
    doc('f', { grupoId: null }),
  ];
  expect([...preparacionesPorDocumento(docs, ctx).values()]).toEqual([
    true,
    false,
    true,
    true,
    true,
    true,
  ]);
  expect([
    ...preparacionesPorDocumento(docs, { ...ctx, cobraSetup: false }).values(),
  ]).toEqual([false, false, false, false, false, false]);
});

it.each([
  { papelMateriaPrimaId: 'otro' },
  { gramaje: 120 },
  { tamanoAnchoMm: 297, tamanoAltoMm: 420 },
  { faz: 1 as const },
  { color: 'COLOR' as const },
])('un cambio productivo %j necesita otra preparación', (cambio) => {
  expect(
    preparacionesPorDocumento([doc('a'), doc('b', cambio)], ctx).get('b'),
  ).toBe(true);
});

/** Motor controlado: permite verificar importes, no sólo flags internos.
 * Conserva el adaptador, agregación, IVA, costos y metadata reales del servicio.
 */
it.each([1, 10])(
  'preview y tomo persistible coinciden: cinco originales, %i juegos y un setup',
  async (juegos) => {
    const cotizar = jest.fn(
      async ({ jobContext }: { jobContext: Record<string, unknown> }) => {
        const hojas = Number(jobContext.cantidad);
        const neto = hojas * 10 + (jobContext.omitirSetupCleanup ? 0 : 100);
        return {
          exitoso: true,
          cotizacion: {
            pasos: [
              {
                familiaCodigo: 'impresion_por_hoja',
                outputsCanonicos: { pliegos_impresos: hojas },
              },
            ],
            costos: {
              tiempoTotal: neto,
              materialesTotal: 0,
              cargosDirectosTotal: 0,
              tercerizadoTotal: 0,
              total: neto,
              unitario: neto / hojas,
            },
            desglosePrecio: {
              precioBase: neto,
              totalComisiones: 0,
              precioNetoTotal: neto,
              precioBrutoTotal: neto * 1.21,
            },
            precio: { precioTotal: neto * 1.21 },
            cantidadComercialPricing: 1,
          },
        };
      },
    );
    const service = new CentroCopiadoService(
      {} as never,
      { cotizar } as never,
      undefined,
      undefined,
      undefined,
      { exigirTodas: jest.fn() } as never,
    );
    const internas = service as unknown as {
      contexto: () => Promise<unknown>;
      validarOperacion: () => Promise<void>;
      resolverPapel: () => unknown;
    };
    jest.spyOn(internas, 'contexto').mockResolvedValue(ctx);
    jest.spyOn(internas, 'validarOperacion').mockResolvedValue(undefined);
    jest
      .spyOn(internas, 'resolverPapel')
      .mockReturnValue({ varianteId: 'variante', label: 'Obra' });
    const dto = {
      documentos: ['a', 'b', 'c', 'd', 'e'].map((id) => doc(id)),
      grupos: [{ id: 'T', juegos, terminaciones: [] }],
    };
    const preview = await service.cotizar('tenant', dto);
    const construido = await service.construirItems('tenant', dto);
    const esperado = 5 * 2 * juegos * 10 + 100;
    expect(preview.totales.subtotal).toBe(esperado);
    expect(construido.items).toHaveLength(1);
    expect(construido.items[0].subtotal).toBe(esperado);
    expect(construido.items[0].total).toBeCloseTo(esperado * 1.21, 2);
    expect(construido.items[0].cotizacion?.costos.total).toBe(esperado);
    expect(
      cotizar.mock.calls.filter(([c]) => !c.jobContext.omitirSetupCleanup),
    ).toHaveLength(2); // una en cada recorrido
  },
);
