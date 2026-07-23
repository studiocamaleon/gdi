import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EstadoIntegracion, ProveedorIntegracion } from '@prisma/client';

import { conLockDeCron } from '../../common/cron-lock';
import { runWithTenant } from '../../common/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegracionesService } from '../integraciones.service';
import { WatiClient } from '../wati/wati.client';
import { POR_EVENTO } from '../wati/catalogo';
import { ESTADOS } from './notificaciones.service';

/**
 * Drena la cola de notificaciones.
 *
 * Es el worker de la cola pobre de D5: una tabla y este cron. Sobrevive a un
 * reinicio, es observable desde la UI, y el día que aparezca Redis se cambia
 * esto sin tocar ningún punto de enganche.
 *
 * Lo que hace distinto a un "mandar todo lo pendiente":
 *
 *  - **Respeta la ventana horaria.** Lo que cae fuera se corre al próximo
 *    horario en vez de descartarse: un WhatsApp a las 23:40 se lee como spam,
 *    pero el aviso sigue siendo útil a las 9 de la mañana.
 *  - **Verifica que la plantilla esté aprobada** antes de mandar. Meta sólo
 *    entrega las aprobadas, y si una se pausó por calidad el envío falla sin
 *    decir por qué.
 *  - **Reintenta con techo.** Un teléfono que no existe fallaría para siempre;
 *    después de `MAX_INTENTOS` la fila queda `fallida` con su motivo y deja de
 *    consumir llamadas.
 */

/** Cada cuántos intentos se rinde con una notificación. */
const MAX_INTENTOS = 4;

/** Techo de envíos por corrida y por tenant, para no vaciar la cola de golpe. */
const POR_CORRIDA = 25;

/**
 * El sistema es argentino y no modelamos zona horaria por tenant, así que la
 * ventana se evalúa en hora de Buenos Aires — no en la del servidor, que en
 * Render es UTC y correría la ventana tres horas.
 */
const ZONA = 'America/Argentina/Buenos_Aires';

@Injectable()
export class NotificacionesScheduler {
  private readonly logger = new Logger(NotificacionesScheduler.name);
  private corriendo = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly integraciones: IntegracionesService,
    private readonly wati: WatiClient,
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
      const config = await this.prisma.configuracionNotificaciones.findFirst();
      // El freno de mano: corta todo sin desconectar la integración.
      if (config?.pausado) return;

      const ahora = new Date();
      const pendientes = await this.prisma.notificacionWhatsapp.findMany({
        where: {
          estado: ESTADOS.pendiente,
          OR: [{ programadaPara: null }, { programadaPara: { lte: ahora } }],
        },
        orderBy: { createdAt: 'asc' },
        take: POR_CORRIDA,
      });
      if (pendientes.length === 0) return;

      // Fuera de horario no se descarta nada: se corre al próximo horario.
      const proxima = this.proximaVentana(
        ahora,
        config?.horaDesde ?? '09:00',
        config?.horaHasta ?? '20:00',
      );
      if (proxima) {
        await this.prisma.notificacionWhatsapp.updateMany({
          where: { id: { in: pendientes.map((p) => p.id) } },
          data: { programadaPara: proxima },
        });
        return;
      }

      const cred = await this.integraciones.credencialesWati();
      if (!cred) return;

      // Una sola lectura del catálogo remoto por corrida: saber qué está
      // aprobado es lo mismo para las 25 notificaciones de esta tanda.
      const aprobadas = new Set(
        (await this.wati.listarPlantillas(cred))
          .filter((p) => p.estado === 'APPROVED')
          .map((p) => p.nombre),
      );

      let enviadas = 0;
      for (const n of pendientes) {
        if (!aprobadas.has(n.plantilla)) {
          await this.marcar(n.id, ESTADOS.pendiente, {
            motivo: `La plantilla ${n.plantilla} no está aprobada.`,
            intentos: n.intentos + 1,
            // Se reintenta más tarde: una plantilla pendiente de Meta se
            // aprueba sola en horas, y el aviso todavía sirve.
            programadaPara: new Date(ahora.getTime() + 60 * 60 * 1000),
          });
          continue;
        }

        const nombres = POR_EVENTO.get(n.evento as never)?.parametros.map(
          (p) => p.nombre,
        );
        const valores = Array.isArray(n.parametros)
          ? (n.parametros as string[])
          : [];
        if (!nombres || nombres.length !== valores.length) {
          await this.marcar(n.id, ESTADOS.descartada, {
            motivo: 'Los parámetros no coinciden con la plantilla actual.',
            intentos: n.intentos + 1,
          });
          continue;
        }

        const res = await this.wati.enviarPlantilla(cred, {
          telefono: n.telefono,
          plantilla: n.plantilla,
          parametros: Object.fromEntries(
            nombres.map((nombre, i) => [nombre, valores[i]]),
          ),
          broadcastName: `grafo_${n.evento}`,
        });

        if (res.ok) {
          await this.marcar(n.id, ESTADOS.enviada, {
            intentos: n.intentos + 1,
            enviadaEl: new Date(),
            motivo: null,
          });
          enviadas += 1;
          continue;
        }

        const intentos = n.intentos + 1;
        await this.marcar(
          n.id,
          intentos >= MAX_INTENTOS ? ESTADOS.fallida : ESTADOS.pendiente,
          {
            intentos,
            motivo: res.motivo,
            // Backoff simple: cada intento espera el doble que el anterior.
            programadaPara:
              intentos >= MAX_INTENTOS
                ? null
                : new Date(ahora.getTime() + 2 ** intentos * 60 * 1000),
          },
        );
      }

      if (enviadas > 0) {
        this.logger.log(`Tenant ${tenantId}: ${enviadas} WhatsApp enviados.`);
      }
    });
  }

  private async marcar(
    id: string,
    estado: string,
    datos: {
      intentos: number;
      motivo?: string | null;
      enviadaEl?: Date;
      programadaPara?: Date | null;
    },
  ): Promise<void> {
    await this.prisma.notificacionWhatsapp.updateMany({
      where: { id },
      data: { estado, ...datos },
    });
  }

  /**
   * `null` si `ahora` cae dentro de la ventana; si no, cuándo se abre.
   *
   * Sólo mueve la hora, nunca el día, salvo que ya haya cerrado — en ese caso
   * va al día siguiente. No contempla fines de semana a propósito: una orden
   * lista un sábado le sirve al cliente el sábado.
   */
  proximaVentana(ahora: Date, desde: string, hasta: string): Date | null {
    const minutos = (hhmm: string): number => {
      const [h, m] = hhmm.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const partes = new Intl.DateTimeFormat('en-GB', {
      timeZone: ZONA,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(ahora);
    const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? 0);
    const minuto = Number(partes.find((p) => p.type === 'minute')?.value ?? 0);
    const actual = hora * 60 + minuto;

    const inicio = minutos(desde);
    const fin = minutos(hasta);
    if (actual >= inicio && actual < fin) return null;

    // Cuánto falta para la apertura: hoy si todavía no abrió, mañana si cerró.
    const faltan =
      actual < inicio ? inicio - actual : 24 * 60 - actual + inicio;
    return new Date(ahora.getTime() + faltan * 60 * 1000);
  }
}
