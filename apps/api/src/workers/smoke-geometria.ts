import { randomUUID } from 'node:crypto';
import { Job, Queue, QueueEvents } from 'bullmq';
import {
  COLA_GEOMETRIA,
  TRABAJO_MEDIR_POLIGONO,
  type MedirPoligonoData,
  type MedirPoligonoResult,
} from './colas';
import { conexionRedisWorker } from './redis';

async function main(): Promise<void> {
  const connection = conexionRedisWorker();
  const queue = new Queue<MedirPoligonoData, MedirPoligonoResult>(
    COLA_GEOMETRIA,
    { connection },
  );
  const events = new QueueEvents(COLA_GEOMETRIA, { connection });
  try {
    await Promise.all([queue.waitUntilReady(), events.waitUntilReady()]);
    const correlationId = randomUUID();
    const data: MedirPoligonoData = {
      schemaVersion: 1,
      tenantId: 'smoke-local',
      correlationId,
      solicitadoEl: new Date().toISOString(),
      puntos: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 100 },
        { x: 0, y: 100 },
      ],
    };
    const job: Job<MedirPoligonoData, MedirPoligonoResult> = await queue.add(
      TRABAJO_MEDIR_POLIGONO,
      data,
      {
        jobId: `smoke-${correlationId}`,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    const result = await job.waitUntilFinished(events, 15_000);
    if (
      result.areaMm2 !== 20_000 ||
      result.perimetroMm !== 600 ||
      result.limites.anchoMm !== 200 ||
      result.limites.altoMm !== 100
    ) {
      throw new Error(
        `Resultado geométrico inesperado: ${JSON.stringify(result)}`,
      );
    }
    process.stdout.write(
      `${JSON.stringify({ ok: true, queue: COLA_GEOMETRIA, jobId: job.id, result }, null, 2)}\n`,
    );
  } finally {
    await Promise.allSettled([events.close(), queue.close()]);
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n` +
      'Verificá que Redis y el worker estén levantados.\n',
  );
  process.exitCode = 1;
});
