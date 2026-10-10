import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, mkdir, rm, stat, writeFile, realpath, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { respaldar, prepararRecuperacion, validarManifiesto } from './lib/motor.mjs';
import { claveObjeto, directorioPrivado, leerPrivado, medidor, versionHerramienta } from './lib/seguro.mjs';

const ageBin = process.env.ENSAYO_AGE_BIN;
const ageKeygen = process.env.ENSAYO_AGE_KEYGEN;
const conAge = ageBin && ageKeygen;
const hash = b => createHash('sha256').update(b).digest('hex');

test('registra versión real de age y rechaza una herramienta incompatible', { skip: !conAge }, async () => {
  assert.match(await versionHerramienta(ageBin, /^v1\.3\.\d+$/), /^v1\.3\./);
  await assert.rejects(versionHerramienta(ageBin, /^herramienta-incompatible$/), /no admitida/);
});

test('producción cifra y recupera con prefijo propio, sin aceptar recibos de staging', { skip: !conAge }, async t => {
  const c = await contexto(t);
  const copia = await respaldar({ ...c.opciones, entorno: 'produccion' });
  assert.equal(copia.recibo.entorno, 'produccion');
  assert.ok([...c.destino.objetos.values()].every(o => o.ref.fileName.startsWith('produccion/')));
  const out = await prepararRecuperacion({ destino: c.destino, recibo: copia.recibo, carpeta: c.carpeta, ageBin, identidad: c.identidad });
  assert.equal(out.archivos, 2);
  await assert.rejects(prepararRecuperacion({ destino: c.destino, recibo: { ...copia.recibo, entorno: 'staging' }, carpeta: c.carpeta, ageBin, identidad: c.identidad }));
});

test('fallar la custodia externa impide actualizar índice y recibo local', { skip: !conAge }, async t => {
  const c=await contexto(t);let llamado=false;
  await assert.rejects(respaldar({...c.opciones,custodiarComprobante:async({recibo})=>{llamado=true;assert.ok(recibo.cierre.fileId);throw new Error('custodia no disponible');}}),/custodia/);
  assert.equal(llamado,true);
  assert.ok(!(await readdir(c.carpeta)).some(n=>n==='indice.json'||n.startsWith('recibo-')));
});

test('conserva código cifrado, extiende su protección y verifica su recuperación', { skip: !conAge }, async t => {
  const c=await contexto(t);await respaldar(c.opciones);
  const a=(await leerPrivado(join(c.carpeta,'indice.json'))).archivos[0];
  const artefacto={tipo:'fuente',revision:'a'.repeat(40),recipient:c.recipient,original:a.original,cifrado:a.cifrado};
  const copia=await respaldar({...c.opciones,artefactos:[artefacto],ahora:()=>Date.now()+86400000});
  assert.ok(c.destino.objetos.get(a.cifrado.fileId).hasta>=copia.recibo.protegidoHasta);
  const out=await prepararRecuperacion({destino:c.destino,recibo:copia.recibo,carpeta:c.carpeta,ageBin,identidad:c.identidad});
  assert.deepEqual(await readFile(join(out.carpeta,'fuente-1.tar.gz')),c.data);
  await assert.rejects(respaldar({...c.opciones,artefactos:[{...artefacto,recipient:'otro'}]}),/otra llave/);
});

class Memoria {
  objetos = new Map(); llamadas = []; falla;
  async iniciar() {}
  async subir(path, nombre, huella, hasta) {
    this.llamadas.push(nombre);
    if (this.falla && nombre.includes(this.falla)) throw new Error('Fallo simulado');
    const bytes = await readFile(path);
    assert.equal(hash(bytes), huella.sha256);
    assert.match(bytes.toString('utf8', 0, 22), /age-encryption.org/);
    const ref = { ...huella, fileId: randomUUID(), fileName: nombre };
    this.objetos.set(ref.fileId, { bytes, ref, hasta }); return ref;
  }
  async proteger(ref, hasta) {
    const a = this.objetos.get(ref.fileId);
    assert.ok(a); assert.equal(hash(a.bytes), ref.sha256);
    if (this.falla === 'retencion') throw new Error('Protección rechazada');
    a.hasta = Math.max(a.hasta, hasta);
  }
  async descargar(ref) { return Readable.from([this.objetos.get(ref.fileId).bytes]); }
}

async function contexto(t) {
  const carpeta = await mkdtemp(join(await realpath(tmpdir()), 'grafo-respaldo-test-'));
  t.after(() => rm(carpeta, { recursive: true, force: true }));
  const identidad = join(carpeta, 'identidad');
  execFileSync(ageKeygen, ['-o', identidad], { stdio: ['ignore', 'ignore', 'ignore'] });
  const recipient = execFileSync(ageKeygen, ['-y', identidad], { encoding: 'utf8' }).trim();
  const data = Buffer.from('documento de una empresa ficticia');
  const a = { key: 't/ficticio/archivo.pdf', bytes: data.length, etag: '"etag-ficticio"', modificado: '2026-01-01T00:00:00.000Z' };
  const b = { key: 'usuarios/demo/perfil/foto.webp', bytes: 0, etag: '"vacio"', modificado: a.modificado };
  const destino = new Memoria();
  let cerrada = false;
  const origen = {
    async iniciar() { return { archivos: [a, b], requeridos: [{ key: a.key, bytes: a.bytes }, { key: b.key, bytes: null }],
      metadata: { datos: 'ficticios' }, cerrar: async () => { cerrada = true; },
      exportar: async () => ({ entrada: Readable.from([Buffer.from('PGDMP prueba ficticia')]), fin: Promise.resolve(), cerrar: async () => {} }) }; },
    async abrir(objeto) { assert.equal(cerrada, true); return Readable.from([objeto === a ? data : Buffer.alloc(0)]); },
    async comprobar() {},
  };
  const opciones = { origen, destino, carpeta, ageBin, recipient, entorno: 'staging', identidadOrigen: 'ensayo', maxBytes: 1024 * 1024 };
  return { carpeta, identidad, recipient, destino, origen, opciones, data, a, b };
}

for (const key of ['../archivo', '/absoluto', 'a/../b', 'a//b', 'a\\b', 'a\nb', '__proto__/../b', '']) {
  test(`rechaza clave peligrosa ${JSON.stringify(key)}`, () => assert.throws(() => claveObjeto(key)));
}

test('rechaza guardar copias dentro de Git', async () => {
  await assert.rejects(directorioPrivado(new URL('./datos-prohibidos', import.meta.url).pathname), /fuera de Git/);
});

test('rechaza archivos de configuración con permisos compartidos', async t => {
  const p = await mkdtemp(join(tmpdir(), 'grafo-config-test-')); t.after(() => rm(p, { recursive: true, force: true }));
  const f = join(p, 'config.json'); await writeFile(f, '{}', { mode: 0o644 });
  await chmod(f, 0o644);
  await assert.rejects(leerPrivado(f), /permisos/);
});

test('el límite de entrada corta un stream que excede su tamaño', async () => {
  const m = medidor(2); m.stream.resume();
  const error = new Promise(resolve => m.stream.once('error', resolve));
  m.stream.end(Buffer.from('123')); assert.match((await error).message, /límite/);
});

test('cifra, recupera y reutiliza versiones sin exponer nombres; prolonga retención', { skip: !conAge }, async t => {
  const c = await contexto(t);
  const first = await respaldar(c.opciones);
  assert.equal(first.cantidadArchivos, 2); assert.equal(first.reutilizados, 0);
  for (const objeto of c.destino.objetos.values()) {
    assert.ok(!objeto.bytes.includes(c.data)); assert.ok(!objeto.ref.fileName.includes('archivo.pdf'));
  }
  const segundo = await respaldar({ ...c.opciones, ahora: () => Date.now() + 2 * 86_400_000 });
  assert.equal(segundo.reutilizados, 2);
  const index = await leerPrivado(join(c.carpeta, 'indice.json'));
  for (const a of index.archivos) assert.ok(c.destino.objetos.get(a.cifrado.fileId).hasta >= segundo.recibo.protegidoHasta);
  const out = await prepararRecuperacion({ destino: c.destino, recibo: segundo.recibo, carpeta: c.carpeta, ageBin, identidad: c.identidad });
  assert.equal(out.sistemaRestaurado, false);
  assert.equal((await readFile(join(out.carpeta, 'base.dump'))).toString(), 'PGDMP prueba ficticia');
  assert.deepEqual(await readFile(join(out.carpeta, 'objeto-000001')), c.data);
  assert.equal((await stat(join(out.carpeta, 'objeto-000002'))).size, 0);
  assert.equal((await stat(join(c.carpeta, 'indice.json'))).mode & 0o077, 0);
  assert.ok(!(await readdir(c.carpeta)).some(n => n.startsWith('temporal-') || n === 'ejecucion.lock'));
});

test('archivo modificado obliga a subir otra versión', { skip: !conAge }, async t => {
  const c = await contexto(t); await respaldar(c.opciones);
  c.a.etag = '"nueva"';
  assert.equal((await respaldar(c.opciones)).reutilizados, 1);
});

test('rotar destinatario o cambiar origen impide reutilizar copias previas', { skip: !conAge }, async t => {
  const c = await contexto(t); await respaldar(c.opciones);
  assert.equal((await respaldar({ ...c.opciones, identidadOrigen: 'otro' })).reutilizados, 0);
  const segundo = join(c.carpeta, 'otra-identidad');
  execFileSync(ageKeygen, ['-o', segundo], { stdio: 'ignore' });
  const recipient = execFileSync(ageKeygen, ['-y', segundo], { encoding: 'utf8' }).trim();
  assert.equal((await respaldar({ ...c.opciones, identidadOrigen: 'otro', recipient })).reutilizados, 0);
});

for (const tipo of ['ausente', 'tamano', 'cambio', 'exportacion', 'retencion', 'manifiesto', 'plazo', 'tamano-stream']) {
  test(`no publica éxito ante ${tipo} y limpia temporales`, { skip: !conAge }, async t => {
    const c = await contexto(t);
    if (tipo === 'retencion') { await respaldar(c.opciones); c.destino.llamadas = []; c.destino.falla = 'retencion'; }
    const iniciar = c.origen.iniciar;
    c.origen.iniciar = async (...args) => {
      const snapshot = await iniciar(...args);
      if (tipo === 'ausente') snapshot.requeridos.push({ key: 'no-existe', bytes: null });
      if (tipo === 'tamano') snapshot.requeridos[0].bytes++;
      if (tipo === 'exportacion') snapshot.exportar = async () => ({ entrada: Readable.from(['parcial']),
        fin: Promise.reject(new Error('dump incompleto')), cerrar: async () => {} });
      return snapshot;
    };
    if (tipo === 'cambio') c.origen.comprobar = async () => { throw new Error('cambió'); };
    if (tipo === 'manifiesto') c.destino.falla = 'manifiesto';
    if (tipo === 'plazo') { let call = 0; c.opciones.ahora = () => ++call === 1 ? 0 : 60 * 60_000; }
    if (tipo === 'tamano-stream') c.origen.abrir = async () => Readable.from([Buffer.alloc(2 * 1024 * 1024)]);
    const esperado = { ausente: /ausente/, tamano: /tamaño/, cambio: /cambió/, exportacion: /dump incompleto/,
      retencion: /Protección/, manifiesto: /Fallo simulado/, plazo: /plazo/, 'tamano-stream': /cifrado/ };
    await assert.rejects(respaldar(c.opciones), esperado[tipo]);
    assert.ok(!c.destino.llamadas.some(n => n.endsWith('/completa.age')));
    assert.ok(!(await readdir(c.carpeta)).some(n => n.startsWith('temporal-') || n === 'ejecucion.lock'));
  });
}

test('una segunda ejecución no rompe el bloqueo de la primera', { skip: !conAge }, async t => {
  const c = await contexto(t); await mkdir(join(c.carpeta, 'ejecucion.lock'));
  await assert.rejects(respaldar(c.opciones), { code: 'EEXIST' });
  assert.ok((await stat(join(c.carpeta, 'ejecucion.lock'))).isDirectory());
});

for (const tipo of ['clave-equivocada', 'cifrado-alterado', 'recibo-alterado']) {
  test(`rechaza recuperación ${tipo}, sin archivos parciales`, { skip: !conAge }, async t => {
    const c = await contexto(t); const { recibo } = await respaldar(c.opciones);
    let identidad = c.identidad;
    if (tipo === 'clave-equivocada') {
      identidad = join(c.carpeta, 'incorrecta'); execFileSync(ageKeygen, ['-o', identidad], { stdio: 'ignore' });
    }
    if (tipo === 'cifrado-alterado') c.destino.objetos.get(recibo.manifiesto.fileId).bytes[100] ^= 1;
    if (tipo === 'recibo-alterado') recibo.manifiesto.sha256 = '0'.repeat(64);
    await assert.rejects(prepararRecuperacion({ destino: c.destino, recibo, carpeta: c.carpeta, ageBin, identidad }));
    assert.ok(!(await readdir(c.carpeta)).some(n => n.startsWith('restauracion-')));
  });
}

test('valida requeridos y duplicados al restaurar manifiestos', () => {
  const ref = { fileId: 'id', fileName: 'staging/obj.age', bytes: 20, sha1: 'a'.repeat(40), sha256: 'b'.repeat(64) };
  const a = { key: 'archivo', original: { bytes: 10, sha256: 'c'.repeat(64) }, cifrado: ref };
  const m = { version: 1, id: randomUUID(), entorno: 'staging', proposito: 'ensayo', base: a, archivos: [a], requeridos: [{ key: 'archivo', bytes: 10 }], operacionExternaDeshabilitada: true };
  validarManifiesto(m, 'staging');
  assert.throws(() => validarManifiesto({ ...m, archivos: [a, a] }, 'staging'), /repetido/);
  assert.throws(() => validarManifiesto({ ...m, archivos: [] }, 'staging'), /Falta/);
  assert.throws(() => validarManifiesto({ ...m, entorno: 'produccion' }, 'staging'));
});
