import { readdir, rm, mkdir, writeFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as pausa } from 'node:timers/promises';
import { directorioPrivado, exigir } from './lib/seguro.mjs';
import { demoraSiguienteCopia } from './lib/horario.mjs';

// ENTRYPOINT mantiene flock durante toda la vida del proceso. Sólo UNA máquina
// puede montar este volumen. El kernel libera flock si el proceso/máquina muere.
process.umask(0o077);
let child; const parada=new AbortController();
for(const s of ['SIGTERM','SIGINT']) process.once(s,()=>{parada.abort();child?.kill('SIGTERM');});
try {
  exigir(process.env.RESPALDO_BAJO_FLOCK==='1','Arrancar mediante entrypoint con bloqueo del volumen.');
  const c=JSON.parse(Buffer.from(process.env.RESPALDO_CONFIG_BASE64 ?? '', 'base64').toString('utf8'));
  delete process.env.RESPALDO_CONFIG_BASE64;
  exigir(c.automatico === true && c.carpeta === '/data/estado' && c.firmaBajoCustodia === true,'Configuración automática incompleta.');
  await directorioPrivado(c.carpeta);
  // Exclusión garantizada por flock: restos de una ejecución interrumpida, no de otro proceso activo.
  for(const nombre of await readdir(c.carpeta)) {
    if(nombre==='ejecucion.lock' || /^temporal-[a-zA-Z0-9]+$/.test(nombre) || /^(?:indice|recibo-[a-f0-9-]+)\.json\.nuevo$/.test(nombre)) {
      const ruta=join(c.carpeta,nombre), info=await lstat(ruta);
      exigir(!info.isSymbolicLink() && info.uid===process.getuid(),'Estado temporal inseguro.');
      await rm(ruta,{recursive:info.isDirectory(),force:true});
    }
  }
  await mkdir('/run/respaldo',{recursive:true,mode:0o700});
  await writeFile('/run/respaldo/config.json',JSON.stringify(c),{mode:0o600});
  do {
    const inicio=Date.now();
    const code=await new Promise(resolve=>{
      child=spawn(process.execPath,['--max-old-space-size=256','/app/ejecutar.mjs','/run/respaldo/config.json'],{
        env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/data',LANG:'C.UTF-8'},stdio:['ignore','inherit','inherit']});
      child.once('error',()=>resolve(1));child.once('exit',code=>resolve(code??1));
    }); child=undefined;
    if(process.env.RESPALDO_UNA_VEZ==='1'){process.exitCode=code;break;}
    if(parada.signal.aborted)break;
    await pausa(demoraSiguienteCopia(inicio,Date.now()),undefined,{signal:parada.signal}).catch(()=>{});
  } while(!parada.signal.aborted);
} catch {console.error('Ejecutor detenido: configuración o bloqueo inválido. El monitor externo detectará ausencia.');process.exitCode=1;}
