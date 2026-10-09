const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFile } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { prepararMedioInbox } = require('../../dist/src/integraciones/meta/inbox/meta-medios-formato');

const ejecutar = (bin, args) => execFileSync(bin, args, {
  encoding: 'utf8', timeout: 10000, maxBuffer: 256 * 1024,
});
const hash = value => createHash('sha256').update(value).digest('hex');

async function main() {
  assert.match(ejecutar('ffmpeg', ['-version']), /^ffmpeg version 9\.0\.2\b/);
  const protocolos = ejecutar('ffmpeg', ['-hide_banner', '-protocols']);
  const nombres = protocolos.split('\n').map(x => x.trim()).filter(x => /^[a-z0-9]+$/.test(x));
  assert.deepEqual([...new Set(nombres)].sort(), ['file', 'pipe']);
  const decoders = ejecutar('ffmpeg', ['-hide_banner', '-decoders']);
  assert.doesNotMatch(decoders, /\b(dvdsub|dvvideo|hevc|vp9|rasc|tiff)\b/);
  const demuxers = ejecutar('ffmpeg', ['-hide_banner', '-demuxers']);
  assert.doesNotMatch(demuxers, /\b(hls|dash|concat|mpegps|image2|sdp|rtsp)\b/);
  const fixture = await readFile(process.argv[2]);
  const antes = hash(fixture);
  const normal = await prepararMedioInbox(fixture, 'audio/mp4');
  assert.equal(hash(normal.bytes), antes);
  const voz = await prepararMedioInbox(fixture, 'audio/mp4', true);
  assert.equal(voz.mime, 'audio/ogg');
  assert.equal(voz.bytes.subarray(0, 4).toString(), 'OggS');
  const header = voz.bytes.indexOf('OpusHead');
  assert(header >= 0);
  assert.equal(voz.bytes[header + 9], 1);
  assert.equal(hash(fixture), antes);
  // El resultado puede volver a validarse y convertirse como una grabación OGG.
  const ogg = await prepararMedioInbox(voz.bytes, 'audio/ogg');
  assert.equal(hash(ogg.bytes), hash(voz.bytes));
  assert.equal((await prepararMedioInbox(voz.bytes, 'audio/ogg', true)).mime, 'audio/ogg');
  await assert.rejects(() => prepararMedioInbox(Buffer.from('MZarchivo.exe'), 'audio/mp4'));
  await assert.rejects(() => prepararMedioInbox(Buffer.from('#EXTM3U\nhttp://127.0.0.1/privado'), 'audio/mp4', true));
  console.log('Multimedia comprobada: versión, protocolos, formatos, voz Opus mono, rechazo de archivos inválidos.');
}

main().catch(error => {
  console.error('No pasó el ensayo multimedia:', error.name);
  process.exitCode = 1;
});
