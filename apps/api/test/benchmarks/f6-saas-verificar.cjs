/** Verifica los presupuestos sobre la evidencia de una corrida local completa.
 * Separa calidad/invariantes de la medición; no suma repeticiones como pruebas nuevas. */
const {readFileSync,writeFileSync}=require('node:fs');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const out=resolve(process.argv[2]??'../../output/f6-saas-2026-09-11');
const leer=p=>JSON.parse(readFileSync(resolve(out,p)));
const presupuestos=new Map([[100,100],[500,500],[1000,1200],[2500,4500],[5000,15000]]);
for(const m of leer('equivalentes/motor.json')){
 const mediana=[...m.tiemposMs].sort((a,b)=>a-b)[1];
 assert.ok(mediana<presupuestos.get(m.pasos),`${m.pasos} operaciones exceden el presupuesto`);
}
for(const r of leer('http.json')){
 if(r.tipo==='contexto ETA'||r.tipo==='tablero'){
  assert.deepEqual(Object.keys(r.estados),['200']);assert.ok(r.p95Ms<2000);
 }else assert.equal(r.accesosCruzadosRechazados,200);
}
const cpu=leer('cpu-http.json');assert.equal(cpu.lecturas.n,400);assert.ok(cpu.lecturasDuranteCalculo.p95Ms<2500);
assert.equal(cpu.calculosCompletos,10);assert.equal(cpu.calculosLimitados,3);assert.equal(cpu.duplicadaRechazada,true);
const cola=leer('carga-workers.json');assert.equal(cola.propuestasListas,20);assert.equal(cola.entregas,80);assert.ok(cola.duracionMs<60000);assert.equal(cola.pasosPublicados,0);
const recovery=leer('recuperacion.json');assert.ok(recovery[0].leaseRestanteMs<=90000);assert.ok(recovery[1].duracionMs<120000);assert.ok(recovery.slice(1).every(r=>r.estado==='LISTA'&&r.fuentes===1&&r.entregas===4&&r.pasosPublicados===0));
const tx=leer('publicacion-interrumpida.json');assert.equal(tx.lotesTrasFallo,0);assert.equal(tx.pasosTrasFallo,0);assert.deepEqual(tx.reintento,{lotes:4,pasos:16,dependencias:12});
const r={presupuestosAprobados:true,motorHasta5000:true,usuariosSimultaneos:200,apiConCalculosPesados:true,recuperacionWorker:true,recuperacionRedis:true,atomicidadPostgreSQL:true};
writeFileSync(resolve(out,'presupuestos.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(r));
