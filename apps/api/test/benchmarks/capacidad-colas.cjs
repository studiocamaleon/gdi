/* Admisión real BullMQ/Redis entre tres procesos. Los tiempos de trabajo son
 * controlados: este ensayo mide justicia/cupos, NO velocidad de nesting.
 * Sólo usa un prefijo Redis y tenants únicos creados por esta ejecución.
 * node apps/api/test/benchmarks/capacidad-colas.cjs [carpeta-salida]
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const { once } = require('node:events');
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis').default;
const { GeometriaWorker } = require('../../dist/src/workers/geometria/geometria.worker');
const { CapacidadGeometriaService } = require('../../dist/src/workers/geometria/capacidad-geometria.service');
const { TenantConcurrencyService } = require('../../dist/src/workers/tenant-concurrency.service');
const { OpenNestService } = require('../../dist/src/workers/geometria/opennest.service');
const { validarResultadoNestingOpenNest } = require('../../dist/src/workers/geometria/validar-nesting-opennest');
const { COLA_GEOMETRIA, COLA_GEOMETRIA_INTENSIVA, TRABAJO_NESTING_IRREGULAR_OPENNEST } = require('../../dist/src/workers/colas');
const { conexionRedisWorker, urlRedisWorkers } = require('../../dist/src/workers/redis');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (fn, timeout = 120000) => {
  const deadline = Date.now() + timeout;
  while (!(await fn())) { assert.ok(Date.now() < deadline, 'El ensayo superó su plazo.'); await sleep(40); }
};

async function hijo(folder) {
  const config = JSON.parse(fs.readFileSync(path.join(folder, 'config.json')));
  process.env.GRAFONEST_POOL_ID = config.prefix;
  const capacity = new CapacidadGeometriaService(), tenant = new TenantConcurrencyService();
  const result = JSON.parse(fs.readFileSync(path.join(folder, 'referencia.json')));
  const resolver = async data => {
    validarResultadoNestingOpenNest(data, result);
    process.send({ tipo: 'inicio', id: data.correlationId, clase: data.claseComplejidad, pid: process.pid, tiempo: Date.now() });
    if (data.correlationId === 'a-0') await until(() => fs.existsSync(path.join(folder, 'continuar')), 10000);
    else await sleep(data.claseComplejidad === 'INTENSIVA' ? 1200 : 30);
    process.send({ tipo: 'fin', id: data.correlationId, pid: process.pid, tiempo: Date.now() });
    return result;
  };
  const engine = new GeometriaWorker({ resolver }, { leerCancelacion: async () => false }, tenant, capacity, { exigirTodas: async () => {} });
  if (process.env.GRAFONEST_BENCH_NO_WAKE === '1') engine.despertarSiguiente = async () => {};
  await capacity.estado();
  const workers = [COLA_GEOMETRIA, COLA_GEOMETRIA_INTENSIVA].map(name => {
    const w = new Worker(name, j => engine.procesar(j, w), { connection: conexionRedisWorker(), prefix: config.prefix, concurrency: 4 });
    engine.conectarEventos(w); return w;
  });
  await Promise.all(workers.map(w => w.waitUntilReady())); process.send({ tipo: 'listo', pid: process.pid });
  await new Promise(resolve => process.once('message', resolve));
  await Promise.all(workers.map(w => w.close()));
  capacity.onApplicationShutdown(); tenant.onApplicationShutdown(); process.disconnect();
}

async function principal() {
  const folder = path.resolve(process.argv[2] || 'output/grafonest-transformacion-2026-09-09/capacidad-colas');
  fs.mkdirSync(folder, { recursive: true });
  fs.rmSync(path.join(folder, 'continuar'), { force: true });
  const prefix = `grafonest-queue-test-${randomUUID()}`;
  process.env.GRAFONEST_POOL_ID = prefix;
  const tenants = Object.fromEntries(['a','b','c','d','h1','h2'].map(k => [k, randomUUID()]));
  const config = { prefix, tenants };
  const capacity = new CapacidadGeometriaService();
  const redis = new Redis(urlRedisWorkers(), { maxRetriesPerRequest: 1 });
  const queues = [COLA_GEOMETRIA, COLA_GEOMETRIA_INTENSIVA].map(name => new Queue(name, { prefix, connection: conexionRedisWorker() }));
  const children = [], events = [], states = [], jobs = [];
  let ready = 0;
  try {
    const input = { schemaVersion: 1, tenantId: tenants.a, correlationId: 'base', solicitadoEl: new Date().toISOString(), motor: 'collision', semilla: 30,
      timeoutMs: 2000, separacionMm: 0, placa: { anchoMm: 100, altoMm: 100, margenMm: 0, maxPlacas: 1 },
      piezas: [{ id: 'pieza', cantidad: 1, rotaciones: 1, contorno: [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}] }] };
    const reference = await new OpenNestService().resolver(input);
    fs.writeFileSync(path.join(folder, 'referencia.json'), JSON.stringify(reference));
    fs.writeFileSync(path.join(folder, 'config.json'), JSON.stringify(config));
    for (let i=0;i<3;i++) {
      const child = fork(__filename, ['--hijo', folder], { stdio: ['ignore','pipe','pipe','ipc'] });
      const log = fs.createWriteStream(path.join(folder, `replica-${i}.log`));
      child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false }); child.once('exit', () => log.end());
      child.on('message', e => { events.push(e); if (e.tipo === 'listo') ready++; });
      children.push(child);
    }
    await until(() => ready === 3, 10000);
    const enqueue = async (id, empresa, heavy = false) => {
      const registro = { jobId: id, tenantId: tenants[empresa], clase: heavy ? 'intensiva' : 'normal', prioridad: heavy ? 20 : 5 };
      await capacity.registrar(registro, false);
      const j = await queues[heavy ? 1 : 0].add(TRABAJO_NESTING_IRREGULAR_OPENNEST,
        { ...input, tenantId: registro.tenantId, correlationId: id, claseComplejidad: heavy ? 'INTENSIVA' : 'NORMAL' },
        { jobId: id, attempts: 1, priority: registro.prioridad });
      await capacity.confirmar(id); jobs.push(j);
    };
    await enqueue('a-0','a'); await until(() => events.some(e => e.id === 'a-0' && e.tipo === 'inicio'));
    for (let i=1;i<=100;i++) await enqueue(`a-${i}`, 'a');
    await enqueue('b-0','b'); await enqueue('c-0','c'); await enqueue('d-0','d');
    await enqueue('h1-0','h1',true); await enqueue('h2-0','h2',true);
    fs.writeFileSync(path.join(folder, 'continuar'), 'ok');
    await until(async () => {
      const s = await capacity.estado(); states.push({ tiempo: Date.now(), ...s });
      assert.ok(s.cpuReservada <= 4 && s.memoriaReservadaMb <= 4096);
      assert.ok(s.normalesActivos <= 2 && s.intensivosActivos <= 1);
      const counts = await Promise.all(queues.map(q => q.getJobCounts('completed','failed')));
      assert.equal(counts.reduce((n,c) => n+c.failed,0),0);
      return counts.reduce((n,c) => n+c.completed,0) === jobs.length;
    });
    const starts = events.filter(e => e.tipo === 'inicio');
    assert.equal(starts.length, jobs.length); assert.equal(new Set(starts.map(e => e.id)).size, jobs.length);
    const bIndex = starts.findIndex(e => e.id === 'b-0');
    const aBeforeB = starts.slice(0,bIndex).filter(e => e.id.startsWith('a-')).length;
    assert.ok(aBeforeB <= 2, `La fábrica B esperó ${aBeforeB} trabajos de A.`);
    assert.ok(starts.filter(e=>e.id.startsWith('a-')).every((e,i)=>e.id===`a-${i}`), 'La misma fábrica conserva FIFO.');
    assert.ok(states.some(s => s.normalesActivos > 0 && s.intensivosActivos > 0), 'Deben coexistir trabajos normales e intensivos.');
    const final = await capacity.estado(); assert.equal(final.permisosActivos,0); assert.equal(final.trabajosPendientes,0);
    for (const j of jobs) { const saved = await j.queue.getJob(j.id); validarResultadoNestingOpenNest(saved.data, saved.returnvalue); }
    const summary = { procesos: children.length, trabajos: jobs.length, completadosUnaSolaVez: true, trabajosAAntesDeB: aBeforeB,
      despertarInmediato: process.env.GRAFONEST_BENCH_NO_WAKE !== '1',
      maxCpuReservada: Math.max(...states.map(s=>s.cpuReservada)), maxMemoriaReservadaMb: Math.max(...states.map(s=>s.memoriaReservadaMb)),
      duracionLoteMs: Math.max(...events.filter(e=>e.tiempo).map(e=>e.tiempo))-Math.min(...events.filter(e=>e.tiempo).map(e=>e.tiempo)),
      consumoFisicoMedido: false, duracionesControladas: true, estadoFinal: final };
    fs.writeFileSync(path.join(folder, 'eventos.json'), JSON.stringify(events)); fs.writeFileSync(path.join(folder, 'estados.json'), JSON.stringify(states));
    fs.writeFileSync(path.join(folder, 'aceptacion.json'), JSON.stringify(summary,null,2)); console.log(JSON.stringify(summary));
  } finally {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child,'exit'); child.send('terminar');
      const timer=setTimeout(()=>child.kill('SIGKILL'),5000); await closed; clearTimeout(timer);
    }
    await Promise.all(queues.map(async q=>{ await q.obliterate({force:true}); await q.close(); }));
    const patterns = [`grafo:geometry:capacity:v1:{${createHash('sha256').update(prefix).digest('hex')}}*`, ...Object.values(tenants).map(t=>`grafo:worker:v1:tenant:${createHash('sha256').update(t).digest('hex')}:*`)];
    for (const pattern of patterns) { let cursor='0'; do { const [next,keys]=await redis.scan(cursor,'MATCH',pattern,'COUNT',100); if(keys.length) await redis.del(...keys); cursor=next; } while(cursor!=='0'); }
    capacity.onApplicationShutdown(); redis.disconnect();
  }
}
(process.argv[2] === '--hijo' ? hijo(process.argv[3]) : principal()).catch(e=>{console.error(e);process.exitCode=1;});
