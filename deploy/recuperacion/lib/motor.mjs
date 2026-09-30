import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { claveObjeto, copiarVerificado, createReadStream, directorioPrivado, exigir, guardarPrivado, leerPrivado, transformarAge } from './seguro.mjs';

const DIA = 86_400_000;
export const LIMITE_ARCHIVO = 4 * 1024 ** 3;
const LIMITE_MANIFIESTO = 32 * 1024 ** 2;
const MAX_ARCHIVOS = 100_000;

export function validarRef(ref, entorno, max = LIMITE_ARCHIVO + 2 * 1024 ** 2) {
  exigir(ref && typeof ref.fileId === 'string' && /^[a-zA-Z0-9_-]{1,256}$/.test(ref.fileId) &&
    typeof ref.fileName === 'string' && ref.fileName.startsWith(`${entorno}/`) && /^[a-z0-9/._-]+$/.test(ref.fileName) &&
    Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= max && /^[a-f0-9]{64}$/.test(ref.sha256) &&
    /^[a-f0-9]{40}$/.test(ref.sha1), 'Referencia de respaldo inválida.');
}

export function validarManifiesto(m, entorno) {
  exigir(m?.version === 1 && m.entorno === entorno && ['ensayo', 'respaldo'].includes(m.proposito) && /^[a-f0-9-]{36}$/.test(m.id) &&
    Array.isArray(m.archivos) && m.archivos.length <= MAX_ARCHIVOS && Array.isArray(m.requeridos) &&
    m.requeridos.length <= MAX_ARCHIVOS && m.operacionExternaDeshabilitada === true, 'Manifiesto de recuperación inválido.');
  const entradas = [m.base, ...m.archivos];
  const claves = new Map();
  for (const [i, a] of entradas.entries()) {
    validarRef(a?.cifrado, entorno);
    exigir(a.original && Number.isSafeInteger(a.original.bytes) && a.original.bytes >= 0 &&
      a.original.bytes <= LIMITE_ARCHIVO && /^[a-f0-9]{64}$/.test(a.original.sha256), 'Huella original inválida.');
    if (i > 0) {
      claveObjeto(a.key); exigir(!claves.has(a.key), 'Archivo repetido en el manifiesto.'); claves.set(a.key, a);
    }
  }
  for (const r of m.requeridos) {
    claveObjeto(r.key);
    const a = claves.get(r.key);
    exigir(a && (r.bytes === null || r.bytes === a.original.bytes), 'Falta un archivo requerido por la base.');
  }
  exigir(Array.isArray(m.artefactos ?? []) && (m.artefactos ?? []).length <= 10, 'Artefactos de recuperación inválidos.');
  for(const a of m.artefactos ?? []) {
    exigir(a.tipo === 'fuente' && /^[a-f0-9]{40}$/.test(a.revision) &&
      typeof a.recipient === 'string' && a.original && /^[a-f0-9]{64}$/.test(a.original.sha256) &&
      Number.isSafeInteger(a.original.bytes) && a.original.bytes > 0 && a.original.bytes <= LIMITE_ARCHIVO, 'Código recuperable inválido.');
    validarRef(a.cifrado, entorno);
  }
}

// Todos los datos privados (incluidos nombres y huellas originales) van cifrados.
// El recibo local fija la raíz de confianza por fileId + SHA-256, nunca por "último nombre".
export async function respaldar({ origen, destino, carpeta, ageBin, recipient, entorno, identidadOrigen, signal, ensayo = false, herramientas = {},
  maxBytes = LIMITE_ARCHIVO, duracionMaxMs = 45 * 60_000, ahora = Date.now, custodiarComprobante, artefactos = [] }) {
  exigir(['staging', 'produccion'].includes(entorno) && typeof identidadOrigen === 'string' && identidadOrigen.length > 0, 'Identificar origen y entorno.');
  exigir(maxBytes > 0 && maxBytes <= LIMITE_ARCHIVO && duracionMaxMs > 0 && duracionMaxMs <= 45 * 60_000, 'Límites de respaldo inválidos.');
  await directorioPrivado(carpeta);
  const bloqueo = join(carpeta, 'ejecucion.lock');
  await mkdir(bloqueo, { mode: 0o700 }); // No romper un bloqueo ajeno/antiguo automáticamente.
  let temporal; let snapshot;
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), duracionMaxMs);
  const control = AbortSignal.any([controlador.signal, ...(signal ? [signal] : [])]);
  const inicio = ahora();
  const limiteTiempo = inicio + duracionMaxMs;
  const protegidoHasta = limiteTiempo + 30 * DIA;
  const id = randomUUID();
  const proposito = ensayo ? 'ensayo' : 'respaldo';
  const prefijo = `${entorno}/${ensayo ? 'ensayos' : 'copias'}/${id}`;
  const comprobarPlazo = () => { control.throwIfAborted(); exigir(ahora() < limiteTiempo, 'La copia superó el plazo permitido.'); };
  try {
    temporal = await mkdtemp(join(carpeta, 'temporal-'));
    await destino.iniciar(); comprobarPlazo();
    exigir(Array.isArray(artefactos) && artefactos.length <= 10, 'Demasiados artefactos de código.');
    for(const a of artefactos) {
      validarRef(a?.cifrado, entorno);
      exigir(a.recipient === recipient, 'El código requiere otra llave de recuperación.');
      await destino.proteger(a.cifrado, protegidoHasta);
    }
    let anterior;
    try { anterior = await leerPrivado(join(carpeta, 'indice.json')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const reutilizable = anterior?.version === 1 && anterior.recipient === recipient && anterior.entorno === entorno &&
      anterior.identidadOrigen === identidadOrigen && anterior.proposito === proposito;
    const cache = new Map(reutilizable ? anterior.archivos.map(a => [a.key, a]) : []);
    const nuevos = [];
    async function copiar(entrada, nombre, tamanoEsperado = null) {
      const path = join(temporal, `${randomUUID()}.age`);
      try {
        comprobarPlazo();
        const espacio = await statfs(temporal);
        exigir(espacio.bavail * espacio.bsize >= (tamanoEsperado ?? maxBytes) + 258 * 1024 ** 2, 'No hay espacio temporal suficiente para la copia.');
        const c = await transformarAge({ entrada, destino: path, bin: ageBin, recipient, maxBytes, signal: control });
        exigir(tamanoEsperado === null || c.original.bytes === tamanoEsperado, 'El tamaño del archivo cambió durante el respaldo.');
        const cifrado = await destino.subir(path, `${prefijo}/${nombre}.age`, c.resultado, protegidoHasta);
        validarRef(cifrado, entorno, maxBytes + 2 * 1024 ** 2);
        return { original: c.original, cifrado };
      } finally { entrada.destroy(); await rm(path, { force: true }); }
    }
    snapshot = await origen.iniciar(control);
    exigir(Array.isArray(snapshot.archivos) && snapshot.archivos.length <= MAX_ARCHIVOS && Array.isArray(snapshot.requeridos), 'Inventario de origen inválido.');
    const claves = new Map();
    for (const a of snapshot.archivos) {
      claveObjeto(a.key);
      exigir(!claves.has(a.key) && Number.isSafeInteger(a.bytes) && a.bytes >= 0 && a.bytes <= maxBytes &&
        typeof a.etag === 'string' && a.etag.length > 0 && typeof a.modificado === 'string', 'Inventario de archivo inválido.');
      claves.set(a.key, a);
    }
    for (const r of snapshot.requeridos) {
      const a = claves.get(claveObjeto(r.key));
      exigir(a && (r.bytes === null || r.bytes === a.bytes), 'La base referencia un archivo ausente o con tamaño distinto.');
    }
    const dump = await snapshot.exportar(control);
    dump.fin.catch(() => {});
    let base;
    try { base = await copiar(dump.entrada, 'base'); await dump.fin; }
    finally { await dump.cerrar(); }
    // pg_dump y la consulta de referencias comparten la misma instantánea.
    await snapshot.cerrar();
    for (const a of snapshot.archivos) {
      comprobarPlazo();
      const previo = cache.get(a.key);
      let copia;
      if (previo && previo.etag === a.etag && previo.modificado === a.modificado && previo.original?.bytes === a.bytes) {
        validarRef(previo.cifrado, entorno);
        await destino.proteger(previo.cifrado, protegidoHasta);
        copia = { original: previo.original, cifrado: previo.cifrado };
      } else {
        copia = await copiar(await origen.abrir(a, control), randomUUID(), a.bytes);
      }
      // Detectar desapariciones/cambios concurrentes, también al reutilizar objetos.
      await origen.comprobar(a, control);
      nuevos.push({ ...a, ...copia });
    }
    comprobarPlazo();
    const manifiesto = { version: 1, id, entorno, proposito, iniciado: new Date(inicio).toISOString(),
      metadata: snapshot.metadata, herramientas, requeridos: snapshot.requeridos, base, archivos: nuevos, artefactos,
      operacionExternaDeshabilitada: true };
    validarManifiesto(manifiesto, entorno);
    const bytes = Buffer.from(JSON.stringify(manifiesto));
    exigir(bytes.length <= LIMITE_MANIFIESTO, 'Manifiesto demasiado grande.');
    const manifest = await copiar(Readable.from([bytes]), 'manifiesto', bytes.length);
    comprobarPlazo();
    const completado = new Date(ahora()).toISOString();
    const resumen = { version: 1, id, entorno, proposito, completado, protegidoHasta, manifiesto: manifest.cifrado };
    // Sólo este último objeto indica finalización. No existe un "success" anticipado.
    const cierre = await copiar(Readable.from([Buffer.from(JSON.stringify(resumen))]), 'completa');
    comprobarPlazo();
    const recibo = { ...resumen, cierre: cierre.cifrado };
    // La ejecución automática exige esta custodia antes de emitir su señal de éxito.
    // Perder el disco del ejecutor no debe perder las referencias de recuperación.
    if (custodiarComprobante) await custodiarComprobante({ recibo, destino, temporal, control });
    comprobarPlazo();
    await guardarPrivado(join(carpeta, `recibo-${id}.json`), recibo);
    await guardarPrivado(join(carpeta, 'indice.json'), { version: 1, recipient, entorno, proposito, identidadOrigen, archivos: nuevos });
    return { recibo, cantidadArchivos: nuevos.length, reutilizados: nuevos.filter(a => cache.get(a.key)?.cifrado.fileId === a.cifrado.fileId).length };
  } finally {
    clearTimeout(temporizador); controlador.abort();
    try { await snapshot?.cerrar(); } finally {
      try { if (temporal) await rm(temporal, { recursive: true, force: true }); }
      finally { await rm(bloqueo, { recursive: true, force: true }); }
    }
  }
}

// Prepara datos verificados; jamás escribe en una base/R2 ni arranca aplicación, colas o envíos.
export async function prepararRecuperacion({ destino, recibo, carpeta, ageBin, identidad, signal }) {
  exigir(['staging', 'produccion'].includes(recibo?.entorno) && recibo.version === 1 && ['ensayo', 'respaldo'].includes(recibo.proposito), 'Recibo inválido.');
  validarRef(recibo.manifiesto, recibo.entorno, LIMITE_MANIFIESTO + 2 * 1024 ** 2);
  validarRef(recibo.cierre, recibo.entorno, 64 * 1024);
  await directorioPrivado(carpeta);
  const run = await mkdtemp(join(carpeta, 'restauracion-'));
  try {
    await destino.iniciar();
    async function descifrar(ref, nombre, maxBytes) {
      const cipher = join(run, `${randomUUID()}.age`);
      const output = join(run, nombre);
      try {
        await copiarVerificado(await destino.descargar(ref), cipher, ref, signal);
        return await transformarAge({ entrada: createReadStream(cipher), destino: output, bin: ageBin, identidad, maxBytes, signal });
      } finally { await rm(cipher, { force: true }); }
    }
    await descifrar(recibo.cierre, 'cierre.json', 64 * 1024);
    const cierre = JSON.parse(await readFile(join(run, 'cierre.json'), 'utf8'));
    exigir(cierre.version === 1 && cierre.id === recibo.id && cierre.entorno === recibo.entorno && cierre.proposito === recibo.proposito &&
      cierre.manifiesto.fileId === recibo.manifiesto.fileId && cierre.manifiesto.sha256 === recibo.manifiesto.sha256, 'El recibo no coincide con el cierre cifrado.');
    await descifrar(recibo.manifiesto, 'manifiesto.json', LIMITE_MANIFIESTO);
    const m = JSON.parse(await readFile(join(run, 'manifiesto.json'), 'utf8'));
    validarManifiesto(m, recibo.entorno); exigir(m.id === recibo.id && m.proposito === recibo.proposito, 'La copia no coincide con el recibo.');
    const entradas = [m.base, ...m.archivos];
    const mapa = [];
    for (const [i, a] of entradas.entries()) {
      const nombre = i === 0 ? 'base.dump' : `objeto-${String(i).padStart(6, '0')}`;
      const espacio = await statfs(run);
      exigir(espacio.bavail * espacio.bsize >= a.cifrado.bytes + a.original.bytes + 256 * 1024 ** 2, 'No hay espacio para recuperar la copia.');
      const resultado = await descifrar(a.cifrado, nombre, Math.max(a.original.bytes, 1));
      exigir(resultado.resultado.bytes === a.original.bytes && resultado.resultado.sha256 === a.original.sha256, 'La huella descifrada no coincide.');
      if (i) mapa.push({ archivo: nombre, key: a.key, bytes: a.original.bytes, sha256: a.original.sha256 });
    }
    await guardarPrivado(join(run, 'archivos-verificados.json'), mapa);
    const fuentes=[];
    for(const [i,a] of (m.artefactos ?? []).entries()) {
      const nombre=`fuente-${i+1}.tar.gz`;
      const espacio=await statfs(run);
      exigir(espacio.bavail * espacio.bsize >= a.cifrado.bytes + a.original.bytes + 256 * 1024 ** 2,'No hay espacio para recuperar el código.');
      const resultado=await descifrar(a.cifrado,nombre,a.original.bytes);
      exigir(resultado.resultado.bytes === a.original.bytes && resultado.resultado.sha256 === a.original.sha256,'Código recuperado alterado.');
      fuentes.push({archivo:nombre,revision:a.revision,sha256:a.original.sha256});
    }
    await guardarPrivado(join(run,'fuentes-verificadas.json'),fuentes);
    await guardarPrivado(join(run, 'VERIFICADO.json'), { id: m.id, archivos: mapa.length, datosPreparados: true,
      sistemaRestaurado: false, enviosHabilitados: false });
    return { carpeta: run, archivos: mapa.length, sistemaRestaurado: false };
  } catch (error) { await rm(run, { recursive: true, force: true }); throw error; }
}
