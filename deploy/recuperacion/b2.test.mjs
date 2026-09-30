import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DestinoB2 } from './lib/b2.mjs';
import { CAPACIDADES_COPIADOR } from './validar-destino.mjs';

const env = { RESPALDO_B2_KEY_ID: 'demo-id', RESPALDO_B2_KEY: 'secreto-ficticio', RESPALDO_B2_ACCOUNT_ID: 'cuenta',
  RESPALDO_B2_BUCKET_ID: 'bucket', RESPALDO_ENTORNO: 'staging' };
const ref = { fileId: 'version-1', fileName: 'staging/copias/demo.age', bytes: 10, sha1: 'a'.repeat(40), sha256: 'b'.repeat(64) };
const info = () => ({ accountId: 'cuenta', bucketId: 'bucket', action: 'upload', fileId: ref.fileId, fileName: ref.fileName,
  contentLength: ref.bytes, contentSha1: ref.sha1, fileRetention: { isClientAuthorizedToRead: true,
    value: { mode: 'compliance', retainUntilTimestamp: 1000 } } });

function escenario({ upload = 'https://pod-000-1007-13.backblaze.com/b2api/v4/b2_upload_file/bucket/x', download = 'https://f001.backblazeb2.com',
  update = true, cambiarInfo = () => {}, fallo = null } = {}) {
  const calls = []; let detalle = info(); cambiarInfo(detalle);
  const b2 = new DestinoB2(env, { fetchFn: async (url, init) => {
    calls.push({ url, init }); assert.equal(init.redirect, 'error');
    if (fallo) return new Response('secreto-ficticio', { status: fallo });
    if (url.endsWith('b2_authorize_account')) return Response.json({ accountId: 'cuenta', authorizationToken: 'token-demo', apiInfo: { storageApi: {
      apiUrl: 'https://api001.backblazeb2.com', downloadUrl: download,
      allowed: { buckets: [{ id: 'bucket' }], namePrefix: 'staging/', capabilities: [...CAPACIDADES_COPIADOR] },
    } } });
    if (url.endsWith('b2_list_buckets')) return Response.json({ buckets: [{ bucketId: 'bucket', accountId: 'cuenta', bucketType: 'allPrivate',
      lifecycleRules: [], fileLockConfiguration: { isClientAuthorizedToRead: true, value: { isFileLockEnabled: true,
        defaultRetention: { mode: 'compliance', period: { unit: 'days', duration: 30 } } } } }] });
    if (url.endsWith('b2_get_upload_url')) return Response.json({ bucketId: 'bucket', authorizationToken: 'subida-demo', uploadUrl: upload });
    if (url.endsWith('b2_get_file_info')) return Response.json(detalle);
    if (url.endsWith('b2_update_file_retention')) {
      if (update) detalle.fileRetention.value.retainUntilTimestamp = JSON.parse(init.body).fileRetention.retainUntilTimestamp;
      return Response.json({ fileRetention: detalle.fileRetention.value });
    }
    if (url.includes('b2_download_file_by_id?')) return new Response('contenido!', { headers: { 'content-length': '10' } });
    throw new Error('Solicitud inesperada');
  } });
  return { b2, calls };
}

for (const url of ['https://example.invalid/', 'http://f001.backblazeb2.com/', 'https://f001.backblazeb2.com.evil.invalid/',
  'https://token@f001.backblazeb2.com/', 'https://f001.backblazeb2.com/?token=demo']) {
  test(`rechaza endpoint de descarga ${url}`, async () => {
    const { b2, calls } = escenario({ download: url }); await assert.rejects(b2.iniciar(), /Destino B2/); assert.equal(calls.length, 1);
  });
}

for (const url of ['https://example.invalid/', 'http://pod-001.backblaze.com/b2api/v4/b2_upload_file/a/b',
  'https://pod-001.backblaze.com.evil.invalid/b2api/v4/b2_upload_file/a/b']) {
  test(`rechaza endpoint de subida ${url}`, async t => {
    const dir = await mkdtemp(join(tmpdir(), 'b2-test-')); t.after(() => rm(dir, { recursive: true, force: true }));
    const file = join(dir, 'cipher'); await writeFile(file, 'ficticio');
    const { b2, calls } = escenario({ upload: url }); await b2.iniciar();
    await assert.rejects(b2.subir(file, ref.fileName, ref, 1000), /Destino B2/);
    assert.ok(!calls.some(c => c.url === url));
  });
}

for (const [nombre, modificar] of [
  ['otra versión', i => { i.fileId = 'otra'; }], ['otro bucket', i => { i.bucketId = 'otro'; }],
  ['otra cuenta', i => { i.accountId = 'otra'; }], ['otro nombre', i => { i.fileName = 'staging/otro.age'; }],
  ['otro tamaño', i => { i.contentLength++; }], ['otra huella', i => { i.contentSha1 = 'c'.repeat(40); }],
  ['sin lock', i => { i.fileRetention = null; }], ['governance', i => { i.fileRetention.value.mode = 'governance'; }],
]) {
  test(`no reutiliza versión B2 con ${nombre}`, async () => {
    const { b2, calls } = escenario({ cambiarInfo: modificar }); await b2.iniciar();
    await assert.rejects(b2.proteger(ref, 2000));
    assert.ok(!calls.some(c => c.url.endsWith('b2_update_file_retention')));
  });
}

test('verifica extensión real, sin acortar retención existente', async () => {
  const { b2, calls } = escenario(); await b2.iniciar(); await b2.proteger(ref, 2000); await b2.proteger(ref, 500);
  const updates = calls.filter(c => c.url.endsWith('b2_update_file_retention'));
  assert.equal(updates.length, 1); assert.equal(JSON.parse(updates[0].init.body).fileRetention.retainUntilTimestamp, 2000);
});
test('una respuesta 200 sin extender efectivamente la retención falla', async () => {
  const { b2 } = escenario({ update: false }); await b2.iniciar(); await assert.rejects(b2.proteger(ref, 2000), /protección/);
});
test('descarga mediante fileId y autorización en cabecera, nunca URL pública', async () => {
  const { b2, calls } = escenario(); await b2.iniciar(); const body = await b2.descargar(ref);
  for await (const _ of body) { /* consumir respuesta */ }
  const last = calls.at(-1); assert.ok(last.url.endsWith('?fileId=version-1')); assert.equal(last.init.headers.Authorization, 'token-demo');
});
test('rechazos del proveedor no revelan su cuerpo', async () => {
  const { b2 } = escenario({ fallo: 403 }); await assert.rejects(b2.iniciar(), e => !e.message.includes('secreto-ficticio'));
});
