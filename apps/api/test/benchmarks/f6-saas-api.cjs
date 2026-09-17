/** Servidor QA con autenticación y servicios reales. Sólo localhost, base/Redis exclusivos. */
const path=require('node:path');
const { monitorEventLoopDelay }=require('node:perf_hooks');
const root=path.resolve(__dirname,'../..');
const url=process.env.F6_SAAS_DATABASE_URL;
if(!url||new URL(url).pathname!=='/gdi_saas_f6_saas_20260911')throw Error('Base exclusiva requerida');
process.env.DATABASE_URL=url;process.env.MIGRATE_DATABASE_URL=url;
process.env.REDIS_URL='redis://127.0.0.1:6391';
require('dotenv').config({path:path.join(root,'.env'),quiet:true});
const {Test}=require('@nestjs/testing');
const {ValidationPipe,Controller,Post}=require('@nestjs/common');
const {CurrentSession}=require('../../dist/src/auth/current-auth.decorator');
const {Permiso}=require('../../dist/src/auth/permiso.decorator');
const {calcularReprogramacion}=require('../../dist/src/planificacion-entregas/reprogramacion-computo');
const {fixture}=require('./f6-saas-motor.cjs');
require('ts-node').register({transpileOnly:true,project:path.join(root,'tsconfig.json')});
const {exhibidorControlado}=require('../fixtures/f6-planificacion/exhibidor-controlado');
// Endpoint exclusivo de este harness: mismo pool de cálculo, guards reales.
// No forma parte de AppModule ni de ninguna ruta del producto.
class ComputoQA {
 async calcular(auth){
  const piloto=exhibidorControlado();piloto.porEntrega=true;
  const grande=fixture(1000);
  piloto.taller={...grande,estaciones:[...grande.estaciones,...piloto.taller.estaciones]};
  const r=await calcularReprogramacion({tenantId:auth.tenantId,piloto,excluidas:[...new Set(grande.items.map(i=>i.ordenId))]});
  return {entregas:r.resultado.alternativas[0].entregas.length,operaciones:1000};
 }
}
Controller('qa/f6-computo')(ComputoQA);Permiso('produccion.ver')(ComputoQA);
Post()(ComputoQA.prototype,'calcular',Object.getOwnPropertyDescriptor(ComputoQA.prototype,'calcular'));
CurrentSession()(ComputoQA.prototype,'calcular',0);
const {AppModule}=require('../../dist/src/app.module');
const {NotificacionesOrdenesService}=require('../../dist/src/integraciones/notificaciones/notificaciones-ordenes.service');
(async()=>{
 const mod=await Test.createTestingModule({imports:[AppModule],controllers:[ComputoQA]})
 .overrideProvider('SCHEDULE_MODULE_OPTIONS').useValue({cronJobs:false,intervals:false,timeouts:false})
 .overrideProvider(NotificacionesOrdenesService).useValue({sincronizar:async()=>{},cambioEntrega:async()=>{}}).compile();
 const app=mod.createNestApplication();app.setGlobalPrefix('api');
 // El generador local representa distintas IP detrás del proxy de entrada.
 // Sólo se confía en el proxy loopback; no se desactiva el rate limiting.
 app.getHttpAdapter().getInstance().set('trust proxy','loopback');
 app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
 const delay=monitorEventLoopDelay({resolution:20});delay.enable();
 const timer=setInterval(()=>{console.log('METRICA '+JSON.stringify({fecha:new Date(),memoria:process.memoryUsage(),eventLoopP95Ms:delay.percentile(95)/1e6,eventLoopMaxMs:delay.max/1e6}));delay.reset();},5000);timer.unref();
 await app.listen(3011,'127.0.0.1');console.log('F6_SAAS_LISTA');
 for(const s of ['SIGINT','SIGTERM'])process.on(s,async()=>{clearInterval(timer);delay.disable();await app.close();process.exit(0)});
})().catch(e=>{console.error(e);process.exitCode=1});
