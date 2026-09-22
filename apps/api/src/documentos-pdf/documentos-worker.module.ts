import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ArchivosModule } from '../archivos/archivos.module';
import { TenantConcurrencyService } from '../workers/tenant-concurrency.service';
import { PresupuestoRenderService } from '../presupuestos/pdf-piloto/presupuesto-render.service';
import { DocumentosPdfWorker } from './documentos-pdf.worker';

// Sin AppModule, motor de cotización ni ScheduleModule: proceso dedicado a PDF.
@Module({
  imports: [
    CapacidadesEmpresaModule,
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ArchivosModule,
  ],
  providers: [
    TenantConcurrencyService,
    PresupuestoRenderService,
    DocumentosPdfWorker,
  ],
})
export class DocumentosWorkerModule {}
