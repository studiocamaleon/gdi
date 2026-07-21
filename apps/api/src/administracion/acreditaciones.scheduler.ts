import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CobrosService } from './cobros.service';

/**
 * Barrido nocturno de acreditaciones vencidas.
 *
 * Tesorería también barre al leer el resumen (ver TesoreriaService), así
 * que el cron no es la única red: sirve para que los saldos queden bien
 * aunque nadie entre al módulo. Ambos caminos van al mismo método
 * idempotente, y el guard local evita superponer corridas largas.
 */
@Injectable()
export class AcreditacionesScheduler {
  private readonly logger = new Logger(AcreditacionesScheduler.name);
  private corriendo = false;

  constructor(private readonly cobros: CobrosService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'acreditar-cobros-vencidos' })
  async acreditarVencidos() {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      const acreditados = await this.cobros.barrerVencidos();
      if (acreditados > 0) {
        this.logger.log(`Acreditados ${acreditados} cobros vencidos.`);
      }
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
