import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { firmarComprobante, verificarComprobante, custodioComprobantes, leerComprobanteRemoto, listarComprobantes, nombreComprobante } from './lib/comprobantes.mjs';
import { cicloSupervisado, notificarMonitor } from './lib/monitor.mjs';
import { demoraSiguienteCopia } from './lib/horario.mjs';
const keys=()=>{const k=generateKeyPairSync('ed25519');return{clavePrivada:k.privateKey.export({type:'pkcs8',format:'pem'}),clavePublica:k.publicKey.export({type:'spki',format:'pem'}),idClave:'firma-ficticia-v1'};};
const firma=keys(),id=randomUUID();
const referencia=n=>({fileId:randomUUID(),fileName:`staging/copias/${id}/${n}.age`,bytes:20,sha256:'a'.repeat(64),sha1:'b'.repeat(40)});
const recibo={version:1,id,entorno:'staging',proposito:'respaldo',completado:'2026-09-30T00:00:00.000Z',protegidoHasta:Date.parse('2026-10-31T00:00:00.000Z'),manifiesto:referencia('manifiesto'),cierre:referencia('completa')};
const confianza={...firma,entorno:'staging'};
test('programa a la siguiente hora sin solapar ni acumular ejecuciones',()=>{
  assert.equal(demoraSiguienteCopia(0,70_000),3_530_000);
  assert.equal(demoraSiguienteCopia(3_500_000,3_700_000),3_500_000);
  assert.equal(demoraSiguienteCopia(3_600_000,3_600_000),3_600_000);
  assert.throws(()=>demoraSiguienteCopia(10,9));
});
test('recupera raíz auténtica con clave pública guardada fuera del ejecutor',()=>{assert.deepEqual(verificarComprobante(firmarComprobante(recibo,firma),confianza),recibo);});
test('rechaza firma alterada, datos cambiados y clave de un atacante',()=>{
  const contenido=firmarComprobante(recibo,firma),sobre=JSON.parse(contenido);
  assert.throws(()=>verificarComprobante(contenido,{...confianza,...keys()}));
  sobre.datos=Buffer.from(JSON.stringify({...recibo,id:randomUUID()})).toString('base64');
  assert.throws(()=>verificarComprobante(Buffer.from(JSON.stringify(sobre)),confianza));
  assert.throws(()=>firmarComprobante(recibo,{...firma,clavePublica:keys().clavePublica}));
});
test('rechaza otro entorno, propósito, retención corta y referencias cruzadas',()=>{
  const contenido=firmarComprobante(recibo,firma);
  assert.throws(()=>verificarComprobante(contenido,{...confianza,entorno:'produccion'}));
  assert.throws(()=>verificarComprobante(contenido,{...confianza,proposito:'ensayo'}));
  assert.throws(()=>firmarComprobante({...recibo,protegidoHasta:Date.parse(recibo.completado)},firma));
  assert.throws(()=>firmarComprobante({...recibo,cierre:{...recibo.cierre,fileName:'staging/otra/completa.age'}},firma));
  assert.throws(()=>verificarComprobante(Buffer.alloc(17000),confianza));
});
test('no publica contenido ni metadatos del origen en el recibo',()=>{
  const firmado=firmarComprobante({...recibo,metadata:{nombre:'Cliente secreto'},manifiesto:{...recibo.manifiesto,original:'dato privado'}},firma);
  assert.deepEqual(verificarComprobante(firmado,confianza),recibo);
});
test('sube, protege y vuelve a descargar antes de confirmar la custodia',async t=>{
  const temporal=await mkdtemp(join(tmpdir(),'comprobante-'));t.after(()=>rm(temporal,{recursive:true,force:true}));
  let bytes,info;
  const destino={config:{bucketId:'ficticio'},async subir(file,name,huella,hasta){bytes=await readFile(file);assert.equal(hasta,recibo.protegidoHasta);info={fileId:'version-ficticia',fileName:name,contentLength:bytes.length,contentSha1:huella.sha1,...huella};return info;},async descargar(){return Readable.from([bytes]);},async call(){return info;}};
  await custodioComprobantes(firma)({recibo,destino,temporal,control:AbortSignal.timeout(5000)});
  assert.equal(info.fileName,nombreComprobante(recibo));
  assert.deepEqual(await leerComprobanteRemoto(destino,info.fileId,confianza),recibo);
  bytes[10]^=1;await assert.rejects(leerComprobanteRemoto(destino,info.fileId,confianza));
});
test('corta catálogo con cursores repetidos y no confunde versiones con último nombre',async()=>{
  const destino={config:{bucketId:'ficticio'},async call(){return {files:[{fileId:'1',fileName:nombreComprobante(recibo),action:'upload',uploadTimestamp:1}],nextFileName:nombreComprobante(recibo),nextFileId:'1'};}};
  await assert.rejects(listarComprobantes(destino,confianza),/repetido/);
});
test('sólo comunica éxito después del respaldo y la custodia',async()=>{
  const eventos=[]; const url='https://hc-ping.com/00000000-0000-4000-8000-000000000001';
  await cicloSupervisado({url,ejecutar:async()=>eventos.push('completa'),notificar:async(_,ok)=>eventos.push(ok)});
  assert.deepEqual(eventos,['completa',true]); eventos.length=0;
  await assert.rejects(cicloSupervisado({url,ejecutar:async()=>{throw new Error('custodia rechazada');},notificar:async(_,ok)=>eventos.push(ok)}));
  assert.deepEqual(eventos,[false]);
});
test('monitor sólo envía estado sin cuerpo, no sigue redirects ni filtra secretos',async()=>{
  const url='https://hc-ping.com/00000000-0000-4000-8000-000000000001';
  let llamada;
  await notificarMonitor(url,false,{fetchFn:async(u,init)=>{llamada={u,init};return new Response('ok');}});
  assert.equal(llamada.u,url+'/fail');assert.equal(llamada.init.body,'');assert.equal(llamada.init.redirect,'error');
  await assert.rejects(notificarMonitor('https://otro.example/'+url,true));
  await assert.rejects(notificarMonitor(url,true,{fetchFn:async()=>new Response('',{status:500})}));
});
