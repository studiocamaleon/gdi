import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  MetaInboxProcesador,
  recepcionGeneralMetaHabilitada,
} from './meta-inbox-procesador.service';

/** Usa el worker existente; no crea una máquina ni un servicio de pago nuevo. */
@Injectable()
export class MetaInboxWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setTimeout>;
  private parada = false;
  private tarea?: Promise<void>;
  private readonly logger = new Logger(MetaInboxWorker.name);
  constructor(private readonly procesador: MetaInboxProcesador) {}
  onModuleInit() {
    if (
      !recepcionGeneralMetaHabilitada() ||
      (process.env.NODE_ENV === 'development' &&
        process.env.GRAFO_LOCAL_DISABLE_CRON === 'true')
    )
      return;
    this.programar();
  }
  private programar() {
    if (this.parada) return;
    this.timer = setTimeout(() => {
      this.tarea = this.ejecutar();
    }, 1000);
    this.timer.unref();
  }
  private async ejecutar() {
    try {
      for (let i = 0; i < 10 && !this.parada; i++) {
        if (!(await this.procesador.procesarSiguiente())) break;
      }
    } catch {
      this.logger.warn(
        'La recepción de Inbox se retomará en el próximo ciclo.',
      );
    } finally {
      this.programar();
    }
  }
  async onModuleDestroy() {
    this.parada = true;
    clearTimeout(this.timer);
    await this.tarea;
  }
}
