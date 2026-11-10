import { setTimeout as pausa } from 'node:timers/promises';

export const WEB = 'grafoprint-staging-web';
export const APPS = Object.freeze({
  api: 'grafoprint-staging-api', worker: 'grafoprint-staging-worker',
  workerPdf: 'grafoprint-staging-worker-pdf', pdf: 'grafoprint-staging-pdf',
});
export const COMANDO_OCUPACION = Object.freeze(['node', '/app/staging-demanda/ocupacion.cjs']);
const VARIABLES = { api: 'STAGING_DEMANDA_TOKEN_API', worker: 'STAGING_DEMANDA_TOKEN_WORKER', workerPdf: 'STAGING_DEMANDA_TOKEN_WORKER_PDF', pdf: 'STAGING_DEMANDA_TOKEN_PDF' };

export function configuracion(env) {
  if (env.FLY_APP_NAME !== WEB || env.STAGING_PRIVATE !== 'true' || env.STAGING_DEMANDA_ENABLED !== 'true') {
    throw new Error('El controlador sólo puede ejecutarse en la web de staging.');
  }
  const idleMs = Number(env.STAGING_DEMANDA_IDLE_SECONDS ?? 900) * 1000;
  if (!Number.isSafeInteger(idleMs) || idleMs < 60000 || idleMs > 86400000) throw new Error('Inactividad inválida.');
  const tokens = Object.fromEntries(Object.entries(VARIABLES).map(([rol, variable]) => [rol, env[variable]]));
  if (Object.values(tokens).some((t) => !t) || !env.STAGING_DEMANDA_TOKEN_LECTURA) throw new Error('Faltan accesos limitados de staging.');
  return { idleMs, tokens, execToken: env.STAGING_DEMANDA_TOKEN_LECTURA };
}

export function entornoNext(env) {
  return Object.fromEntries(Object.entries({ ...env, PORT: '3002', HOSTNAME: '127.0.0.1' })
    .filter(([k]) => !k.startsWith('STAGING_DEMANDA_') && k !== 'FLY_API_TOKEN' && k !== 'FLY_ACCESS_TOKEN'));
}

export class FlyStaging {
  constructor(config, { fetcher = fetch, dormir = pausa, ahora = Date.now } = {}) {
    this.config = config; this.fetcher = fetcher; this.dormir = dormir; this.ahora = ahora;
  }
  async peticion(rol, sufijo = '', cuerpo, exec = false) {
    if (!Object.hasOwn(APPS, rol)) throw new Error('Destino ajeno a staging.');
    if (!/^\/(?:[a-f0-9]{14}(?:\/(?:start|stop|exec))?)?$/.test(sufijo || '/') && sufijo !== '') throw new Error('Operación no permitida.');
    const token = exec ? this.config.execToken : this.config.tokens[rol];
    const res = await this.fetcher(`https://api.machines.dev/v1/apps/${APPS[rol]}/machines${sufijo}`, {
      method: cuerpo === undefined ? 'GET' : 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo), signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`Fly ${rol}: HTTP ${res.status}.`);
    const texto = await res.text();
    return texto ? JSON.parse(texto) : {};
  }
  async maquina(rol) {
    const lista = await this.peticion(rol);
    if (!Array.isArray(lista) || lista.length !== 1 || !/^[a-f0-9]{14}$/.test(lista[0].id)) throw new Error(`Se esperaba una máquina en ${rol}.`);
    const m = lista[0];
    if (rol !== 'pdf' && m.config?.env?.GRAFO_DEPLOY_ENV !== 'staging') throw new Error('Entorno de máquina incorrecto.');
    return m;
  }
  async esperar(rol, estado, limite = 180000) {
    const fin = this.ahora() + limite;
    while (this.ahora() < fin) {
      const m = await this.maquina(rol);
      if (m.state === estado) return m;
      await this.dormir(1500);
    }
    throw new Error(`Tiempo agotado: ${rol} no llegó a ${estado}.`);
  }
  async encender() {
    // Las peticiones del navegador esperan a que el conjunto esté preparado.
    const iniciar = async (rol) => {
      let m = await this.maquina(rol);
      if (m.state === 'stopping') m = await this.esperar(rol, 'stopped', 330000);
      if (m.state === 'stopped' || m.state === 'suspended') await this.peticion(rol, `/${m.id}/start`, {});
      else if (!['started', 'starting'].includes(m.state)) throw new Error(`Estado inesperado de ${rol}.`);
      await this.esperar(rol, 'started');
    };
    await Promise.all(['api', 'pdf'].map(iniciar));
    const fin = this.ahora() + 180000;
    while (this.ahora() < fin) {
      const listas = await Promise.all(['http://grafoprint-staging-api.internal:3001/api', 'http://grafoprint-staging-pdf.internal:3000/health'].map(async (url) => {
        try { const r = await this.fetcher(url, { signal: AbortSignal.timeout(5000), redirect: 'error' }); await r.arrayBuffer(); return r.ok; } catch { return false; }
      }));
      if (listas.every(Boolean)) { await Promise.all(['worker', 'workerPdf'].map(iniciar)); return; }
      await this.dormir(1500);
    }
    throw new Error('Los servicios de staging no están listos.');
  }
  async libre() {
    const m = await this.maquina('api');
    if (m.state !== 'started') throw new Error('API apagada: no se puede comprobar la ocupación.');
    const r = await this.peticion('api', `/${m.id}/exec`, { command: COMANDO_OCUPACION, timeout: 20 }, true);
    if ((r.exit_code ?? 0) !== 0 || r.exit_signal || r.stderr) throw new Error('Comprobación de ocupación fallida.');
    const s = JSON.parse(r.stdout);
    if (s.version !== 1 || ![s.redisPendientes, s.postgresPendientes].every((n) => Number.isSafeInteger(n) && n >= 0) || s.libre !== (s.redisPendientes + s.postgresPendientes === 0)) throw new Error('Respuesta de ocupación inválida.');
    return s.libre;
  }
  async detener(rol) {
    const m = await this.maquina(rol);
    if (m.state === 'stopped') return;
    if (m.state !== 'started') throw new Error(`No detener ${rol} durante una transición.`);
    // SIGTERM permite cerrar BullMQ y esperar las operaciones ya aceptadas.
    await this.peticion(rol, `/${m.id}/stop`, { signal: 'SIGTERM', timeout: '300s' });
    await this.esperar(rol, 'stopped', 330000);
  }
  async apagar(sigueInactivo) {
    if (!sigueInactivo() || !await this.libre() || !sigueInactivo()) return false;
    // El API queda disponible para comprobar otra vez la cola después de drenar.
    for (const rol of ['worker', 'workerPdf']) {
      if (!sigueInactivo()) { await this.encender(); return false; }
      await this.detener(rol);
    }
    if (!sigueInactivo() || !await this.libre()) { await this.encender(); return false; }
    for (const rol of ['pdf', 'api']) {
      if (!sigueInactivo()) { await this.encender(); return false; }
      await this.detener(rol);
    }
    if (!sigueInactivo()) { await this.encender(); return false; }
    return true;
  }
}

// Serializa el arranque y la parada; una visita durante la parada cancela el reposo.
export class Sesion {
  constructor(fly, { idleMs = 900000, ahora = Date.now } = {}) {
    this.fly = fly; this.idleMs = idleMs; this.ahora = ahora;
    this.ultima = ahora(); this.activas = 0; this.lista = false; this.operacion = null;
  }
  entrar() { this.ultima = this.ahora(); this.activas++; let cerrada = false; return () => { if (!cerrada) { cerrada = true; this.activas--; this.ultima = this.ahora(); } }; }
  inactiva() { return this.activas === 0 && this.ahora() - this.ultima >= this.idleMs; }
  async preparar() {
    if (this.operacion) await this.operacion;
    if (this.lista) return;
    if (!this.operacion) {
      this.operacion = this.fly.encender().then(() => { this.lista = true; }).finally(() => { this.operacion = null; });
    }
    await this.operacion;
  }
  async reposar() {
    if (this.operacion || !this.inactiva()) return false;
    this.lista = false;
    this.operacion = this.fly.apagar(() => this.inactiva()).finally(() => { this.operacion = null; });
    return await this.operacion;
  }
}
