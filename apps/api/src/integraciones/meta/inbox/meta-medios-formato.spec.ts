import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { prepararMedioInbox } from './meta-medios-formato';
import { formatoArchivoInbox } from '../../../common/inbox/medios';
it('rechaza extensiones falsas y conserva los límites diferentes de cada familia', () => {
  expect(formatoArchivoInbox('arte.png', 'image/jpeg')).toBeNull();
  expect(
    formatoArchivoInbox('arte.psd', 'application/octet-stream'),
  ).toBeNull();
  expect(formatoArchivoInbox('arte.pdf', '')).toMatchObject({
    tipo: 'document',
    max: 100_000_000,
  });
});
it('verifica WebP y dimensiones reales para stickers', async () => {
  const bien = await sharp({
    create: { width: 512, height: 512, channels: 4, background: '#ff744400' },
  })
    .webp()
    .toBuffer();
  expect((await prepararMedioInbox(bien, 'image/webp')).mime).toBe(
    'image/webp',
  );
  const mal = await sharp(bien).resize(128, 128).webp().toBuffer();
  await expect(prepararMedioInbox(mal, 'image/webp')).rejects.toThrow('512');
});
it('no confía en el MIME de un archivo renombrado', async () => {
  await expect(
    prepararMedioInbox(Buffer.from('MZarchivo.exe'), 'application/pdf'),
  ).rejects.toThrow('formato');
});
it('convierte una grabación real a Opus mono y conserva los archivos de entrada', async () => {
  const origen = await readFile(
    resolve(
      __dirname,
      '../../../../../../src/app/dev/diseno/inbox/archivo/fixtures/tono.m4a',
    ),
  );
  const r = await prepararMedioInbox(origen, 'audio/mp4', true);
  expect(r.mime).toBe('audio/ogg');
  expect(r.bytes.subarray(0, 4).toString()).toBe('OggS');
  const head = r.bytes.indexOf('OpusHead');
  expect(head).toBeGreaterThan(0);
  expect(r.bytes[head + 9]).toBe(1);
}, 20000);
