import { Readable } from 'node:stream';
import { createReadStream, exigir } from './seguro.mjs';
import { validarConfiguracion, validarPermisos, validarDeposito, CAPACIDADES_LECTOR } from '../validar-destino.mjs';

function urlProveedor(raw, tipo) {
  const u = new URL(raw);
  const patron = tipo === 'upload' ? /^pod-[a-z0-9-]+\.backblaze(?:b2)?\.com$/ : /^f[0-9]+\.backblazeb2\.com$/;
  exigir(u.protocol === 'https:' && patron.test(u.hostname) && !u.port && !u.username && !u.password && !u.search && !u.hash &&
    (tipo === 'upload' ? u.pathname.startsWith('/b2api/v4/b2_upload_file/') : u.pathname === '/'), 'Destino B2 no permitido.');
  return tipo === 'upload' ? u.href : u.origin;
}

async function json(response) {
  if (!response.ok || !response.body) {
    await response.body?.cancel(); throw new Error('B2 rechazó la operación de respaldo.');
  }
  const chunks = []; let size = 0;
  try {
    for await (const chunk of response.body) {
      size += chunk.length; exigir(size <= 512 * 1024, 'Respuesta B2 demasiado grande.'); chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw new Error('Respuesta B2 inválida.'); }
}

export class DestinoB2 {
  constructor(env, { fetchFn = fetch, signal, soloLectura = false } = {}) {
    this.config = validarConfiguracion(env); this.fetchFn = fetchFn; this.signal = signal;
    this.soloLectura = soloLectura;
  }
  async request(url, init, timeout = 15_000) {
    const signal = AbortSignal.any([AbortSignal.timeout(timeout), ...(this.signal ? [this.signal] : [])]);
    try { return await this.fetchFn(url, { ...init, redirect: 'error', signal }); }
    catch { throw new Error('No se pudo contactar B2 de forma segura.'); }
  }
  async iniciar() {
    const c = this.config;
    const auth = await json(await this.request('https://api.backblazeb2.com/b2api/v4/b2_authorize_account', {
      headers: { Authorization: `Basic ${Buffer.from(`${c.keyId}:${c.key}`).toString('base64')}` },
    }));
    this.api = validarPermisos(auth, c, this.soloLectura ? CAPACIDADES_LECTOR : undefined); this.token = auth.authorizationToken;
    this.download = urlProveedor(auth.apiInfo.storageApi.downloadUrl, 'download');
    validarDeposito(await this.call('b2_list_buckets', { accountId: c.accountId, bucketId: c.bucketId }), c);
  }
  async call(op, body) {
    exigir(this.api && this.token, 'B2 no fue verificado.');
    return json(await this.request(`${this.api}/b2api/v4/${op}`, {
      method: 'POST', headers: { Authorization: this.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }));
  }
  comprobarInfo(info, ref, hasta) {
    exigir(info?.accountId === this.config.accountId && info.bucketId === this.config.bucketId && info.action === 'upload' &&
      info.fileId === ref.fileId && info.fileName === ref.fileName && info.fileName.startsWith(this.config.prefijo) &&
      info.contentLength === ref.bytes && info.contentSha1 === ref.sha1, 'La versión B2 no coincide con el respaldo.');
    const lock = info.fileRetention;
    exigir(lock?.isClientAuthorizedToRead === true && lock.value?.mode === 'compliance' &&
      Number.isSafeInteger(lock.value.retainUntilTimestamp) && lock.value.retainUntilTimestamp >= hasta, 'La versión B2 no tiene la protección requerida.');
    return lock.value.retainUntilTimestamp;
  }
  async subir(path, nombre, huella, hasta) {
    exigir(!this.soloLectura, 'El restaurador no puede escribir respaldos.');
    exigir(nombre.startsWith(this.config.prefijo) && /^[a-z0-9/._-]+$/.test(nombre), 'Nombre de respaldo no permitido.');
    const target = await this.call('b2_get_upload_url', { bucketId: this.config.bucketId });
    exigir(target.bucketId === this.config.bucketId && typeof target.authorizationToken === 'string', 'Destino de subida inválido.');
    const stream = createReadStream(path);
    let info;
    try {
      info = await json(await this.request(urlProveedor(target.uploadUrl, 'upload'), {
        method: 'POST', duplex: 'half', body: stream,
        headers: { Authorization: target.authorizationToken, 'Content-Type': 'application/octet-stream',
          'Content-Length': String(huella.bytes), 'X-Bz-File-Name': encodeURIComponent(nombre),
          'X-Bz-Content-Sha1': huella.sha1, 'X-Bz-File-Retention-Mode': 'compliance',
          'X-Bz-File-Retention-Retain-Until-Timestamp': String(hasta) },
      }, 15 * 60_000));
    } finally { stream.destroy(); }
    exigir(typeof info.fileId === 'string' && info.fileId.length > 0, 'B2 no devolvió una versión válida.');
    const ref = { ...huella, fileId: info.fileId, fileName: nombre };
    this.comprobarInfo(info, ref, hasta);
    this.comprobarInfo(await this.call('b2_get_file_info', { fileId: ref.fileId }), ref, hasta);
    return ref;
  }
  async proteger(ref, hasta) {
    exigir(!this.soloLectura, 'El restaurador no puede cambiar retenciones.');
    const info = await this.call('b2_get_file_info', { fileId: ref.fileId });
    const actual = this.comprobarInfo(info, ref, 0);
    if (actual < hasta) {
      await this.call('b2_update_file_retention', { fileId: ref.fileId, fileName: ref.fileName,
        fileRetention: { mode: 'compliance', retainUntilTimestamp: hasta } });
      this.comprobarInfo(await this.call('b2_get_file_info', { fileId: ref.fileId }), ref, hasta);
    }
  }
  async descargar(ref) {
    this.comprobarInfo(await this.call('b2_get_file_info', { fileId: ref.fileId }), ref, 0);
    const response = await this.request(`${this.download}/b2api/v4/b2_download_file_by_id?fileId=${encodeURIComponent(ref.fileId)}`,
      { headers: { Authorization: this.token } }, 15 * 60_000);
    if (!response.ok || !response.body || Number(response.headers.get('content-length')) !== ref.bytes) {
      await response.body?.cancel(); throw new Error('No se pudo descargar la versión exacta del respaldo.');
    }
    return Readable.fromWeb(response.body);
  }
}
