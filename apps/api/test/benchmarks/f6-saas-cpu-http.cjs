/** Cómputo real aislado en threads del mismo proceso HTTP + usuarios leyendo.
 * El endpoint qa sólo existe en f6-saas-api.cjs, nunca en el producto. */
const {readFileSync,writeFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {performance}=require('node:perf_hooks');
const assert=require('node:assert/strict');
const out=resolve('../../output/f6-saas-2026-09-11');
const tenants=JSON.parse(readFileSync(resolve(out,'tenants.json')));
const clients=tenants.map((t,i)=>({...t.users[0],tenant:t,ip:`10.20.${i}.1`}));
const base='http://127.0.0.1:3011/api';
async function request(c,path,post){const begin=performance.now();const r=await fetch(base+path,{method:post?'POST':'GET',body:post?JSON.stringify(post):undefined,signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json','X-Forwarded-For':c.ip,...(c.token?{Authorization:`Bearer ${c.token}`}:{})}});const json=await r.json();return {status:r.status,json,ms:performance.now()-begin};}
function stats(a){a=a.map(r=>r.ms).sort((x,y)=>x-y);return {n:a.length,p50Ms:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)],maxMs:a.at(-1)};}
(async()=>{
 for(const c of clients){const r=await request(c,'/auth/login',{email:c.email,password:'F6-SaaS-prueba-2026!'});assert.equal(r.status,201);c.token=r.json.accessToken;}
 const begin=performance.now();let terminados=0;
 const calculos=clients.slice(0,12).map(c=>request(c,'/qa/f6-computo',{}).then(r=>{terminados++;return r;}));
 // Se intenta ocupar además otra plaza desde la misma empresa.
 const repetida=request(clients[0],'/qa/f6-computo',{});
 const lecturas=[];
 for(let vuelta=0;vuelta<20;vuelta++){
  await Promise.all(clients.map(async c=>{const r=await request(c,'/eta/contexto-prevision');assert.equal(r.status,200);assert.ok(r.json.items.every(i=>i.ordenId),'Contexto válido');lecturas.push({ms:r.ms,status:r.status,calculosPendientes:12-terminados});}));
  await new Promise(r=>setTimeout(r,100));
 }
 const resultados=await Promise.all(calculos);const duplicada=await repetida;
 assert.deepEqual([resultados[0].status,duplicada.status].sort(),[201,503]);
 resultados.push(duplicada);
 assert.ok(resultados.every(r=>[201,503].includes(r.status)),JSON.stringify(resultados));
 const completos=resultados.filter(r=>r.status===201);assert.ok(completos.length>=2);
 assert.ok(completos.every(r=>r.json.entregas===4));
 const simultaneas=lecturas.filter(r=>r.calculosPendientes>0);assert.ok(simultaneas.length>=40);
 const r={duracionMs:performance.now()-begin,lecturas:stats(lecturas),lecturasDuranteCalculo:stats(simultaneas),calculosCompletos:completos.length,calculosLimitados:resultados.filter(r=>r.status===503).length,duplicadaRechazada:true,calculos:resultados.map(({status,ms})=>({status,ms}))};
 writeFileSync(resolve(out,'cpu-http.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(r));
 assert.ok(r.lecturasDuranteCalculo.p95Ms<2500,'p95 HTTP durante cálculo menor a 2.5 s en QA local');
})().catch(e=>{console.error(e);process.exitCode=1});
