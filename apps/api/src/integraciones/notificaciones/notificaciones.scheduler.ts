import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EstadoIntegracion, ProveedorIntegracion } from '@prisma/client';

import { conLockDeCron } from '../../common/cron-lock';
import { runWithTenant } from '../../common/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { DespachoService } from './despacho.service';
import { NotificacionesResenasService } from './notificaciones-resenas.service';
import { NotificacionesPresupuestosService } from './notificaciones-presupuestos.service';
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

/**
 * Cuánto puede estar una fila reservada (`enviando`) antes de darla por
 * abandonada. Una llamada a Wati tarda segundos: diez minutos sólo se
 * alcanzan si el proceso que la reservó se murió en el medio.
 */
const RESERVA_VENCIDA_MIN = 10;

@Injectable()
export class NotificacionesScheduler {
  private readonly logger = new Logger(NotificacionesScheduler.name);
  private corriendo = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly despacho: DespachoService,
    private readonly resenas: NotificacionesResenasService,
    private readonly presupuestos: NotificacionesPresupuestosService,
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
          await this.soltarReservasVencidas();
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
   * El pedido de reseña, una vez por día.
   *
   * Va aparte del drenado de cada cinco minutos porque no es lo mismo: aquello
   * despacha lo que YA está encolado, esto decide qué encolar. Y decidirlo
   * cada cinco minutos no aporta nada — el plazo se mide en días— mientras que
   * pasar seguido multiplica las consultas por tenant.
   *
   * El horario (10:00 UTC — el cron no declara timeZone) es sólo el momento
   * del BARRIDO, no el de la salida: con zona horaria por tenant, un único
   * disparo no puede caer "dentro de la ventana" de todos a la vez. El que
   * decide es el despacho, que evalúa la ventana de cortesía (09:00–20:00)
   * en la zona de CADA tenant y reprograma a su próxima ventana local lo
   * que caiga fuera. Barrer temprano en el continente (07:00 en Buenos
   * Aires, 04:00 en Tegucigalpa) hace que lo encolado salga ese mismo día,
   * apenas abra la ventana local de cada uno.
   */
  @Cron('0 10 * * *', { name: 'notificaciones-resenas' })
  async pedirResenas(): Promise<void> {
    try {
      await conLockDeCron(
        this.prisma,
        'notificaciones-resenas',
        600,
        async () => {
          let total = 0;
          for (const tenantId of await this.tenantsConWati()) {
            total += await this.resenas.barrer(tenantId);
          }
          if (total > 0) {
            this.logger.log(`${total} pedido(s) de reseña encolados.`);
          }
        },
      );
    } catch (error) {
      this.logger.error(
        'Falló el barrido de pedidos de reseña.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @Cron('15 10 * * *', { name: 'notificaciones-presupuestos-por-vencer' })
  async recordarPresupuestos(): Promise<void> {
    try {
      await conLockDeCron(
        this.prisma,
        'notificaciones-presupuestos-por-vencer',
        600,
        async () => {
          let total = 0;
          for (const tenantId of await this.tenantsConWati()) {
            total += await this.presupuestos.barrerPorVencer(tenantId);
          }
          if (total > 0) {
            this.logger.log(
              `${total} recordatorio(s) de presupuesto encolados.`,
            );
          }
        },
      );
    } catch (error) {
      this.logger.error(
        'Falló el barrido de presupuestos por vencer.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Devuelve a la cola las filas que quedaron reservadas por un proceso que se
   * murió mientras hablaba con Wati.
   *
   * Es la contracara de la reserva: sin esto, un deploy en el momento justo
   * dejaría un aviso colgado para siempre. El corte de diez minutos es lo que
   * hace que soltar una fila signifique "el proceso murió" y no "todavía está
   * mandando" — que es el caso en el que reintentar duplicaría el mensaje.
   *
   * Cross-tenant y sin contexto, igual que `tenantsConWati`.
   */
  private async soltarReservasVencidas(): Promise<void> {
    const corte = new Date(Date.now() - RESERVA_VENCIDA_MIN * 60 * 1000);
    const filas = await this.prisma.$executeRawUnsafe(
      `UPDATE "NotificacionWhatsapp"
          SET "estado" = $1, "reservadaEl" = NULL
        WHERE "estado" = $2 AND ("reservadaEl" IS NULL OR "reservadaEl" < $3)`,
      ESTADOS.pendiente,
      ESTADOS.enviando,
      corte,
    );
    if (filas > 0) {
      this.logger.warn(
        `${filas} notificación(es) quedaron reservadas sin terminar y vuelven a la cola.`,
      );
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
