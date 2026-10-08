import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { FacturacionLotesService } from './facturacion-lotes.service';
import { runWithTenant } from '../common/tenant-context';
import { reportarFallo } from '../common/observabilidad';
import { textoErrorLog } from '../common/log-seguro';

/** Proceso dedicado, cola PostgreSQL. No importa AppModule ni ScheduleModule. */
@Injectable()
export class FacturacionLotesWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(FacturacionLotesWorker.name);
  private timer?: NodeJS.Timeout;
  private activo?: Promise<void>;
  private cerrando = false;
  constructor(private readonly lotes: FacturacionLotesService) {}
  onApplicationBootstrap() {
    this.programar(0);
  }
  private programar(ms: number) {
    if (this.cerrando) return;
    this.timer = setTimeout(() => {
      this.activo = this.turno().finally(() => this.programar(1_000));
    }, ms);
  }
  async turno() {
    try {
      const lote = await this.lotes.reclamar();
      if (!lote) return;
      await runWithTenant(lote.tenantId, async () => {
        let perdido = false;
        const renovacion = setInterval(() => {
          void this.lotes
            .renovar(lote)
            .then((ok) => {
              perdido ||= !ok;
            })
            .catch(() => {
              perdido = true;
            });
        }, 15_000);
        renovacion.unref();
        try {
          if (!perdido) await this.lotes.procesar(lote);
        } finally {
          clearInterval(renovacion);
          // Sólo el propietario puede liberar. Si murió, el lease vence solo.
          await this.lotes.liberar(lote);
        }
      });
    } catch (error) {
      reportarFallo(error, {
        area: 'administracion',
        operacion: 'cola',
        cola: 'facturacion',
        etapa: 'worker',
      });
      this.logger.error(textoErrorLog(error));
    }
  }
  async onApplicationShutdown() {
    this.cerrando = true;
    clearTimeout(this.timer);
    await this.activo;
  }
}
