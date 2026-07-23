import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EstadoIntegracion, ProveedorIntegracion } from '@prisma/client';

import { runWithTenant } from '../../common/tenant-context';
import { conLockDeCron } from '../../common/cron-lock';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegracionesService } from '../integraciones.service';

/**
 * Deja el catálogo de Grafo dado de alta y en revisión, solo.
 *
 * El tenant conecta Wati con sus credenciales y no hace nada más: en menos de
 * una hora tiene las 13 plantillas en revisión de Meta. Ése era el punto de
 * toda la integración — que no haya que ir al dashboard de Wati a escribir
 * trece textos a mano.
 *
 * **Por qué no lleva la cuenta del cupo.** Meta acepta 10 plantillas por hora,
 * así que un catálogo de 13 nunca entra de una. Se podría llevar una ventana
 * deslizante de envíos por tenant, pero sería estado nuestro que se puede
 * desincronizar del de Meta. En vez de eso: intentar, y parar en el primer
 * "esperá N minutos". Se corrige solo — una corrida mete 10, rebota, y alguna
 * de las siguientes ya pasó la hora y mete el resto. Wati es la fuente de
 * verdad del cupo y nosotros sólo obedecemos.
 *
 * **Por qué mira a todos los tenants y no sólo al que recién conectó.** Cubre
 * gratis tres casos que un disparo al conectar no cubre: una conexión que se
 * cortó a la mitad, un tenant conectado hace meses cuando sumemos plantillas
 * nuevas al catálogo, y una plantilla que Meta rechazó y volvió a DRAFT.
 */
@Injectable()
export class WatiScheduler {
  private readonly logger = new Logger(WatiScheduler.name);
  private corriendo = false;

  constructor(
    private readonly integraciones: IntegracionesService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('*/15 * * * *', { name: 'wati-plantillas' })
  async sincronizarPlantillas(): Promise<void> {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      // TTL holgado: son hasta 13 altas con dos llamadas de red cada una.
      await conLockDeCron(this.prisma, 'wati-plantillas', 900, async () => {
        for (const tenantId of await this.tenantsConWati()) {
          await this.sincronizarTenant(tenantId);
        }
      });
    } catch (error) {
      this.logger.error(
        'Falló la sincronización de plantillas de Wati.',
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
      // Los casts son obligatorios: son columnas enum de Postgres y un
      // parámetro llega como text, así que sin ellos no hay operador de
      // comparación y la query falla con 42883.
      `SELECT "tenantId" FROM "IntegracionTenant"
        WHERE "proveedor" = $1::"ProveedorIntegracion"
          AND "estado"    = $2::"EstadoIntegracion"`,
      ProveedorIntegracion.WATI,
      EstadoIntegracion.CONECTADA,
    );
    return filas.map((f) => f.tenantId);
  }

  private async sincronizarTenant(tenantId: string): Promise<void> {
    await runWithTenant(tenantId, async () => {
      let estado: Awaited<ReturnType<IntegracionesService['plantillasWati']>>;
      try {
        estado = await this.integraciones.plantillasWati();
      } catch (error) {
        // Credenciales revocadas, Wati caído: no es motivo para frenar a los
        // demás tenants.
        this.logger.warn(
          `No se pudieron leer las plantillas del tenant ${tenantId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }

      // DRAFT también entra: es una que se creó y quedó sin enviar porque el
      // cupo cortó la corrida anterior. Ésas son las baratas de completar.
      const pendientes = estado.gestionadas.filter(
        (g) => g.estado === 'SIN_SOMETER' || g.estado === 'DRAFT',
      );
      if (pendientes.length === 0) return;

      let enviadas = 0;
      for (const p of pendientes) {
        const res = await this.integraciones.someterPlantillaWati(p.codigo);
        if (res.ok) {
          enviadas += 1;
          continue;
        }
        if (res.esperaMinutos) {
          this.logger.log(
            `Tenant ${tenantId}: ${enviadas} plantilla(s) enviadas, corte por cupo de Meta (faltan ${
              pendientes.length - enviadas
            }, vuelve en ~${res.esperaMinutos} min).`,
          );
          return;
        }
        this.logger.warn(
          `Tenant ${tenantId}: falló ${p.codigo} — ${res.motivo ?? 'sin motivo'}`,
        );
      }

      if (enviadas > 0) {
        this.logger.log(
          `Tenant ${tenantId}: ${enviadas} plantilla(s) enviadas a revisión.`,
        );
      }
    });
  }
}
