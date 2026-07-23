import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { conLockDeCron } from '../common/cron-lock';
import { PrismaService } from '../prisma/prisma.service';
import { CobrosService } from './cobros.service';

/**
 * Barrido nocturno de acreditaciones vencidas.
 *
 * Tesorería también barre al leer el resumen (ver TesoreriaService), así
 * que el cron no es la única red: sirve para que los saldos queden bien
 * aunque nadie entre al módulo. Ambos caminos van al mismo método
 * idempotente.
 *
 * Dos guardas, y cada una tapa algo distinto: `corriendo` evita superponer
 * corridas dentro de este proceso, y el lease evita que dos instancias del
 * API acrediten los mismos cobros a la vez.
 */
@Injectable()
export class AcreditacionesScheduler {
  private readonly logger = new Logger(AcreditacionesScheduler.name);
  private corriendo = false;

  constructor(
    private readonly cobros: CobrosService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'acreditar-cobros-vencidos' })
  async acreditarVencidos() {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      await conLockDeCron(
        this.prisma,
        'acreditar-cobros-vencidos',
        600,
        async () => {
          const acreditados = await this.cobros.barrerVencidos();
          if (acreditados > 0) {
            this.logger.log(`Acreditados ${acreditados} cobros vencidos.`);
          }
        },
      );
    } catch (error) {
      this.logger.error(
        'Falló el barrido de acreditaciones vencidas.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.corriendo = false;
    }
  }
}
