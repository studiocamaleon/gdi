import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { conLockDeCron } from '../common/cron-lock';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Higiene de sesiones: se van las que ya no sirven para nada.
 *
 * Una sesión muerta —revocada o vencida— no autoriza nada, pero la fila se
 * quedaba para siempre: en desarrollo había 135 filas de las que sólo 15
 * estaban vivas, la más vieja de tres meses atrás. Crece con cada login de cada
 * persona, sin techo.
 *
 * NO se borra la más reciente de cada tenant aunque esté muerta: la consola de
 * la plataforma lee `max(createdAt)` por tenant para saber cuándo entró alguien
 * por última vez. Sin esa fila, un tenant dormido pasaría de "última actividad
 * hace 4 meses" a no tener fecha, que se lee como que nunca entró nadie.
 *
 * Corre SIN contexto de tenant a propósito: el barrido es global. Mismo patrón
 * que ArchivosScheduler.
 */

/** Cuánto se guarda una sesión muerta antes de barrerla. */
const RETENCION_DIAS = 30;

@Injectable()
export class SesionesScheduler {
  private readonly logger = new Logger(SesionesScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('30 4 * * *', { name: 'higiene-sesiones' })
  async higiene(): Promise<void> {
        // TTL holgado: el barrido es un par de queries, pero con muchos tenants
    // la conservación de la última por tenant hace N lecturas.
    await conLockDeCron(this.prisma, 'higiene-sesiones', 300, async () => {
      const borradas = await this.purgar();
      if (borradas > 0) {
        this.logger.log(`Sesiones muertas purgadas: ${borradas}.`);
      }
    });
  }

  /** Expuesto para poder correrlo a mano y para los tests. */
  async purgar(ahora = new Date()): Promise<number> {
    const corte = new Date(
      ahora.getTime() - RETENCION_DIAS * 24 * 60 * 60 * 1000,
    );

    // La última sesión de cada tenant se conserva: es la "última actividad" que
    // muestra la consola.
    const ultimasPorTenant = await this.prisma.authSession.groupBy({
      by: ['currentTenantId'],
      _max: { createdAt: true },
    });
    const aConservar: string[] = [];
    for (const fila of ultimasPorTenant) {
      if (!fila._max.createdAt) continue;
      const ultima = await this.prisma.authSession.findFirst({
        where: {
          currentTenantId: fila.currentTenantId,
          createdAt: fila._max.createdAt,
        },
        select: { id: true },
      });
      if (ultima) aConservar.push(ultima.id);
    }

    const { count } = await this.prisma.authSession.deleteMany({
      where: {
        id: { notIn: aConservar },
        createdAt: { lt: corte },
        // Muerta = revocada explícitamente o vencida por el reloj.
        OR: [{ revokedAt: { not: null } }, { expiresAt: { lte: ahora } }],
      },
    });
    return count;
  }
}
