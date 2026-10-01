import {
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import {
  createIORedisClient,
  Job,
  Queue,
  RedisConnection,
  type JobsOptions,
  type QueueOptions,
  type IRedisClient,
} from 'bullmq';
import { conexionRedisApi, urlRedisWorkers } from './redis';

// Por cola: una preparación comercial puede incluir hasta 20 cantidades.
// Los cupos incluyen espera, ejecución y demora; no se renuevan al reiniciar.
export const CUPO_CALCULOS = Object.freeze({
  empresa: 32,
  cola: 128,
  bytesEmpresa: 8 * 1024 * 1024,
  bytesCola: 32 * 1024 * 1024,
  bytesTrabajo: 8 * 1024 * 1024,
});
type Registro = { id: string; empresa: string; bytes: number };

/**
 * Admisión y alta de BullMQ en la misma transacción optimista de Redis.
 * No hay permisos temporales que venzan mientras el trabajo sigue esperando.
 * Usa el alta transaccional pública de BullMQ, sin reemplazar sus scripts.
 */
export class ColaCalculos<D, R, N extends string> extends Queue<
  D,
  R,
  N,
  D,
  R,
  N
> {
  private turno: Promise<unknown> = Promise.resolve();
  private esperando = 0;
  private readonly registro: string;
  private conexionAdmision?: RedisConnection;
  private generacionConexion = 0;

  constructor(
    nombre: string,
    private readonly empresaDe: (data: D) => string,
    opciones: Omit<QueueOptions, 'connection'> = {},
    private readonly redisAdmision = new Redis(urlRedisWorkers(), {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      connectTimeout: 5_000,
      commandTimeout: 5_000,
      autoResendUnfulfilledCommands: false,
      enableOfflineQueue: false,
    }),
  ) {
    super(nombre, { ...opciones, connection: conexionRedisApi() });
    this.registro = this.toKey('grafo-admision-v1');
    this.redisAdmision.on('close', () => this.generacionConexion++);
  }

  protected async addJob(
    nombre: N,
    data: D,
    opciones?: JobsOptions,
  ): Promise<Job<D, R, N>> {
    if (this.esperando >= 64) throw colaOcupada();
    this.esperando++;
    const intento = this.turno.then(() => this.admitir(nombre, data, opciones));
    // WATCH pertenece a la conexión: dos altas de esta instancia no se mezclan.
    this.turno = intento.catch(() => undefined);
    try {
      return await intento;
    } finally {
      this.esperando--;
    }
  }

  private async admitir(
    nombre: N,
    data: D,
    opciones?: JobsOptions,
  ): Promise<Job<D, R, N>> {
    const id = opciones?.jobId;
    const empresaId = this.empresaDe(data);
    if (!id || id.includes(':') || !empresaId)
      throw new Error('Falta la identidad del cálculo.');
    const empresa = createHash('sha256').update(empresaId).digest('hex');
    const bytes = Buffer.byteLength(JSON.stringify(data));
    if (bytes > CUPO_CALCULOS.bytesTrabajo)
      throw new HttpException(
        'El cálculo contiene demasiada información. Reducí el archivo o la cantidad de piezas.',
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    await this.waitUntilReady();
    await this.prepararAdmision();
    const client: IRedisClient = createIORedisClient(this.redisAdmision);
    const job = new Job<D, R, N>(
      this,
      nombre,
      data,
      {
        ...this.jobsOpts,
        ...opciones,
        sizeLimit: CUPO_CALCULOS.bytesTrabajo,
      },
      id,
    );
    try {
      for (let intento = 0; intento < 12; intento++) {
        const conexion = this.generacionConexion;
        await this.redisAdmision.watch(this.registro, this.toKey(id));
        if (opciones?.deduplication) {
          if (Object.keys(opciones.deduplication).some((k) => k !== 'id'))
            throw new Error('Sólo se admite deduplicación simple en cálculos.');
          const clave = `${this.keys.de}:${opciones.deduplication.id}`;
          await this.redisAdmision.watch(clave);
          const compartido = await this.redisAdmision.get(clave);
          if (compartido) {
            const existente = await Job.fromId<D, R, N>(this, compartido);
            this.exigirMismaConexion(conexion);
            if (existente && (await this.redisAdmision.multi().ping().exec()))
              return existente;
            await this.redisAdmision.unwatch();
            continue;
          }
        }
        const raw = await this.redisAdmision.get(this.registro);
        const anteriores = (raw ? JSON.parse(raw) : []) as Registro[];
        if (
          !Array.isArray(anteriores) ||
          anteriores.length > CUPO_CALCULOS.cola
        )
          throw new Error('Registro de admisión inválido.');
        const vivos: Registro[] = [];
        if (anteriores.length) {
          await this.redisAdmision.watch(
            ...anteriores.map((r) => this.toKey(r.id)),
          );
          const lecturas = this.redisAdmision.pipeline();
          for (const r of anteriores)
            lecturas.hmget(this.toKey(r.id), 'name', 'finishedOn');
          const estados = await lecturas.exec();
          if (!estados) throw new Error('No se pudo consultar la cola.');
          estados.forEach(([error, estado], index) => {
            if (error) throw error;
            const [payload, terminado] = estado as [
              string | null,
              string | null,
            ];
            if (payload !== null && terminado === null)
              vivos.push(anteriores[index]);
          });
        }
        // Durante un despliegue puede quedar trabajo de productores anteriores.
        // Lo dejamos terminar sin borrar nada ni ignorarlo al calcular el cupo.
        const listas = ['wait', 'paused', 'active'];
        const conjuntos = ['prioritized', 'delayed', 'waiting-children'];
        await this.redisAdmision.watch(
          ...[...listas, ...conjuntos].map((k) => this.toKey(k)),
        );
        const conteos = this.redisAdmision.pipeline();
        listas.forEach((k) => conteos.llen(this.toKey(k)));
        conjuntos.forEach((k) => conteos.zcard(this.toKey(k)));
        const contados = await conteos.exec();
        if (!contados) throw new Error('No se pudo contar la cola.');
        const totalReal = contados.reduce((total, [error, cantidad]) => {
          if (error) throw error;
          return total + Number(cantidad);
        }, 0);
        if (totalReal > vivos.length) {
          // Otra réplica pudo haber insertado entre las lecturas. Sólo rechazar
          // si Redis confirma que la vista vigilada continúa siendo válida.
          this.exigirMismaConexion(conexion);
          if (await this.redisAdmision.multi().ping().exec())
            throw new ServiceUnavailableException(
              'El servicio está terminando cálculos anteriores. Reintentá en unos segundos.',
            );
          continue;
        }
        const existente = await this.redisAdmision.hmget(
          this.toKey(id),
          'name',
          'finishedOn',
        );
        const yaContado = vivos.some((r) => r.id === id);
        // Un duplicado terminal conserva su resultado. Reintentar es otro job.
        const terminal = existente[0] !== null && existente[1] !== null;
        if (!yaContado && !terminal) {
          const propios = vivos.filter((r) => r.empresa === empresa);
          const totalBytes = vivos.reduce((s, r) => s + r.bytes, 0);
          const propiosBytes = propios.reduce((s, r) => s + r.bytes, 0);
          if (
            vivos.length >= CUPO_CALCULOS.cola ||
            propios.length >= CUPO_CALCULOS.empresa ||
            totalBytes + bytes > CUPO_CALCULOS.bytesCola ||
            propiosBytes + bytes > CUPO_CALCULOS.bytesEmpresa
          ) {
            this.exigirMismaConexion(conexion);
            if (await this.redisAdmision.multi().ping().exec())
              throw colaOcupada();
            continue;
          }
          vivos.push({ id, empresa, bytes });
        }
        const tx = client.multi();
        // Una caída antes de EXEC no crea ni reserva nada; después, crea ambos.
        await job.addJob(tx);
        tx.runCommand('grafoGuardarAdmision', [
          this.registro,
          JSON.stringify(vivos),
        ]);
        this.exigirMismaConexion(conexion);
        const resultado = await tx.exec();
        if (resultado === null) {
          await new Promise((r) =>
            setTimeout(r, 2 + Math.floor(Math.random() * 8)),
          );
          continue;
        }
        for (const [error] of resultado) if (error) throw error;
        if (resultado[0][1] !== id)
          throw new Error('El alta del cálculo no fue confirmada.');
        // BullMQ admite D o Job<D> como primer genérico; acá D es siempre datos.
        this.emit('waiting', job as never);
        return job;
      }
      throw colaOcupada();
    } finally {
      await this.redisAdmision
        .unwatch()
        .catch(() => this.redisAdmision.disconnect());
    }
  }

  private exigirMismaConexion(generacion: number): void {
    // Redis descarta WATCH al desconectarse. Nunca confirmar una transacción
    // en una conexión nueva que perdió esa vigilancia.
    if (
      generacion !== this.generacionConexion ||
      this.redisAdmision.status !== 'ready'
    )
      throw new ServiceUnavailableException(
        'Se interrumpió la conexión del servicio de cálculos. Volvé a intentar.',
      );
  }

  private async prepararAdmision(): Promise<void> {
    if (!this.conexionAdmision) {
      // Conexión exclusiva: otras operaciones de Queue no pueden cerrar WATCH.
      this.conexionAdmision = new RedisConnection(this.redisAdmision, {
        shared: true,
      });
      this.conexionAdmision.on('error', (error: Error) =>
        this.emit('error', error),
      );
    }
    // Carga los mismos scripts de BullMQ en la conexión transaccional.
    await this.conexionAdmision.client;
    // El adaptador de BullMQ usa runCommand en sus transacciones.
    createIORedisClient(this.redisAdmision).defineCommand(
      'grafoGuardarAdmision',
      {
        numberOfKeys: 1,
        lua: "return redis.call('SET', KEYS[1], ARGV[1])",
      },
    );
  }

  async close(): Promise<void> {
    await this.turno;
    await super.close();
    await this.conexionAdmision?.close();
    this.redisAdmision.disconnect();
  }

  // Estas colas sólo reciben altas individuales con identidad de empresa.
  addBulk(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException(
        'Los cálculos requieren admisión individual.',
      ),
    );
  }
}

function colaOcupada(): HttpException {
  return new HttpException(
    'Ya hay varios cálculos pendientes. Esperá a que terminen y volvé a intentar; los trabajos aceptados se conservan.',
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
