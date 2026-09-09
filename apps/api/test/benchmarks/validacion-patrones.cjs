/* Comparación del validador y materializador sobre la misma geometría.
 * Las versiones anteriores se guardan antes de editar; dependencias iguales.
 * node --expose-gc apps/api/test/benchmarks/validacion-patrones.cjs
 */
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const Module=require('node:module'); const {performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'../../../..');
const dir=path.join(root,'output/grafonest-transformacion-2026-09-09/validacion-patrones');
const actual=require('../../dist/src/workers/geometria/validar-nesting-opennest');
const material=require('../../dist/src/workers/geometria/cartera-patrones');
const {patronesDeResultado}=require('../../dist/src/workers/geometria/biblioteca-patrones.service');
const {seleccionInicialDeResultado}=require('../../dist/src/workers/geometria/seleccion-inicial');
function previous(name,original){
  const file=path.join(root,'apps/api/dist/src/workers/geometria',original);
  const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
  m._compile(fs.readFileSync(path.join(dir,name),'utf8'),file);return m.exports;
}
const old=previous('validador-anterior.js','validar-nesting-opennest.js');
const oldMaterial=previous('cartera-anterior.js','cartera-patrones.js');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const base=read('output/grafonest-mejoras-2026-09-09/entrada-100.json');
const ref=read('output/grafonest-transformacion-2026-09-09/biblioteca-patrones-nativos/resultado-100.json');
const cases=[];
for(const factor of [1,2,5]){
  const input={...base,piezas:base.piezas.map(p=>({...p,cantidad:p.cantidad*factor}))};
  const quantities=new Map(base.piezas.map(p=>[p.id,p.cantidad]));
  const result={...ref,placasUsadas:ref.placasUsadas*factor,cantidadSolicitada:ref.cantidadSolicitada*factor,cantidadColocada:ref.cantidadColocada*factor,
    placements:Array.from({length:factor},(_,i)=>ref.placements.map(p=>({...p,copia:p.copia+i*quantities.get(p.piezaId),placa:p.placa+i*ref.placasUsadas}))).flat()};
  cases.push({name:`exhibidor-${100*factor}`,input,result});
}
const series='output/grafonest-transformacion-2026-09-09/serie-controlada/geometrias';
for(const name of ['puma','hueco-ocupado','common-line','giro-fijo-separacion','200-formas-unicas']){
  cases.push({name,input:read(`${series}/${name}/nativo/entrada.json`),result:read(`${series}/${name}/nativo/resultado.json`)});
}
const rows=[];
for(const c of cases){
  const cartera=patronesDeResultado(c.input,c.result);
  const plan={seleccion:seleccionInicialDeResultado(c.input,cartera,c.result),optimoPlacasDentroCartera:false,optimoPatronesDentroCartera:false};
  assert.ok(plan.seleccion);
  const before=oldMaterial.materializarPatrones(c.input,cartera,plan),after=material.materializarPatrones(c.input,cartera,plan);
  assert.deepEqual(after,before,'La preparación debe conservar exactamente la geometría anterior.');
  assert.deepEqual(actual.validarResultadoNestingOpenNest(c.input,c.result),old.validarResultadoNestingOpenNest(c.input,c.result));
  for(let repetition=0;repetition<3;repetition++){
    for(const variant of repetition%2?['actual','anterior']:['anterior','actual']){
      global.gc?.();
      const v=variant==='actual'?actual:old,m=variant==='actual'?material:oldMaterial;
      const start=performance.now();const r=m.materializarPatrones(c.input,cartera,plan);const t=performance.now();
      v.validarResultadoNestingOpenNest(c.input,r);const end=performance.now();
      rows.push({caso:c.name,repeticion:repetition,variante:variant,piezas:r.cantidadColocada,placas:r.placasUsadas,
        patrones:plan.seleccion.length,materializarMs:t-start,validarMs:end-t,totalMs:end-start,geometriaIdentica:true});
    }
  }
}
fs.writeFileSync(path.join(dir,'geometria-mediciones.json'),JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows));
