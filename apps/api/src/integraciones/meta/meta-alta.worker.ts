import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaAltaService } from './meta-alta.service';

@Injectable()
export class MetaAltaWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setTimeout>;
  private tarea?: Promise<void>;
  private cerrado = false;
  private readonly logger = new Logger(MetaAltaWorker.name);
  constructor(
    private readonly altas: MetaAltaService,
    private readonly db: PrismaService,
  ) {}
  onModuleInit() {
    if (
      !['sandbox', 'coexistencia'].includes(
        process.env.META_CONEXION_MODO ?? '',
      ) ||
      (process.env.NODE_ENV === 'development' &&
        process.env.GRAFO_LOCAL_DISABLE_CRON === 'true')
    )
      return;
    this.programar();
  }
  private programar() {
    if (this.cerrado) return;
    this.timer = setTimeout(() => {
      this.tarea = this.ejecutar();
    }, 2000);
    this.timer.unref();
  }
  private async ejecutar() {
    try {
      await this.db.metaAutorizacion.updateMany({
        where: {
          estado: { in: ['PREPARADA', 'CANJEANDO', 'CANJEADA', 'VERIFICANDO'] },
          venceEl: { lte: new Date() },
        },
        data: {
          estado: 'REINICIAR',
          tokenCifrado: Prisma.DbNull,
          falloCodigo: 'INTENTO_VENCIDO',
        },
      });
      for (let i = 0; i < 3 && !this.cerrado; i++)
        if (!(await this.altas.procesarSiguiente())) break;
    } catch {
      this.logger.warn(
        'El alta de WhatsApp necesita un nuevo ciclo de comprobación.',
      );
    } finally {
      this.programar();
    }
  }
  async onModuleDestroy() {
    this.cerrado = true;
    clearTimeout(this.timer);
    await this.tarea;
  }
}
