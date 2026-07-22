import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EtaService } from './eta.service';

/**
 * Foto diaria del ETA (F2). Corre después del barrido de acreditaciones
 * (01:00): a las 03:00 itera los tenants con órdenes vivas y snapshotea la
 * cola proyectada. Idempotente (upsert por día), con guard local para no
 * superponer corridas largas.
 */
@Injectable()
export class EtaSnapshotScheduler {
  private readonly logger = new Logger(EtaSnapshotScheduler.name);
  private corriendo = false;

  constructor(private readonly eta: EtaService) {}

  @Cron('0 3 * * *', { name: 'eta-snapshot-diario' })
  async snapshotDiario() {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
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
    } finally {
      this.corriendo = false;
    }
  }
}
