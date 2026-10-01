import { exigir } from './seguro.mjs';
export function validarMonitor(url) {
  exigir(typeof url === 'string' && /^https:\/\/hc-ping\.com\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(url),'Monitor no permitido.'); return url;
}
export async function notificarMonitor(url,exito,{fetchFn=fetch}={}){
  validarMonitor(url);
  const r=await fetchFn(url+(exito?'':'/fail'),{method:'POST',body:'',redirect:'error',signal:AbortSignal.timeout(10_000)});
  await r.body?.cancel(); exigir(r.ok,'El monitor no confirmó recepción.');
}
export async function cicloSupervisado({ejecutar,url,notificar=notificarMonitor}){
  validarMonitor(url);
  try {const resultado=await ejecutar(); await notificar(url,true); return resultado;}
  catch(error){await notificar(url,false).catch(()=>{});throw error;}
}
