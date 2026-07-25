import { EstadoCuentaPdfService } from '../estado-cuenta-pdf.service';

/**
 * El logo del tenant en el estado de cuenta.
 *
 * Era el único PDF del sistema que no lo llevaba: la factura, el recibo, el
 * presupuesto y el seguimiento público ya lo dibujaban. Ver
 * docs/pdf-sin-puppeteer-diseno.md
 *
 * Lo que se fija acá es que el logo ENTRE al documento y —sobre todo— que uno
 * roto no impida emitirlo: un cliente pidiendo su estado de cuenta no puede
 * quedarse sin él porque alguien subió un PNG cortado.
 */

/** PNG de 1×1 transparente, el mínimo que jsPDF acepta. */
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** Espejo de lo que devuelve CuentaCorrienteService.obtener(). */
const CC = {
  cliente: {
    id: 'c1',
    nombre: 'Imprenta Imagen',
    razonSocial: 'Imprenta Imagen SRL',
    cuit: null,
    condicionFiscal: 'RI',
    limiteCredito: null,
    vendedor: null,
  },
  saldo: 120000,
  comprobantesPendientes: 1,
  usoLimitePct: null,
  excedido: false,
  excedente: 0,
  aging: [],
  agingTotal: 0,
  movimientos: [],
} as never;

describe('estado de cuenta · logo del tenant', () => {
  const service = new EstadoCuentaPdfService();
  const FECHA = new Date('2026-07-25T12:00:00Z');

  it('lo embebe cuando hay logo', () => {
    const con = service.generar(CC, null, FECHA, PNG_1PX);
    const sin = service.generar(CC, null, FECHA, null);

    expect(con.length).toBeGreaterThan(sin.length);
  });

  it('sin logo sigue saliendo', () => {
    expect(service.generar(CC, null, FECHA, null).length).toBeGreaterThan(0);
  });

  /**
   * La regla que comparten los cuatro PDF: un logo roto NO puede impedir que
   * salga el documento. Se avisa por log y se dibuja sin él.
   */
  it('un logo corrupto no tumba el documento', () => {
    const roto = service.generar(
      CC,
      null,
      FECHA,
      'data:image/png;base64,ESTO-NO-ES-BASE64',
    );
    expect(roto.length).toBeGreaterThan(0);
  });

  /** jsPDF no rasteriza SVG: se ignora en vez de explotar. */
  it('ignora un SVG', () => {
    const svg = 'data:image/svg+xml;base64,PHN2Zy8+';
    const conSvg = service.generar(CC, null, FECHA, svg);
    const sin = service.generar(CC, null, FECHA, null);

    expect(conSvg.length).toBe(sin.length);
  });
});
