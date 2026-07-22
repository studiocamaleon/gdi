import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { ArchivosService } from './archivos.service';

/**
 * Higiene del storage. Dos barridos, misma corrida nocturna:
 *
 *  - PENDIENTE viejo: el usuario pidió la URL firmada y abandonó la subida.
 *    La fila queda reservada y el objeto puede o no existir; se van los dos.
 *  - Papelera vencida: borrado lógico de hace más de un mes. Recién acá el
 *    objeto se va del bucket de verdad.
 *
 * Corre SIN contexto de tenant a propósito: el tenant-guard de Prisma no
 * inyecta nada y las queries ven todas las filas, que es lo que hace falta
 * para un barrido global. Mismo patrón que AcreditacionesScheduler.
 */
@Injectable()
export class ArchivosScheduler {
  private readonly logger = new Logger(ArchivosScheduler.name);
  private corriendo = false;

  constructor(private readonly archivos: ArchivosService) {}

  @Cron('0 4 * * *', { name: 'higiene-archivos' })
  async higiene(): Promise<void> {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      const pendientes = await this.archivos.barrerPendientes();
      const purgados = await this.archivos.purgarPapelera();
      // Al final: recién después de purgar tiene sentido recontar.
      const corregidos = await this.archivos.resincronizarContadores();
      if (pendientes > 0 || purgados > 0 || corregidos > 0) {
        this.logger.log(
          `Higiene de archivos: ${pendientes} subidas abandonadas, ${purgados} de papelera, ${corregidos} contadores corregidos.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Falló la higiene de archivos.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.corriendo = false;
    }
  }
}
