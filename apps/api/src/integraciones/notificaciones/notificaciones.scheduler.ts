import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EstadoIntegracion, ProveedorIntegracion } from '@prisma/client';

import { conLockDeCron } from '../../common/cron-lock';
import { runWithTenant } from '../../common/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { DespachoService } from './despacho.service';
import { ESTADOS } from './estados';

/**
 * La red de la cola de notificaciones.
 *
 * El camino normal es el inmediato: al encolar se intenta mandar en el acto,
 * así el cliente se entera cuando pasa el hecho y no cinco minutos después.
 * Este cron levanta lo que ese intento no pudo:
 *
 *  - lo que cayó fuera de horario y quedó reprogramado,
 *  - lo que falló por un error transitorio y espera su reintento,
 *  - lo que quedó pendiente porque el proceso se reinició justo en el medio.
 *
 * Que sea una red y no el camino principal es lo que permite que el envío no
 * bloquee al operario sin perder nada por el camino.
 */

/** Techo por corrida y por tenant, para no vaciar la cola de golpe. */
const POR_CORRIDA = 25;

@Injectable()
export class NotificacionesScheduler {
  private readonly logger = new Logger(NotificacionesScheduler.name);
  private corriendo = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly despacho: DespachoService,
  ) {}

  @Cron('*/5 * * * *', { name: 'notificaciones-whatsapp' })
  async drenar(): Promise<void> {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      await conLockDeCron(
        this.prisma,
        'notificaciones-whatsapp',
        600,
        async () => {
          for (const tenantId of await this.tenantsConWati()) {
            await this.drenarTenant(tenantId);
          }
        },
      );
    } catch (error) {
      this.logger.error(
        'Falló el drenado de notificaciones.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.corriendo = false;
    }
  }

  /**
   * Query cruda a propósito: el cron no tiene contexto de tenant, y es
   * justamente la pregunta cross-tenant que el guard bloquearía.
   */
  private async tenantsConWati(): Promise<string[]> {
    const filas = await this.prisma.$queryRawUnsafe<
      Array<{ tenantId: string }>
    >(
      `SELECT "tenantId" FROM "IntegracionTenant"
        WHERE "proveedor" = $1::"ProveedorIntegracion"
          AND "estado"    = $2::"EstadoIntegracion"`,
      ProveedorIntegracion.WATI,
      EstadoIntegracion.CONECTADA,
    );
    return filas.map((f) => f.tenantId);
  }

  private async drenarTenant(tenantId: string): Promise<void> {
    await runWithTenant(tenantId, async () => {
      const ahora = new Date();
      const pendientes = await this.prisma.notificacionWhatsapp.findMany({
        where: {
          estado: ESTADOS.pendiente,
          OR: [{ programadaPara: null }, { programadaPara: { lte: ahora } }],
        },
        orderBy: { createdAt: 'asc' },
        take: POR_CORRIDA,
        select: { id: true },
      });

      let enviadas = 0;
      for (const { id } of pendientes) {
        const res = await this.despacho.despachar(id, ahora);
        if (res.estado === 'enviada') enviadas += 1;
      }

      if (enviadas > 0) {
        this.logger.log(`Tenant ${tenantId}: ${enviadas} WhatsApp enviados.`);
      }
    });
  }
}
