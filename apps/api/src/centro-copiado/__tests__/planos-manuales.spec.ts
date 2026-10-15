import { CentroCopiadoCadService } from '../centro-copiado-cad.service';
import type { DocumentoInput } from '../adaptador';
import { calcularComercialCad } from '../comercial/calculo-cad';
import {
  filaCad,
  pedidoCad,
  tarifarioCad,
} from '../comercial/__tests__/fixtures-cad';
import { calcularPedidoCopiado } from '../pedidos/calculo-pedido';
import { contenidoEjemplo } from '../tarifarios/__tests__/fixtures';

const perfil = {
  id: 'perfil-ficticio',
  revision: 'a'.repeat(64),
  productoId: 'producto-ficticio',
  rutaAlternativaId: 'ruta-ficticia',
  configPasoId: 'paso-ficticio',
  maquinaId: 'plotter-ficticio',
  materialVarianteId: 'rollo-ficticio',
  papelMateriaPrimaId: 'papel-ficticio',
  gramaje: 80,
  color: 'BN' as const,
  materialNombre: 'Papel de prueba',
  maquinaNombre: 'Plotter de prueba',
  rollo: { anchoRolloMm: 610, margenMm: 5 },
};
function plano(copias = 1) {
  return {
    id: 'plano-manual',
    nombre: 'Plano de prueba',
    modo: 'CAD' as const,
    cad: { cotizacion: { id: perfil.id, revision: perfil.revision } },
    paginas: 1,
    copias,
    tamano: 'CAD',
    tamanoAnchoMm: 594,
    tamanoAltoMm: 841,
    medidasPaginas: [{ anchoMm: 594, altoMm: 841 }],
    papelMateriaPrimaId: perfil.papelMateriaPrimaId,
    gramaje: 80,
    color: 'BN' as const,
    faz: 1 as const,
    cobertura: 'alta',
  };
}
function entorno() {
  const motor = {
    cotizar: jest.fn().mockResolvedValue({
      exitoso: true,
      cotizacion: {
        costos: { total: 100 },
        desglosePrecio: { precioNetoTotal: 200, precioBrutoTotal: 242 },
      },
    }),
  };
  const servicio = new CentroCopiadoCadService(
    {} as never,
    { configuraciones: () => Promise.resolve([perfil]) } as never,
    motor as never,
    { exigirTodas: jest.fn() } as never,
  );
  return { servicio, motor };
}
const comercial = (doc: DocumentoInput) => ({
  ...doc,
  modo: 'CAD' as const,
  gramaje: 80,
  rolloProduccion: perfil.rollo,
});

it.each([
  [1, '0.851', '0', '4255.00'],
  [5, '4.255', '4', '17020.00'],
  [10, '8.51', '4', '34040.00'],
])(
  'construye %s planos manuales y aplica el mismo tarifario que al PDF',
  async (copias, ml, desde, total) => {
    const { servicio, motor } = entorno();
    const doc = plano(Number(copias));
    const item = await servicio.construir(
      'empresa-demo',
      doc,
      'carga-demo',
      null,
    );
    expect(item.error).toBeNull();
    expect(item.cantidad).toBe(copias);
    expect(item.especificaciones).toMatchObject({
      Plano: doc.nombre,
      Origen: 'Carga manual',
    });
    expect(item.especificaciones).not.toHaveProperty('Archivo');
    expect(motor.cotizar).toHaveBeenCalledWith(
      expect.objectContaining({
        productoId: perfil.productoId,
        rutaAlternativaId: perfil.rutaAlternativaId,
        jobContext: expect.objectContaining({
          cantidad: copias,
          piezas: [{ cantidad: copias, anchoMm: 594, altoMm: 841 }],
          _centroCopiado: expect.objectContaining({
            modo: 'CAD',
            paginas: 1,
            copias,
            medidasPaginas: doc.medidasPaginas,
          }) as unknown,
        }) as unknown,
      }),
    );
    // El contexto que se guarda en la OT permite volver a construir la fila sin PDF.
    const contexto = item.jobContext._centroCopiado as DocumentoInput;
    const reabierto = await servicio.construir(
      'empresa-demo',
      { ...contexto, id: doc.id },
      'carga-demo',
      null,
    );
    expect(reabierto.error).toBeNull();
    expect(reabierto.jobContext).toEqual(item.jobContext);

    const pdf = {
      ...doc,
      archivoNombre: 'plano-ficticio.pdf',
      paginasOriginales: 1,
    };
    const calcular = (d: DocumentoInput) =>
      calcularComercialCad(pedidoCad([comercial(d)]), tarifarioCad());
    expect(calcular(doc)).toEqual(calcular(pdf));
    expect(calcular(doc).grupos[0]).toMatchObject({
      cantidadParaTramo: ml,
      tramo: { desdeCantidad: desde },
    });
    const contenido = contenidoEjemplo();
    contenido.cad!.rangosGenerales = ['0', '4'];
    contenido.cad!.filas = [{ ...filaCad(), precios: [...filaCad().precios] }];
    const pedido = calcularPedidoCopiado({
      referencia: {
        tenantId: 'empresa-demo',
        tarifarioId: 'tarifa-demo',
        versionId: 'v1',
        modalidad: 'TARIFARIO',
        politicaRevision: 1,
        canalVenta: 'mostrador',
        monedaCodigo: 'ARS',
      },
      contenido,
      decimales: 2,
      tratamientoFiscal: 'FISCAL',
      lineas: [
        {
          id: 'linea-demo',
          documentos: [comercial(doc)],
          ivaPorcentaje: '21',
          costoImpresion: '100',
          costoTerminaciones: '0',
          terminacionesNeto: '0',
          acuerdoImpresionNeto: null,
          cargas: [],
          descuento: null,
        },
      ],
    });
    expect(pedido.estado).toBe('CALCULADO');
    expect(pedido.composicion.total?.total).toBe(total);
    expect(pedido.precios[0].precio?.total).toBe(total);
  },
);

it.each<Partial<DocumentoInput>>([
  { medidasPaginas: undefined },
  { medidasPaginas: [{ anchoMm: 0, altoMm: 841 }] },
  { medidasPaginas: [{ anchoMm: -1, altoMm: 841 }] },
  { medidasPaginas: [{ anchoMm: NaN, altoMm: 841 }] },
  { medidasPaginas: [{ anchoMm: 594, altoMm: Infinity }] },
  { medidasPaginas: [{ anchoMm: 594, altoMm: 100001 }] },
  { medidasPaginas: [{ anchoMm: 700, altoMm: 700 }] },
  {
    paginas: 2,
    medidasPaginas: [
      { anchoMm: 594, altoMm: 841 },
      { anchoMm: 420, altoMm: 594 },
    ],
  },
  { paginasOriginales: 1 },
  { rangoPaginas: '1' },
  { copiasPorPagina: [] },
  { archivoBytes: 200 },
  { archivoNombre: 'plano.txt', paginasOriginales: 1 },
  { archivoNombre: 'plano.pdf' },
  { copias: 0 },
  { copias: 1.5 },
  { copias: 10001 },
  { faz: 2 },
  { grupoId: 'tomo-demo' },
])('rechaza la fila inválida sin cotizar: %j', async (cambio) => {
  const { servicio, motor } = entorno();
  const doc = { ...plano(), ...cambio };
  const r = await servicio.construir('empresa-demo', doc, 'carga-demo', null);
  expect(r.error).toBeTruthy();
  expect(motor.cotizar).not.toHaveBeenCalled();
  expect(() =>
    calcularComercialCad(pedidoCad([comercial(doc)]), tarifarioCad()),
  ).toThrow();
});

it('conserva la validación del perfil y de su revisión en filas manuales', async () => {
  const { servicio, motor } = entorno();
  const r = await servicio.construir(
    'empresa-demo',
    {
      ...plano(),
      cad: { cotizacion: { id: perfil.id, revision: 'b'.repeat(64) } },
    },
    'carga-demo',
    null,
  );
  expect(r.error).toContain('cambió');
  expect(motor.cotizar).not.toHaveBeenCalled();
});
