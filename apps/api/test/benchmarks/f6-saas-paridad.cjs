/** Compara cada decisión con una captura previa del scheduler, sin modificar el módulo cargado. */
const {readFileSync,writeFileSync}=require('node:fs');
const {resolve}=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const assert=require('node:assert/strict');
const {fixture}=require('./f6-saas-motor.cjs');
const {simularFlujo}=require('../../dist/src/eta/motor/flujo-produccion');
const anterior=new Module(resolve(__dirname,'../../dist/src/eta/motor/baseline.cjs'),module);
anterior.filename=anterior.id;anterior.paths=Module._nodeModulePaths(resolve(__dirname,'../../dist/src/eta/motor'));
anterior._compile(ts.transpileModule(readFileSync(process.argv[2],'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,anterior.filename);
const antiguo=anterior.exports.simularFlujo;
let seed=23;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/2**32;}
const comparar=c=>{
 const a=antiguo(c),b=simularFlujo(c);
 assert.deepEqual(b,a);
 return b;
};
let escenarios=0;
for(let i=0;i<60;i++){
 const c=fixture(12+Math.floor(rand()*8)*4);
 for(const e of c.estaciones){e.capacidadConcurrente=1+Math.floor(rand()*4);e.equipoProduccion.personas=2;e.tiempoPreparacionMin=Math.floor(rand()*5);}
 // Un equipo compartido siempre representa la misma capacidad y horario.
 for(const item of c.items){item.fechaEntrega=i%3?'2026-12-31':'2026-09-14';item.prioridadPlanificacion=Math.floor(rand()*3);
  for(const p of item.pasos){p.duracionEstimadaMin=5+Math.floor(rand()*45);p.demandaHumana={version:1,verificada:true,fases:[{minutos:p.duracionEstimadaMin,personas:1}]};}
 }
 const a=comparar(c);escenarios++;
 if(i%3===0){
  const porId=new Map(a.traza.map(t=>[t.pasoId,t]));
  for(const p of c.items.flatMap(i=>i.pasos)){const t=porId.get(p.id);if(t){p.planificadoDesde=t.inicio.toISOString();p.planificadoHasta=t.fin.toISOString();p.atencionPlanificada=t.atencionPlanificada;}}
  comparar(c);escenarios++;
 }
}
for(const n of [100,500,1000]){comparar(fixture(n));escenarios++;}
const result={escenarios,resultado:'Todas las fechas, reservas, dependencias, orden de decisión y conteos idénticos'};
writeFileSync(resolve(process.argv[3]??'../../output/f6-saas-2026-09-11/paridad.json'),JSON.stringify(result,null,2));console.log(result);
