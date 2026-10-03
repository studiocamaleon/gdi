import { PDFDocument, degrees, PDFName, PDFNumber } from 'pdf-lib';
import { unificarTomoPdf, type FuenteTomoPdf } from './tomo-pdf';
async function fuente(
  nombre: string,
  cantidad: number,
  cambios: Partial<FuenteTomoPdf> = {},
): Promise<FuenteTomoPdf> {
  const pdf = await PDFDocument.create();
  for (let i = 1; i <= cantidad; i++) {
    const p = pdf.addPage([300 + i, 450 + i]);
    p.node.set(PDFName.of('PaginaOriginal'), PDFNumber.of(i));
    p.setRotation(degrees(90));
    p.setCropBox(5, 6, 280 + i, 420 + i);
    p.drawText(`${nombre} - ${i}`);
  }
  const bytes = await pdf.save();
  return {
    nombre,
    paginas: cantidad,
    faz: 2,
    cargar: async () => bytes,
    ...cambios,
  };
}
it('respeta rangos, orden, rotaciones y tamaño del reverso; cierra también el último juego impar', async () => {
  const a = await fuente('A', 5, {
    paginas: 3,
    paginasOriginales: 5,
    rangoPaginas: '2-3,5',
  });
  const b = await fuente('B', 4, {
    paginas: 1,
    paginasOriginales: 4,
    rangoPaginas: '4',
  });
  const r = await unificarTomoPdf([a, b]);
  expect(r).toMatchObject({ paginas: 6, blancos: 2 });
  const pages = (await PDFDocument.load(r.bytes)).getPages();
  expect(
    pages.map(
      (p) => p.node.get(PDFName.of('PaginaOriginal'))?.toString() ?? null,
    ),
  ).toEqual(['2', '3', '5', null, '4', null]);
  expect(pages[3].getSize()).toEqual(pages[2].getSize());
  expect(pages[3].getCropBox()).toEqual(pages[2].getCropBox());
  expect(pages[3].getRotation()).toEqual(pages[2].getRotation());
  expect(pages[3].node.get(PDFName.of('Contents'))).toBeUndefined();
  const inverso = await unificarTomoPdf([b, a]);
  expect((await PDFDocument.load(inverso.bytes)).getPage(0).getWidth()).toBe(
    304,
  );
});
it('no agrega blancos a documentos pares ni a simple faz', async () => {
  expect(
    await unificarTomoPdf([await fuente('A', 2), await fuente('B', 4)]),
  ).toMatchObject({ paginas: 6, blancos: 0 });
  expect(
    await unificarTomoPdf([
      await fuente('A', 3, { faz: 1 }),
      await fuente('B', 1, { faz: 1 }),
    ]),
  ).toMatchObject({ paginas: 4, blancos: 0 });
});
it('rechaza rangos desactualizados, originales cambiados, PDF corruptos y caras mezcladas', async () => {
  await expect(
    unificarTomoPdf([await fuente('A', 5, { rangoPaginas: '1-2' })]),
  ).rejects.toThrow('rango');
  await expect(
    unificarTomoPdf([await fuente('A', 5, { paginas: 4 })]),
  ).rejects.toThrow('cambiaron');
  await expect(
    unificarTomoPdf([
      await fuente('A', 2, { cargar: async () => new Uint8Array([1, 2]) }),
    ]),
  ).rejects.toThrow('PDF válido');
  await expect(
    unificarTomoPdf([await fuente('A', 2), await fuente('B', 2, { faz: 1 })]),
  ).rejects.toThrow('misma cantidad de caras');
});
it('rechaza tomos excesivos antes de cargar los originales', async () => {
  const cargar = jest.fn();
  await expect(
    unificarTomoPdf([{ nombre: 'Grande', paginas: 5001, faz: 2, cargar }]),
  ).rejects.toThrow('5.000');
  expect(cargar).not.toHaveBeenCalled();
});
