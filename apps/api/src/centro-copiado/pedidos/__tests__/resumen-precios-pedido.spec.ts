import { resumirPreciosCopiado } from '../resumen-precios-pedido';
import {
  calcularPedidoCopiado,
  type LineaPedidoCopiado,
} from '../calculo-pedido';
import { contenidoEjemplo } from '../../tarifarios/__tests__/fixtures';
import { documento } from '../../comercial/__tests__/fixtures';
import { documentoCad, filaCad } from '../../comercial/__tests__/fixtures-cad';

const papel = '00000000-0000-4000-8000-000000000001';
const referencia = {
  tenantId: 'empresa-ficticia',
  tarifarioId: 'tarifa',
  versionId: 'version',
  modalidad: 'TARIFARIO' as const,
  politicaRevision: 1,
  canalVenta: 'mostrador' as const,
  monedaCodigo: 'ARS',
};
function caso(paginas = 2) {
  const contenido = contenidoEjemplo(papel);
  contenido.hojas!.filas[0].precios = [
    { desdeCantidad: 1, precioUnitario: '121' },
    { desdeCantidad: 100, precioUnitario: '96.8' },
  ];
  const lineas: LineaPedidoCopiado[] = [
    {
      id: 'carga-a',
      documentos: [
        documento('doc-a', { papelMateriaPrimaId: papel, paginas, faz: 2 }),
      ],
      ivaPorcentaje: '21',
      costoImpresion: '900',
      costoTerminaciones: '0',
      terminacionesNeto: '0',
      acuerdoImpresionNeto: null,
      cargas: [],
      descuento: null,
    },
  ];
  return {
    referencia,
    contenido,
    lineas,
    decimales: 2,
    tratamientoFiscal: 'FISCAL' as const,
  };
}
function resumen(i: ReturnType<typeof caso>, sinComprobante = false) {
  const calculado = calcularPedidoCopiado(i);
  return resumirPreciosCopiado({
    tenantId: referencia.tenantId,
    contenido: i.contenido,
    lineas: i.lineas,
    precios: calculado.precios,
    nombresPapeles: { [papel]: 'Obra' },
    sinComprobante,
    decimales: 2,
  });
}
it('acumula cargas compatibles y muestra el rango y el importe final guardado por hoja', () => {
  const i = caso(100);
  i.lineas.push({
    ...i.lineas[0],
    id: 'carga-b',
    documentos: [
      documento('doc-b', { papelMateriaPrimaId: papel, paginas: 100, faz: 2 }),
    ],
  });
  expect(resumen(i)).toEqual([
    expect.objectContaining({
      papel: 'Obra · 80 g',
      detalle: 'A4 · B/N · Doble faz',
      desde: '100',
      hasta: null,
      cantidad: '100',
      precioFinal: '96.80000000',
      totalImpresion: '9680.00',
    }),
  ]);
});
it.each(['INCLUIDO', 'MAS_IVA'] as const)(
  'resuelve el precio final con IVA %s y sin comprobante sin duplicarlo',
  (iva) => {
    const i = caso();
    i.contenido.composicion.iva = iva;
    i.contenido.hojas!.filas[0].precios[0].precioUnitario =
      iva === 'INCLUIDO' ? '121' : '100';
    expect(resumen(i)[0].precioFinal).toBe('121.00000000');
    expect(resumen(i, true)[0].precioFinal).toBe('100.00000000');
  },
);
it('incluye preparación, mínimo, acuerdo y descuento de impresión, excluyendo terminaciones', () => {
  const i = caso(4);
  i.lineas[0].acuerdoImpresionNeto = '80';
  i.lineas[0].descuento = { tipo: 'PORCENTAJE', valor: '50' };
  i.lineas[0].terminacionesNeto = '200';
  i.contenido.composicion.preparacion = {
    modalidad: 'FIJA_PEDIDO',
    importe: '12.1',
  };
  i.contenido.composicion.minimo = {
    modalidad: 'IMPORTE_PEDIDO',
    importe: '121',
  };
  expect(resumen(i)[0]).toMatchObject({
    cantidad: '2',
    totalImpresion: '121.00',
    precioFinal: '60.50000000',
  });
});
it('no confunde carillas con hojas físicas y separa la última hoja simple', () => {
  const i = caso(3);
  i.contenido.hojas!.reglas.unidad = 'CARILLA';
  expect(resumen(i)[0]).toMatchObject({
    unidadRango: 'CARILLA',
    unidadPrecio: 'HOJA',
    cantidad: '2',
    totalImpresion: '363.00',
    precioFinal: '181.50000000',
  });
  i.contenido.hojas!.reglas.unidad = 'HOJA';
  i.contenido.hojas!.reglas.ultimaHojaImpar = 'COBRAR_SIMPLE';
  i.contenido.hojas!.filas.push({
    ...i.contenido.hojas!.filas[0],
    combinacion: { ...i.contenido.hojas!.filas[0].combinacion, faz: 1 },
    precios: [{ desdeCantidad: 1, precioUnitario: '60.5' }],
  });
  const r = resumen(i);
  expect(r).toHaveLength(2);
  expect(r.map((g) => g.precioFinal).sort()).toEqual([
    '121.00000000',
    '60.50000000',
  ]);
  expect(r.reduce((s, g) => s + Number(g.totalImpresion), 0)).toBe(181.5);
});
it('conserva un cero explícito y no transforma un precio pendiente en gratuito', () => {
  const i = caso();
  i.contenido.hojas!.filas[0].precios[0].precioUnitario = '0';
  expect(resumen(i)[0].precioFinal).toBe('0.00000000');
  i.contenido.hojas!.filas[0].precios[0].precioUnitario = null;
  expect(resumen(i)[0].precioFinal).toBeNull();
});
it('CAD muestra metros facturados y el límite superior exclusivo del rango', () => {
  const i = caso();
  i.contenido.cad!.filas = [
    filaCad({ papelMateriaPrimaId: papel }, [
      { desdeCantidad: '0', precioUnitario: '5000' },
      { desdeCantidad: '10', precioUnitario: '4000' },
    ]),
  ];
  i.lineas[0].documentos = [
    documentoCad('plano', { papelMateriaPrimaId: papel }),
  ];
  const r = resumen(i);
  expect(r[0]).toMatchObject({
    unidadPrecio: 'ML',
    unidadRango: 'ML',
    hastaExclusivo: true,
    desde: '0',
    hasta: '10',
  });
  expect(r[0].detalle).toContain('Rollo');
});
it('leer el resumen conserva precios históricos aunque difieran del precio unitario de referencia', () => {
  const i = caso(4);
  const r = calcularPedidoCopiado(i);
  r.precios[0].precio!.impresionTotal = '88.00';
  const tabla = resumirPreciosCopiado({
    tenantId: referencia.tenantId,
    contenido: i.contenido,
    lineas: i.lineas,
    precios: r.precios,
    nombresPapeles: { [papel]: 'Obra' },
    sinComprobante: false,
    decimales: 2,
  });
  expect(tabla[0].precioFinal).toBe('44.00000000');
});
