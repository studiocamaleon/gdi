import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { runWithTenant } from '../common/tenant-context';
import { urlRedisWorkers } from '../workers/redis';
import { CanalInbox, claveCanalInbox } from './inbox-revision';

const TOPICO = 'grafo:inbox:revision:v1';
type Listener = (revision: string | null) => void;
type CanalActivo = {
  canal: CanalInbox;
  listeners: Set<Listener>;
  revision?: string;
  consultando: boolean;
  pendiente: boolean;
  timer: ReturnType<typeof setInterval>;
};

/** Un control de respaldo por canal activo y proceso, no por pestaña.
 * Los avisos Redis son pistas sin contenido; se confirma la revisión en DB. */
@Injectable()
export class InboxTiempoRealBus implements OnModuleDestroy {
  private canales = new Map<string, CanalActivo>();
  private publicador?: Redis;
  private receptor?: Redis;
  private cerrado = false;
  constructor(private readonly prisma: PrismaService) {}

  private conectar() {
    if (this.publicador || this.cerrado) return;
    const opciones = {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      connectTimeout: 1500,
      retryStrategy: (n: number) => Math.min(n * 500, 5000),
    };
    this.publicador = new Redis(urlRedisWorkers(), opciones);
    this.receptor = new Redis(urlRedisWorkers(), opciones);
    // Nunca registrar la URL de Redis ni fallar un webhook por este transporte.
    this.publicador.on('error', () => undefined);
    this.receptor.on('error', () => undefined);
    this.receptor.on('ready', () => {
      void this.receptor
        ?.subscribe(TOPICO)
        .then(() => {
          for (const canal of this.canales.values()) void this.comprobar(canal);
        })
        .catch(() => undefined);
    });
    this.receptor.on('message', (topico, clave) => {
      if (topico !== TOPICO || !/^[a-f0-9]{64}$/.test(clave)) return;
      const canal = this.canales.get(clave);
      if (canal) void this.comprobar(canal);
    });
    void this.publicador.connect().catch(() => undefined);
    void this.receptor.connect().catch(() => undefined);
  }

  /** Sólo DESPUÉS del commit. Si Redis no recibe el aviso, el respaldo detecta
   * la revisión persistida. No enviar texto, teléfonos ni credenciales. */
  avisar(canal: CanalInbox) {
    if (this.cerrado) return;
    const clave = claveCanalInbox(canal);
    const activo = this.canales.get(clave);
    if (activo) void this.comprobar(activo);
    try {
      this.conectar();
      if (this.publicador?.status === 'ready')
        void this.publicador.publish(TOPICO, clave).catch(() => undefined);
    } catch {
      /* La revisión duradera permite recuperar el aviso. */
    }
  }

  escuchar(canal: CanalInbox, listener: Listener): () => void {
    if (this.cerrado) throw new Error('El bus del Inbox está cerrado.');
    const clave = claveCanalInbox(canal);
    let activo = this.canales.get(clave);
    if (!activo) {
      activo = {
        canal,
        listeners: new Set(),
        consultando: false,
        pendiente: false,
        timer: setInterval(() => void this.comprobar(activo!), 15000),
      };
      activo.timer.unref?.();
      this.canales.set(clave, activo);
    }
    activo.listeners.add(listener);
    // El snapshot inicial siempre provoca reconciliación en el navegador.
    if (activo.revision !== undefined) listener(activo.revision);
    void this.comprobar(activo);
    try {
      this.conectar();
    } catch {
      /* respaldo por DB */
    }
    return () => {
      activo.listeners.delete(listener);
      if (!activo.listeners.size) {
        clearInterval(activo.timer);
        this.canales.delete(clave);
      }
    };
  }

  private async comprobar(activo: CanalActivo) {
    if (this.cerrado || !activo.listeners.size) return;
    if (activo.consultando) {
      activo.pendiente = true;
      return;
    }
    activo.consultando = true;
    try {
      // La conexión compartida no puede heredar el tenant del primer cliente.
      const fila = await runWithTenant(activo.canal.tenantId, () =>
        this.prisma.inboxCanalRevision.findUnique({
          where: { tenantId_wabaId_phoneNumberId: activo.canal },
          select: { revision: true },
        }),
      );
      const revision = (fila?.revision ?? 0n).toString();
      if (this.cerrado) return;
      if (activo.revision !== revision) {
        activo.revision = revision;
        for (const listener of activo.listeners) listener(revision);
      }
    } catch {
      if (this.cerrado) return;
      activo.revision = undefined;
      for (const listener of activo.listeners) listener(null);
    } finally {
      activo.consultando = false;
      if (activo.pendiente) {
        activo.pendiente = false;
        void this.comprobar(activo);
      }
    }
  }

  onModuleDestroy() {
    this.cerrado = true;
    for (const canal of this.canales.values()) {
      clearInterval(canal.timer);
      canal.listeners.clear();
    }
    this.canales.clear();
    this.publicador?.disconnect();
    this.receptor?.disconnect();
  }
}
