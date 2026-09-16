/** Datos desechables, exclusivamente en la base f6_saas. No calibra tenants reales. */
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { fixture } = require('./f6-saas-motor.cjs');
const url = process.env.F6_SAAS_DATABASE_URL;
if (!url || new URL(url).pathname !== '/gdi_saas_f6_saas_20260911') throw Error('Base exclusiva de carga requerida');
const db = new PrismaClient({datasources:{db:{url}}});
const out=resolve(process.argv[2]??'../../output/f6-saas-2026-09-11');mkdirSync(out,{recursive:true});
(async()=>{
  const hash=await bcrypt.hash('F6-SaaS-prueba-2026!',10);
  const manifest=[];
  for(let t=0;t<20;t++){
    const tenantId=randomUUID();
    await db.tenant.create({data:{id:tenantId,nombre:`QA SaaS ${t}`,slug:`qa-saas-${tenantId}`}});
    const planta=await db.planta.create({data:{tenantId,nombre:'Planta QA',codigo:'QA'}});
    const c=fixture(t===19?1000:100);
    const equipos=new Map(),estaciones=new Map(),maquinas=new Map();
    const familias=['embalaje','impresion_por_hoja','corte_laser','ensamble_estructural'];
    for(const e of c.estaciones){
      if(!equipos.has(e.equipoProduccion.id))equipos.set(e.equipoProduccion.id,(await db.equipoProduccion.create({data:{tenantId,nombre:e.equipoProduccion.id,personas:4,calendarioJson:e.calendario}})).id);
      const est=await db.estacion.create({data:{tenantId,nombre:e.nombre,capacidadConcurrente:4,calendarioJson:e.calendario,tiempoPreparacionMin:2,equipoProduccionId:equipos.get(e.equipoProduccion.id)}});
      estaciones.set(e.id,est.id);
      if(!e.maquinas.length)await db.estacionRegla.create({data:{tenantId,estacionId:est.id,tipo:'paso',valor:familias[Number(e.id.slice(1))]}});
      for(const m of e.maquinas){const id=randomUUID();maquinas.set(m.id,id);await db.maquina.create({data:{id,tenantId,plantaId:planta.id,estacionId:est.id,codigo:m.id,nombre:m.id,plantilla:'IMPRESORA_LASER',geometriaTrabajo:'PLIEGO',unidadProduccionPrincipal:'HOJA',parametrosTecnicosJson:{operacionMaquina:'autonoma'}}});}
    }
    const ordenes=new Map();const pasos=[];const items=[];
    for(const i of c.items){
      if(!ordenes.has(i.ordenId))ordenes.set(i.ordenId,randomUUID());
      const id=randomUUID(),ordenId=ordenes.get(i.ordenId);
      items.push({id,tenantId,ordenId,codigo:i.id,nombre:i.nombre,familia:'QA',cantidad:50,cantidadUnidad:'u',subtotal:1000,impuestos:0,total:1000,fechaEntrega:new Date('2026-12-31')});
      for(const p of i.pasos)pasos.push({id:randomUUID(),tenantId,ordenId,itemId:id,indice:p.indice,nodoClave:p.nodoClave,nombre:p.nombre,familiaCodigo:familias[p.indice],categoriaFamilia:'produccion',maquinaId:p.maquinaId?maquinas.get(p.maquinaId):null,duracionEstimadaMin:p.duracionEstimadaMin,demandaHumanaJson:p.demandaHumana,esTerminal:p.esTerminal});
    }
    await db.ordenTrabajo.createMany({data:[...ordenes].map(([codigo,id])=>({id,tenantId,numero:`QA-${t}-${codigo}`,estado:'pendiente',fechaEntrega:new Date('2026-12-31'),total:4000}))});
    await db.ordenTrabajoItem.createMany({data:items});
    await db.ordenTrabajoItemPaso.createMany({data:pasos});
    const dependencias=items.flatMap(i=>{const ruta=pasos.filter(p=>p.itemId===i.id).sort((a,b)=>a.indice-b.indice);return ruta.slice(1).map((p,j)=>({tenantId,ordenId:i.ordenId,predecesorPasoId:ruta[j].id,sucesorPasoId:p.id}));});
    await db.ordenTrabajoPasoDependencia.createMany({data:dependencias});
    const users=[];
    for(let u=0;u<10;u++){
      const email=`qa-saas-${t}-${u}-${tenantId}@example.test`;
      const usuario=await db.user.create({data:{email,nombreCompleto:`QA ${t}/${u}`,passwordHash:hash}});
      await db.membership.create({data:{tenantId,userId:usuario.id,rol:'ADMINISTRADOR'}});
      users.push({id:usuario.id,email});
    }
    manifest.push({tenantId,pasos:pasos.length,items:items.map(i=>i.id),users});
    writeFileSync(resolve(out,'tenants.json'),JSON.stringify(manifest,null,2));
    console.log(JSON.stringify({tenant:t,operaciones:pasos.length,usuarios:users.length}));
  }
})().catch(e=>{console.error(e.message.split('\n').slice(-6).join('\n'));process.exitCode=1}).finally(()=>db.$disconnect());
