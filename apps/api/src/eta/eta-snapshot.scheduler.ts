import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { conLockDeCron } from '../common/cron-lock';
import { PrismaService } from '../prisma/prisma.service';
import { EtaService } from './eta.service';

/**
 * Foto diaria del ETA (F2). Corre después del barrido de acreditaciones
 * (01:00 UTC): a las 09:00 UTC itera los tenants con órdenes vivas y
 * snapshotea la cola proyectada. El horario es UTC —el cron no declara
 * timeZone— y 09:00 UTC es madrugada en todo el continente (06:00 en
 * Buenos Aires, 03:00 en Tegucigalpa), así la foto cae "de noche" para
 * cualquier tenant; la FECHA del snapshot ya se calcula con la zona de
 * cada uno en eta.service. Idempotente (upsert por día), con guard local
 * para no superponer corridas largas.
 */
@Injectable()
export class EtaSnapshotScheduler {
  private readonly logger = new Logger(EtaSnapshotScheduler.name);
  private corriendo = false;

  constructor(
    private readonly eta: EtaService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 9 * * *', { name: 'eta-snapshot-diario' })
  async snapshotDiario() {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      // El TTL más largo de los tres: recorre TODOS los tenants con actividad
      // y cada uno corre el scheduler entero. Crece con la base.
      await conLockDeCron(
        this.prisma,
        'eta-snapshot-diario',
        1800,
        async () => {
          const tenants = await this.eta.tenantsConActividad();
          let ok = 0;
          for (const tenantId of tenants) {
            try {
              await this.eta.snapshotDiario(tenantId);
              ok += 1;
            } catch (error) {
              // Un tenant que falla no debe frenar al resto.
              this.logger.error(
                `Falló el snapshot de ETA del tenant ${tenantId}.`,
                error instanceof Error ? error.stack : String(error),
              );
            }
          }
          if (ok > 0) {
            this.logger.log(`Snapshot de ETA escrito para ${ok} tenant(s).`);
          }
        },
      );
    } finally {
      this.corriendo = false;
    }
  }
}
