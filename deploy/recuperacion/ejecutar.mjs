import { DestinoB2 } from './lib/b2.mjs';
import { OrigenPostgresR2 } from './lib/origen.mjs';
import { respaldar } from './lib/motor.mjs';
import { exigir, leerPrivado, versionHerramienta } from './lib/seguro.mjs';

process.umask(0o077);
let origen;
try {
  exigir(process.argv.length === 3, 'Indicar archivo privado de configuración.');
  const c = await leerPrivado(process.argv[2], 128 * 1024);
  // Producción se habilitará sólo tras el ensayo completo de staging y su revisión.
  exigir(c.b2?.RESPALDO_ENTORNO === 'staging', 'Esta versión del ejecutor sólo habilita staging.');
  exigir(c.accesoOrigenSoloLecturaVerificado === true && c.custodiaVerificada === true,
    'Falta comprobar accesos de lectura y custodia antes de operar.');
  const signal = AbortSignal.timeout(45 * 60_000);
  const ctrl = new AbortController();
  const cancelar = () => ctrl.abort(); process.once('SIGINT', cancelar); process.once('SIGTERM', cancelar);
  const control = AbortSignal.any([signal, ctrl.signal]);
  const herramientas = { node: process.version,
    age: await versionHerramienta(c.ageBin, /^v1\.3\.\d+$/),
    pgDump: await versionHerramienta(c.origen.pgDumpBin, /^pg_dump \(PostgreSQL\) 16\.\d+(?: [\w ().+-]+)?$/) };
  origen = new OrigenPostgresR2(c.origen);
  const destino = new DestinoB2(c.b2, { signal: control });
  const resultado = await respaldar({ origen, destino, carpeta: c.carpeta, ageBin: c.ageBin, recipient: c.recipient,
    entorno: 'staging', identidadOrigen: `${c.origen.pgHost}/${c.origen.pgDatabase}/${c.origen.r2Bucket}`, signal: control, herramientas });
  console.log(JSON.stringify({ copiaCompleta: true, id: resultado.recibo.id, archivos: resultado.cantidadArchivos,
    reutilizados: resultado.reutilizados, restauracionComprobada: false }));
} catch {
  // No exponer errores SQL, nombres de clientes, URLs, tokens ni stderr externos.
  console.error('No se pudo completar el respaldo. No considerarlo una copia válida; revisar configuración, disponibilidad y controles.');
  process.exitCode = 1;
} finally { origen?.cerrar(); }
