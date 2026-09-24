const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { fail } = require('./target.cjs');

async function main() {
  if (process.env.R2_ENDPOINT !== 'http://storage:9090' || process.env.PDF_RENDER_URL !== 'http://pdf-renderer:3000') {
    throw new Error('Este ensayo requiere los emuladores del Compose local.');
  }
  const { R2Driver } = require('../../dist/src/archivos/storage/r2.driver.js');
  const storage = new R2Driver();
  const key = `deploy-test/${randomUUID()}.txt`;
  try {
    const upload = await storage.firmarSubida(key, { contentType: 'text/plain' });
    const sent = await fetch(upload.url, { method: 'PUT', headers: upload.headers, body: 'ensayo-grafoprint', signal: AbortSignal.timeout(20000) });
    assert.ok(sent.ok);
    const url = await storage.firmarDescarga(key, { disposition: 'attachment' });
    const received = await fetch(url, { signal: AbortSignal.timeout(20000) });
    assert.ok(received.ok);
    assert.equal(await received.text(), 'ensayo-grafoprint');
  } finally { await storage.borrar(key); }

  const form = new FormData();
  form.append('files', new Blob(['<!doctype html><html><body><h1>Ensayo Grafoprint</h1></body></html>'], { type: 'text/html' }), 'index.html');
  const rendered = await fetch(`${process.env.PDF_RENDER_URL}/forms/chromium/convert/html`, {
    method: 'POST', body: form, signal: AbortSignal.timeout(60000),
  });
  assert.ok(rendered.ok);
  assert.equal(Buffer.from(await rendered.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  console.log('OK: subida/descarga firmada contra S3Mock y PDF real de Chromium.');
}

main().catch(fail);
