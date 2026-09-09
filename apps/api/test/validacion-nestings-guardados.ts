import { restaurarJson } from '../src/common/json-compartido';
import { PrismaService } from '../src/prisma/prisma.service';
/** Validación local: cotiza el exhibidor sin crear cotizaciones ni órdenes. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { Queue } from 'bullmq';
import { conexionRedisApi } from '../src/workers/redis';
import { COLA_COTIZACIONES, CotizacionJobsService } from '../src/workers/cotizacion/cotizacion-jobs.service';

function nestings(value: unknown, ruta = ''): unknown[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((v, i) => nestings(v, `${ruta}/${i}`));
  return Object.entries(value).flatMap(([key, v]) => {
    if (key === 'nestingResult' && v && typeof v === 'object') {
      const n = v as Record<string, unknown>;
      return [{ ruta, algorithm: n.algorithm, substrates: n.substrates, placements: n.placements }];
    }
    return nestings(v, `${ruta}/${key}`);
  });
}

async function main() {
  const db = new PrismaService();
  const trabajos = new CotizacionJobsService();
  const queue = new Queue(COLA_COTIZACIONES, { connection: conexionRedisApi() });
  try {
    const producto = await db.producto.findFirstOrThrow({ where: { nombre: 'Exhibidor · prueba de archivos y patrones' } });
    const preparado = await db.preparacionNestingProducto.findFirstOrThrow({ where: { tenantId: producto.tenantId, productoId: producto.id, cantidad: 50, estado: 'PREPARADO' } });
    const anterior = await queue.getJob(preparado.jobId!);
    assert((restaurarJson(anterior?.returnvalue) as { exitoso?: boolean })?.exitoso, 'La preparación debe estar terminada.');
    const antes = await db.nestingGuardado.count({where: {tenantId: producto.tenantId}});
    const inicio = Date.now();
    let trabajo = await trabajos.crear({ cotizacion: { tenantId: producto.tenantId, productoId: producto.id, rutaAlternativaId: preparado.rutaClave, jobContext: {cantidad: 50} } });
    while (trabajo.estado === 'pendiente' || trabajo.estado === 'procesando') {
      assert(Date.now() - inicio < 30000, 'La reutilización no debe iniciar otra búsqueda larga.');
      await new Promise(r => setTimeout(r, 250));
      trabajo = await trabajos.consultar(producto.tenantId, trabajo.id);
    }
    assert(trabajo.resultado, JSON.stringify(trabajo.error));
    const resultado = trabajo.resultado;
    const duracionMs = Date.now() - inicio;
    assert(resultado.exitoso, JSON.stringify(resultado.errores));
    const originales = nestings(restaurarJson(anterior.returnvalue));
    const actuales = nestings(JSON.parse(JSON.stringify(resultado)));
    assert(originales.length > 0);
    const firma = (v: unknown) => createHash('sha256').update(JSON.stringify(v, (_k, n: unknown) => typeof n === 'number' ? Math.round(n * 1e8) / 1e8 : n)).digest('hex');
    assert.equal(firma(actuales), firma(originales), 'Deben conservarse placas, piezas, posiciones, operaciones y capas (tolerancia 1e-8 mm).');
    const prev = (restaurarJson(anterior.returnvalue) as { cotizacion: any }).cotizacion;
    assert.deepEqual(resultado.cotizacion?.costos, prev.costos, 'Los mismos recursos y tarifas deben dar el mismo costo.');
    assert.equal(await db.nestingGuardado.count({where: {tenantId: producto.tenantId}}), antes);
    assert(duracionMs < 20000, `La reutilización tardó ${duracionMs} ms.`);
    console.log(JSON.stringify({ producto: producto.nombre, cantidad: 50, preparacionMs: preparado.duracionMs, reutilizacionMs: duracionMs, nestingsComparados: actuales.length, costos: resultado.cotizacion?.costos, geometriaYCapasConservadas: true, toleranciaMm: 1e-8 }));
  } finally { await queue.close(); await trabajos.onApplicationShutdown(); await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
