/** Ensayo con procesos, PostgreSQL y Redis reales. La cotización es un proveedor
 * controlado para interrumpir exactamente dentro del cálculo; no mide nesting. */
const path=require('node:path');
const {readFileSync,writeFileSync}=require('node:fs');
const {randomUUID}=require('node:crypto');
const {fork,execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const url=process.env.F6_SAAS_DATABASE_URL;
if(!url||new URL(url).pathname!=='/gdi_saas_f6_saas_20260911')throw Error('Base exclusiva requerida');
process.env.DATABASE_URL=url;process.env.REDIS_URL='redis://127.0.0.1:6391';
process.env.WORKER_TENANT_QUOTE_CONCURRENCY='1';
require('ts-node').register({transpileOnly:true,project:path.join(root,'tsconfig.json')});
const {PrismaService}=require('../../dist/src/prisma/prisma.service');
const {EtaService}=require('../../dist/src/eta/eta.service');
const {ProduccionService}=require('../../dist/src/produccion/produccion.service');
const {PlanificacionEntregasService}=require('../../dist/src/planificacion-entregas/planificacion.service');
const {PlanificacionEntregasWorker}=require('../../dist/src/planificacion-entregas/planificacion.worker');
const {PlanificacionEntregasDispatcher}=require('../../dist/src/planificacion-entregas/planificacion-dispatcher');
const {TenantConcurrencyService}=require('../../dist/src/workers/tenant-concurrency.service');
const {cotizacionesExhibidor}=require('../fixtures/f6-planificacion/cotizaciones-exhibidor');
const Redis=require('ioredis');
const db=new PrismaService();
const service=new PlanificacionEntregasService(db,new EtaService(db,new ProduccionService(db)));
const out=path.resolve(__dirname,'../../../../output/f6-saas-2026-09-11');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fuentes=cotizacionesExhibidor();

async function child(){
 const concurrency=new TenantConcurrencyService();
 const worker=new PlanificacionEntregasWorker(service,{cotizar:async input=>{
   process.send?.({tipo:'cotizando',cantidad:input.jobContext.cantidad});
   await sleep(Number(process.env.F6_QUOTE_DELAY_MS??'30'));
   return {exitoso:true,errores:[],advertencias:[],cotizacion:{...fuentes.find(f=>f.cotizacion.cantidadPedida===Number(input.jobContext.cantidad)).cotizacion,productoId:input.productoId}};
 }},concurrency);
 await worker.onApplicationBootstrap();process.send?.({tipo:'listo'});
 process.on('SIGTERM',async()=>{await worker.onApplicationShutdown();concurrency.onApplicationShutdown();await db.$disconnect();process.exit(0)});
}
async function crear(t){
 const sub=await db.productoSubcategoriaComercial.findFirstOrThrow();
 const p=await db.producto.create({data:{tenantId:t.tenantId,subcategoriaComercialId:sub.id,codigo:`RC-${randomUUID()}`,nombre:'QA recuperación'}});
 const q=await db.cotizacion.create({data:{tenantId:t.tenantId}});
 const c=await db.cotizacionItem.create({data:{tenantId:t.tenantId,cotizacionId:q.id,productoId:p.id,cantidad:200,jobContextJson:{cantidad:200},snapshotJson:{}}});
 const orden=await db.ordenTrabajo.create({data:{tenantId:t.tenantId,numero:`RC-${randomUUID()}`,estado:'pendiente'}});
 const item=await db.ordenTrabajoItem.create({data:{tenantId:t.tenantId,ordenId:orden.id,cotizacionItemId:c.id,codigo:'RC',nombre:'Recuperación',familia:'QA',cantidad:200,cantidadUnidad:'u',subtotal:1000,impuestos:0,total:1000}});
 const auth={tenantId:t.tenantId,userId:t.users[0].id};
 const r=await service.solicitar(auth,item.id,{expectedVersion:0,idempotencyKey:randomUUID(),entregas:[1,2,3,4].map(i=>({clave:`e${i}`,cantidad:50}))});
 return {tenantId:t.tenantId,itemId:item.id,revisionId:r.plan.revisionId};
}
function arrancar(delay=30){
 const c=fork(__filename,['worker'],{env:{...process.env,F6_QUOTE_DELAY_MS:String(delay)},stdio:['ignore','inherit','inherit','ipc']});
 const eventos=[];c.on('message',m=>eventos.push(m));
 return {c,eventos};
}
async function hasta(fn,ms=120000){const end=Date.now()+ms;while(Date.now()<end){const r=await fn();if(r)return r;await sleep(250);}throw Error('Plazo de recuperación excedido');}
async function lista(r){return hasta(async()=>{const v=await db.planEntregaRevision.findUnique({where:{id:r.revisionId},select:{estado:true,error:true}});if(v.estado==='FALLIDA')throw Error(v.error);return v.estado==='LISTA';});}
async function verificar(r){assert.equal(await db.fuenteProduccionEntrega.count({where:{revisionId:r.revisionId}}),1);assert.equal(await db.planEntregaSolicitud.count({where:{revisionId:r.revisionId}}),4);assert.equal(await db.loteProduccionEntrega.count({where:{revisionId:r.revisionId}}),0);assert.equal(await db.ordenTrabajoItemPaso.count({where:{itemId:r.itemId}}),0);}
async function parent(){
 const tenants=JSON.parse(readFileSync(path.join(out,'tenants.json')));
 const dispatcher=new PlanificacionEntregasDispatcher(db);
 const redis=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:1});
 let w;
 const resultado=[];
 try {
  const r=await crear(tenants[0]);
  w=arrancar(30000);await hasta(()=>w.eventos.some(e=>e.tipo==='listo'),15000);
  await dispatcher.despachar();await hasta(()=>w.eventos.some(e=>e.tipo==='cotizando'),15000);
  const inicio=Date.now();w.c.kill('SIGKILL');await new Promise(resolve=>w.c.once('exit',resolve));
  const claves=await redis.keys('grafo:worker:v1:tenant:*:cotizacion:*');
  const ttl=Math.max(...await Promise.all(claves.map(k=>redis.pttl(k))));
  resultado.push({escenario:'worker interrumpido',leaseRestanteMs:ttl});
  writeFileSync(path.join(out,'recuperacion.json'),JSON.stringify(resultado,null,2));
  assert.ok(ttl > 0 && ttl <= 90000, 'El cupo del worker caído debe liberarse en 90 segundos');
  w=arrancar();await lista(r);await verificar(r);
  resultado.push({escenario:'worker recuperado',duracionMs:Date.now()-inicio,estado:'LISTA',fuentes:1,entregas:4,lotesPublicados:0,pasosPublicados:0});
  // Interrupción real de Redis al encolar. La solicitud ya existe en PostgreSQL.
  const r2=await crear(tenants[1]);
  execFileSync('/tmp/grafo-f6-saas-20260911/redis-7.2.10/src/redis-cli',['-p','6391','SHUTDOWN']);
  await dispatcher.despachar();
  assert.equal((await db.planEntregaRevision.findUnique({where:{id:r2.revisionId}})).estado,'SOLICITADA');
  execFileSync('/tmp/grafo-f6-saas-20260911/redis-7.2.10/src/redis-server',['--bind','127.0.0.1','--port','6391','--dir','/tmp/grafo-f6-saas-20260911/redis-data','--appendonly','yes','--maxmemory','256mb','--maxmemory-policy','noeviction','--daemonize','yes','--pidfile','/tmp/grafo-f6-saas-20260911/redis.pid','--logfile','/tmp/grafo-f6-saas-20260911/redis.log']);
  await hasta(()=>redis.ping().catch(()=>false),15000);await dispatcher.despachar();await lista(r2);await verificar(r2);
  resultado.push({escenario:'Redis interrumpido al encolar y reiniciado',estado:'LISTA',fuentes:1,entregas:4,lotesPublicados:0,pasosPublicados:0});
  writeFileSync(path.join(out,'recuperacion.json'),JSON.stringify(resultado,null,2));console.log(JSON.stringify(resultado));
 }finally{if(w?.c.exitCode===null){w.c.kill('SIGTERM');await new Promise(resolve=>w.c.once('exit',resolve));}await dispatcher.onApplicationShutdown();redis.disconnect();await db.$disconnect();}
}
(process.argv[2]==='worker'?child():process.argv[2]==='carga'?carga():parent()).catch(e=>{console.error(e.message);process.exitCode=1});

async function carga(){
 const tenants=JSON.parse(readFileSync(path.join(out,'tenants.json')));
 const dispatcher=new PlanificacionEntregasDispatcher(db);const workers=[];
 try {
  const solicitudes=[];
  for (const t of tenants) solicitudes.push(await crear(t));
  for(let i=0;i<4;i++)workers.push(arrancar(100));
  await hasta(()=>workers.every(w=>w.eventos.some(e=>e.tipo==='listo')),20000);
  const inicio=Date.now();await dispatcher.despachar();
  const tiempos=new Map();
  await hasta(async()=>{
    const estados=await db.planEntregaRevision.findMany({where:{id:{in:solicitudes.map(r=>r.revisionId)}},select:{id:true,estado:true,error:true}});
    for(const r of estados){assert.notEqual(r.estado,'FALLIDA',r.error);if(r.estado==='LISTA'&&!tiempos.has(r.id))tiempos.set(r.id,Date.now()-inicio);}
    return tiempos.size===solicitudes.length;
  },180000);
  for(const r of solicitudes)await verificar(r);
  const ms=[...tiempos.values()].sort((a,b)=>a-b);
  const resultado={tenants:20,workers:4,propuestasListas:20,entregas:80,fuentes:20,lotesPublicados:0,pasosPublicados:0,primeraMs:ms[0],p95Ms:ms[19],duracionMs:Date.now()-inicio};
  writeFileSync(path.join(out,'carga-workers.json'),JSON.stringify(resultado,null,2));console.log(JSON.stringify(resultado));
 }finally{
  for(const w of workers)w.c.kill('SIGTERM');
  await Promise.all(workers.map(w=>w.c.exitCode===null?new Promise(r=>w.c.once('exit',r)):Promise.resolve()));
  await dispatcher.onApplicationShutdown();await db.$disconnect();
 }
}
