import { PresupuestoRenderService } from './presupuesto-render.service';
import type { PresupuestoPdfDatos } from '../presupuesto-pdf.service';

const datos: PresupuestoPdfDatos = {
  numero: 'PRES-PRUEBA',
  negocio: 'Imprenta',
  cliente: null,
  vendedor: null,
  fechaEmision: null,
  fechaValidez: null,
  observaciones: null,
  senaSugeridaPct: null,
  condicionesTexto: null,
  subtotal: 0,
  impuestos: 0,
  cargosDirectos: 0,
  total: 0,
  items: [],
};

describe('adaptador de render HTML', () => {
  const url = process.env.PDF_RENDER_URL;
  beforeEach(() => {
    process.env.PDF_RENDER_URL = 'http://renderer/';
  });
  afterEach(() => {
    if (url === undefined) delete process.env.PDF_RENDER_URL;
    else process.env.PDF_RENDER_URL = url;
    jest.restoreAllMocks();
  });

  it('envía HTML, pie y fuentes autocontenidas y devuelve sólo el PDF validado', async () => {
    const pdf = Buffer.from('%PDF-1.4\nprueba');
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(new Uint8Array(pdf), {
        headers: { 'content-type': 'application/pdf' },
      }),
    );
    await expect(
      new PresupuestoRenderService().generar(datos),
    ).resolves.toEqual(pdf);
    const [destino, opciones] = fetchMock.mock.calls[0];
    expect(destino).toBe('http://renderer/forms/chromium/convert/html');
    const form = opciones?.body as FormData;
    expect(form.getAll('files').map((file) => (file as File).name)).toEqual([
      'index.html',
      'footer.html',
      'Geist-Regular.ttf',
      'Geist-Bold.ttf',
    ]);
    expect(form.get('printBackground')).toBe('true');
    expect(form.get('failOnResourceLoadingFailed')).toBe('true');
    expect(opciones?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [503, 'application/pdf', '%PDF-no disponible'],
    [200, 'text/html', '<html>Error</html>'],
    [200, 'application/pdf', 'no es un pdf'],
  ])(
    'convierte respuesta inválida %s/%s en error recuperable',
    async (status, type, body) => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(body, { status, headers: { 'content-type': type } }),
        );
      await expect(
        new PresupuestoRenderService().generar(datos),
      ).rejects.toThrow('No se pudo generar');
    },
  );

  it('limita el tamaño de salida y corta el pedido al excederlo', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(new Uint8Array(16 * 1024 * 1024 + 1), {
        headers: { 'content-type': 'application/pdf' },
      }),
    );
    await expect(new PresupuestoRenderService().generar(datos)).rejects.toThrow(
      'No se pudo generar',
    );
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});
