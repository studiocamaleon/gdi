import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Queue, QueueEvents } from 'bullmq';
import { CotizacionWorker } from './cotizacion.worker';
import {
  COLA_COTIZACIONES,
  CotizacionJobsService,
} from './cotizacion-jobs.service';
import { TenantConcurrencyService } from '../tenant-concurrency.service';
import {
  esJsonCompartido,
  leerPropiedadJson,
  restaurarJson,
} from '../../common/json-compartido';

const probar = process.env.F4_QUOTE_WORKER_INTEGRATION === '1' ? it : it.skip;
probar(
  'BullMQ conserva el resultado grande compacto y el servicio entrega el plan completo',
  async () => {
    const url = new URL(process.env.REDIS_URL!);
    expect(url.hostname).toBe('127.0.0.1');
    expect(url.port).not.toBe('6379');
    const connection = { url: url.toString(), maxRetriesPerRequest: null };
    const captura = restaurarJson<any>(
      JSON.parse(
        gunzipSync(
          readFileSync(
            join(
              __dirname,
              '../../../test/fixtures/f4-persistencia/exhibidor-150-cotizacion.json.gz',
            ),
          ),
        ).toString(),
      ),
    );
    const queue = new Queue(COLA_COTIZACIONES, { connection });
    const events = new QueueEvents(COLA_COTIZACIONES, { connection });
    const concurrencia = new TenantConcurrencyService();
    const jobs = new CotizacionJobsService();
    const worker = new CotizacionWorker(
      { cotizar: async () => captura.result } as never,
      concurrencia,
    );
    try {
      await events.waitUntilReady();
      await worker.onApplicationBootstrap();
      const tenantId = randomUUID();
      const creada = await jobs.crear({
        cotizacion: { ...captura.data.input, tenantId },
      });
      const job = await queue.getJob(creada.id);
      const raw = await job!.waitUntilFinished(events, 15000);
      expect(esJsonCompartido(raw)).toBe(true);
      expect(leerPropiedadJson(raw, 'exitoso')).toBe(true);
      expect(Buffer.byteLength(JSON.stringify(raw))).toBeLessThan(2_000_000);
      const vista = await jobs.consultar(tenantId, creada.id);
      expect(
        vista.resultado?.cotizacion?.componentesFabricados?.[0].pasos[0]
          .nestingResult?.placements,
      ).toHaveLength(1350);
      expect(JSON.stringify(vista.resultado)).toBe(
        JSON.stringify(captura.result),
      );
      await expect(jobs.consultar(randomUUID(), creada.id)).rejects.toThrow(
        /No se encontró/,
      );
      await job!.remove();
    } finally {
      await worker.onApplicationShutdown();
      await concurrencia.onApplicationShutdown();
      await jobs.onApplicationShutdown();
      await events.close();
      await queue.close();
    }
  },
  30000,
);
