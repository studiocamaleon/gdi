import { Module } from '@nestjs/common';

import { ArchivosController } from './archivos.controller';
import { ArchivosLocalController } from './archivos-local.controller';
import { ArchivosScheduler } from './archivos.scheduler';
import { ArchivosService } from './archivos.service';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [ArchivosController, ArchivosLocalController],
  providers: [ArchivosService, ArchivosScheduler],
  // Presupuestos (logo en el PDF) y Tenants (definir el logo) lo consumen.
  exports: [ArchivosService],
})
export class ArchivosModule {}
