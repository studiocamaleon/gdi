import { DestinoB2 } from './lib/b2.mjs';
import { prepararRecuperacion } from './lib/motor.mjs';
import { exigir, leerPrivado } from './lib/seguro.mjs';

process.umask(0o077);
try {
  exigir(process.argv.length === 3, 'Indicar configuración privada de recuperación.');
  const c = await leerPrivado(process.argv[2], 128 * 1024);
  const recibo = await leerPrivado(c.recibo, 64 * 1024);
  exigir(recibo.entorno === c.b2.RESPALDO_ENTORNO, 'El recibo pertenece a otro entorno.');
  const ctrl = new AbortController();
  process.once('SIGINT', () => ctrl.abort()); process.once('SIGTERM', () => ctrl.abort());
  const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(2 * 60 * 60_000)]);
  const destino = new DestinoB2(c.b2, { signal, soloLectura: true });
  const result = await prepararRecuperacion({ destino, recibo, carpeta: c.carpeta, ageBin: c.ageBin, identidad: c.identidad, signal });
  console.log(JSON.stringify({ datosVerificados: true, carpeta: result.carpeta, archivos: result.archivos,
    sistemaRestaurado: false, enviosHabilitados: false }));
} catch {
  console.error('No se pudo verificar la recuperación. No utilizar datos parciales ni habilitar la aplicación.');
  process.exitCode = 1;
}
