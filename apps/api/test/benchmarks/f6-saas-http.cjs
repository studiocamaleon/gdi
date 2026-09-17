/** HTTP real, usuarios separados y tenants aislados. Ejecutar servidor/seed QA antes. */
const {readFileSync,writeFileSync}=require('node:fs');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const out=resolve(process.argv[2]??'../../output/f6-saas-2026-09-11');
const tenants=JSON.parse(readFileSync(resolve(out,'tenants.json')));
const clients=tenants.flatMap((t,i)=>t.users.map((u,j)=>({...u,tenant:t,ip:`10.10.${i}.${j+1}`})));
const base='http://127.0.0.1:3011/api';
const stats=[];
async function request(c,path,opts={}){
 const begin=performance.now();
 const r=await fetch(base+path,{...opts,signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json','X-Forwarded-For':c.ip,...(c.token?{Authorization:`Bearer ${c.token}`}:{})}});
 const raw=await r.text();return {status:r.status,json:raw?JSON.parse(raw):null,ms:performance.now()-begin,bytes:Buffer.byteLength(raw)};
}
async function batches(a,n,fn){for(let i=0;i<a.length;i+=n)await Promise.all(a.slice(i,i+n).map(fn));}
function resumen(m){const v=m.map(x=>x.ms).sort((a,b)=>a-b);return {solicitudes:m.length,p50Ms:v[Math.floor(v.length*.5)],p95Ms:v[Math.min(v.length-1,Math.floor(v.length*.95))],maxMs:v.at(-1),bytes:m.reduce((n,x)=>n+x.bytes,0),estados:m.reduce((o,x)=>(o[x.status]=(o[x.status]??0)+1,o),{})};}
(async()=>{
 await batches(clients,10,async c=>{const r=await request(c,'/auth/login',{method:'POST',body:JSON.stringify({email:c.email,password:'F6-SaaS-prueba-2026!'})});assert.equal(r.status,201,"Login de QA");c.token=r.json.accessToken;assert.ok(c.token)});
 console.log('200 sesiones reales autenticadas');
 for(const concurrentes of [20,50,100,200]){
  const measures=[];const start=performance.now();
  for(let vuelta=0;vuelta<3;vuelta++)await batches(clients,concurrentes,async c=>{
   const r=await request(c,'/eta/contexto-prevision');measures.push(r);assert.equal(r.status,200);
   assert.equal(r.json.items.reduce((n,i)=>n+i.pasos.length,0),c.tenant.pasos);
   const own=new Set(c.tenant.items);assert.ok(r.json.items.every(i=>own.has(i.id)),'Datos de otro tenant');
   delete r.json;
  });
  const s={tipo:'contexto ETA',concurrentes,duracionMs:performance.now()-start,...resumen(measures)};stats.push(s);console.log(JSON.stringify(s));writeFileSync(resolve(out,'http.json'),JSON.stringify(stats,null,2));
 }
 const m=[];await batches(clients,100,async c=>{const r=await request(c,'/ordenes-trabajo/tablero');assert.equal(r.status,200,JSON.stringify(r.json));m.push({...r,json:undefined});});
 stats.push({tipo:'tablero',concurrentes:100,...resumen(m)});
 let rechazadas=0;await batches(clients,20,async(c)=>{const foreign=tenants.find(t=>t.tenantId!==c.tenant.tenantId);const r=await request(c,`/ordenes-trabajo/items/${foreign.items[0]}/planificacion-entregas`);assert.ok([403,404].includes(r.status),`Filtración ${r.status}`);rechazadas++;});
 stats.push({tipo:'aislamiento',accesosCruzadosRechazados:rechazadas});
 writeFileSync(resolve(out,'http.json'),JSON.stringify(stats,null,2));console.log(JSON.stringify(stats.slice(-2)));
})().catch(e=>{console.error(e);process.exitCode=1});
