import { monedaDe } from '../../common/moneda';
import type { PresupuestoPdfDatos } from '../presupuesto-pdf.service';
import { presupuestoHtml, presupuestoFooter } from './presupuesto-html';
import { PresupuestoPilotoService } from './presupuesto-piloto.service';
import { PresupuestoRenderService } from './presupuesto-render.service';

const datos: PresupuestoPdfDatos = {
  numero: 'PRES-PRUEBA',
  negocio: 'Imprenta de prueba',
  cliente: 'Cliente',
  vendedor: null,
  fechaEmision: '2026-09-17T23:00:00Z',
  fechaValidez: '2026-09-30',
  observaciones: null,
  senaSugeridaPct: 50,
  condicionesTexto: null,
  subtotal: 1000,
  impuestos: 210,
  cargosDirectos: 0,
  total: 1210,
  items: [
    {
      nombre: 'Tarjetas',
      cantidad: 500,
      cantidadUnidad: 'u.',
      total: 1210,
      specs: [],
      adicionales: [],
    },
  ],
};

describe('presupuesto HTML', () => {
  it('preserva importes, moneda regional y fechas calendario sin recalcular el presupuesto', () => {
    const html = presupuestoHtml({
      ...datos,
      total: 1400.55,
      empresa: { moneda: monedaDe('USD') },
    });
    expect(html).toContain('US$ 1.400,55');
    expect(html).toContain('US$ 2,42');
    expect(html).toContain('17/09/2026');
    expect(html).toContain('30/09/2026');
    expect(html).toContain('50%');
    expect(
      presupuestoHtml({ ...datos, empresa: { moneda: monedaDe('CLP') } }),
    ).toContain('CLP $ 1.210');
  });

  it('escapa texto del tenant y nunca incorpora su URL de logo como recurso remoto', () => {
    const ataque = '<script>alert("x")</script>';
    const html = presupuestoHtml({
      ...datos,
      negocio: ataque,
      logoDataUri: 'http://localhost/private',
      observaciones: ataque,
      condicionesTexto: ataque,
      items: [
        {
          ...datos.items[0],
          nombre: ataque,
          specs: [{ etiqueta: ataque, valor: ataque }],
          adicionales: [ataque],
        },
      ],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('http://localhost/private');
    expect(html).toContain('&lt;script&gt;');
    expect(presupuestoFooter({ ...datos, negocio: ataque })).not.toContain(
      '<script>',
    );
  });

  it('incluye descuentos, canje, cargos y observaciones sin alterar el snapshot', () => {
    const snapshot = {
      ...datos,
      descuentoTotal: 100,
      cargosDirectos: 50,
      fidelizacionCanjePuntos: 20,
      fidelizacionCanjeMonto: 40,
      observaciones: 'Entregar embalado',
      fidelizacionPuntosEstimados: 10,
    };
    const original = JSON.stringify(snapshot);
    const html = presupuestoHtml(snapshot);
    for (const texto of [
      'AR$ 1.100,00',
      'AR$ -100,00',
      'AR$ -40,00',
      'Cargos directos',
      'Entregar embalado',
      '10 puntos',
    ]) {
      expect(html).toContain(texto);
    }
    expect(JSON.stringify(snapshot)).toBe(original);
  });
});

describe('caché acotado del piloto', () => {
  const env = {
    flag: process.env.PRESUPUESTO_PDF_PILOTO,
    url: process.env.PDF_RENDER_URL,
  };
  beforeEach(() => {
    process.env.PRESUPUESTO_PDF_PILOTO = 'true';
    process.env.PDF_RENDER_URL = 'http://renderer';
  });
  afterEach(() => {
    if (env.flag === undefined) delete process.env.PRESUPUESTO_PDF_PILOTO;
    else process.env.PRESUPUESTO_PDF_PILOTO = env.flag;
    if (env.url === undefined) delete process.env.PDF_RENDER_URL;
    else process.env.PDF_RENDER_URL = env.url;
    jest.restoreAllMocks();
  });
  const setup = () => {
    const generar = jest.fn().mockResolvedValue(Buffer.from('%PDF-prueba'));
    return {
      generar,
      service: new PresupuestoPilotoService({
        generar,
      } as unknown as PresupuestoRenderService, { exigir: jest.fn().mockResolvedValue(undefined) } as never),
    };
  };

  it('está deshabilitado por defecto', async () => {
    delete process.env.PRESUPUESTO_PDF_PILOTO;
    const { service, generar } = setup();
    await expect(service.generar('tenant', 'id', datos)).rejects.toThrow(
      'no habilitado',
    );
    expect(generar).not.toHaveBeenCalled();
  });

  it('deduplica simultáneos y reutiliza PDF; un cambio de datos, documento o tenant invalida la clave', async () => {
    const { service, generar } = setup();
    await Promise.all(
      Array.from({ length: 6 }, () => service.generar('A', '1', datos)),
    );
    await service.generar('A', '1', datos);
    expect(generar).toHaveBeenCalledTimes(1);
    await service.generar('B', '1', datos);
    await service.generar('A', '2', datos);
    await service.generar('A', '1', { ...datos, total: 99 });
    expect(generar).toHaveBeenCalledTimes(4);
  });

  it('vence a los cinco minutos y limita la cantidad de documentos guardados', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const { service, generar } = setup();
    await service.generar('A', '1', datos);
    now.mockReturnValue(301_001);
    await service.generar('A', '1', datos);
    expect(generar).toHaveBeenCalledTimes(2);
    for (let n = 2; n <= 17; n++) await service.generar('A', String(n), datos);
    await service.generar('A', '1', datos);
    expect(generar).toHaveBeenCalledTimes(19);
  });

  it('libera el pendiente al fallar para permitir un reintento', async () => {
    const { service, generar } = setup();
    generar.mockRejectedValueOnce(new Error('falló'));
    await expect(service.generar('A', '1', datos)).rejects.toThrow('falló');
    await expect(service.generar('A', '1', datos)).resolves.toBeInstanceOf(
      Buffer,
    );
    expect(generar).toHaveBeenCalledTimes(2);
  });

  it('rechaza exceso de trabajo y documentos que exceden los límites del piloto', async () => {
    const { service, generar } = setup();
    let terminar!: (pdf: Buffer) => void;
    generar.mockReturnValue(
      new Promise<Buffer>((resolve) => {
        terminar = resolve;
      }),
    );
    const pendientes = Array.from({ length: 8 }, (_, n) =>
      service.generar('A', String(n), datos),
    );
    await expect(service.generar('A', 'otro', datos)).rejects.toThrow(
      'ocupado',
    );
    await expect(
      service.generar('A', 'grande', {
        ...datos,
        items: Array.from({ length: 501 }, () => datos.items[0]),
      }),
    ).rejects.toThrow('límite');
    terminar(Buffer.from('%PDF-fin'));
    await Promise.all(pendientes);
  });
});
