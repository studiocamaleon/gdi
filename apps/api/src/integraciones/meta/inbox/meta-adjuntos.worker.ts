import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { adjuntosHabilitados } from './meta-adjuntos';
import { recepcionGeneralMetaHabilitada } from './meta-inbox-procesador.service';
import { MetaAdjuntosService } from './meta-adjuntos.service';
/** Independiente del bucle de mensajes: una descarga lenta no detiene la recepción. */
@Injectable()
export class MetaAdjuntosWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setTimeout>;
  private parada = false;
  private tarea?: Promise<void>;
  private readonly logger = new Logger(MetaAdjuntosWorker.name);
  constructor(private readonly service: MetaAdjuntosService) {}
  onModuleInit() {
    if (
      !adjuntosHabilitados() ||
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
    }, 2000);
    this.timer.unref();
  }
  private async ejecutar() {
    try {
      await this.service.procesarSiguiente();
    } catch {
      this.logger.warn(
        'La copia privada de adjuntos se retomará en el próximo ciclo.',
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
