import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { OrigenPostgresR2 } from './lib/origen.mjs';
import { DestinoB2 } from './lib/b2.mjs';
import { CAPACIDADES_COPIADOR, CAPACIDADES_LECTOR, validarPermisos, validarConfiguracion } from './validar-destino.mjs';

function config() {
  return { r2Endpoint: `https://${'a'.repeat(32)}.us.r2.cloudflarestorage.com`, r2Bucket: 'ficticio', r2KeyId: 'demo', r2Key: 'demo',
    pgHost: 'ep-demo.us-east-2.aws.neon.tech', pgPort: 5432, pgDatabase: 'ficticia', pgUser: 'lector', pgPassword: 'ficticia',
    revision: 'a'.repeat(40), imagenes: [`demo@sha256:${'b'.repeat(64)}`], idsClavesInternas: ['ficticia-v1'] };
}
const signal = () => AbortSignal.timeout(10_000);
const a = { key: 't/demo/a.pdf', bytes: 10, etag: '"demo"', modificado: '2026-01-01T00:00:00.000Z' };
const info = () => ({ ETag: a.etag, ContentLength: a.bytes, LastModified: new Date(a.modificado) });

for (const [nombre, cambio] of [
  ['endpoint R2 ajeno', c => { c.r2Endpoint = 'https://example.invalid'; }],
  ['R2 sin TLS', c => { c.r2Endpoint = c.r2Endpoint.replace('https:', 'http:'); }],
  ['host PostgreSQL ajeno', c => { c.pgHost = 'localhost'; }],
  ['conexión agrupada', c => { c.pgHost = 'ep-demo-pooler.us-east-2.aws.neon.tech'; }],
  ['imagen mutable', c => { c.imagenes = ['demo:latest']; }],
  ['sin claves bajo custodia', c => { c.idsClavesInternas = []; }],
]) {
  test(`rechaza configuración de origen: ${nombre}`, () => { const c = config(); cambio(c); assert.throws(() => new OrigenPostgresR2(c)); });
}

test('acepta endpoint jurisdiccional US, exige versión/ETag al descargar', async () => {
  const source = new OrigenPostgresR2(config(), { s3: { async send(command) {
    assert.equal(command.input.IfMatch, a.etag); return { ...info(), Body: Readable.from(['0123456789']) };
  } } });
  let data = ''; for await (const b of await source.abrir(a, signal())) data += b;
  assert.equal(data, '0123456789'); await source.comprobar(a, signal());
});

test('R2: listado con milisegundos y GET/HEAD con fecha HTTP en segundos describen el mismo objeto', async () => {
  const listado = { ...a, modificado: '2026-01-01T00:00:00.713Z' };
  const source = new OrigenPostgresR2(config(), { s3: { async send(command) {
    assert.equal(command.input.IfMatch, a.etag);
    return { ...info(), Body: Readable.from(['0123456789']) };
  } } });
  let data = ''; for await (const b of await source.abrir(listado, signal())) data += b;
  assert.equal(data, '0123456789'); await source.comprobar(listado, signal());
});

for (const [nombre, cambio] of [
  ['ETag distinto dentro del mismo segundo', { ETag: 'otro' }],
  ['fecha del segundo siguiente', { LastModified: new Date('2026-01-01T00:00:01.000Z') }],
  ['fecha inválida', { LastModified: new Date('invalida') }],
  ['fecha ausente', { LastModified: undefined }],
]) {
  test(`la precisión HTTP no admite ${nombre}`, async () => {
    const source = new OrigenPostgresR2(config(), { s3: { async send() {
      return { ...info(), ...cambio, Body: Readable.from(['0123456789']) };
    } } });
    const listado = { ...a, modificado: '2026-01-01T00:00:00.713Z' };
    await assert.rejects(source.abrir(listado, signal()), /cambió/);
    await assert.rejects(source.comprobar(listado, signal()), /cambió/);
  });
}

for (const field of ['ETag', 'ContentLength', 'LastModified']) {
  test(`rechaza cambio concurrente de ${field} y cierra el stream`, async () => {
    const body = Readable.from(['parcial']); const h = info();
    h[field] = field === 'LastModified' ? new Date('2026-02-01') : field === 'ETag' ? 'otro' : 20;
    const source = new OrigenPostgresR2(config(), { s3: { async send() { return { ...h, Body: body }; } } });
    await assert.rejects(source.abrir(a, signal()), /cambió/); assert.equal(body.destroyed, true);
    await assert.rejects(source.comprobar(a, signal()), /cambió/);
  });
}

for (const tipo of ['paginacion', 'migracion']) {
  test(`cierra la instantánea al detectar ${tipo} incompleta`, async () => {
    let cerrada = false; let pages = 0;
    const client = { on() {}, async connect() {}, async end() { cerrada = true; }, async query(sql) {
      if (sql.includes('FROM pg_roles r')) return { rows: [{ elevado: false, crea_base: false, crea_esquema: false, escribe: false, miembro: false, cambia_secuencia: false }] };
      if (sql.includes('pg_proc p')) return { rows: [{ ejecuta: false }] };
      if (sql.includes('pg_export_snapshot')) return { rows: [{ id: '0000-0001-1', version: '16', base: 'ficticia' }] };
      if (sql.includes('_prisma_migrations')) return { rows: tipo === 'migracion' ? [{ finished_at: null, rolled_back_at: null }] : [] };
      return { rows: [] };
    } };
    const source = new OrigenPostgresR2(config(), { crearCliente: () => client, s3: { async send() {
      pages++; return { Contents: [], IsTruncated: true, NextContinuationToken: 'repetido' };
    } } });
    await assert.rejects(source.iniciar(signal()), tipo === 'migracion' ? /migración/ : /Paginación/);
    assert.equal(cerrada, true); assert.equal(pages, tipo === 'migracion' ? 0 : 2);
  });
}

test('la recuperación exige un acceso B2 separado de sólo lectura', async () => {
  const env = { RESPALDO_B2_KEY_ID: 'demo', RESPALDO_B2_KEY: 'demo', RESPALDO_B2_ACCOUNT_ID: 'cuenta', RESPALDO_B2_BUCKET_ID: 'bucket', RESPALDO_ENTORNO: 'staging' };
  const auth = { accountId: 'cuenta', authorizationToken: 'demo', apiInfo: { storageApi: { apiUrl: 'https://api001.backblazeb2.com',
    allowed: { buckets: [{ id: 'bucket' }], namePrefix: 'staging/', capabilities: [...CAPACIDADES_COPIADOR] } } } };
  assert.throws(() => validarPermisos(auth, validarConfiguracion(env), CAPACIDADES_LECTOR), /excesivos/);
  auth.apiInfo.storageApi.allowed.capabilities = [...CAPACIDADES_LECTOR];
  validarPermisos(auth, validarConfiguracion(env), CAPACIDADES_LECTOR);
  const b2 = new DestinoB2(env, { soloLectura: true, fetchFn: () => assert.fail('No debe conectar') });
  await assert.rejects(b2.subir(), /no puede escribir/); await assert.rejects(b2.proteger(), /no puede cambiar/);
});
