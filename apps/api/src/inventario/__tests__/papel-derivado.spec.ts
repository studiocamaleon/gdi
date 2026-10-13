import {
  planPapelDerivado,
  leerPapelDerivado,
  pliegosPapel,
  sobrantePapel,
  sobrantesDelConsumo,
  cantidadPapelCortado,
} from '../papel-derivado';
import { REGISTRO_COMPRA_SUSTRATO } from '../../motor-universal/primitivas';
import { proyectarMaterialesOrden } from '../../ordenes-trabajo/materiales-orden.proyeccion';

const convertir = (q: number, ancho: number, alto: number, copiado = true) =>
  REGISTRO_COMPRA_SUSTRATO.pliegos_a_hojas(
    q,
    'sustrato_principal',
    { conservaSobrantePapel: copiado } as never,
    { pliego_impresion_ancho_mm: 210, pliego_impresion_alto_mm: 297 } as never,
    null,
    { atributosVarianteJson: { anchoMm: ancho, altoMm: alto } },
  );

describe('Costo y soportes de papel derivado', () => {
  it.each([
    [1, 1, 8],
    [5, 1, 4],
    [10, 2, 8],
  ])('opalina: %s A4, %s pliegos y %s A4 restantes', (q, padres, resto) => {
    const cantidad = convertir(q, 650, 950);
    expect(cantidad * 360).toBeCloseTo(q * 40, 8);
    const p = planPapelDerivado(
      cantidad,
      { anchoMm: 650, altoMm: 950 },
      210,
      297,
    )!;
    expect(p.hojasNecesarias).toBe(q);
    expect(pliegosPapel(p)).toBe(padres);
    expect(sobrantePapel(p)).toBe(resto);
  });
  it.each([
    [1, 1, 1],
    [5, 3, 1],
    [10, 5, 0],
  ])('SRA3: %s A4, %s hojas y %s restantes', (q, padres, resto) => {
    const cantidad = convertir(q, 325, 475);
    expect(cantidad * 80).toBe(q * 40);
    const p = planPapelDerivado(
      cantidad,
      { anchoMm: 325, altoMm: 475 },
      210,
      297,
    )!;
    expect(pliegosPapel(p)).toBe(padres);
    expect(sobrantePapel(p)).toBe(resto);
  });
  it('mantiene el redondeo del catálogo y un papel ya A4 no se vuelve a dividir', () => {
    expect(convertir(1, 650, 950, false)).toBe(1);
    expect(convertir(5, 325, 475, false)).toBe(3);
    expect(convertir(5, 210, 297)).toBe(5);
    expect(
      planPapelDerivado(5, { anchoMm: 210, altoMm: 297 }, 210, 297),
    ).toBeUndefined();
  });
  it('rechaza planes incoherentes y redondea la merma a hojas utilizables', () => {
    const p = planPapelDerivado(
      (5 / 9) * 1.02,
      { anchoMm: 650, altoMm: 950 },
      210,
      297,
    )!;
    expect(p.hojasNecesarias).toBe(6);
    expect(leerPapelDerivado({ ...p, rendimiento: 10 })).toBeUndefined();
    expect(leerPapelDerivado({ ...p, hojasNecesarias: 5.2 })).toBeUndefined();
  });
  it('al reutilizar papel cortado costea y consume hojas enteras, incluida la merma', () => {
    const attrs = { _papelDerivado: { version: 1 } };
    expect(cantidadPapelCortado(5 * 1.02, attrs)).toBe(6);
    expect(cantidadPapelCortado(5, attrs)).toBe(5);
    expect(cantidadPapelCortado(5.1, {})).toBeUndefined();
  });
  it('en un consumo parcial devuelve el sobrante una única vez al completar el plan', () => {
    const p = planPapelDerivado(
      10 / 9,
      { anchoMm: 650, altoMm: 950 },
      210,
      297,
    )!;
    expect(sobrantesDelConsumo([p], 0, 1)).toEqual([]);
    expect(sobrantesDelConsumo([p], 1, 1)).toEqual([{ plan: p, hojas: 8 }]);
    expect(sobrantesDelConsumo([p], 2, 1)).toEqual([]);
  });
  it('agrupa documentos A4 en una sola compra física sin alterar sus costos', () => {
    const p = planPapelDerivado(
      1 / 9,
      { anchoMm: 650, altoMm: 950 },
      210,
      297,
    )!;
    const items = [1, 2].map((n) => ({
      id: String(n),
      nombre: 'Documento',
      parentItemId: null,
      contieneLotesEntrega: false,
      cotizacionItem: null,
      pasos: [],
      trazabilidadSnapshotJson: {
        pasos: [
          {
            rutaPasoId: 'imprimir',
            materiales: [
              {
                tipoLineaCosto: 'MATERIAL',
                materialVarianteId: 'papel',
                materialDisplayName: 'Opalina',
                cantidad: 1 / 9,
                unidad: 'hoja',
                contextoUnidadesSnapshot: {
                  unidadStock: 'HOJA',
                  unidadCompra: 'HOJA',
                },
                papelDerivado: p,
              },
            ],
          },
        ],
      },
    }));
    const n = proyectarMaterialesOrden('orden', items).necesidades[0];
    expect(n.estado).toBe('calculada');
    expect(n.cantidad).toBe(1);
    expect(n.origenes[0].papelDerivado?.hojasNecesarias).toBe(2);
    expect(p.hojasNecesarias).toBe(1); // no muta el snapshot compartido
  });
});
