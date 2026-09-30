import { DestinoB2 } from './lib/b2.mjs';
import { leerPrivado, guardarPrivado, exigir } from './lib/seguro.mjs';
import { listarComprobantes, leerComprobanteRemoto } from './lib/comprobantes.mjs';
process.umask(0o077);
try {
  exigir([3,5].includes(process.argv.length),'Indicar configuración de lectura y, opcionalmente, fileId y salida privada.');
  const c=await leerPrivado(process.argv[2],128*1024);
  const destino=new DestinoB2(c.b2,{soloLectura:true,signal:AbortSignal.timeout(120_000)});await destino.iniciar();
  const confianza={...c.firmaComprobantes,entorno:c.b2.RESPALDO_ENTORNO};
  if(process.argv.length===3) console.log(JSON.stringify(await listarComprobantes(destino,confianza),null,2));
  else {const recibo=await leerComprobanteRemoto(destino,process.argv[3],confianza);await guardarPrivado(process.argv[4],recibo);console.log('Comprobante auténtico recuperado.');}
} catch {console.error('No se pudo verificar el comprobante. No usar una raíz de recuperación sin verificar.');process.exitCode=1;}
