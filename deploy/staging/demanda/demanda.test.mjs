import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { APPS, WEB, configuracion, entornoNext, FlyStaging, Sesion } from './control.mjs';
import { crearServidor } from './servidor.mjs';
const { validarEntorno, medir } = createRequire(import.meta.url)('./ocupacion.cjs');
const env = { FLY_APP_NAME: WEB, STAGING_PRIVATE: 'true', STAGING_DEMANDA_ENABLED: 'true', STAGING_DEMANDA_TOKEN_API: 'token-ficticio-api', STAGING_DEMANDA_TOKEN_WORKER: 'token-ficticio-worker', STAGING_DEMANDA_TOKEN_WORKER_PDF: 'token-ficticio-worker-pdf', STAGING_DEMANDA_TOKEN_PDF: 'token-ficticio-pdf', STAGING_DEMANDA_TOKEN_LECTURA: 'token-ficticio-lectura' };

function entornoSimulado({ libre = true, roto = false, estado = 'started' } = {}) {
  const estados = Object.fromEntries(Object.keys(APPS).map((r) => [r, estado]));
  const llamadas = []; let ahora = 0;
  const fetcher = async (url, opciones = {}) => {
    if (url.startsWith('http://')) { llamadas.push(['salud', url]); return new Response('{}'); }
    const coincidencia = new URL(url).pathname.match(/^\/v1\/apps\/([^/]+)\/machines(?:\/([a-f0-9]+)\/(start|stop|exec))?$/);
    assert.ok(coincidencia);
    const rol = Object.entries(APPS).find(([, app]) => app === coincidencia[1])?.[0];
    assert.ok(rol, 'ninguna solicitud puede salir hacia producción ni respaldos');
    const accion = coincidencia[3]; llamadas.push([rol, accion ?? 'listar']);
    if (accion === 'exec') return new Response(JSON.stringify(roto ? { stdout: '{}' } : { stdout: JSON.stringify({ version: 1, libre, redisPendientes: libre ? 0 : 1, postgresPendientes: 0 }) }));
    if (accion) { estados[rol] = accion === 'start' ? 'started' : 'stopped'; return new Response('{}'); }
    return new Response(JSON.stringify([{ id: '11111111111111', state: estados[rol], config: { env: { GRAFO_DEPLOY_ENV: 'staging' } } }]));
  };
  return { llamadas, estados, fly: new FlyStaging(configuracion(env), { fetcher, ahora: () => ahora, dormir: async (n) => { ahora += n; } }) };
}

test('rechaza producción y configuración incompleta antes de operar', () => {
  assert.throws(() => configuracion({ ...env, FLY_APP_NAME: 'empresa-ficticia-production-web' }));
  assert.throws(() => configuracion({ ...env, STAGING_PRIVATE: 'false' }));
  assert.throws(() => configuracion({ ...env, STAGING_DEMANDA_TOKEN_API: '' }));
  assert.throws(() => configuracion({ ...env, STAGING_DEMANDA_IDLE_SECONDS: '0' }));
  assert.throws(() => validarEntorno({ FLY_APP_NAME: 'empresa-ficticia-production-api', GRAFO_DEPLOY_ENV: 'production' }));
});
test('Next no hereda permisos de administrar Fly', () => {
  const child = entornoNext({ ...env, FLY_API_TOKEN: 'no-heredar', DATABASE_URL: 'conexion-ficticia', PORT: '3000' });
  assert.equal(child.PORT, '3002'); assert.equal(child.HOSTNAME, '127.0.0.1');
  assert.equal(child.DATABASE_URL, 'conexion-ficticia');
  assert.ok(!Object.keys(child).some((k) => k.startsWith('STAGING_DEMANDA_') || k === 'FLY_API_TOKEN'));
});
test('el cliente rechaza roles y rutas arbitrarios sin llamar a la red', async () => {
  const { fly, llamadas } = entornoSimulado();
  await assert.rejects(fly.peticion('production'));
  await assert.rejects(fly.peticion('api', '/../otra-app'));
  assert.equal(llamadas.length, 0);
});
test('enciende dependencias y comprueba salud antes de arrancar los workers', async () => {
  const { fly, llamadas, estados } = entornoSimulado({ estado: 'stopped' });
  await fly.encender();
  assert.ok(Object.values(estados).every((v) => v === 'started'));
  const salud = llamadas.findIndex(([r]) => r === 'salud');
  assert.ok(llamadas.findIndex(([r, a]) => r === 'worker' && a === 'start') > salud);
});
test('no apaga durante un trabajo ni ante respuesta de ocupación incompleta', async () => {
  for (const opciones of [{ libre: false }, { roto: true }]) {
    const { fly, llamadas } = entornoSimulado(opciones);
    if (opciones.roto) await assert.rejects(fly.apagar(() => true));
    else assert.equal(await fly.apagar(() => true), false);
    assert.ok(!llamadas.some(([, a]) => a === 'stop'));
  }
});
test('drena workers, vuelve a comprobar las colas y recién después detiene PDF/API', async () => {
  const { fly, llamadas, estados } = entornoSimulado();
  assert.equal(await fly.apagar(() => true), true);
  assert.deepEqual(llamadas.filter(([, a]) => ['stop', 'exec'].includes(a)), [['api', 'exec'], ['worker', 'stop'], ['workerPdf', 'stop'], ['api', 'exec'], ['pdf', 'stop'], ['api', 'stop']]);
  assert.ok(Object.values(estados).every((e) => e === 'stopped'));
});
test('una visita mientras se apaga cancela la parada y recupera todo el conjunto', async () => {
  const { fly, estados } = entornoSimulado();
  assert.equal(await fly.apagar(() => estados.worker !== 'stopped'), false);
  assert.ok(Object.values(estados).every((e) => e === 'started'));
});
test('una conexión larga y el plazo de inactividad impiden el apagado', async () => {
  let ahora = 0; let paradas = 0;
  const sesion = new Sesion({ encender: async () => {}, apagar: async () => { paradas++; return true; } }, { idleMs: 900, ahora: () => ahora });
  const cerrar = sesion.entrar(); ahora = 1000;
  assert.equal(await sesion.reposar(), false); cerrar(); cerrar();
  assert.equal(sesion.activas, 0); ahora = 1899; assert.equal(await sesion.reposar(), false);
  ahora = 1900; assert.equal(await sesion.reposar(), true); assert.equal(paradas, 1);
});
test('visitas concurrentes comparten un solo arranque', async () => {
  let inicios = 0; let liberar;
  const espera = new Promise((r) => { liberar = r; });
  const sesion = new Sesion({ encender: async () => { inicios++; await espera; } });
  const visitas = [sesion.preparar(), sesion.preparar(), sesion.preparar()];
  liberar(); await Promise.all(visitas); assert.equal(inicios, 1);
});
test('control de ocupación descubre colas adicionales y considera PostgreSQL', async () => {
  const redis = { scan: async () => ['0', ['bull:cola-ficticia:meta']], llen: async (k) => k === 'bull:cola-ficticia:active' ? 1 : 0, zcard: async () => 0 };
  const db = { $queryRawUnsafe: async (q) => { assert.ok(q.startsWith('SELECT')); return [{ pendientes: 2 }]; } };
  assert.deepEqual(await medir(redis, db), { version: 1, redisPendientes: 1, postgresPendientes: 2, libre: false });
  redis.llen = async () => 0; db.$queryRawUnsafe = async () => [{ pendientes: 0 }];
  assert.equal((await medir(redis, db)).libre, true);
  db.$queryRawUnsafe = async () => { throw new Error('base no disponible'); };
  await assert.rejects(medir(redis, db));
});
test('proxy conserva POST, cookies, redirecciones y excluye salud de actividad', async (t) => {
  let escrituras = 0; let recibido = '';
  const backend = http.createServer((req, res) => {
    escrituras++; req.on('data', (b) => { recibido += b; });
    req.on('end', () => { res.writeHead(302, { Location: '/panel', 'Set-Cookie': ['sesion=ficticia; HttpOnly; Secure', 'otra=ficticia'], 'Content-Type': 'text/plain' }); res.end('ok'); });
  });
  backend.listen(0, '127.0.0.1'); await once(backend, 'listening');
  const sesion = new Sesion({ encender: async () => {} });
  const proxy = crearServidor(sesion, { portNext: backend.address().port, log: () => {} });
  proxy.listen(0, '127.0.0.1'); await once(proxy, 'listening');
  t.after(() => { proxy.closeAllConnections(); proxy.close(); backend.closeAllConnections(); backend.close(); });
  const base = `http://127.0.0.1:${proxy.address().port}`;
  const ultima = sesion.ultima;
  assert.equal((await fetch(base + '/api/health')).status, 200); assert.equal(sesion.ultima, ultima); assert.equal(escrituras, 0);
  const r = await fetch(base + '/guardar', { method: 'POST', body: 'dato-ficticio', redirect: 'manual' });
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/panel'); assert.equal(r.headers.getSetCookie().length, 2);
  assert.equal(await r.text(), 'ok'); assert.equal(recibido, 'dato-ficticio'); assert.equal(escrituras, 1);
});
test('pantalla de arranque no refleja enlaces privados ni manda la visita al backend antes de tiempo', async (t) => {
  let liberar;
  const sesion = new Sesion({ encender: () => new Promise((r) => { liberar = r; }) });
  const proxy = crearServidor(sesion, { log: () => {} }); proxy.listen(0, '127.0.0.1'); await once(proxy, 'listening');
  t.after(() => { liberar?.(); proxy.closeAllConnections(); proxy.close(); });
  const r = await fetch(`http://127.0.0.1:${proxy.address().port}/invitacion?token=ficticio-privado`, { headers: { Accept: 'text/html' } });
  const html = await r.text(); assert.equal(r.status, 200); assert.match(html, /Estamos preparando staging/); assert.ok(!html.includes('ficticio-privado'));
});
