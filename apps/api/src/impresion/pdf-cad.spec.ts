import { PDFDocument, PDFName, PDFNumber, degrees } from 'pdf-lib';
import { geometriaCad, prepararPaginaCad } from './pdf-cad';
import { planDocumento } from './documentos-orden.domain';
import { resolverPerfil } from './perfiles-impresion.domain';
import { perfilPrueba } from './perfiles-impresion.fixture';
const PT = 72 / 25.4;
const config = {
  anchoRolloMm: 914,
  margenMm: 5,
  origenPapel: 'Roll',
  usarOrigenPredeterminado: false,
};
it.each([0, 90, 180, 270])(
  'preserva tamaño físico, CropBox desplazado y UserUnit con Rotate=%s',
  async (giro) => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([450 * PT, 350 * PT]);
    page.setCropBox(10 * PT, 20 * PT, 400 * PT, 300 * PT);
    page.setRotation(degrees(giro));
    page.node.set(PDFName.of('UserUnit'), PDFNumber.of(2));
    page.drawRectangle({
      x: 10 * PT,
      y: 20 * PT,
      width: 400 * PT,
      height: 300 * PT,
    });
    const g = geometriaCad(page);
    expect(g.medida.anchoMm).toBeCloseTo(giro % 180 ? 600 : 800, 8);
    expect(g.medida.altoMm).toBeCloseTo(giro % 180 ? 800 : 600, 8);
    // Los cuatro vértices del área visible llegan al origen y los bordes físicos.
    const [a, b, c, d, e, f] = g.matriz;
    const puntos = [
      [g.caja.left, g.caja.bottom],
      [g.caja.right, g.caja.bottom],
      [g.caja.left, g.caja.top],
      [g.caja.right, g.caja.top],
    ].map(([x, y]) => [(a * x + c * y + e) / PT, (b * x + d * y + f) / PT]);
    expect(Math.min(...puntos.map((p) => p[0]))).toBeCloseTo(0, 8);
    expect(Math.min(...puntos.map((p) => p[1]))).toBeCloseTo(0, 8);
    expect(Math.max(...puntos.map((p) => p[0]))).toBeCloseTo(
      g.medida.anchoMm,
      8,
    );
    expect(Math.max(...puntos.map((p) => p[1]))).toBeCloseTo(
      g.medida.altoMm,
      8,
    );
    const salida = await prepararPaginaCad(pdf, 1, g.medida, config);
    expect(salida.plan.escala).toBe(100);
    const real = await PDFDocument.load(salida.pdf);
    expect(real.getPageCount()).toBe(1);
    expect(real.getPage(0).getWidth() / PT).toBeCloseTo(914, 8);
    expect(real.getPage(0).getHeight() / PT).toBeCloseTo(610, 8);
    expect(real.getPage(0).getRotation().angle).toBe(0);
  },
);
it('rechaza medidas cambiadas, exceso de ancho y anotaciones que no puede conservar', async () => {
  const pdf = await PDFDocument.create(),
    page = pdf.addPage([910 * PT, 1200 * PT]);
  await expect(
    prepararPaginaCad(pdf, 1, { anchoMm: 900, altoMm: 1200 }, config),
  ).rejects.toThrow('cotizadas');
  await expect(
    prepararPaginaCad(pdf, 1, { anchoMm: 910, altoMm: 1200 }, config),
  ).rejects.toThrow('No se reducirá');
  page.setSize(300 * PT, 400 * PT);
  page.node.set(
    PDFName.of('Annots'),
    pdf.context.obj([{ Type: 'Annot', Subtype: 'Text' }]),
  );
  await expect(
    prepararPaginaCad(pdf, 1, { anchoMm: 300, altoMm: 400 }, config),
  ).rejects.toThrow('anotaciones');
});
const meta = {
  modo: 'CAD',
  nombre: 'Planos',
  archivoNombre: 'planos.pdf',
  paginas: 2,
  paginasOriginales: 3,
  rangoPaginas: '1,3',
  medidasPaginas: [
    { anchoMm: 594, altoMm: 841 },
    { anchoMm: 841, altoMm: 1189 },
    { anchoMm: 300, altoMm: 900 },
  ],
  copias: 1,
  copiasPorPagina: [
    { pagina: 1, copias: 3 },
    { pagina: 2, copias: 10 },
  ],
  hojas: 4,
  escala: 100,
  faz: 1,
  color: 'BN',
  tamano: 'CAD',
  gramaje: 80,
  papelMateriaPrimaId: 'papel',
  cad: { perfilId: 'cad', versionPerfil: 2, versionDestino: 3 },
  materialVarianteId: 'rollo',
  rutaAlternativaId: 'ruta',
};
it('despacha sólo las páginas seleccionadas con sus cantidades originales', () => {
  const p = planDocumento({ _centroCopiado: meta })!;
  expect(p.motivo).toBeNull();
  expect(p.hojas).toBe(4);
  expect(p.paginasCad?.map((p) => [p.pagina, p.copias])).toEqual([
    [1, 3],
    [3, 1],
  ]);
  expect(
    planDocumento({ _centroCopiado: { ...meta, hojas: 5 } })?.motivo,
  ).toContain('cantidades');
});
it('ruta CAD exige el perfil, variante, máquina y revisiones de la cotización', () => {
  const p = {
    ...structuredClone(perfilPrueba),
    id: 'cad',
    tamano: 'CAD',
    gramaje: 80,
    faz: 1,
    version: 2,
    cad: { materialVarianteId: 'rollo', rutaAlternativaId: 'ruta' },
  };
  Object.assign(p.bandeja.destino, { version: 3, cad: config });
  const d = planDocumento({ _centroCopiado: meta })!.configuracion;
  expect(resolverPerfil(d, [p], ['maquina']).estado).toBe('LISTO');
  expect(resolverPerfil(d, [p], ['otra']).estado).toBe('REVISAR');
  expect(
    resolverPerfil({ ...d, cad: { ...d.cad!, versionDestino: 2 } }, [p]).estado,
  ).toBe('REVISAR');
  expect(resolverPerfil(d, [{ ...p, modo: 'PREPARACION' }]).estado).toBe(
    'PREPARACION',
  );
});
