// Sin base, red ni datos de empresas. Debe correr en la imagen final Linux:
// una prueba en macOS no detecta que el contenedor carece de fuentes.
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { renderizarEtiquetas } = require('../../dist/src/impresion/etiqueta-ot');

async function anchoTitulo(png) {
  const { data, info } = await sharp(png)
    .extract({ left: 42, top: 30, width: 716, height: 80 })
    .greyscale()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minimo = info.width;
  let maximo = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] < 128) {
        minimo = Math.min(minimo, x);
        maximo = Math.max(maximo, x);
      }
    }
  }
  assert.ok(maximo >= minimo, 'La etiqueta no tiene texto visible.');
  return maximo - minimo + 1;
}

async function main() {
  const datos = {
    numero: 'OT-2026-0001',
    cliente: 'María Muñoz',
    fechaEntrega: new Date('2026-09-30T00:00:00Z'),
    logo: null,
    productos: [{ nombre: 'Impresión gráfica', cantidad: 4.04, unidad: 'm²' }],
  };
  const [estrecho] = await renderizarEtiquetas({ ...datos, empresa: 'IIIIIIII' });
  const [ancho] = await renderizarEtiquetas({ ...datos, empresa: 'WWWWWWWW' });
  // Sin fuente, Pango dibuja la misma caja para cada carácter: los anchos son
  // iguales aunque el PNG sea válido. W debe ocupar claramente más que I.
  assert.ok(
    await anchoTitulo(ancho) > (await anchoTitulo(estrecho)) * 1.5,
    'Falta una fuente proporcional legible en las etiquetas.',
  );
  const zonaQr = { left: 250, top: 850, width: 300, height: 275 };
  assert.deepEqual(
    await sharp(estrecho).extract(zonaQr).raw().toBuffer(),
    await sharp(ancho).extract(zonaQr).raw().toBuffer(),
    'El contenido del QR debe mantenerse independiente del texto.',
  );
  console.log('OK: texto visible con glifos proporcionales y QR conservado.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
