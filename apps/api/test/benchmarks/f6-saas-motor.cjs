/** node test/benchmarks/f6-saas-motor.cjs [salida] [tamaños separados por coma]
 * Datos sintéticos deterministas. Usa el build de API: ejecutar npm run build
 * después de modificar el motor. No conecta servicios ni modifica OT.
 */
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const assert = require('node:assert/strict');
const { simularFlujo } = require('../../dist/src/eta/motor/flujo-produccion');
const { demandaDesdeTiempo } = require('../../dist/src/eta/motor/demanda-humana');

function fixture(pasos) {
  const calendario = { dias: Object.fromEntries(['lun','mar','mie','jue','vie','sab','dom'].map((d,i)=>[d,i<5?[{desde:'09:00',hasta:'13:00'},{desde:'14:00',hasta:'18:00'}]:null])) };
  const estaciones = Array.from({length:4},(_,e)=>({
    id:`e${e}`, nombre:`Estación ${e}`, activo:true, calendario, capacidadConcurrente:4,
    tiempoPreparacionMin:2, familias:[`f${e}`],
    maquinas: e===1||e===2 ? Array.from({length:4},(_,m)=>({id:`m${e}-${m}`,centroCostoId:null,operacionMaquina:'autonoma'})) : [],
    equipoProduccion:{id:`eq${Math.floor(e/2)}`,nombre:'Equipo compartido',personas:4,activo:true,calendario},
  }));
  const items = Array.from({length:Math.ceil(pasos/4)},(_,i)=>({
    id:`item${i}`, ordenId:`ot${Math.floor(i/4)}`,ordenNumero:`OT-${String(Math.floor(i/4)).padStart(5,'0')}`,
    ordenEstado:'pendiente',nombre:`Lote ${i%4}`,fechaEntrega:'2026-12-31',sinRuta:false,
    pasos:Array.from({length:Math.min(4,pasos-i*4)},(_,e)=>{
      const maquinaId=e===1||e===2?`m${e}-${i%4}`:null;
      const totalMin=maquinaId?25:10;
      return {id:`p${i}-${e}`,indice:e,nombre:`Operación ${e}`,nodoClave:`n${e}`,nodosPredecesoresClaves:e?[`n${e-1}`]:[],
        familiaCodigo:`f${e}`,maquinaId,centroCostoId:null,duracionEstimadaMin:totalMin,
        demandaHumana:maquinaId?demandaDesdeTiempo({maquinaId,operacionMaquina:'autonoma',dotacionOperarios:1,totalMin,setupMin:3,runMin:20,cleanupMin:2,tiempoFijoMin:0}):{version:1,verificada:true,fases:[{minutos:totalMin,personas:1}]},
        estado:'pendiente',iniciadoEl:null,tipoEjecucion:'interno',plazoProveedorDias:null,esTerminal:e===3};
    }),
  }));
  return {items,estaciones,ahora:new Date('2026-09-14T09:00:00-03:00'),zona:'America/Argentina/Buenos_Aires',medianas:new Map(),noLaborables:new Set(['2026-09-21']),tiempoEntrePasosMin:2};
}

function verificar(c,s) {
  assert.equal(s.traza.length,c.items.reduce((n,i)=>n+i.pasos.length,0));
  const porPaso=new Map(s.traza.map(t=>[t.pasoId,t]));
  const porEquipo=new Map(); const porMaquina=new Map();
  const pasos=new Map(c.items.flatMap(i=>i.pasos.map(p=>[p.id,p])));
  for(const t of s.traza){
    assert.ok(!t.parcial && t.fin>=t.inicio);
    for(const id of t.predecesorPasoIds) assert.ok(porPaso.get(id).fin<=t.inicio,`Dependencia ${id}`);
    for(const r of t.reservasHumanas??[]){ const e=porEquipo.get(t.equipoProduccionId)??[];e.push([r.inicio,r.personas],[r.fin,-r.personas]);porEquipo.set(t.equipoProduccionId,e); }
    const m=pasos.get(t.pasoId).maquinaId;
    if(m){const a=porMaquina.get(m)??[];a.push([+t.inicio,+t.fin]);porMaquina.set(m,a);}
  }
  for(const eventos of porEquipo.values()){let personas=0;for(const [,delta] of eventos.sort((a,b)=>a[0]-b[0]||a[1]-b[1])){personas+=delta;assert.ok(personas<=4 && personas>=0,`Sobreasignación ${personas}`);}}
  for(const ventanas of porMaquina.values()){ventanas.sort((a,b)=>a[0]-b[0]);for(let i=1;i<ventanas.length;i++)assert.ok(ventanas[i-1][1]<=ventanas[i][0]);}
}
module.exports={fixture,verificar};
if(require.main===module){
  const out=resolve(process.argv[2]??'../../output/f6-saas-2026-09-11');mkdirSync(out,{recursive:true});
  const tamaños=(process.argv[3]??'100,500,1000,2500,5000').split(',').map(Number);
  const resultados=[];
  simularFlujo(fixture(20));
  for(const pasos of tamaños){
    const c=fixture(pasos);const tiempos=[];let s;
    for(let r=0;r<3;r++){const inicio=performance.now();s=simularFlujo(c);tiempos.push(performance.now()-inicio);if(tiempos.at(-1)>30000)break;}
    verificar(c,s);
    const huella=createHash('sha256').update(JSON.stringify(s.traza)).digest('hex');
    const fila={pasos,lotes:c.items.length,ordenes:new Set(c.items.map(i=>i.ordenId)).size,tiemposMs:tiempos,memoria:process.memoryUsage(),huella};
    resultados.push(fila);writeFileSync(resolve(out,'motor.json'),JSON.stringify(resultados,null,2));console.log(JSON.stringify(fila));
  }
}
