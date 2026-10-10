import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { exigir, copiarVerificado } from './seguro.mjs';
import { validarRef } from './motor.mjs';

const MAX = 16 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const firmaIdValido = v => typeof v === 'string' && /^[a-z0-9-]{1,64}$/.test(v);
function comprobarRecibo(r) {
  exigir(r?.version === 1 && UUID.test(r.id) && ['staging','produccion'].includes(r.entorno) &&
    ['respaldo','ensayo'].includes(r.proposito) && Number.isFinite(Date.parse(r.completado)) &&
    new Date(r.completado).toISOString() === r.completado && Number.isSafeInteger(r.protegidoHasta) &&
    r.protegidoHasta >= Date.parse(r.completado) + 30 * 86_400_000, 'Comprobante inválido.');
  validarRef(r.manifiesto, r.entorno, 34 * 1024 ** 2); validarRef(r.cierre, r.entorno, 64 * 1024);
  const prefijo = `${r.entorno}/${r.proposito === 'ensayo' ? 'ensayos' : 'copias'}/${r.id}/`;
  exigir(r.manifiesto.fileName === `${prefijo}manifiesto.age` && r.cierre.fileName === `${prefijo}completa.age`, 'Referencias fuera de la copia.');
}

export function nombreComprobante(recibo) {
  comprobarRecibo(recibo);
  return `${recibo.entorno}/comprobantes/${recibo.proposito}/${recibo.completado.slice(0,10)}/${recibo.id}.json`;
}

export function firmarComprobante(recibo, { clavePrivada, clavePublica, idClave }) {
  comprobarRecibo(recibo); exigir(firmaIdValido(idClave), 'Identificador de firma inválido.');
  const privada=createPrivateKey(clavePrivada); const publica=createPublicKey(clavePublica);
  exigir(privada.asymmetricKeyType === 'ed25519' && publica.asymmetricKeyType === 'ed25519' &&
    createPublicKey(privada).export({type:'spki',format:'der'}).equals(publica.export({type:'spki',format:'der'})), 'La firma requiere el par Ed25519 verificado.');
  // Selección cerrada: jamás publicar metadatos del origen o contenido original.
  const publicaRef = ({fileId,fileName,bytes,sha256,sha1})=>({fileId,fileName,bytes,sha256,sha1});
  const datos = Buffer.from(JSON.stringify({ version:1, id:recibo.id, entorno:recibo.entorno,
    proposito:recibo.proposito, completado:recibo.completado, protegidoHasta:recibo.protegidoHasta,
    manifiesto:publicaRef(recibo.manifiesto), cierre:publicaRef(recibo.cierre) }));
  const contenido=Buffer.from(JSON.stringify({version:1, idClave, datos:datos.toString('base64'),
    firma:sign(null,datos,privada).toString('base64')}));
  exigir(contenido.length <= MAX, 'Comprobante demasiado grande.'); return contenido;
}

export function verificarComprobante(contenido, { clavePublica, idClave, entorno, proposito='respaldo' }) {
  exigir(Buffer.isBuffer(contenido) && contenido.length <= MAX && firmaIdValido(idClave), 'Comprobante fuera de límites.');
  const sobre=JSON.parse(contenido.toString('utf8'));
  exigir(sobre.version === 1 && sobre.idClave === idClave && typeof sobre.datos === 'string' && typeof sobre.firma === 'string', 'Firma no reconocida.');
  const datos=Buffer.from(sobre.datos,'base64'), firma=Buffer.from(sobre.firma,'base64');
  const publica=createPublicKey(clavePublica);
  exigir(publica.asymmetricKeyType === 'ed25519' && firma.length === 64 && datos.toString('base64') === sobre.datos &&
    firma.toString('base64') === sobre.firma && verify(null,datos,publica,firma), 'El comprobante no tiene una firma válida.');
  const recibo=JSON.parse(datos.toString('utf8')); comprobarRecibo(recibo);
  exigir(recibo.entorno === entorno && recibo.proposito === proposito, 'Comprobante de otro entorno o de ensayo.');
  return recibo;
}

export function custodioComprobantes(firma) {
  return async ({recibo, destino, temporal, control}) => {
    const contenido=firmarComprobante(recibo,firma); const archivo=join(temporal,'comprobante.json');
    const verificacion=join(temporal,'comprobante-verificado.json');
    const huella={bytes:contenido.length,sha256:createHash('sha256').update(contenido).digest('hex'),sha1:createHash('sha1').update(contenido).digest('hex')};
    try {
      await writeFile(archivo,contenido,{mode:0o600,flag:'wx'});
      const ref=await destino.subir(archivo,nombreComprobante(recibo),huella,recibo.protegidoHasta);
      await copiarVerificado(await destino.descargar(ref),verificacion,ref,control);
      verificarComprobante(await readFile(verificacion),{...firma,entorno:recibo.entorno,proposito:recibo.proposito});
    } finally { await rm(archivo,{force:true}); await rm(verificacion,{force:true}); }
  };
}

// Se elige una versión explícita; nunca se confía en un nombre mutable ni "la última".
export async function leerComprobanteRemoto(destino,fileId,confianza) {
  exigir(/^[a-zA-Z0-9_-]{1,256}$/.test(fileId), 'Identificador remoto inválido.');
  const info=await destino.call('b2_get_file_info',{fileId});
  exigir(info?.contentLength > 0 && info.contentLength <= MAX &&
    info.fileName?.startsWith(`${confianza.entorno}/comprobantes/${confianza.proposito ?? 'respaldo'}/`), 'Objeto fuera del catálogo de comprobantes.');
  const ref={fileId,fileName:info.fileName,bytes:info.contentLength,sha1:info.contentSha1};
  const chunks=[];let size=0;
  for await(const chunk of await destino.descargar(ref)){size+=chunk.length;exigir(size<=MAX,'Comprobante demasiado grande.');chunks.push(chunk);}
  const contenido=Buffer.concat(chunks);
  exigir(size===ref.bytes && createHash('sha1').update(contenido).digest('hex')===ref.sha1,'Descarga incompleta.');
  const recibo=verificarComprobante(contenido,confianza);
  exigir(nombreComprobante(recibo)===ref.fileName,'Nombre de comprobante inconsistente.');
  return recibo;
}

export async function listarComprobantes(destino, {entorno,proposito='respaldo'}) {
  exigir(['staging','produccion'].includes(entorno) && ['respaldo','ensayo'].includes(proposito), 'Catálogo inválido.');
  const prefix=`${entorno}/comprobantes/${proposito}/`; const salida=[];const cursores=new Set();let cursor={};
  for(let pagina=0;pagina<1000;pagina++){
    const datos=await destino.call('b2_list_file_versions',{bucketId:destino.config.bucketId,prefix,maxFileCount:100,...cursor});
    exigir(Array.isArray(datos.files),'Catálogo inválido.');
    for(const f of datos.files){exigir(f.fileName?.startsWith(prefix),'Catálogo fuera de alcance.'); if(f.action==='upload') salida.push({fileId:f.fileId,fileName:f.fileName,subidoEl:f.uploadTimestamp});}
    if(!datos.nextFileName) return salida.sort((a,b)=>b.subidoEl-a.subidoEl);
    const siguiente=JSON.stringify([datos.nextFileName,datos.nextFileId]);exigir(!cursores.has(siguiente),'Catálogo repetido.');cursores.add(siguiente);
    cursor={startFileName:datos.nextFileName,startFileId:datos.nextFileId};
  }
  throw new Error('Catálogo demasiado grande; acotar fecha antes de recuperar.');
}
