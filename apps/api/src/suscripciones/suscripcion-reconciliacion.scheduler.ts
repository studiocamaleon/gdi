import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { conLockDeCron } from '../common/cron-lock';
import { PaddleService } from '../cobro/paddle.service';
import { SuscripcionSyncService } from '../cobro/suscripcion-sync.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Red de seguridad de los webhooks de Paddle.
 *
 * Cada diez minutos consulta el estado autoritativo de las suscripciones
 * vinculadas. Así una renovación, una tarjeta corregida o un webhook perdido
 * convergen solos. También vence nuestra gracia aunque Paddle no envíe otro
 * evento luego del primer rechazo.
 */
@Injectable()
export class SuscripcionReconciliacionScheduler {
  private readonly logger = new Logger(
    SuscripcionReconciliacionScheduler.name,
  );
  private corriendo = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleService,
    private readonly sync: SuscripcionSyncService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'reconciliar-suscripciones-paddle',
  })
  async ejecutar() {
    if (this.corriendo || !this.paddle.habilitado) return;
    this.corriendo = true;
    try {
      await conLockDeCron(
        this.prisma,
        'reconciliar-suscripciones-paddle',
        540,
        async () => {
          const resultado = await this.barrer();
          if (resultado.sincronizadas || resultado.suspendidas) {
            this.logger.log(
              `Paddle reconciliado: ${resultado.sincronizadas} sincronizadas, ${resultado.suspendidas} gracias vencidas.`,
            );
          }
        },
      );
    } finally {
      this.corriendo = false;
    }
  }

  async barrer(ahora = new Date()) {
    const vencidas = await this.prisma.suscripcion.updateMany({
      where: {
        proveedor: 'paddle',
        estadoProveedor: 'past_due',
        estado: 'activa',
        graciaHasta: { lte: ahora },
      },
      data: { estado: 'suspendida' },
    });

    const suscripciones = await this.prisma.suscripcion.findMany({
      where: { proveedor: 'paddle', referenciaExterna: { not: null } },
      select: { referenciaExterna: true },
    });
    let sincronizadas = 0;
    for (const suscripcion of suscripciones) {
      if (!suscripcion.referenciaExterna) continue;
      const aplicada = await this.sincronizarReferencia(
        suscripcion.referenciaExterna,
        ahora,
      );
      if (aplicada) sincronizadas += 1;
    }
    return { sincronizadas, suspendidas: vencidas.count };
  }

  async sincronizarReferencia(referencia: string, ahora = new Date()) {
    const remota = await this.paddle.obtenerSuscripcion(referencia);
    const externa = remota ? this.sync.extraer(remota) : null;
    if (!externa) return false;
    const resultado = await this.sync.aplicar(externa, {
      origen: 'reconciliacion',
      ahora,
    });
    return resultado.aplicado;
  }
}
