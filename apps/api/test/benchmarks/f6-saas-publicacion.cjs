/** Pérdida REAL de la conexión PostgreSQL después de escribir el primer lote,
 * antes del COMMIT. Ejecuta únicamente en la copia de pruebas F6 SaaS. */
const path=require('node:path'),assert=require('node:assert/strict');
const {writeFileSync}=require('node:fs');
const url=process.env.F6_SAAS_DATABASE_URL;
if(!url||new URL(url).pathname!=='/gdi_saas_f6_saas_20260911')throw Error('Base QA exclusiva requerida');
process.env.DATABASE_URL=url;
require('ts-node').register({transpileOnly:true,project:path.resolve(__dirname,'../../tsconfig.json')});
const {PrismaService}=require('../../dist/src/prisma/prisma.service');
const {OrdenesTrabajoService}=require('../../dist/src/ordenes-trabajo/ordenes-trabajo.service');
const {crearFixtureLotesF6}=require('../soporte-lotes-f6');
const db=new PrismaService();
const service=new OrdenesTrabajoService(db,...Array(10).fill({}));
(async()=>{
 const f=await db.$transaction(tx=>crearFixtureLotesF6(tx,db),{timeout:60000});
 let aviso,liberar,pid;const escrita=new Promise(r=>aviso=r);const espera=new Promise(r=>liberar=r);
 const publicacion=db.$transaction(async tx=>{
  const p=await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid, current_database() AS db');
  assert.equal(p[0].db,'gdi_saas_f6_saas_20260911');pid=p[0].pid;
  let interceptada=false;
  const controlada=new Proxy(tx,{get(target,key){
   if(key!=='loteProduccionEntrega')return Reflect.get(target,key);
   return new Proxy(target.loteProduccionEntrega,{get(delegate,method){
    if(method!=='create')return Reflect.get(delegate,method);
    return async args=>{const r=await delegate.create(args);if(!interceptada){interceptada=true;aviso();await espera;}return r;};
   }});
  }});
  await service.sincronizarLotesEntrega(controlada,f.tenantId,f.raiz.id);
 },{timeout:60000}).then(()=>({ok:true}),error=>({ok:false,error:error.message}));
 await Promise.race([escrita,publicacion.then(()=>{throw Error('No alcanzó la escritura intermedia');}),new Promise((_,r)=>{const t=setTimeout(()=>r(Error('Plazo excedido')),30000);t.unref();})]);
 try {
  assert.equal(await db.loteProduccionEntrega.count({where:{productoItemId:f.raiz.id}}),0,'No se observa el lote sin COMMIT');
  const killed=await db.$queryRawUnsafe('SELECT pg_terminate_backend($1::integer) AS terminado',pid);
  assert.equal(killed[0].terminado,true);
 }finally{liberar();}
 const r=await publicacion;assert.equal(r.ok,false);
 assert.equal(await db.loteProduccionEntrega.count({where:{productoItemId:f.raiz.id}}),0);
 assert.equal(await db.ordenTrabajoItemPaso.count({where:{ordenId:f.orden.id}}),0);
 assert.equal(await db.ordenTrabajoItem.count({where:{ordenId:f.orden.id}}),1);
 await db.$transaction(tx=>service.sincronizarLotesEntrega(tx,f.tenantId,f.raiz.id),{timeout:60000});
 assert.equal(await db.loteProduccionEntrega.count({where:{productoItemId:f.raiz.id}}),4);
 assert.equal(await db.ordenTrabajoItemPaso.count({where:{ordenId:f.orden.id}}),16);
 assert.equal(await db.ordenTrabajoPasoDependencia.count({where:{ordenId:f.orden.id}}),12);
 const resultado={interrupcion:'Conexión PostgreSQL terminada tras insertar primer lote sin COMMIT',lotesTrasFallo:0,pasosTrasFallo:0,itemsTrasFallo:1,reintento:{lotes:4,pasos:16,dependencias:12},ordenId:f.orden.id};
 writeFileSync(path.resolve(__dirname,'../../../../output/f6-saas-2026-09-11/publicacion-interrumpida.json'),JSON.stringify(resultado,null,2));console.log(JSON.stringify(resultado));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
