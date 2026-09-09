/* BullMQ real + checkpoint PostgreSQL + SIGKILL + guardia de procesos.
 * El solver entrega una referencia real validada mediante una barrera controlada;
 * no mide velocidad geométrica. No modifica colas ni tenants comerciales.
 * node apps/api/test/benchmarks/cola-recuperacion.cjs [carpeta-salida]
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { fork, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const { randomUUID, createHash } = require('node:crypto');
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis').default;
const { PrismaClient } = require('@prisma/client');
const { snapshotsExtension } = require('../../dist/src/prisma/snapshots.extension');
const { OpenNestService, ejecutarSubprocesoJson } = require('../../dist/src/workers/geometria/opennest.service');
const { GeometriaWorker } = require('../../dist/src/workers/geometria/geometria.worker');
const { NestingsGuardadosService } = require('../../dist/src/workers/geometria/nestings-guardados.service');
const { CapacidadGeometriaService } = require('../../dist/src/workers/geometria/capacidad-geometria.service');
const { TenantConcurrencyService } = require('../../dist/src/workers/tenant-concurrency.service');
const { contarPatronesResultado } = require('../../dist/src/workers/geometria/calidad-nesting');
const { validarResultadoNestingOpenNest } = require('../../dist/src/workers/geometria/validar-nesting-opennest');
const { COLA_GEOMETRIA_INTENSIVA, TRABAJO_NESTING_IRREGULAR_OPENNEST } = require('../../dist/src/workers/colas');
const { conexionRedisWorker, urlRedisWorkers } = require('../../dist/src/workers/redis');
const root = path.resolve(__dirname, '../../../..');
const datasourceUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5436/gdi_saas_test?schema=public';
if (!new URL(datasourceUrl).pathname.endsWith('_test')) throw new Error('Se requiere una base terminada en _test.');
const db = new PrismaClient({ datasourceUrl }).$extends(snapshotsExtension);
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const until = async (fn,timeout=120000) => { const limit=Date.now()+timeout; while (!(await fn())) { assert.ok(Date.now()<limit,'Se agotó el plazo del ensayo.'); await sleep(100); } };
const detenido = pid => { try { return execFileSync('ps',['-o','stat=','-p',String(pid)],{encoding:'utf8'}).trim().startsWith('Z'); } catch { return true; } };

async function hijo(mode,folder) {
  const config=JSON.parse(fs.readFileSync(path.join(folder,'config.json')));
  process.env.GRAFONEST_POOL_ID=config.prefix;
  const reference=JSON.parse(fs.readFileSync(path.join(folder,'referencia.json')));
  class GuardadosBarrera extends NestingsGuardadosService {
    async guardarCheckpoint(input,result) {
      await super.guardarCheckpoint(input,result);
      if (mode === 'interrumpir' && result.placasUsadas === 64) {
        const code = `import os,sys,time,subprocess\nfrom pathlib import Path\nsys.path.insert(0,${JSON.stringify(path.join(root,'apps/api/dist/src/workers/geometria/python'))})\nfrom process_guard import start_guard\nstart_guard()\nchild=subprocess.Popen([sys.executable,'-c','import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(120)'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)\nPath(${JSON.stringify(path.join(folder,'nativo.json'))}).write_text(__import__('json').dumps({'runner':os.getpid(),'native':child.pid}))\ntime.sleep(120)\n`;
        const native=ejecutarSubprocesoJson({ejecutable:'python3',argumentos:['-c',code],entrada:{},timeoutMs:120000});
        native.catch(()=>undefined);
        await until(()=>fs.existsSync(path.join(folder,'nativo.json')),5000);
        process.send({tipo:'checkpoint',placas:result.placasUsadas,patrones:contarPatronesResultado(result),tiempo:Date.now()});
        await native;
      }
    }
  }
  class SolverControlado extends OpenNestService {
    async ejecutarRunner(options) {
      if (mode === 'interrumpir') {
        const giros=new Map(options.entrada.piezas.map(p=>[p.id,p.rotaciones]));
        if (!reference.placements.every(p=>Number.isInteger(p.rotacionGrados*giros.get(p.piezaId)/360)))
          return {ok:false,error:{message:'El candidato requiere otros giros.'}};
        return {ok:true,result:{...reference,motor:options.entrada.motor}};
      }
      await sleep(options.timeoutMs);
      return {ok:false,error:{message:'No hay mejora durante esta prueba de recuperación.'}};
    }
  }
  const capacity=new CapacidadGeometriaService(), tenant=new TenantConcurrencyService();
  const engine=new GeometriaWorker(new SolverControlado(new GuardadosBarrera(db)),{leerCancelacion:async()=>false},tenant,capacity);
  await capacity.estado();
  const worker=new Worker(COLA_GEOMETRIA_INTENSIVA,j=>engine.procesar(j,worker),{prefix:config.prefix,connection:conexionRedisWorker(),concurrency:1,lockDuration:5000,stalledInterval:1000,maxStalledCount:2});
  engine.conectarEventos(worker);
  worker.on('stalled',id=>process.send({tipo:'stalled',id,tiempo:Date.now()}));
  worker.on('completed',j=>process.send({tipo:'completado',id:j.id,tiempo:Date.now()}));
  worker.on('failed',(j,e)=>process.send({tipo:'fallido',id:j?.id,message:e.message}));
  await worker.waitUntilReady(); process.send({tipo:'listo',pid:process.pid});
  await new Promise(r=>process.once('message',r));
  await worker.close(); capacity.onApplicationShutdown(); tenant.onApplicationShutdown(); process.disconnect();
}

async function principal() {
  const folder=path.resolve(process.argv[2] || path.join(root,'output/grafonest-transformacion-2026-09-09/cola-recuperacion'));
  fs.mkdirSync(folder,{recursive:true}); fs.rmSync(path.join(folder,'nativo.json'),{force:true});
  const tenantId=randomUUID(), prefix=`grafonest-recovery-test-${randomUUID()}`;
  process.env.GRAFONEST_POOL_ID=prefix;
  const capacity=new CapacidadGeometriaService(), guardados=new NestingsGuardadosService(db);
  const redis=new Redis(urlRedisWorkers(),{maxRetriesPerRequest:1});
  const queue=new Queue(COLA_GEOMETRIA_INTENSIVA,{prefix,connection:conexionRedisWorker()});
  const children=[],events=[]; let native;
  const spawn = mode => {
    const child=fork(__filename,['--hijo',mode,folder],{stdio:['ignore','pipe','pipe','ipc']});
    children.push(child); child.on('message',e=>events.push({...e,mode}));
    const log=fs.createWriteStream(path.join(folder,`${mode}.log`));
    child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});child.once('exit',()=>log.end());
    return child;
  };
  try {
    await db.tenant.create({data:{id:tenantId,nombre:'Recuperación BullMQ GrafoNest',slug:tenantId}});
    const input={...JSON.parse(fs.readFileSync(path.join(root,'output/grafonest-mejoras-2026-09-09/entrada-100.json'))),tenantId,correlationId:randomUUID(),timeoutMs:9000};
    const reference=JSON.parse(fs.readFileSync(path.join(root,'output/grafonest-transformacion-2026-09-09/biblioteca-patrones-nativos/resultado-100.json')));
    validarResultadoNestingOpenNest(input,reference);
    fs.writeFileSync(path.join(folder,'entrada.json'),JSON.stringify(input)); fs.writeFileSync(path.join(folder,'referencia.json'),JSON.stringify(reference));
    fs.writeFileSync(path.join(folder,'config.json'),JSON.stringify({prefix,tenantId}));
    const first=spawn('interrumpir'); await until(()=>events.some(e=>e.mode==='interrumpir' && e.tipo==='listo'),10000);
    const jobId='recuperable'; await capacity.registrar({jobId,tenantId,clase:'intensiva',prioridad:20},false);
    const job=await queue.add(TRABAJO_NESTING_IRREGULAR_OPENNEST,input,{jobId,priority:20,attempts:1}); await capacity.confirmar(jobId);
    await until(()=>events.some(e=>e.tipo==='checkpoint'),30000);
    assert.equal(await guardados.obtener(input),null,'El checkpoint no debe publicar el precio definitivo.');
    native=JSON.parse(fs.readFileSync(path.join(folder,'nativo.json')));
    const crashedAt=Date.now(), closed=once(first,'exit'); first.kill('SIGKILL'); assert.equal((await closed)[1],'SIGKILL');
    await until(()=>detenido(native.runner) && detenido(native.native),5000);
    const cleanupMs=Date.now()-crashedAt;
    const checkpoint=await guardados.obtenerCheckpoint(input); assert.equal(checkpoint.placasUsadas,64); assert.equal(contarPatronesResultado(checkpoint),5);
    spawn('recuperar');
    await until(async()=>{
      const state=await job.getState(); assert.notEqual(state,'failed',JSON.stringify(events));
      const s=await capacity.estado(); assert.ok(s.permisosActivos<=1 && s.intensivosActivos<=1);
      return state==='completed';
    },120000);
    const finalJob=await queue.getJob(jobId), result=finalJob.returnvalue;
    validarResultadoNestingOpenNest(input,result); assert.equal(result.cantidadColocada,900); assert.equal(result.placasUsadas,64); assert.equal(contarPatronesResultado(result),5);
    assert.ok(events.some(e=>e.tipo==='stalled'),'BullMQ debe detectar y recuperar el job detenido.');
    assert.equal(await guardados.obtenerCheckpoint(input),null); assert.equal((await capacity.estado()).permisosActivos,0);
    const summary={interrupcion:'SIGKILL',limpiezaDescendientesMs:cleanupMs,recuperacionTotalMs:Date.now()-crashedAt,leaseMs:60000,
      piezas:result.cantidadColocada,placas:result.placasUsadas,patrones:contarPatronesResultado(result),intentosFinalizados:finalJob.attemptsMade,
      eventosFallidos:events.filter(e=>e.tipo==='fallido').length,
      intentosIniciados:finalJob.attemptsStarted,checkpointLimpio:true,geometriaValidada:true,solverControlado:true,estadoFinal:await capacity.estado()};
    fs.writeFileSync(path.join(folder,'eventos.json'),JSON.stringify(events));fs.writeFileSync(path.join(folder,'resultado.json'),JSON.stringify(result));
    fs.writeFileSync(path.join(folder,'aceptacion.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
  } finally {
    for (const child of children) if(child.exitCode===null && child.signalCode===null) { const closed=once(child,'exit');child.send('terminar');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);await closed;clearTimeout(timer); }
    if(native && !detenido(native.runner)) { try {process.kill(-native.runner,'SIGKILL');} catch {} }
    await queue.obliterate({force:true});await queue.close();
    for(const pattern of [`grafo:geometry:capacity:v1:{${createHash('sha256').update(prefix).digest('hex')}}*`,`grafo:worker:v1:tenant:${createHash('sha256').update(tenantId).digest('hex')}:*`]){
      let cursor='0';do{const [next,keys]=await redis.scan(cursor,'MATCH',pattern,'COUNT',100);if(keys.length)await redis.del(...keys);cursor=next;}while(cursor!=='0');
    }
    capacity.onApplicationShutdown();redis.disconnect();await db.tenant.deleteMany({where:{id:tenantId}});
  }
}
(process.argv[2]==='--hijo'?hijo(process.argv[3],process.argv[4]):principal()).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
