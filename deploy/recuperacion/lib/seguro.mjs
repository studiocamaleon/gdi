import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

export function claveObjeto(key) {
  exigir(typeof key === 'string' && key.length <= 1024 && key.length > 0 &&
    !key.includes('\\') && !/[\x00-\x1f\x7f]/.test(key) &&
    key.split('/').every(p => p && p !== '.' && p !== '..'), 'Clave de archivo no válida.');
  return key;
}

// Los directorios operativos se crean fuera del checkout y no pueden ser enlaces.
export async function directorioPrivado(path) {
  exigir(isAbsolute(path), 'Usá un directorio privado absoluto fuera de Git.');
  const ancestors = [];
  for (let p = resolve(path); ; p = dirname(p)) {
    ancestors.push(p);
    if (p === dirname(p)) break;
  }
  for (const p of ancestors.reverse()) {
    const info = await lstat(p).catch(e => { if (e.code !== 'ENOENT') throw e; });
    exigir(!info || (info.isDirectory() && !info.isSymbolicLink()), 'El directorio contiene enlaces o archivos.');
    const git = await lstat(join(p, '.git')).catch(e => { if (e.code !== 'ENOENT') throw e; });
    exigir(!git, 'El respaldo y sus claves deben quedar fuera de Git.');
  }
  await mkdir(path, { recursive: true, mode: 0o700 });
  const info = await lstat(path);
  exigir(info.uid === process.getuid() && (info.mode & 0o077) === 0, 'El directorio debe pertenecer al ejecutor y tener permisos 0700.');
}

export async function leerPrivado(path, max = 64 * 1024 * 1024) {
  const info = await lstat(path);
  exigir(info.isFile() && !info.isSymbolicLink() && info.uid === process.getuid() &&
    (info.mode & 0o077) === 0 && info.size <= max, 'Archivo privado inválido o con permisos excesivos.');
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function guardarPrivado(path, value) {
  const tmp = `${path}.nuevo`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  try { await rename(tmp, path); } finally { await rm(tmp, { force: true }); }
}

export function medidor(maxBytes) {
  exigir(Number.isSafeInteger(maxBytes) && maxBytes > 0, 'Límite de tamaño inválido.');
  let bytes = 0;
  const sha256 = createHash('sha256');
  const sha1 = createHash('sha1');
  const stream = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maxBytes) return callback(new Error('El archivo supera el límite del respaldo.'));
      sha256.update(chunk); sha1.update(chunk); callback(null, chunk);
    },
  });
  return { stream, resultado: () => ({ bytes, sha256: sha256.digest('hex'), sha1: sha1.digest('hex') }) };
}

// Nunca heredar secretos de B2/R2 ni imprimir stderr de pg_dump/age.
export function proceso(bin, args, env, signal) {
  exigir(isAbsolute(bin), 'La herramienta debe tener una ruta absoluta.');
  const child = spawn(bin, args, { env: { LANG: 'C', PATH: '/usr/bin:/bin', ...env }, stdio: ['pipe', 'pipe', 'ignore'], signal });
  const fin = new Promise((ok, fail) => {
    child.once('error', () => fail(new Error('No se pudo ejecutar la herramienta de respaldo.')));
    child.once('close', code => code === 0 ? ok() : fail(new Error('La herramienta de respaldo no terminó correctamente.')));
  });
  // Hay consumidores que primero conectan streams y luego esperan fin.
  fin.catch(() => {});
  return { child, fin };
}

export async function versionHerramienta(bin, patron) {
  const { child, fin } = proceso(bin, ['--version'], {}, AbortSignal.timeout(10_000));
  child.stdin.end();
  let output = '';
  try {
    for await (const chunk of child.stdout) {
      output += chunk.toString('utf8'); exigir(output.length <= 1024, 'Versión de herramienta inválida.');
    }
    await fin; exigir(patron.test(output.trim()), 'Versión de herramienta no admitida.'); return output.trim();
  } finally { child.kill('SIGKILL'); await fin.catch(() => {}); }
}

export async function transformarAge({ entrada, destino, bin, recipient, identidad, maxBytes, signal }) {
  exigir(Boolean(recipient) !== Boolean(identidad), 'Indicar destinatario público o identidad de recuperación.');
  if (recipient) exigir(/^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(recipient), 'Destinatario público age inválido.');
  const args = recipient ? ['--encrypt', '--recipient', recipient] : ['--decrypt', '--identity', identidad];
  const { child, fin } = proceso(bin, args, {}, signal);
  const origen = medidor(maxBytes + (identidad ? 2 * 1024 * 1024 : 0));
  const salida = medidor(maxBytes + (recipient ? 2 * 1024 * 1024 : 0));
  const trabajos = [
    pipeline(entrada, origen.stream, child.stdin, { signal }),
    pipeline(child.stdout, salida.stream, createWriteStream(destino, { mode: 0o600, flags: 'wx' }), { signal }),
    fin,
  ];
  try {
    await Promise.all(trabajos);
    return { original: origen.resultado(), resultado: salida.resultado() };
  } catch {
    child.kill('SIGKILL'); entrada.destroy();
    await Promise.allSettled(trabajos);
    await rm(destino, { force: true });
    throw new Error('No se pudo completar el cifrado/descifrado verificado.');
  }
}

export async function copiarVerificado(entrada, destino, esperado, signal) {
  const medida = medidor(esperado.bytes);
  try {
    await pipeline(entrada, medida.stream, createWriteStream(destino, { mode: 0o600, flags: 'wx' }), { signal });
    const r = medida.resultado();
    exigir(r.bytes === esperado.bytes && r.sha256 === esperado.sha256, 'El contenido no coincide con la huella del respaldo.');
  } catch (error) { await rm(destino, { force: true }); throw error; }
}

export { createReadStream };
