import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { configuracion, entornoNext, FlyStaging, Sesion } from './control.mjs';

export function cabeceras(headers) {
  const quitar = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', ...(headers.connection ?? '').toLowerCase().split(',').map((s) => s.trim())]);
  return Object.fromEntries(Object.entries(headers).filter(([k]) => !quitar.has(k.toLowerCase())));
}

const ESPERA = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="4"><title>Preparando staging · Grafoprint</title><style>body{margin:0;background:#f6f5f2;color:#171918;font:17px system-ui;display:grid;min-height:100vh;place-items:center}main{max-width:480px;padding:32px}small{color:#666}h1{font-size:28px}p{line-height:1.6}</style><main><small>GRAFOPRINT · ENTORNO DE PRUEBAS</small><h1>Estamos preparando staging</h1><p>La aplicación se abrirá automáticamente cuando termine de encenderse.</p><small>La primera apertura puede demorar uno o dos minutos.</small></main></html>`;

export function crearServidor(sesion, { portNext = 3002, log = console.log } = {}) {
  const servidor = http.createServer(async (req, res) => {
    if (req.url?.split('?')[0] === '/api/health' && ['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ status: 'ok', service: 'grafoprint-staging-demanda', ready: sesion.lista }));
      return;
    }
    const terminar = sesion.entrar();
    res.once('close', terminar);
    res.once('finish', terminar);
    try {
      if ((!sesion.lista || sesion.operacion) && req.method === 'GET' && req.headers.accept?.includes('text/html')) {
        void sesion.preparar().catch(() => log('staging_demanda: arranque pendiente; se reintentará al acceder.'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" });
        res.end(ESPERA);
        return;
      }
      await sesion.preparar();
      if (res.destroyed) return;
      const upstream = http.request({ hostname: '127.0.0.1', port: portNext, path: req.url, method: req.method, headers: cabeceras(req.headers) }, (respuesta) => {
        res.writeHead(respuesta.statusCode, cabeceras(respuesta.headers));
        respuesta.on('error', () => res.destroy());
        respuesta.pipe(res);
      });
      upstream.on('error', () => {
        if (res.headersSent) res.destroy();
        else { res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '5', 'Cache-Control': 'no-store' }); res.end('Staging está iniciando. Volvé a intentar en unos segundos.'); }
      });
      req.on('aborted', () => upstream.destroy());
      res.on('close', () => upstream.destroy());
      req.pipe(upstream);
    } catch {
      log('staging_demanda: preparación incompleta; no se envió la solicitud a la aplicación.');
      if (!res.destroyed && !res.headersSent) { res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '10' }); res.end('No se pudo preparar staging. Intentá nuevamente en unos segundos.'); }
    }
  });
  servidor.on('upgrade', (_req, socket) => { socket.end('HTTP/1.1 426 Upgrade Required\r\nConnection: close\r\n\r\n'); });
  return servidor;
}

export function retencionVigente(ahora = Date.now()) {
  try {
    const hasta = Number(readFileSync('/tmp/staging-demanda-mantener-hasta', 'utf8'));
    return Number.isSafeInteger(hasta) && hasta > ahora && hasta <= ahora + 86400000;
  } catch { return false; }
}

async function main() {
  const config = configuracion(process.env);
  const fly = new FlyStaging(config);
  const sesion = new Sesion(fly, config);
  const inactiva = sesion.inactiva.bind(sesion);
  sesion.inactiva = () => !retencionVigente() && inactiva();
  const child = spawn(process.execPath, ['/app/server.js'], { cwd: '/app', env: entornoNext(process.env), stdio: 'inherit' });
  let saliendo = false;
  const servidor = crearServidor(sesion);
  const salir = (codigo) => {
    if (saliendo) return;
    saliendo = true; clearInterval(timer);
    servidor.close(); child.kill('SIGTERM');
    const forzar = setTimeout(() => process.exit(codigo), 25000); forzar.unref();
    child.once('exit', () => process.exit(codigo));
  };
  child.on('error', () => salir(1));
  child.on('exit', () => { if (!saliendo) process.exit(1); });
  const timer = setInterval(async () => {
    try { if (await sesion.reposar() && sesion.inactiva()) { console.log('staging_demanda: servicios detenidos por inactividad.'); salir(0); } }
    catch { console.error('staging_demanda: parada no confirmada; se conserva o recupera el servicio.'); await sesion.preparar().catch(() => {}); }
  }, 30000);
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => salir(0));
  servidor.listen(3000, '0.0.0.0');
  console.log(`staging_demanda: control iniciado; reposo después de ${config.idleMs / 60000} minutos.`);
  void sesion.preparar().then(() => console.log('staging_demanda: servicios preparados.')).catch(() => console.error('staging_demanda: inicio pendiente; reintento al acceder.'));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch(() => { console.error('staging_demanda: configuración inválida.'); process.exitCode = 1; });
