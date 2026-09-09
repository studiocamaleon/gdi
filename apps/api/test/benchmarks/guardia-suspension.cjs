/* Suspensión real de un coordinador propio: comprueba los 45 segundos sin
 * pulsos y el cierre de descendientes antes del permiso Redis de 60 segundos.
 * No usa Redis/DB ni suspende servicios de la aplicación.
 */
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {fork,execFileSync}=require('node:child_process');
const {once}=require('node:events');
const {ejecutarSubprocesoJson}=require('../../dist/src/workers/geometria/opennest.service');
const root=path.resolve(__dirname,'../../../..');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const detenido=pid=>{try{return execFileSync('ps',['-o','stat=','-p',String(pid)],{encoding:'utf8'}).trim().startsWith('Z');}catch{return true;}};
async function hijo(folder){
  const code=`import os,sys,time,subprocess,json\nfrom pathlib import Path\nsys.path.insert(0,${JSON.stringify(path.join(root,'apps/api/dist/src/workers/geometria/python'))})\nfrom process_guard import start_guard\nstart_guard()\nchild=subprocess.Popen([sys.executable,'-c','import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(120)'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)\nPath(${JSON.stringify(path.join(folder,'procesos.json'))}).write_text(json.dumps({'runner':os.getpid(),'native':child.pid}))\ntime.sleep(120)\n`;
  try{await ejecutarSubprocesoJson({ejecutable:'python3',argumentos:['-c',code],entrada:{},timeoutMs:120000});throw new Error('Debía terminar sin resultado.');}
  catch(e){process.send({tipo:'fin',codigo:e.codigo});}
  process.disconnect();
}
async function principal(){
  const folder=path.resolve(process.argv[2]||'output/grafonest-transformacion-2026-09-09/guardia-suspension');
  fs.mkdirSync(folder,{recursive:true});fs.rmSync(path.join(folder,'procesos.json'),{force:true});
  const child=fork(__filename,['--hijo',folder],{stdio:['ignore','ignore','inherit','ipc']});
  const closed=once(child,'exit');const events=[];child.on('message',e=>events.push(e));let native;
  try{
    const limit=Date.now()+10000;
    while(!fs.existsSync(path.join(folder,'procesos.json'))){assert.ok(Date.now()<limit);await sleep(50);}
    native=JSON.parse(fs.readFileSync(path.join(folder,'procesos.json')));
    // Dejar pasar dos pulsos: si no funcionaran, la guardia vencería antes.
    await sleep(11000);assert.ok(!detenido(native.runner));
    child.kill('SIGSTOP');const start=Date.now();
    while(!detenido(native.runner)||!detenido(native.native)){assert.ok(Date.now()-start<55000,'La guardia no terminó el grupo.');await sleep(200);}
    const silenceMs=Date.now()-start;assert.ok(silenceMs>38000 && silenceMs<50000);
    child.kill('SIGCONT');assert.equal((await closed)[0],0);
    assert.equal(events[0]?.codigo,'INVALID_OUTPUT');
    const summary={interrupcion:'SIGSTOP',pulsosPrevios:2,terminacionTrasSuspensionMs:silenceMs,antesDeLease60s:true,descendientesDetenidos:true};
    fs.writeFileSync(path.join(folder,'aceptacion.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
  }finally{
    if(child.exitCode===null && child.signalCode===null){child.kill('SIGCONT');child.kill('SIGKILL');await closed;}
    if(native && !detenido(native.runner)){try{process.kill(-native.runner,'SIGKILL');}catch{}}
  }
}
(process.argv[2]==='--hijo'?hijo(process.argv[3]):principal()).catch(e=>{console.error(e);process.exitCode=1;});
