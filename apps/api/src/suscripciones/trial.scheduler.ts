import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { conLockDeCron } from '../common/cron-lock';

/**
 * Cierra las pruebas vencidas.
 *
 * Qué implica "cerrar": la suscripción pasa a `suspendida`, lo que cierra los
 * gates por plan (AFIP, WhatsApp). NO se borra nada y el tenant sigue entrando
 * y viendo todos sus datos — y con un pago vuelve a 'activa' al instante, por
 * el webhook. Se eligió así a propósito: una prueba que nunca termina no es una
 * prueba, pero bloquearle el sistema a una imprenta sería desproporcionado.
 *
 * Sólo toca suscripciones que siguen en prueba y NO están pagas: si el tenant
 * ya pagó, `proveedor` es 'paddle' y el estado lo manda la pasarela.
 * Ver docs/suscripciones-cobro-diseno.md
 */
@Injectable()
export class TrialScheduler {
  private readonly logger = new Logger(TrialScheduler.name);
  private corriendo = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'cerrar-pruebas-vencidas' })
  async cerrarVencidas() {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      await conLockDeCron(
        this.prisma,
        'cerrar-pruebas-vencidas',
        600,
        async () => {
          const cerradas = await this.barrer();
          if (cerradas > 0) {
            this.logger.log(`Pruebas vencidas cerradas: ${cerradas}.`);
          }
        },
      );
    } finally {
      this.corriendo = false;
    }
  }

  /**
   * Idempotente y llamable a mano. Devuelve cuántas cerró.
   *
   * El filtro por `proveedor: 'manual'` es la guarda importante: una vez que el
   * tenant paga, la suscripción la gobierna Paddle y este barrido no debe
   * tocarla nunca.
   */
  async barrer(ahora = new Date()): Promise<number> {
    const r = await this.prisma.suscripcion.updateMany({
      where: {
        trialHasta: { lte: ahora },
        estado: 'activa',
        proveedor: 'manual',
      },
      data: { estado: 'suspendida' },
    });
    return r.count;
  }
}
