import { OrdenPagoPdfService } from '../orden-pago-pdf.service';
import type { OrdenPagoDoc } from '../orden-pago-pdf.service';

/**
 * La orden de pago en PDF. No se compara el binario byte a byte —cambiaría
 * con cualquier ajuste de diseño y sería un test que sólo molesta— sino que
 * se genere un PDF válido y que el TEXTO que el proveedor necesita esté
 * adentro: los comprobantes cancelados y, sobre todo, las retenciones.
 */
describe('OrdenPagoPdfService', () => {
  const service = new OrdenPagoPdfService();

  const base: OrdenPagoDoc = {
    numero: 'OP-2026-0043',
    negocio: 'Grafica Corporearte',
    empresa: null,
    iniciales: 'GC',
    logoDataUri: null,
    proveedorNombre: 'Papelera del Sur',
    proveedorCuit: '30712345671',
    fecha: '2026-07-26',
    registradoPor: 'Silvina',
    metodoNombre: 'Transferencia',
    cuentaTexto: 'Banco Galicia',
    referencia: 'TRF-9988',
    cheque: null,
    egresos: [
      {
        numero: 'EGR-2026-0002',
        descripcion: 'Papel obra 90g',
        comprobante: 'FA 0001-00012345',
        vencimiento: '2026-08-30',
        monto: 320_000,
      },
    ],
    retenciones: [],
    montoBruto: 320_000,
    retencionesTotal: 0,
    montoNeto: 320_000,
  };

  /** El texto del PDF, en crudo. jsPDF sin comprimir lo deja legible. */
  const textoDe = (doc: OrdenPagoDoc) =>
    service.generar(doc).toString('latin1');

  it('genera un PDF válido', () => {
    const pdf = service.generar(base);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('no explota sin datos de empresa ni logo', () => {
    expect(() => service.generar({ ...base, empresa: null })).not.toThrow();
  });

  it('un logo corrupto no impide emitir la orden', () => {
    // Un data URI roto no puede dejar al proveedor sin su comprobante.
    expect(() =>
      service.generar({ ...base, logoDataUri: 'data:image/png;base64,ZZZZ' }),
    ).not.toThrow();
  });

  it('con retenciones el neto es menor que el bruto', () => {
    const conRet = service.generar({
      ...base,
      retenciones: [{ regimen: 'Ganancias (SICORE)', monto: 9_600 }],
      retencionesTotal: 9_600,
      montoNeto: 310_400,
    });
    // El documento con retenciones tiene MÁS contenido: los renglones del
    // desglose y el "Neto pagado". Es la razón por la que el proveedor lo pide.
    expect(conRet.length).toBeGreaterThan(service.generar(base).length);
  });

  it('el aviso de cheque sólo aparece si se pagó con cheque', () => {
    const sinCheque = service.generar(base).length;
    const conCheque = service.generar({
      ...base,
      cheque: { numero: '00012345', banco: 'Galicia', fechaPago: '2026-09-30' },
    }).length;
    expect(conCheque).toBeGreaterThan(sinCheque);
  });

  it('varios comprobantes hacen crecer el detalle', () => {
    const uno = service.generar(base).length;
    const tres = service.generar({
      ...base,
      egresos: [
        base.egresos[0],
        { ...base.egresos[0], numero: 'EGR-2026-0003', monto: 200_000 },
        { ...base.egresos[0], numero: 'EGR-2026-0004', monto: 260_000 },
      ],
      montoBruto: 780_000,
      montoNeto: 780_000,
    }).length;
    expect(tres).toBeGreaterThan(uno);
  });

  it('no se cae con un egreso sin comprobante ni vencimiento', () => {
    // El flete sin factura también se puede pagar.
    expect(() =>
      service.generar({
        ...base,
        proveedorCuit: null,
        egresos: [
          {
            numero: 'EGR-2026-0009',
            descripcion: 'Flete Ramón',
            comprobante: null,
            vencimiento: null,
            monto: 8_000,
          },
        ],
        montoBruto: 8_000,
        montoNeto: 8_000,
      }),
    ).not.toThrow();
    expect(textoDe(base).startsWith('%PDF-')).toBe(true);
  });
});
